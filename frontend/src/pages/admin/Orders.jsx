import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock, Package, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';
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
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnersError, setPartnersError] = useState('');

  // Assign Delivery Modal
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [courierSearch, setCourierSearch] = useState('');

  // Quick Add Courier inside Assign Modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickServiceType, setQuickServiceType] = useState('Standard');
  const [quickVehicleNumber, setQuickVehicleNumber] = useState('');
  const [savingQuickCourier, setSavingQuickCourier] = useState(false);

  const load = (status) =>
    api
      .get('/admin/orders', { params: status ? { status } : {} })
      .then(({ data }) => setOrders(data));

  const loadPartners = async () => {
    setLoadingPartners(true);
    setPartnersError('');
    try {
      // Fetch all delivery partners so both active and newly registered couriers are visible
      const { data } = await api.get('/admin/delivery-partners');
      const list = data.partners || [];
      setPartners(list);
      return list;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load courier partners list';
      setPartnersError(msg);
      return [];
    } finally {
      setLoadingPartners(false);
    }
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

  const openAssignModal = async (order) => {
    setAssigningOrder(order);
    setAssignNotes('');
    setAssignError('');
    setCourierSearch('');
    setShowQuickAdd(false);

    let defaultDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    if (order.estimatedDelivery) {
      try {
        const d = new Date(order.estimatedDelivery);
        if (!isNaN(d.getTime())) defaultDate = d.toISOString().slice(0, 10);
      } catch {}
    }
    setExpectedDate(defaultDate);

    const existingId =
      order.deliveryPartner?._id ||
      (typeof order.deliveryPartner === 'string' ? order.deliveryPartner : '');

    // Preselect from existing in-memory partners immediately
    if (partners.length > 0) {
      const matched = partners.some((p) => p._id === existingId);
      setSelectedPartnerId(matched ? existingId : partners[0]?._id || '');
    }

    // Refresh fresh list in background
    const freshPartners = await loadPartners();
    if (freshPartners.length > 0) {
      const matched = freshPartners.some((p) => p._id === existingId);
      setSelectedPartnerId(matched ? existingId : freshPartners[0]?._id || '');
    }
  };

  const handleQuickAddCourier = async (e) => {
    e.preventDefault();
    if (!quickName.trim() || !quickPhone.trim()) {
      setAssignError('Please provide at least Courier Name and Phone Number');
      return;
    }

    setSavingQuickCourier(true);
    setAssignError('');
    try {
      const generatedEmail = quickEmail.trim() || `courier_${Date.now()}@shoppingnow.local`;
      const { data } = await api.post('/admin/delivery-partners', {
        name: quickName.trim(),
        phone: quickPhone.trim(),
        email: generatedEmail,
        password: 'Password123!',
        serviceType: quickServiceType,
        vehicleType: 'Bike',
        vehicleNumber: quickVehicleNumber.trim(),
      });
      const newPartner = data.partner;
      const updatedList = [newPartner, ...partners];
      setPartners(updatedList);
      setSelectedPartnerId(newPartner._id);
      setShowQuickAdd(false);
      setQuickName('');
      setQuickPhone('');
      setQuickEmail('');
      setQuickVehicleNumber('');
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to create new courier partner');
    } finally {
      setSavingQuickCourier(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assigningOrder || !selectedPartnerId) {
      setAssignError('Please select a delivery partner from the list.');
      return;
    }

    setAssigning(true);
    setAssignError('');

    try {
      const { data } = await api.post(`/admin/orders/${assigningOrder._id}/assign-delivery`, {
        partnerId: selectedPartnerId,
        expectedDeliveryDate: expectedDate,
        notes: assignNotes,
      });
      const orderNum = assigningOrder._id.slice(-6).toUpperCase();
      setAssigningOrder(null);
      setSuccessMsg(data.message || `Delivery partner assigned to Order #${orderNum}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      load(filter);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign delivery partner');
    } finally {
      setAssigning(false);
    }
  };

  const filteredCouriers = partners.filter((p) => {
    if (!courierSearch.trim()) return true;
    const q = courierSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.serviceType?.toLowerCase().includes(q) ||
      p.vehicleNumber?.toLowerCase().includes(q)
    );
  });

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

      {successMsg && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Truck size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

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
                      {o.status !== 'Cancelled' && (
                        <button
                          onClick={() => openAssignModal(o)}
                          className="text-[10px] text-sky-600 hover:text-sky-800 underline mt-1 font-semibold block"
                        >
                          Re-assign Partner
                        </button>
                      )}
                    </div>
                  ) : o.status !== 'Cancelled' ? (
                    <button
                      onClick={() => openAssignModal(o)}
                      className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-sky-700 hover:bg-sky-50 font-semibold shadow-2xs"
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

            {/* Business rules eligibility checks */}
            {assigningOrder.paymentStatus === 'Refunded' ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>Cannot dispatch: This order has been refunded.</span>
              </div>
            ) : assigningOrder.status === 'Cancelled' ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-700 flex items-center gap-2">
                <AlertCircle size={16} className="text-slate-500 shrink-0" />
                <span>Order has been cancelled and cannot be assigned for delivery.</span>
              </div>
            ) : assigningOrder.status === 'Delivered' ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <Truck size={16} className="text-emerald-600 shrink-0" />
                <span>Order is marked Delivered. Assigning a courier will update the assigned courier fleet member & shipment history.</span>
              </div>
            ) : assigningOrder.paymentStatus !== 'Paid' && !/cash\s*on\s*delivery|cod/i.test(assigningOrder.paymentMethod || '') ? (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-900 flex items-center gap-2">
                <AlertCircle size={16} className="text-sky-600 shrink-0" />
                <div>
                  <span className="font-bold">Payment Status: {assigningOrder.paymentStatus} ({assigningOrder.paymentMethod || 'Online'})</span>
                  <p className="text-[11px] text-sky-700">
                    Assigning a courier will generate an AWB and advance the order status to Packed.
                  </p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select Courier Partner * ({partners.length} Available)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                    <span>{showQuickAdd ? 'Close' : '+ Quick Add Courier'}</span>
                  </button>
                </div>

                {/* Quick Add Courier Inline Drawer */}
                {showQuickAdd && (
                  <div className="mb-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 space-y-2.5">
                    <p className="text-xs font-bold text-sky-900">Add New Courier Fleet Partner</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Full Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Rahul Courier"
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          className="input py-1 text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Phone *</label>
                        <input
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={quickPhone}
                          onChange={(e) => setQuickPhone(e.target.value)}
                          className="input py-1 text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Service Type</label>
                        <select
                          value={quickServiceType}
                          onChange={(e) => setQuickServiceType(e.target.value)}
                          className="input py-1 text-xs"
                        >
                          <option value="Standard">Standard</option>
                          <option value="Express">Express</option>
                          <option value="Hyperlocal">Hyperlocal</option>
                          <option value="Surface">Surface</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-semibold text-slate-500">Vehicle No.</label>
                        <input
                          type="text"
                          placeholder="e.g. TN 45 AB 1234"
                          value={quickVehicleNumber}
                          onChange={(e) => setQuickVehicleNumber(e.target.value)}
                          className="input py-1 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleQuickAddCourier}
                        disabled={savingQuickCourier || !quickName.trim() || !quickPhone.trim()}
                        className="btn btn-primary text-xs py-1.5 px-3 shadow-xs"
                      >
                        {savingQuickCourier ? 'Adding…' : 'Save & Select Courier'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Search Box if list has more than 2 items */}
                {partners.length > 2 && (
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search courier by name, vehicle, or phone..."
                      value={courierSearch}
                      onChange={(e) => setCourierSearch(e.target.value)}
                      className="input pl-8 py-1.5 text-xs w-full"
                    />
                  </div>
                )}

                {loadingPartners ? (
                  <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center gap-2">
                    <RefreshCw size={15} className="animate-spin text-sky-600" />
                    <span>Loading courier fleet…</span>
                  </div>
                ) : partnersError ? (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between">
                    <span>{partnersError}</span>
                    <button
                      type="button"
                      onClick={loadPartners}
                      className="text-xs font-bold underline ml-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : partners.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <p className="font-bold">No delivery partners found in the system.</p>
                    <p className="mt-1 text-[11px] text-amber-700">
                      Click <strong>"+ Quick Add Courier"</strong> above to register a courier partner instantly!
                    </p>
                  </div>
                ) : filteredCouriers.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                    No courier matches "{courierSearch}".
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 rounded-2xl border border-slate-100 p-1.5 bg-slate-50/50">
                    {filteredCouriers.map((p) => {
                      const isSelected = selectedPartnerId === p._id;
                      return (
                        <div
                          key={p._id}
                          onClick={() => setSelectedPartnerId(p._id)}
                          className={`cursor-pointer rounded-xl border p-2.5 transition flex items-center justify-between ${
                            isSelected
                              ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-500/30 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Truck size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-900">{p.name}</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                                  {p.serviceType}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                    p.status === 'Active'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>📞 {p.phone}</span>
                                {p.vehicleNumber && <span>· 🛵 {p.vehicleNumber}</span>}
                                <span className="font-medium text-slate-600">· {p.activeShipmentsCount || 0} active</span>
                              </div>
                            </div>
                          </div>
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              isSelected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                  disabled={
                    assigning ||
                    !selectedPartnerId ||
                    assigningOrder.paymentStatus === 'Refunded' ||
                    assigningOrder.status === 'Cancelled'
                  }
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
