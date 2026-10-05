import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CalendarDays, Check, CreditCard, Truck } from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { readStoredObject, writeStoredValue } from '../utils/storage';
import { formatDay } from '../utils/dates';

const steps = ['Delivery address', 'Delivery & payment', 'Order review'];
const paymentOptions = [
  { id: 'Razorpay', label: 'Online payment', detail: 'Pay securely with UPI, card, net banking, or wallet.', icon: CreditCard },
  { id: 'Cash on Delivery', label: 'Cash on Delivery', detail: 'Pay when your order is delivered.', icon: Banknote },
];
const emptyAddress = { line1: '', city: '', state: '', pincode: '', phone: '' };

// Checkout owns card collection. We never handle or persist card details here.
const paymentFailureMessage = (response) => {
  const gatewayError = response?.error;
  const description = typeof gatewayError?.description === 'string' ? gatewayError.description.trim() : '';
  const reason = typeof gatewayError?.reason === 'string' ? gatewayError.reason.trim() : '';
  const detail = [description, reason].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' ');
  return detail ? `Payment failed: ${detail}` : 'Payment failed. If you are testing, use Razorpay Test Mode payment details rather than a real card.';
};

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve();
    return;
  }

  const existingScript = document.querySelector('script[data-razorpay-checkout]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(), { once: true });
    existingScript.addEventListener('error', () => reject(new Error('Razorpay Checkout could not be loaded')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded'));
  document.body.appendChild(script);
});

const Checkout = () => {
  const { items, total, refreshCart, clearCartLocal } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(() => ({ ...emptyAddress, ...readStoredObject('shopnowAddress') }));
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [couponInfo, setCouponInfo] = useState(null);
  const [useCoupon, setUseCoupon] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState(null); // { earliest, maxDate, items }
  const [deliveryMode, setDeliveryMode] = useState('earliest'); // 'earliest' | 'schedule'
  const [scheduledDate, setScheduledDate] = useState('');
  const paymentSucceeded = useRef(false);
  const cancellationStarted = useRef(false);
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);
    const discount = items.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.product.discountPercent || 0) / 100 * item.quantity, 0);
    const itemsTotal = Number(total || 0);
    const delivery = itemsTotal >= 2000 ? 0 : 99;
    const tax = Math.max(0, itemsTotal - (subtotal - discount));
    const couponDiscount = useCoupon && couponInfo?.eligible ? Number(couponInfo.discount || 0) : 0;
    return { subtotal, discount, tax, delivery, couponDiscount, total: itemsTotal - couponDiscount + delivery };
  }, [items, total, couponInfo, useCoupon]);

  useEffect(() => {
    if (items.length) api.get('/orders/coupon').then(({ data }) => setCouponInfo(data)).catch(() => setCouponInfo(null));
  }, [items.length]);

  const loadEstimate = useCallback(() => api.get('/orders/delivery-estimate')
    .then(({ data }) => setEstimate(data))
    .catch(() => setEstimate(null)), []);

  useEffect(() => {
    if (items.length) void loadEstimate();
  }, [items.length, loadEstimate]);

  // Date sent to the server: only when the customer chose a fixed date.
  const requestedDate = deliveryMode === 'schedule' && scheduledDate ? scheduledDate : undefined;
  const deliveryLabel = requestedDate
    ? `Scheduled for ${formatDay(requestedDate, true)}`
    : estimate ? `Estimated by ${formatDay(estimate.earliest, true)}` : '';
  const hasFastTrack = Boolean(estimate?.items?.some((item) => item.fastTracked));

  const goToReview = () => {
    setError('');
    if (deliveryMode === 'schedule' && !scheduledDate) {
      setError('Pick a delivery date, or choose the earliest delivery.');
      return;
    }
    setStep(2);
  };

  const [saved, setSaved] = useState([]);
  useEffect(() => {
    api.get('/addresses').then(({ data }) => {
      setSaved(data);
      const def = data.find((a) => a.isDefault);
      if (def && !readStoredObject('shopnowAddress').line1) setAddress({ line1: def.line1, city: def.city, state: def.state, pincode: def.pincode, phone: def.phone });
    }).catch(() => {});
  }, []);
  const applySaved = (a) => setAddress({ line1: a.line1, city: a.city, state: a.state, pincode: a.pincode, phone: a.phone });
  const updateAddress = (event) => setAddress((current) => ({ ...current, [event.target.name]: event.target.value }));

  const continueToPayment = (event) => {
    event.preventDefault();
    setError('');
    if (Object.values(address).some((value) => !String(value).trim())) {
      setError('Complete every delivery address field to continue.');
      return;
    }
    writeStoredValue('shopnowAddress', address);
    setStep(1);
  };

  const cancelRazorpayOrder = async (orderId) => {
    if (cancellationStarted.current || paymentSucceeded.current) return;
    cancellationStarted.current = true;
    try {
      await api.post(`/orders/${orderId}/payment/cancel`);
      await refreshCart();
    } finally {
      cancellationStarted.current = false;
    }
  };

  const payWithRazorpay = async () => {
    let checkoutOpened = false;
    let localOrderId = '';

    try {
      const { data } = await api.post('/orders/razorpay', { shippingAddress: address, deliveryDate: requestedDate, applyCoupon: summary.couponDiscount > 0 });
      localOrderId = data.orderId;
      await loadRazorpayCheckout();

      const abandonPayment = async (message) => {
        if (paymentSucceeded.current || cancellationStarted.current) return;
        try {
          await cancelRazorpayOrder(localOrderId);
          setError(message);
        } catch (cancelError) {
          setError(cancelError.response?.data?.message || 'We could not cancel the pending payment. Please check your orders.');
        } finally {
          setPlacing(false);
        }
      };

      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: 'SHOP-NOW',
        description: `Order #${data.orderId.slice(-6).toUpperCase()}`,
        order_id: data.razorpayOrder.id,
        prefill: { name: user?.name || '', email: user?.email || '', contact: address.phone },
        notes: { localOrderId: data.orderId },
        theme: { color: '#065f46' },
        handler: async (response) => {
          paymentSucceeded.current = true;
          try {
            const { data: verified } = await api.post('/orders/razorpay/verify', {
              orderId: data.orderId,
              ...response,
            });
            clearCartLocal();
            await refreshCart();
            navigate(`/payment-result/${verified.order._id}`);
          } catch (verificationError) {
            setError(verificationError.response?.data?.message || 'Your payment was received, but confirmation is still pending. Please check your orders before trying again.');
          } finally {
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: () => {
            void abandonPayment('Payment was cancelled. Your items have been returned to your bag.');
          },
        },
      });

      razorpay.on('payment.failed', (response) => {
        // Log only gateway diagnostic metadata. Checkout never exposes card data.
        console.warn('Razorpay payment failed', {
          code: response?.error?.code,
          reason: response?.error?.reason,
          step: response?.error?.step,
        });
        void abandonPayment(`${paymentFailureMessage(response)} Your items have been returned to your bag.`);
      });
      checkoutOpened = true;
      razorpay.open();
    } catch (requestError) {
      if (localOrderId && !paymentSucceeded.current) {
        try {
          await cancelRazorpayOrder(localOrderId);
        } catch {
          // Preserve the original checkout error. The server still has the
          // pending order if it could not be cancelled safely.
        }
      }
      setError(requestError.response?.data?.message || requestError.message || 'We could not start Razorpay payment. Please try again.');
    } finally {
      if (!checkoutOpened) setPlacing(false);
    }
  };

  const placeOrder = async () => {
    setError('');
    setPlacing(true);
    paymentSucceeded.current = false;
    cancellationStarted.current = false;

    if (paymentMethod === 'Razorpay') {
      await payWithRazorpay();
      return;
    }

    try {
      const { data } = await api.post('/orders', { shippingAddress: address, paymentMethod, deliveryDate: requestedDate, applyCoupon: summary.couponDiscount > 0 });
      clearCartLocal();
      await refreshCart();
      navigate(`/payment-result/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not place your order. Please try again.');
      void loadEstimate();
    } finally {
      setPlacing(false);
    }
  };

  if (!items.length) return <div className="section-shell py-16 text-center"><h1 className="text-3xl font-bold">Your bag is empty</h1><p className="mt-2 text-slate-600">Add something you love before checking out.</p><button className="btn btn-primary mt-6" onClick={() => navigate('/products')}>Browse products</button></div>;

  return (
    <div className="section-shell py-8 sm:py-12">
      <button onClick={() => navigate('/cart')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={16} />Back to bag</button>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Secure checkout</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Complete your order</h1></div>
        <ol className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
          {steps.map((label, index) => <li key={label} className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${step >= index ? 'text-emerald-800' : 'text-slate-400'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step > index ? 'bg-emerald-800 text-white' : step === index ? 'border-2 border-emerald-800 text-emerald-800' : 'border border-slate-300'}`}>{step > index ? <Check size={14} /> : index + 1}</span><span>{label}</span></li>)}
        </ol>
      </div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {step === 0 && <form onSubmit={continueToPayment}>
            <h2 className="text-xl font-bold">Delivery address</h2><p className="mt-1 text-sm text-slate-500">Where should we deliver your order?</p>
            {saved.length > 0 && <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Saved addresses">{saved.map((a) => <button type="button" key={a._id} onClick={() => applySaved(a)} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-600"><span className="font-semibold">{a.label}</span><span className="block text-xs text-slate-500">{a.line1}, {a.city}</span></button>)}<Link to="/addresses" className="self-center text-sm font-semibold text-indigo-700">Manage</Link></div>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Street address<input className="input mt-2" autoComplete="street-address" name="line1" value={address.line1} onChange={updateAddress} required /></label>
              <label className="text-sm font-medium text-slate-700">City<input className="input mt-2" autoComplete="address-level2" name="city" value={address.city} onChange={updateAddress} required /></label>
              <label className="text-sm font-medium text-slate-700">State<input className="input mt-2" autoComplete="address-level1" name="state" value={address.state} onChange={updateAddress} required /></label>
              <label className="text-sm font-medium text-slate-700">PIN code<input className="input mt-2" autoComplete="postal-code" inputMode="numeric" name="pincode" value={address.pincode} onChange={updateAddress} required /></label>
              <label className="text-sm font-medium text-slate-700">Phone<input className="input mt-2" autoComplete="tel" inputMode="tel" name="phone" value={address.phone} onChange={updateAddress} required /></label>
            </div>
            <button className="btn btn-primary mt-6 w-full sm:w-auto" type="submit">Continue to payment</button>
          </form>}

          {step === 1 && <div>
            {estimate && <div className="mb-8">
              <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays size={20} className="text-indigo-700" />Delivery date</h2>
              <p className="mt-1 text-sm text-slate-500">Get it as soon as possible, or pick a date that suits you.</p>
              <div className="mt-4 space-y-3">
                <label className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${deliveryMode === 'earliest' ? 'border-indigo-700 bg-indigo-50/60 ring-1 ring-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="deliveryMode" checked={deliveryMode === 'earliest'} onChange={() => setDeliveryMode('earliest')} className="h-4 w-4 accent-indigo-700" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Earliest delivery · {formatDay(estimate.earliest, true)}</span><span className="mt-1 block text-xs text-slate-500">Delivered together on the date the slowest item can arrive.</span></span>
                </label>
                <label className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${deliveryMode === 'schedule' ? 'border-indigo-700 bg-indigo-50/60 ring-1 ring-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="deliveryMode" checked={deliveryMode === 'schedule'} onChange={() => setDeliveryMode('schedule')} className="h-4 w-4 accent-indigo-700" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Choose a delivery date</span><span className="mt-1 block text-xs text-slate-500">Between {formatDay(estimate.earliest)} and {formatDay(estimate.maxDate)}.</span></span>
                </label>
                {deliveryMode === 'schedule' && <input type="date" className="input max-w-xs" aria-label="Delivery date" min={estimate.earliest} max={estimate.maxDate} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />}
              </div>
              {hasFastTrack && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Good news: an earlier date is available because stock was just freed up by a cancelled order.</p>}
              {estimate.items.length > 1 && new Set(estimate.items.map((i) => i.date)).size > 1 && <p className="mt-3 text-xs text-slate-500">Your items have different delivery times: {estimate.items.map((i) => `${i.name} ${formatDay(i.date)}`).join(' · ')}. They ship together on the latest date.</p>}
            </div>}
            <h2 className="text-xl font-bold">Payment method</h2><p className="mt-1 text-sm text-slate-500">Choose how you would like to pay.</p>
            <div className="mt-6 space-y-3">
              {paymentOptions.map(({ id, label, detail, icon: Icon }) => <label key={id} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${paymentMethod === id ? 'border-indigo-700 bg-indigo-50/60 ring-1 ring-indigo-700' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="paymentMethod" value={id} checked={paymentMethod === id} onChange={() => setPaymentMethod(id)} className="h-4 w-4 accent-indigo-700" />
                <Icon size={20} className={paymentMethod === id ? 'text-indigo-700' : 'text-slate-500'} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
              </label>)}
            </div>
            {paymentMethod === 'Razorpay' && <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Razorpay will open its secure checkout for UPI, cards, net banking, and available wallets.</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button className="btn btn-secondary" onClick={() => setStep(0)}>Back to address</button><button className="btn btn-primary" onClick={goToReview}>Review order</button></div>
          </div>}

          {step === 2 && <div>
            <h2 className="text-xl font-bold">Review your order</h2><p className="mt-1 text-sm text-slate-500">Check your delivery details and items before placing.</p>
            <div className="mt-5 rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">Delivering to</h3><button className="text-sm font-semibold text-indigo-700" onClick={() => setStep(0)}>Edit</button></div><p className="mt-2 text-sm leading-6 text-slate-600">{address.line1}<br />{address.city}, {address.state} {address.pincode}<br />{address.phone}</p></div>
            {deliveryLabel && <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">Delivery date</h3><button className="text-sm font-semibold text-indigo-700" onClick={() => setStep(1)}>Edit</button></div><p className="mt-2 text-sm text-slate-600">{deliveryLabel}</p></div>}
            <div className="mt-4 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Payment</h3><button className="text-sm font-semibold text-indigo-700" onClick={() => setStep(1)}>Edit</button></div><p className="mt-2 text-sm text-slate-600">{paymentMethod === 'Razorpay' ? 'Online payment via Razorpay' : paymentMethod}</p>{paymentMethod === 'Cash on Delivery' && <p className="mt-1 text-sm text-slate-500">Pay when your order is delivered.</p>}{paymentMethod === 'Razorpay' && <p className="mt-1 text-sm text-slate-500">You will be redirected to Razorpay's secure checkout.</p>}</div>
            <div className="mt-5 space-y-3">{items.map(({ product, quantity, lineTotal }) => <div key={product._id} className="flex items-center gap-3"><img src={product.image || product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=160&q=80'} alt="" className="h-14 w-14 rounded-lg bg-slate-100 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-slate-500">Quantity {quantity}</p></div><span className="text-sm font-semibold">₹{Number(lineTotal).toFixed(2)}</span></div>)}</div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button className="btn btn-secondary" onClick={() => setStep(1)}>Back to payment</button><button className="btn btn-primary flex-1" onClick={placeOrder} disabled={placing}>{placing ? 'Starting payment…' : `${paymentMethod === 'Razorpay' ? 'Pay securely' : 'Place order'} · ₹${summary.total.toFixed(2)}`}</button></div>
          </div>}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <h2 className="text-lg font-bold">Order summary</h2><div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3 text-slate-600"><span>Subtotal</span><span>₹{summary.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between gap-3 text-emerald-800"><span>Discount</span><span>−₹{summary.discount.toFixed(2)}</span></div>
            {couponInfo?.eligible && couponInfo.discount > 0 && <label className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-green-900"><input type="checkbox" className="mt-1" checked={useCoupon} onChange={(e) => setUseCoupon(e.target.checked)} /><span><span className="font-semibold">{couponInfo.label}: {couponInfo.percent}% off</span><span className="block text-xs">Saves ₹{Number(couponInfo.discount).toFixed(2)} (up to ₹{couponInfo.maxDiscount}).</span></span></label>}
            {couponInfo?.eligible && couponInfo.discount === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{couponInfo.label} ({couponInfo.percent}% off) unlocks on orders of ₹{couponInfo.minOrder} or more.</p>}
            {couponInfo && !couponInfo.eligible && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Your order number {couponInfo.nextRewardOrderNumber} gets a loyalty reward.</p>}
            <div className="flex justify-between gap-3 text-slate-600"><span>Tax</span><span>₹{summary.tax.toFixed(2)}</span></div>
            {summary.couponDiscount > 0 && <div className="flex justify-between gap-3 text-green-800"><span>Coupon ({couponInfo.code})</span><span>−₹{summary.couponDiscount.toFixed(2)}</span></div>}
            <div className="flex justify-between gap-3 text-slate-600"><span>Delivery fee</span><span>{summary.delivery === 0 ? 'Free' : `₹${summary.delivery.toFixed(2)}`}</span></div>
            <div className="border-t border-slate-200 pt-3"><div className="flex justify-between gap-3 text-base font-bold"><span>Total</span><span>₹{summary.total.toFixed(2)}</span></div><p className="mt-1 text-xs text-slate-500">Including applicable taxes</p></div>
          </div>
          {deliveryLabel && <div className="mt-5 flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-xs font-semibold text-indigo-700"><CalendarDays size={16} className="shrink-0" />{deliveryLabel}</div>}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><Truck size={16} className="shrink-0 text-emerald-800" />Free delivery on orders above ₹2,000</div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
