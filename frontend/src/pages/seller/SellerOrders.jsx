import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Package,
  Search,
  Truck,
  User,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const STATUS_STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-800 border-amber-200',
  Confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  Packed: 'bg-purple-100 text-purple-800 border-purple-200',
  Shipped: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadOrders = () => {
    setLoading(true);
    api.get('/seller/orders')
      .then(({ data }) => setOrders(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to fetch seller orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setError('');
    setSuccessMsg('');

    try {
      await api.put(`/seller/orders/${orderId}/status`, { status: newStatus });
      setSuccessMsg(`Order #${orderId.slice(-6).toUpperCase()} updated to ${newStatus}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'ALL') return true;
    return (o.status === filterStatus) || o.items.some((i) => (i.sellerStatus || o.status) === filterStatus);
  });

  return (
    <div className="space-y-6">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Customer Orders</h2>
          <p className="text-xs text-slate-500">Track and fulfill orders containing items from your store</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-2xs">
          Total: <strong className="text-slate-900">{orders.length}</strong> orders
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {['ALL', ...STATUS_STEPS].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition ${
              filterStatus === st
                ? 'bg-indigo-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <Package size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold">No orders in this category</p>
          <p className="text-xs text-slate-400 mt-1">Orders matching this filter will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const currentItemStatus = order.items[0]?.sellerStatus || order.status;
            const currentStepIdx = STATUS_STEPS.indexOf(currentItemStatus);
            const nextStatus = currentStepIdx >= 0 && currentStepIdx < STATUS_STEPS.length - 1
              ? STATUS_STEPS[currentStepIdx + 1]
              : null;

            return (
              <div key={order._id} className="card overflow-hidden shadow-soft transition hover:border-slate-300">
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs text-slate-600 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>Placed {new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase border ${
                      STATUS_COLORS[currentItemStatus] || 'bg-slate-100 text-slate-700'
                    }`}>
                      {currentItemStatus}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {order.paymentMethod} ({order.paymentStatus})
                    </span>
                  </div>
                </div>

                {/* Order Body */}
                <div className="p-5 sm:p-6 grid gap-6 lg:grid-cols-[1fr_260px]">
                  {/* Left: Items details */}
                  <div className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Items from your store:
                    </p>
                    <div className="divide-y divide-slate-100">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="py-2.5 first:pt-0 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-sm text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Qty: <strong className="text-slate-800">{item.quantity}</strong> × ₹{Number(item.finalPrice || item.price).toFixed(2)}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            {fmtINR(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Total Store Revenue:</span>
                      <strong className="text-sm text-indigo-950 font-black">{fmtINR(order.sellerSubtotal)}</strong>
                    </div>

                    {/* Stepper Visualizer */}
                    <div className="pt-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Fulfillment Pipeline:
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {STATUS_STEPS.map((step, idx) => {
                          const isDone = currentStepIdx >= idx;
                          const isCurrent = currentStepIdx === idx;
                          return (
                            <div
                              key={step}
                              className={`rounded-lg p-2 text-center transition ${
                                isCurrent
                                  ? 'bg-indigo-700 text-white shadow-xs'
                                  : isDone
                                  ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                                  : 'bg-slate-50 text-slate-400 border border-slate-100'
                              }`}
                            >
                              <div className="text-[10px] font-bold uppercase truncate">{step}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Shipping destination & Status Action */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-4 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <MapPin size={14} className="text-indigo-600" /> Customer Destination
                      </p>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1">
                        <p className="font-semibold text-slate-900">{order.user?.name || 'Customer'}</p>
                        <p>{order.shippingAddress?.line1}</p>
                        <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}</p>
                        <p className="text-slate-500">📞 {order.shippingAddress?.phone}</p>
                      </div>
                    </div>

                    {/* Status Changer Action */}
                    <div className="pt-3 border-t border-slate-200/80 space-y-2">
                      {nextStatus ? (
                        <button
                          type="button"
                          disabled={updatingId === order._id}
                          onClick={() => handleUpdateStatus(order._id, nextStatus)}
                          className="btn btn-primary w-full text-xs font-bold py-2.5 shadow-sm"
                        >
                          {updatingId === order._id ? 'Updating…' : `Mark as ${nextStatus} →`}
                        </button>
                      ) : (
                        <div className="rounded-xl bg-emerald-100/70 p-2 text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={16} /> Fully Delivered
                        </div>
                      )}

                      {/* Manual Select override */}
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase shrink-0">Status:</label>
                        <select
                          className="input py-1 text-xs"
                          value={currentItemStatus}
                          disabled={updatingId === order._id}
                          onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                        >
                          {STATUS_STEPS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
