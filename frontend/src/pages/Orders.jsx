import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import api from '../api/axios';
import { formatDay } from '../utils/dates';
import StatusBadge from '../components/StatusBadge';
import ReorderButton from '../components/ReorderButton';
import ConfirmDialog from '../components/ConfirmDialog';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const loadOrders = () => {
    setLoading(true);
    setError('');
    api.get('/orders')
      .then(({ data }) => setOrders(data))
      .catch((err) => setError(err.response?.data?.message || 'Your orders could not be loaded. Try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const cancelOrder = async () => {
    if (!orderToCancel) return;
    setCancelling(true);
    setCancelError('');
    try {
      const { data } = await api.post(`/orders/${orderToCancel._id}/cancel`);
      setOrders((current) => current.map((order) => (order._id === data._id ? data : order)));
      setOrderToCancel(null);
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Could not cancel this order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="section-shell py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-200" />
          {[0, 1].map((n) => <div key={n} className="card space-y-3 p-5"><div className="h-5 w-44 rounded bg-slate-200" /><div className="h-4 w-32 rounded bg-slate-200" /><div className="h-16 rounded-xl bg-slate-200" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell py-10 sm:py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Orders</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">My orders</h1>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><p className="text-sm text-red-800">{error}</p><button type="button" className="btn btn-secondary mt-4" onClick={loadOrders}>Try again</button></div>}
      {cancelError && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{cancelError}</div>}

      {!error && orders.length === 0 && (
        <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Package size={32} /></span>
          <h2 className="text-2xl font-bold">No orders yet</h2>
          <p className="mt-3 text-slate-600">Your purchases will appear here once you place an order.</p>
          <Link to="/products" className="btn btn-primary mt-6">Start shopping</Link>
        </div>
      )}

      {!error && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((o) => (
            <article className="card p-5 sm:p-6" key={o._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Order ID</p>
                  <h2 className="mt-1 text-lg font-bold">#{o._id.slice(-8).toUpperCase()}</h2>
                  <p className="mt-1 text-sm text-slate-500">Placed {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={o.status} /><StatusBadge kind="payment" status={o.paymentStatus} /></div>
              </div>

              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
                {o.items.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0 truncate">{it.name} × {it.quantity}</span><span className="shrink-0 font-medium">₹{Number(it.lineTotal || 0).toFixed(2)}</span></li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:justify-between">
                <span>{o.paymentMethod}{o.estimatedDelivery && !['Delivered', 'Cancelled'].includes(o.status) ? ` · ${o.scheduledDelivery ? 'Scheduled' : 'Delivery by'} ${formatDay(o.estimatedDelivery)}` : ''}</span>
                <span className="font-semibold text-slate-900">Total ₹{Number(o.totalAmount || 0).toFixed(2)}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-end gap-3">
                {['Pending', 'Processing'].includes(o.status) && <button type="button" className="btn btn-outline" onClick={() => { setCancelError(''); setOrderToCancel(o); }}>Cancel order</button>}
                <ReorderButton order={o} className="btn btn-outline" />
                <Link className="btn btn-primary" to={`/order/${o._id}`}>{o.status === 'Cancelled' ? 'View details' : 'Track order'}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(orderToCancel)}
        busy={cancelling}
        danger
        title="Cancel this order?"
        message={orderToCancel?.paymentStatus === 'Paid' ? 'This cannot be undone. Items go back to stock and your paid amount is credited to your refund wallet. You can reorder within 24 hours.' : 'This cannot be undone. Items go back to stock. You can reorder within 24 hours of cancelling.'}
        confirmLabel="Cancel order"
        onConfirm={cancelOrder}
        onCancel={() => !cancelling && setOrderToCancel(null)}
      />
    </div>
  );
};

export default Orders;
