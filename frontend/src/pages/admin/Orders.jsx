import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Package, Truck, X } from 'lucide-react';
import api from '../../api/axios';
import { formatDay, isPastDay } from '../../utils/dates';

const STATUSES = [
  'Pending',
  'Confirmed',
  'Packed',
  'Processing',
  'Shipped',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Failed Delivery',
  'RTO Initiated',
  'RTO Delivered',
  'Cancelled',
];

const STATUS_STYLES = {
  Pending: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Packed: 'bg-indigo-100 text-indigo-700',
  Processing: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-violet-100 text-violet-700',
  'Picked Up': 'bg-cyan-100 text-cyan-700',
  'In Transit': 'bg-blue-100 text-blue-800',
  'Out for Delivery': 'bg-purple-100 text-purple-800',
  Delivered: 'bg-emerald-100 text-emerald-700',
  'Failed Delivery': 'bg-rose-100 text-rose-800',
  'RTO Initiated': 'bg-orange-100 text-orange-800',
  'RTO Delivered': 'bg-slate-200 text-slate-800',
  Cancelled: 'bg-rose-100 text-rose-700',
};

const STATUS_TRANSITIONS = {
  Pending: ['Confirmed', 'Processing', 'Packed', 'Cancelled'],
  Confirmed: ['Packed', 'Processing', 'Shipped', 'Picked Up', 'Cancelled'],
  Packed: ['Shipped', 'Picked Up', 'Cancelled'],
  Processing: ['Packed', 'Shipped', 'Picked Up', 'Cancelled'],
  Shipped: ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled'],
  'Picked Up': ['In Transit', 'Out for Delivery', 'Failed Delivery', 'Cancelled'],
  'In Transit': ['Out for Delivery', 'Delivered', 'Failed Delivery', 'RTO Initiated', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Failed Delivery', 'RTO Initiated'],
  'Failed Delivery': ['Out for Delivery', 'RTO Initiated'],
  'RTO Initiated': ['RTO Delivered'],
  'RTO Delivered': [],
  Delivered: [],
  Cancelled: [],
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [partners, setPartners] = useState([]);

  // Assign Delivery Modal
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const load = (status) =>
    api
      .get('/admin/orders', { params: status ? { status } : {} })
      .then(({ data }) => setOrders(data));

  const loadPartners = () => {
    api
      .get('/admin/delivery-partners?status=Active')
      .then(({ data }) => setPartners(data.partners || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadPartners();
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

  const openAssignModal = (order) => {
    setAssigningOrder(order);
    setSelectedPartnerId(order.deliveryPartner?._id || (partners[0]?._id || ''));
    setExpectedDate(
      order.estimatedDelivery
        ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
        : new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    );
    setAssignNotes('');
    setAssignError('');
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assigningOrder || !selectedPartnerId) return;

    setAssigning(true);
    setAssignError('');

    try {
      await api.post(`/admin/orders/${assigningOrder._id}/assign-delivery`, {
        partnerId: selectedPartnerId,
        expectedDeliveryDate: expectedDate,
        notes: assignNotes,
      });
      setAssigningOrder(null);
      load(filter);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign delivery partner');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Operations & Fulfillment
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Customer Orders</h2>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="whitespace-nowrap font-medium">Filter by status:</span>
          <select className="input w-auto min-w-[180px] text-xs" value={filter} onChange={handleFilter}>
            <option value="">All Orders</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200">
        <table className="w-full min-w-[960px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="table-th">Order</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Items</th>
              <th className="table-th">Total</th>
              <th className="table-th">Order Status</th>
              <th className="table-th">Delivery Partner & AWB</th>
              <th className="table-th">Placed</th>
              <th className="table-th">Deliver by</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td className="table-td font-semibold text-slate-800">
                  #{o._id.slice(-6).toUpperCase()}
                </td>
                <td className="table-td">
                  <div className="font-medium text-slate-800">{o.user?.name}</div>
                  <div className="text-xs text-slate-500">{o.user?.email}</div>
                  <div className="text-[11px] text-slate-400">
                    {o.shippingAddress?.city}, {o.shippingAddress?.pincode}
                  </div>
                </td>
                <td className="table-td max-w-[200px] text-slate-700">
                  {o.items.map((it) => `${it.name} x${it.quantity}`).join(', ')}
                </td>
                <td className="table-td font-semibold text-slate-800">
                  ₹{Number(o.totalAmount || 0).toFixed(2)}
                  <div className="text-[10px] text-slate-400 font-normal">
                    {o.paymentMethod || 'Online'} · {o.paymentStatus}
                  </div>
                </td>
                <td className="table-td">
                  <select
                    className={`input min-w-[140px] text-xs font-semibold ${
                      STATUS_STYLES[o.status] || 'bg-slate-100 text-slate-700'
                    }`}
                    value={o.status}
                    onChange={(e) => handleStatusChange(o._id, e.target.value)}
                  >
                    {[o.status, ...(STATUS_TRANSITIONS[o.status] || [])].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="table-td">
                  {o.deliveryPartner ? (
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <Truck size={13} className="text-sky-600" />
                        <span>{o.deliveryPartner.name}</span>
                      </div>
                      <div className="font-mono text-[10px] text-sky-700 font-semibold mt-0.5">
                        {o.trackingNumber || o.shipment?.trackingNumber || 'AWB Generated'}
                      </div>
                      <button
                        onClick={() => openAssignModal(o)}
                        className="text-[10px] text-slate-400 hover:text-slate-700 underline mt-1"
                      >
                        Re-assign
                      </button>
                    </div>
                  ) : !['Delivered', 'Cancelled'].includes(o.status) ? (
                    <button
                      onClick={() => openAssignModal(o)}
                      className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-sky-700 hover:bg-sky-50"
                    >
                      <Truck size={12} />
                      <span>Assign Courier</span>
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="table-td text-slate-600">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="table-td">
                  {o.estimatedDelivery ? (
                    <>
                      <div
                        className={`font-medium ${
                          !['Delivered', 'Cancelled'].includes(o.status) && isPastDay(o.estimatedDelivery)
                            ? 'text-rose-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {formatDay(o.estimatedDelivery)}
                      </div>
                      {o.scheduledDelivery && (
                        <span className="table-chip bg-sky-100 text-sky-700">Customer scheduled</span>
                      )}
                      {o.fastTracked && (
                        <span className="table-chip ml-1 bg-indigo-100 text-indigo-600">Fast-tracked</span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Delivery Partner Modal */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assign Courier Partner</h3>
                <p className="text-xs text-slate-500">
                  Order #{assigningOrder._id.slice(-6).toUpperCase()} · Destination:{' '}
                  {assigningOrder.shippingAddress?.city} ({assigningOrder.shippingAddress?.pincode})
                </p>
              </div>
              <button
                onClick={() => setAssigningOrder(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {assignError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Select Active Delivery Partner *
                </label>
                {partners.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    No active delivery partners registered. Please add a delivery partner first in the Delivery tab.
                  </p>
                ) : (
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="input text-xs font-semibold"
                    required
                  >
                    <option value="">-- Choose Courier Partner --</option>
                    {partners.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.serviceType} · {p.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Dispatch Checkpoint Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Package dispatched from Central Warehouse"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningOrder(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedPartnerId}
                  className="btn btn-primary text-xs px-5 flex items-center gap-1.5"
                >
                  <Truck size={14} />
                  <span>{assigning ? 'Assigning…' : 'Generate AWB & Assign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
