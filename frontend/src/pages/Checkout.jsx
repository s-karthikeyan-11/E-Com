import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  Landmark,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { readStoredObject, writeStoredValue } from '../utils/storage';
import { formatDay } from '../utils/dates';

const emptyAddress = { line1: '', city: '', state: '', pincode: '', phone: '' };

const onlineMethods = [
  { id: 'all', label: 'All Payment Options', icon: ShieldCheck, badge: 'Popular', desc: 'UPI, Cards, Net Banking, Wallets' },
  { id: 'upi', label: 'UPI Instant Pay', icon: Smartphone, badge: 'Fastest', desc: 'Google Pay, PhonePe, Paytm, BHIM' },
  { id: 'card', label: 'Credit / Debit Card', icon: CreditCard, badge: 'Secure', desc: 'Visa, MasterCard, RuPay, Maestro' },
  { id: 'netbanking', label: 'Net Banking', icon: Landmark, badge: '50+ Banks', desc: 'SBI, HDFC, ICICI, Axis, Kotak & more' },
  { id: 'wallet', label: 'Wallets', icon: Wallet, badge: 'Quick', desc: 'Paytm, PhonePe, Mobikwik, Freecharge' },
];

const paymentFailureMessage = (response) => {
  const gatewayError = response?.error;
  const description = typeof gatewayError?.description === 'string' ? gatewayError.description.trim() : '';
  const reason = typeof gatewayError?.reason === 'string' ? gatewayError.reason.trim() : '';
  const detail = [description, reason].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' ');
  return detail ? `Payment failed: ${detail}` : 'Payment could not be completed. Please try again or choose another payment method.';
};

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (typeof window !== 'undefined' && window.Razorpay) {
    resolve();
    return;
  }

  const existingScript = document.querySelector('script[data-razorpay-checkout]');
  if (existingScript) {
    existingScript.remove();
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';

  const timeoutId = setTimeout(() => {
    script.onerror = null;
    script.onload = null;
    reject(new Error('Razorpay Checkout timed out while loading. Please check your internet connection.'));
  }, 10000);

  script.onload = () => {
    clearTimeout(timeoutId);
    if (window.Razorpay) {
      resolve();
    } else {
      reject(new Error('Razorpay script loaded but window.Razorpay is unavailable.'));
    }
  };

  script.onerror = () => {
    clearTimeout(timeoutId);
    script.remove();
    reject(new Error('Failed to load Razorpay Checkout SDK. Please check your network connection.'));
  };

  document.head.appendChild(script);
});

const Checkout = () => {
  const { items, total, refreshCart, clearCartLocal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Accordion Steps: 1: Address, 2: Order Summary, 3: Payment
  const [activeStep, setActiveStep] = useState(1);
  const [address, setAddress] = useState(() => ({ ...emptyAddress, ...readStoredObject('shopnowAddress') }));
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  // Delivery estimation & scheduling
  const [estimate, setEstimate] = useState(null);
  const [deliveryMode, setDeliveryMode] = useState('earliest');
  const [scheduledDate, setScheduledDate] = useState('');

  // Payment Options
  const [paymentType, setPaymentType] = useState('ONLINE'); // 'ONLINE' | 'COD'
  const [selectedOnlineMethod, setSelectedOnlineMethod] = useState('all');
  const [embeddedActive, setEmbeddedActive] = useState(false);
  const [embeddedLoading, setEmbeddedLoading] = useState(false);

  // Coupons & Pricing
  const [couponInfo, setCouponInfo] = useState(null);
  const [useCoupon, setUseCoupon] = useState(true);

  // State & Loading
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const embedContainerRef = useRef(null);
  const activeOrderIdRef = useRef('');
  const paymentSucceeded = useRef(false);
  const cancellationStarted = useRef(false);

  // Calculations
  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);
    const discount = items.reduce(
      (sum, item) => sum + (Number(item.product.price || 0) * Number(item.product.discountPercent || 0) / 100) * item.quantity,
      0
    );
    const itemsTotal = Number(total || 0);
    const delivery = itemsTotal >= 2000 ? 0 : 99;
    const tax = Math.max(0, itemsTotal - (subtotal - discount));
    const couponDiscount = useCoupon && couponInfo?.eligible ? Number(couponInfo.discount || 0) : 0;
    const grandTotal = Math.max(0, itemsTotal - couponDiscount + delivery);
    const totalSavings = discount + couponDiscount + (itemsTotal >= 2000 ? 99 : 0);

    return {
      subtotal,
      discount,
      tax,
      delivery,
      couponDiscount,
      total: grandTotal,
      totalSavings,
    };
  }, [items, total, couponInfo, useCoupon]);

  // Load saved addresses
  useEffect(() => {
    api.get('/addresses')
      .then(({ data }) => {
        setSavedAddresses(data);
        const def = data.find((a) => a.isDefault);
        const stored = readStoredObject('shopnowAddress');
        if (!stored.line1 && def) {
          setAddress({ line1: def.line1, city: def.city, state: def.state, pincode: def.pincode, phone: def.phone });
        }
      })
      .catch(() => {});
  }, []);

  // Load Coupon Info
  useEffect(() => {
    if (items.length) {
      api.get('/orders/coupon')
        .then(({ data }) => setCouponInfo(data))
        .catch(() => setCouponInfo(null));
    }
  }, [items.length]);

  // Load Delivery Estimate
  const loadEstimate = useCallback(() => {
    api.get('/orders/delivery-estimate')
      .then(({ data }) => setEstimate(data))
      .catch(() => setEstimate(null));
  }, []);

  useEffect(() => {
    if (items.length) void loadEstimate();
  }, [items.length, loadEstimate]);

  const requestedDate = deliveryMode === 'schedule' && scheduledDate ? scheduledDate : undefined;
  const deliveryLabel = requestedDate
    ? `Scheduled for ${formatDay(requestedDate, true)}`
    : estimate ? `Estimated by ${formatDay(estimate.earliest, true)}` : '';
  const hasFastTrack = Boolean(estimate?.items?.some((item) => item.fastTracked));

  const applySavedAddress = (a) => {
    setAddress({ line1: a.line1, city: a.city, state: a.state, pincode: a.pincode, phone: a.phone });
  };

  const updateAddressField = (event) => {
    setAddress((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const confirmAddressAndProceed = (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!address.line1.trim() || !address.city.trim() || !address.state.trim() || !address.pincode.trim() || !address.phone.trim()) {
      setError('Please fill in all address fields to continue.');
      return;
    }
    writeStoredValue('shopnowAddress', address);
    setAddressConfirmed(true);
    setActiveStep(2); // move to Order Summary
  };

  // Safe cancellation helper
  const cancelRazorpayOrder = async (orderId, reason = '') => {
    if (cancellationStarted.current || paymentSucceeded.current || !orderId) return;
    cancellationStarted.current = true;
    try {
      await api.post(`/orders/${orderId}/payment/cancel`, { reason });
      await refreshCart();
    } catch {
      // rollback logging
    } finally {
      cancellationStarted.current = false;
    }
  };

  // Remove existing Razorpay frame from DOM
  const clearGatewayFrames = () => {
    document.querySelectorAll('iframe.razorpay-checkout-frame, .razorpay-backdrop').forEach((el) => el.remove());
  };

  // Pinned iframe geometry synchronizer: locks iframe directly into our in-page container
  const syncFrameGeometry = useCallback(() => {
    const container = embedContainerRef.current;
    const iframe = document.querySelector('iframe.razorpay-checkout-frame');
    const backdrop = document.querySelector('.razorpay-backdrop');

    if (backdrop) {
      backdrop.style.setProperty('display', 'none', 'important');
      backdrop.style.setProperty('opacity', '0', 'important');
      backdrop.style.setProperty('visibility', 'hidden', 'important');
      backdrop.style.setProperty('pointer-events', 'none', 'important');
    }

    if (!container || !iframe) return;

    const rect = container.getBoundingClientRect();

    if (rect.bottom < 40 || rect.top > window.innerHeight - 40) {
      iframe.style.setProperty('visibility', 'hidden', 'important');
    } else {
      iframe.style.setProperty('visibility', 'visible', 'important');
    }

    iframe.style.setProperty('position', 'fixed', 'important');
    iframe.style.setProperty('top', `${Math.max(0, rect.top)}px`, 'important');
    iframe.style.setProperty('left', `${Math.max(0, rect.left)}px`, 'important');
    iframe.style.setProperty('width', `${rect.width}px`, 'important');
    iframe.style.setProperty('height', `${rect.height}px`, 'important');
    iframe.style.setProperty('z-index', '30', 'important');
    iframe.style.setProperty('border-radius', '16px', 'important');
    iframe.style.setProperty('border', 'none', 'important');
    iframe.style.setProperty('overflow', 'hidden', 'important');
    setEmbeddedLoading(false);
  }, []);

  // Listeners for in-page embedded positioning
  useEffect(() => {
    if (!embeddedActive) return;

    const observer = new MutationObserver(() => {
      syncFrameGeometry();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const intervalId = setInterval(syncFrameGeometry, 120);
    window.addEventListener('scroll', syncFrameGeometry, { passive: true });
    window.addEventListener('resize', syncFrameGeometry, { passive: true });

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
      window.removeEventListener('scroll', syncFrameGeometry);
      window.removeEventListener('resize', syncFrameGeometry);
    };
  }, [embeddedActive, syncFrameGeometry]);

  // Clean up gateway frames when component unmounts
  useEffect(() => {
    return () => {
      clearGatewayFrames();
    };
  }, []);

  // Launch Razorpay Embedded Payment
  const initiateEmbeddedPayment = async (methodOverride) => {
    setError('');
    const targetMethod = methodOverride || selectedOnlineMethod;
    if (methodOverride) {
      setSelectedOnlineMethod(methodOverride);
    }

    // If an existing embedded session was open, safely cancel previous order first
    if (activeOrderIdRef.current && !paymentSucceeded.current) {
      await cancelRazorpayOrder(activeOrderIdRef.current, 'Customer started new payment attempt');
      activeOrderIdRef.current = '';
    }
    clearGatewayFrames();

    setEmbeddedActive(true);
    setEmbeddedLoading(true);
    paymentSucceeded.current = false;
    cancellationStarted.current = false;

    // Scroll smoothly to embed container
    setTimeout(() => {
      embedContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    let localOrderId = '';

    try {
      await loadRazorpayCheckout();

      const { data } = await api.post('/orders/razorpay', {
        shippingAddress: address,
        deliveryDate: requestedDate,
        applyCoupon: summary.couponDiscount > 0,
      });

      localOrderId = data.orderId;
      activeOrderIdRef.current = localOrderId;

      const prefillConfig = {
        name: user?.name || '',
        email: user?.email || '',
        contact: address.phone || '',
      };

      if (targetMethod && targetMethod !== 'all') {
        prefillConfig.method = targetMethod;
      }

      const options = {
        key: data.keyId,
        amount: data.razorpayOrder.amount,
        currency: data.razorpayOrder.currency,
        name: 'SHOPPING-NOW',
        description: `Order #${data.orderId.slice(-6).toUpperCase()}`,
        order_id: data.razorpayOrder.id,
        prefill: prefillConfig,
        notes: {
          localOrderId: data.orderId,
          methodChoice: targetMethod,
        },
        theme: {
          color: '#4338ca', // Indigo-700
        },
        modal: {
          ondismiss: async () => {
            setEmbeddedActive(false);
            setEmbeddedLoading(false);
            clearGatewayFrames();
            await cancelRazorpayOrder(localOrderId, 'Embedded checkout dismissed by customer');
          },
        },
        handler: async (response) => {
          paymentSucceeded.current = true;
          setEmbeddedLoading(true);
          clearGatewayFrames();
          try {
            const { data: verified } = await api.post('/orders/razorpay/verify', {
              orderId: data.orderId,
              ...response,
            });
            clearCartLocal();
            await refreshCart();
            navigate(`/payment-result/${verified.order._id}`);
          } catch (verificationError) {
            setError(
              verificationError.response?.data?.message ||
              'Your payment was processed, but order confirmation is taking longer than expected. Please verify your order in Order History.'
            );
            setEmbeddedActive(false);
            setEmbeddedLoading(false);
          }
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', async (response) => {
        console.warn('Razorpay payment failed:', response);
        try {
          await api.post(`/orders/${data.orderId}/payment/failed`, {
            paymentId: response?.error?.metadata?.payment_id,
            errorDescription: response?.error?.description || response?.error?.reason,
          });
        } catch (err) {
          void err;
        }

        const failMessage = paymentFailureMessage(response);
        setError(`${failMessage} Your cart items remain safe.`);
        setEmbeddedActive(false);
        setEmbeddedLoading(false);
        clearGatewayFrames();
        await cancelRazorpayOrder(localOrderId, failMessage);
      });

      razorpayInstance.open();
    } catch (err) {
      if (localOrderId && !paymentSucceeded.current) {
        await cancelRazorpayOrder(localOrderId, 'Checkout initialization failed');
      }
      clearGatewayFrames();
      setEmbeddedActive(false);
      setEmbeddedLoading(false);
      setError(err.response?.data?.message || err.message || 'Could not initialize payment. Please try again.');
    }
  };

  // Cancel embedded frame and restore selection
  const handleDismissEmbedded = async () => {
    if (activeOrderIdRef.current && !paymentSucceeded.current) {
      await cancelRazorpayOrder(activeOrderIdRef.current, 'Customer cancelled embedded payment');
      activeOrderIdRef.current = '';
    }
    clearGatewayFrames();
    setEmbeddedActive(false);
    setEmbeddedLoading(false);
  };

  // Place Cash on Delivery Order
  const handlePlaceCodOrder = async () => {
    setError('');
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', {
        shippingAddress: address,
        paymentMethod: 'Cash on Delivery',
        deliveryDate: requestedDate,
        applyCoupon: summary.couponDiscount > 0,
      });
      clearCartLocal();
      await refreshCart();
      navigate(`/payment-result/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place Cash on Delivery order.');
      void loadEstimate();
    } finally {
      setPlacing(false);
    }
  };

  if (!items.length) {
    return (
      <div className="section-shell py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Truck size={36} />
        </div>
        <h1 className="mt-5 text-3xl font-bold text-slate-900">Your shopping bag is empty</h1>
        <p className="mt-2 text-slate-600">Explore our curated collection and add products to begin checkout.</p>
        <button className="btn btn-primary mt-6" onClick={() => navigate('/products')}>
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="section-shell py-6 sm:py-10">
      {/* Top Breadcrumb & Trust Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/cart')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          <ArrowLeft size={16} /> Back to Bag
        </button>
        <div className="flex items-center gap-3 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck size={16} className="text-emerald-700" />
          <span>100% Safe & Secure Checkout · Razorpay 256-Bit SSL</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to proceed</p>
            <p className="mt-0.5 text-rose-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Main 2-Column Checkout Layout */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left Column: Flipkart / Amazon Style Accordion Cards */}
        <div className="space-y-5">
          {/* STEP 1: DELIVERY ADDRESS */}
          <section className="card overflow-hidden transition-all duration-300">
            <header className="flex items-center justify-between bg-slate-50/70 px-5 py-4 border-b border-slate-100 sm:px-6">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  addressConfirmed ? 'bg-emerald-600 text-white' : 'bg-indigo-700 text-white'
                }`}>
                  {addressConfirmed ? <Check size={16} /> : '1'}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">Delivery Address</h2>
                  {addressConfirmed && (
                    <p className="text-xs text-slate-500 truncate max-w-sm sm:max-w-md">
                      {address.line1}, {address.city}, {address.pincode}
                    </p>
                  )}
                </div>
              </div>
              {addressConfirmed && activeStep !== 1 && (
                <button
                  onClick={() => {
                    setActiveStep(1);
                    if (embeddedActive) handleDismissEmbedded();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-sm hover:bg-slate-50 hover:border-indigo-300"
                >
                  Change
                </button>
              )}
            </header>

            {activeStep === 1 && (
              <div className="p-5 sm:p-6">
                {savedAddresses.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">Saved Addresses</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {savedAddresses.map((a) => (
                        <button
                          type="button"
                          key={a._id}
                          onClick={() => applySavedAddress(a)}
                          className={`flex flex-col text-left rounded-xl border p-3.5 transition ${
                            address.line1 === a.line1 && address.pincode === a.pincode
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">{a.label || 'Home'}</span>
                          <span className="mt-1 text-sm font-semibold text-slate-900">{a.line1}</span>
                          <span className="text-xs text-slate-500">{a.city}, {a.state} - {a.pincode}</span>
                          <span className="mt-1 text-xs text-slate-600 font-medium">📞 {a.phone}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={confirmAddressAndProceed} className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {savedAddresses.length > 0 ? 'Or enter delivery details' : 'Enter shipping details'}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Street Address *
                      </label>
                      <input
                        className="input"
                        autoComplete="street-address"
                        name="line1"
                        placeholder="House / Flat No., Street, Landmark"
                        value={address.line1}
                        onChange={updateAddressField}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        City *
                      </label>
                      <input
                        className="input"
                        autoComplete="address-level2"
                        name="city"
                        placeholder="City / District"
                        value={address.city}
                        onChange={updateAddressField}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        State *
                      </label>
                      <input
                        className="input"
                        autoComplete="address-level1"
                        name="state"
                        placeholder="State"
                        value={address.state}
                        onChange={updateAddressField}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        PIN Code *
                      </label>
                      <input
                        className="input"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        name="pincode"
                        placeholder="6-digit PIN"
                        value={address.pincode}
                        onChange={updateAddressField}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                        Mobile Phone *
                      </label>
                      <input
                        className="input"
                        autoComplete="tel"
                        inputMode="tel"
                        name="phone"
                        placeholder="10-digit mobile number"
                        value={address.phone}
                        onChange={updateAddressField}
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="submit" className="btn btn-primary w-full sm:w-auto px-8">
                      Deliver Here & Continue <ChevronRight size={16} className="ml-1" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          {/* STEP 2: ORDER SUMMARY & DELIVERY SCHEDULE */}
          <section className="card overflow-hidden transition-all duration-300">
            <header className="flex items-center justify-between bg-slate-50/70 px-5 py-4 border-b border-slate-100 sm:px-6">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  activeStep > 2 ? 'bg-emerald-600 text-white' : activeStep === 2 ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeStep > 2 ? <Check size={16} /> : '2'}
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">Order Summary</h2>
                  <p className="text-xs text-slate-500">
                    {items.length} {items.length === 1 ? 'item' : 'items'} in your order
                    {deliveryLabel ? ` · ${deliveryLabel}` : ''}
                  </p>
                </div>
              </div>
              {addressConfirmed && activeStep !== 2 && (
                <button
                  onClick={() => {
                    setActiveStep(2);
                    if (embeddedActive) handleDismissEmbedded();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-sm hover:bg-slate-50 hover:border-indigo-300"
                >
                  View Items
                </button>
              )}
            </header>

            {activeStep === 2 && (
              <div className="p-5 sm:p-6 space-y-6">
                {/* Delivery Date Preference */}
                {estimate && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CalendarDays size={18} className="text-indigo-700" />
                      <h3 className="text-sm font-bold text-slate-900">Delivery Schedule</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 bg-white transition ${
                        deliveryMode === 'earliest' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="deliveryMode"
                          checked={deliveryMode === 'earliest'}
                          onChange={() => setDeliveryMode('earliest')}
                          className="mt-1 h-4 w-4 accent-indigo-700"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">Earliest Guaranteed Delivery</span>
                          <span className="text-xs text-emerald-700 font-semibold">{formatDay(estimate.earliest, true)}</span>
                        </div>
                      </label>

                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 bg-white transition ${
                        deliveryMode === 'schedule' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <input
                          type="radio"
                          name="deliveryMode"
                          checked={deliveryMode === 'schedule'}
                          onChange={() => setDeliveryMode('schedule')}
                          className="mt-1 h-4 w-4 accent-indigo-700"
                        />
                        <div className="w-full">
                          <span className="block text-xs font-bold text-slate-900">Select Custom Delivery Date</span>
                          <span className="text-xs text-slate-500">Choose between available slots</span>
                          {deliveryMode === 'schedule' && (
                            <input
                              type="date"
                              className="input mt-2 py-1.5 text-xs"
                              min={estimate.earliest}
                              max={estimate.maxDate}
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                            />
                          )}
                        </div>
                      </label>
                    </div>

                    {hasFastTrack && (
                      <p className="mt-3 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        ⚡ Fast-track delivery active: slot released by a recent cancellation.
                      </p>
                    )}
                  </div>
                )}

                {/* Items Preview */}
                <div className="divide-y divide-slate-100">
                  {items.map(({ product, quantity, lineTotal }) => (
                    <div key={product._id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={product.image || product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=160&q=80'}
                          alt={product.name}
                          className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover border border-slate-200"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{product.name}</p>
                          <p className="text-xs text-slate-500">Category: {product.category || 'General'}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Qty: <span className="font-semibold text-slate-900">{quantity}</span> × ₹{Number(product.price).toFixed(2)}
                            {Number(product.discountPercent) > 0 && (
                              <span className="ml-2 text-emerald-700 font-semibold">{product.discountPercent}% OFF</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 text-sm">₹{Number(lineTotal).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="btn btn-secondary text-xs"
                  >
                    Back to Address
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (deliveryMode === 'schedule' && !scheduledDate) {
                        setError('Please select a preferred scheduled date or switch to earliest delivery.');
                        return;
                      }
                      setActiveStep(3);
                    }}
                    className="btn btn-primary text-sm px-8"
                  >
                    Continue to Payment <ChevronRight size={16} className="ml-1" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: PAYMENT OPTIONS & IN-PAGE EMBEDDED RAZORPAY */}
          <section className="card overflow-hidden transition-all duration-300">
            <header className="flex items-center justify-between bg-slate-50/70 px-5 py-4 border-b border-slate-100 sm:px-6">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  activeStep === 3 ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  3
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">Payment Options</h2>
                  <p className="text-xs text-slate-500">Embedded secure payment · No popups or redirects</p>
                </div>
              </div>
            </header>

            {activeStep === 3 && (
              <div className="p-5 sm:p-6 space-y-6">
                {/* Method Chooser: Online Payment vs Cash on Delivery */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4.5 transition ${
                    paymentType === 'ONLINE'
                      ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="paymentType"
                      checked={paymentType === 'ONLINE'}
                      onChange={() => {
                        setPaymentType('ONLINE');
                      }}
                      className="mt-1 h-4 w-4 accent-indigo-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Online Payment</span>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                          Razorpay
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        Pay securely with UPI, Credit/Debit Cards, Net Banking, or Wallets right inside this page.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs">
                          ⚡ UPI
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs">
                          💳 Cards
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs">
                          🏦 Net Banking
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs">
                          👛 Wallets
                        </span>
                      </div>
                    </div>
                  </label>

                  <label className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4.5 transition ${
                    paymentType === 'COD'
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="paymentType"
                      checked={paymentType === 'COD'}
                      onChange={() => {
                        setPaymentType('COD');
                        if (embeddedActive) handleDismissEmbedded();
                      }}
                      className="mt-1 h-4 w-4 accent-emerald-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Cash on Delivery</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                          COD
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        Pay with cash or UPI QR code at your doorstep when your delivery arrives.
                      </p>
                    </div>
                  </label>
                </div>

                {/* ONLINE PAYMENT: EMBEDDED RAZORPAY SECTION */}
                {paymentType === 'ONLINE' && (
                  <div className="rounded-2xl border border-indigo-100 bg-slate-50/60 p-5 sm:p-6 space-y-5">
                    {/* Payment Header with Security Trust */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Lock size={16} className="text-indigo-700" />
                          Select Payment Method & Pay In-Page
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          The payment gateway interface will render embedded directly below
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                        Total Payable: <strong className="text-indigo-700">₹{summary.total.toFixed(2)}</strong>
                      </span>
                    </div>

                    {/* Method Selector Chips */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                        Preferred Gateway Instrument:
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {onlineMethods.map((m) => {
                          const Icon = m.icon;
                          const isSelected = selectedOnlineMethod === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedOnlineMethod(m.id);
                                if (embeddedActive) {
                                  void initiateEmbeddedPayment(m.id);
                                }
                              }}
                              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                                isSelected
                                  ? 'border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <Icon size={18} className={isSelected ? 'text-indigo-700 mt-0.5' : 'text-slate-400 mt-0.5'} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                                    {m.label}
                                  </span>
                                  {m.badge && (
                                    <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                                      {m.badge}
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[11px] text-slate-500 truncate">{m.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* EMBEDDED RAZORPAY FRAME CONTAINER */}
                    <div
                      ref={embedContainerRef}
                      id="razorpay-embed-frame-container"
                      className={`relative w-full rounded-2xl border transition-all duration-300 ${
                        embeddedActive
                          ? 'min-h-[580px] bg-white border-indigo-200 shadow-md ring-4 ring-indigo-500/10'
                          : 'min-h-[220px] bg-white border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center'
                      }`}
                    >
                      {/* State 1: When embedded payment is NOT active yet */}
                      {!embeddedActive && (
                        <div className="max-w-md space-y-4 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                            <Lock size={26} />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900">
                              Ready to Pay ₹{summary.total.toFixed(2)}
                            </h4>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                              Click below to initialize the Razorpay payment interface inside this checkout box. No popups or redirects.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void initiateEmbeddedPayment(selectedOnlineMethod)}
                            className="btn btn-primary px-8 py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                          >
                            Proceed to Pay ₹{summary.total.toFixed(2)}
                          </button>
                        </div>
                      )}

                      {/* State 2: When embedded payment is active and loading */}
                      {embeddedActive && embeddedLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-2xl z-20 space-y-3">
                          <RefreshCw size={28} className="animate-spin text-indigo-700" />
                          <p className="text-sm font-bold text-slate-900">Connecting to Razorpay Embedded Gateway…</p>
                          <p className="text-xs text-slate-500">Preparing secure encryption channel</p>
                        </div>
                      )}

                      {/* State 3: Embedded Top Bar when active */}
                      {embeddedActive && (
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 rounded-t-2xl">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <ShieldCheck size={16} className="text-emerald-600" />
                            <span>Razorpay PCI-DSS Level 1 Encrypted</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleDismissEmbedded}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                          >
                            Cancel Payment
                          </button>
                        </div>
                      )}
                    </div>

                    {embeddedActive && (
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>🔒 256-Bit End-to-End Encryption</span>
                        <button
                          type="button"
                          onClick={handleDismissEmbedded}
                          className="font-semibold text-slate-600 hover:text-slate-900 underline"
                        >
                          Change Method / Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CASH ON DELIVERY SECTION */}
                {paymentType === 'COD' && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <Banknote size={24} className="text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Confirm Cash on Delivery</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Please keep exact cash (₹{summary.total.toFixed(2)}) or scan the delivery executive’s UPI QR code at the time of delivery.
                        </p>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handlePlaceCodOrder}
                        disabled={placing}
                        className="btn bg-emerald-700 text-white hover:bg-emerald-800 px-8 py-3 text-sm font-bold shadow-md w-full sm:w-auto"
                      >
                        {placing ? 'Placing Order…' : `Confirm COD Order · ₹${summary.total.toFixed(2)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Sticky Amazon / Flipkart Price Details Sidebar */}
        <aside className="card p-5 sm:p-6 lg:sticky lg:top-24 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
            Price Details
          </h2>

          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Price ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
              <span className="font-semibold text-slate-900">₹{summary.subtotal.toFixed(2)}</span>
            </div>

            {summary.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Product Discount</span>
                <span className="font-semibold">−₹{summary.discount.toFixed(2)}</span>
              </div>
            )}

            {/* Loyalty Coupon */}
            {couponInfo?.eligible && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCoupon}
                    onChange={(e) => setUseCoupon(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-700"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-950 block">
                      {couponInfo.label} ({couponInfo.code})
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Saves ₹{Number(couponInfo.discount || 0).toFixed(2)} on this order
                    </span>
                  </div>
                </label>
              </div>
            )}

            {useCoupon && summary.couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Coupon Savings</span>
                <span className="font-semibold">−₹{summary.couponDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Delivery Charges</span>
              {summary.delivery === 0 ? (
                <span className="font-bold text-emerald-700 uppercase text-xs">FREE</span>
              ) : (
                <span className="font-semibold text-slate-900">₹{summary.delivery.toFixed(2)}</span>
              )}
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Estimated Taxes (GST)</span>
              <span className="font-semibold text-slate-900">₹{summary.tax.toFixed(2)}</span>
            </div>

            <div className="border-t border-slate-200 pt-3.5 flex justify-between items-baseline">
              <div>
                <span className="text-base font-bold text-slate-900">Total Payable</span>
                <p className="text-[11px] text-slate-500">Inclusive of all taxes</p>
              </div>
              <span className="text-xl font-extrabold text-slate-950">
                ₹{summary.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Savings Highlight */}
          {summary.totalSavings > 0 && (
            <div className="rounded-xl bg-emerald-100/70 border border-emerald-200 p-3 text-center">
              <p className="text-xs font-bold text-emerald-900">
                🎉 You will save ₹{summary.totalSavings.toFixed(2)} on this order!
              </p>
            </div>
          )}

          {/* Trust Guarantees */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-700 shrink-0" />
              <span>Safe and secure payments powered by Razorpay</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-emerald-700 shrink-0" />
              <span>Free delivery on all orders above ₹2,000</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
