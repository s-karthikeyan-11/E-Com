import React, { useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../api/axios';
import OrderTracker from '../components/OrderTracker';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import ReorderButton from '../components/ReorderButton';

const OrderDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canCancel = order && order.paymentMethod === 'Cash on Delivery' && ['Pending', 'Processing'].includes(order.status);
  const cancelOrder = async () => {
    setCancelling(true);
    setActionError('');
    try {
      const { data } = await api.post(`/orders/${id}/cancel`);
      setOrder((current) => ({ ...current, ...data }));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not cancel this order');
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  useEffect(() => { api.get(`/orders/${id}`).then(({ data }) => setOrder(data)).catch((err) => setError(err.response?.data?.message || 'Could not load this order')); }, [id]);

  if (error) return <div className="section-shell py-16 text-center"><h1 className="text-2xl font-bold">Order unavailable</h1><p className="mt-2 text-slate-600">{error}</p><Link className="btn btn-primary mt-5" to="/orders">View my orders</Link></div>;
  if (!order) return <div className="section-shell py-16"><div className="mx-auto h-64 max-w-2xl animate-pulse rounded-2xl bg-slate-200" /></div>;

  const originalSubtotal = order.items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const discount = order.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.discountPercent || 0) / 100 * item.quantity, 0);

  return <div className="section-shell py-8 sm:py-12">
    {location.state?.success && <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 size={34} className="mx-auto text-emerald-700" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Order confirmed</p><h1 className="mt-2 text-2xl font-bold">Thank you for your order</h1><p className="mt-2 text-sm text-slate-600">Your order ID is <strong>#{order._id.toUpperCase()}</strong></p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link className="btn btn-primary" to="/orders">Track order</Link><Link className="btn btn-secondary" to="/products">Continue shopping</Link></div></div>}
    <div className="mx-auto max-w-3xl"><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Order details</p><h1 className="mt-2 text-3xl font-bold">#{order._id.toUpperCase()}</h1></div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={order.status} /><StatusBadge kind="payment" status={order.paymentStatus} />{canCancel && <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(true)} disabled={cancelling}>Cancel order</button>}<ReorderButton order={order} /></div></div>
      {actionError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
      <OrderTracker order={order} />
      {order.walletRefund?.creditedAt && <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Refund added to your wallet</p><p className="mt-1 text-emerald-800">₹{Number(order.walletRefund.amount).toFixed(2)} was credited on {new Date(order.walletRefund.creditedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.</p></div><Link className="btn btn-secondary shrink-0" to="/wallet">View wallet</Link></div>}
      <ConfirmDialog open={confirmOpen} busy={cancelling} danger title="Cancel this order?" message="This cannot be undone. Items go back to stock. You can reorder within 24 hours of cancelling." confirmLabel="Cancel order" onConfirm={cancelOrder} onCancel={() => setConfirmOpen(false)} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><PackageCheck size={20} className="text-emerald-800" /><h2 className="text-lg font-bold">Items in this order</h2></div><div className="mt-5 divide-y divide-slate-100">{order.items.map((item, index) => <div key={`${item.product}-${index}`} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-slate-500">Quantity {item.quantity}</p></div><span className="shrink-0 font-semibold">₹{Number(item.lineTotal || 0).toFixed(2)}</span></div>)}</div>
        <div className="mt-4 grid gap-6 border-t border-slate-200 pt-5 sm:grid-cols-2"><div><h3 className="text-sm font-semibold">Delivery address</h3><p className="mt-2 text-sm leading-6 text-slate-600">{order.shippingAddress?.line1}<br />{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}<br />{order.shippingAddress?.phone}</p></div><div><h3 className="text-sm font-semibold">Payment method</h3><p className="mt-2 text-sm text-slate-600">{order.paymentMethod || 'Cash on Delivery'}</p></div></div>
        <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 text-sm"><div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{originalSubtotal.toFixed(2)}</span></div><div className="flex justify-between text-emerald-800"><span>Discount</span><span>−₹{discount.toFixed(2)}</span></div><div className="flex justify-between text-slate-600"><span>Tax</span><span>₹{Number(order.totalGst || 0).toFixed(2)}</span></div>{Number(order.couponDiscount || 0) > 0 && <div className="flex justify-between text-green-800"><span>Coupon ({order.couponCode})</span><span>−₹{Number(order.couponDiscount).toFixed(2)}</span></div>}<div className="flex justify-between text-slate-600"><span>Delivery fee</span><span>{Number(order.deliveryFee || 0) === 0 ? 'Free' : `₹${Number(order.deliveryFee).toFixed(2)}`}</span></div><div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold"><span>Total</span><span>₹{Number(order.totalAmount).toFixed(2)}</span></div></div>
      </section></div>
  </div>;
};

export default OrderDetails;
