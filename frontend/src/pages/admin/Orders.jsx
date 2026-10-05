import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { formatDay, isPastDay } from '../../utils/dates';

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const STATUS_STYLES = {
  Pending: 'bg-amber-100 text-amber-700',
  Processing: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-violet-100 text-violet-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-rose-100 text-rose-700',
};
const STATUS_TRANSITIONS = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');

  const load = (status) =>
    api.get('/admin/orders', { params: status ? { status } : {} }).then(({ data }) => setOrders(data));

  useEffect(() => {
    load();
  }, []);

  const handleFilter = (e) => {
    const status = e.target.value;
    setFilter(status);
    load(status);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      load(filter);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not update order status');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operations</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Orders</h2>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="whitespace-nowrap">Filter by status:</span>
          <select className="input w-auto min-w-[180px]" value={filter} onChange={handleFilter}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="table-th">Order</th><th className="table-th">Customer</th><th className="table-th">Items</th>
              <th className="table-th">Total</th><th className="table-th">Status</th><th className="table-th">Placed</th><th className="table-th">Deliver by</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td className="table-td font-semibold text-slate-800">#{o._id.slice(-6).toUpperCase()}</td>
                <td className="table-td">
                  <div className="font-medium text-slate-800">{o.user?.name}</div>
                  <div className="text-xs text-slate-500">{o.user?.email}</div>
                </td>
                <td className="table-td max-w-[220px] text-slate-700">{o.items.map((it) => `${it.name} x${it.quantity}`).join(', ')}</td>
                <td className="table-td font-semibold text-slate-800">₹{Number(o.totalAmount || 0).toFixed(2)}</td>
                <td className="table-td">
                  <select
                    className={`input min-w-[150px] ${STATUS_STYLES[o.status] || 'bg-slate-100 text-slate-700'}`}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o._id, e.target.value)}
                  >
                    {[o.status, ...(STATUS_TRANSITIONS[o.status] || [])].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="table-td text-slate-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="table-td">
                  {o.estimatedDelivery ? (
                    <>
                      <div className={`font-medium ${!['Delivered', 'Cancelled'].includes(o.status) && isPastDay(o.estimatedDelivery) ? 'text-rose-700' : 'text-slate-800'}`}>{formatDay(o.estimatedDelivery)}</div>
                      {o.scheduledDelivery && <span className="table-chip bg-sky-100 text-sky-700">Customer scheduled</span>}
                      {o.fastTracked && <span className="table-chip ml-1 bg-indigo-100 text-indigo-600">Fast-tracked</span>}
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOrders;
