import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const STATUS_TABS = [
  'All',
  'Assigned',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Failed Delivery',
];

const NDR_REASONS = [
  'Customer Unavailable / Phone Unreachable',
  'Incorrect / Incomplete Delivery Address',
  'Customer Requested Reschedule for Tomorrow',
  'Security Gate / Premises Closed',
  'Customer Refused Package',
  'COD Cash Not Ready',
];

const RTO_REASONS = [
  'Customer Permanently Rejected Delivery',
  'Address Unreachable after Multiple Attempts',
  'Customer Requested Order Cancellation',
];

const DeliveryOrders = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('status') || 'All';

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Update Status Modal state
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalForm, setModalForm] = useState({
    status: '',
    location: '',
    notes: '',
    receiverName: '',
    failedReason: NDR_REASONS[0],
    failureNotes: '',
    rtoReason: RTO_REASONS[0],
  });

  const loadShipments = () => {
    setLoading(true);
    setError('');
    api
      .get('/delivery/orders', {
        params: { status: activeTab },
      })
      .then(({ data }) => setShipments(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load assigned orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadShipments();
  }, [activeTab]);

  const handleTabChange = (tab) => {
    if (tab === 'All') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', tab);
    }
    setSearchParams(searchParams);
  };

  const openUpdateModal = (shipment) => {
    setSelectedShipment(shipment);
    setModalError('');
    // Suggest next logical status
    let nextStatus = 'In Transit';
    if (shipment.status === 'Assigned') nextStatus = 'Picked Up';
    else if (shipment.status === 'Picked Up') nextStatus = 'In Transit';
    else if (shipment.status === 'In Transit') nextStatus = 'Out for Delivery';
    else if (shipment.status === 'Out for Delivery') nextStatus = 'Delivered';

    setModalForm({
      status: nextStatus,
      location: shipment.currentLocation || 'City Logistics Hub',
      notes: '',
      receiverName: '',
      failedReason: NDR_REASONS[0],
      failureNotes: '',
      rtoReason: RTO_REASONS[0],
    });
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setUpdating(true);
    setModalError('');

    try {
      await api.put(`/delivery/orders/${selectedShipment._id}/status`, modalForm);
      setSelectedShipment(null);
      loadShipments();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to update delivery status');
    } finally {
      setUpdating(false);
    }
  };

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase();
    const order = s.order || {};
    const addr = order.shippingAddress || {};
    return (
      s.trackingNumber?.toLowerCase().includes(q) ||
      order._id?.toLowerCase().includes(q) ||
      addr.city?.toLowerCase().includes(q) ||
      addr.line1?.toLowerCase().includes(q) ||
      addr.phone?.includes(q) ||
      order.user?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Assigned Shipments</h2>
          <p className="text-xs text-slate-500">
            Fulfill and update live delivery checkpoints for your assigned orders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search AWB, order ID, city, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs w-full sm:w-64"
            />
          </div>
          <button
            onClick={loadShipments}
            className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Refresh Orders"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-soft'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Shipments List */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-sky-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold text-slate-500">Fetching assigned orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No shipments found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {search
              ? 'No assigned orders match your search keyword.'
              : `No orders in "${activeTab}" status.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s) => {
            const order = s.order || {};
            const addr = order.shippingAddress || {};
            const isDelivered = s.status === 'Delivered';
            const isFailed = s.status === 'Failed Delivery';
            const isCOD = order.paymentMethod === 'Cash on Delivery';
            const isCODPending = isCOD && order.paymentStatus !== 'Paid';

            return (
              <div
                key={s._id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:border-slate-300 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: AWB & Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {s.trackingNumber}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Order #{String(order._id).slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Current Hub: <strong className="text-slate-700">{s.currentLocation}</strong>
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'Out for Delivery'
                          ? 'bg-purple-100 text-purple-800'
                          : s.status === 'In Transit'
                          ? 'bg-blue-100 text-blue-800'
                          : isFailed
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <MapPin size={16} className="text-sky-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {order.user?.name || 'Customer'}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                              {addr.line1}
                            </p>
                            <p className="text-xs font-semibold text-slate-800 mt-0.5">
                              {addr.city}, {addr.state} — {addr.pincode}
                            </p>
                          </div>
                        </div>

                        {/* Directions / Maps link */}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${addr.line1}, ${addr.city}, ${addr.state} ${addr.pincode}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-xl bg-white border border-slate-200 p-2 text-slate-600 hover:text-sky-600 shadow-2xs"
                          title="Open in Maps"
                        >
                          <Navigation size={15} />
                        </a>
                      </div>

                      {addr.phone && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Customer Phone:</span>
                          <a
                            href={`tel:${addr.phone}`}
                            className="font-bold text-sky-700 hover:underline flex items-center gap-1"
                          >
                            <Phone size={12} />
                            <span>{addr.phone}</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* COD / Payment Warning */}
                    {isCODPending ? (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3 flex items-center justify-between text-xs text-amber-900">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          <div>
                            <span className="font-bold">CASH ON DELIVERY:</span>
                            <p className="text-[11px] text-amber-700">Collect cash upon delivery</p>
                          </div>
                        </div>
                        <span className="text-base font-black text-amber-950">
                          {fmtINR(order.totalAmount || 0)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                        <span>Payment Status:</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Prepaid ({order.paymentMethod || 'Online'})
                        </span>
                      </div>
                    )}

                    {/* Order items count */}
                    <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                      <span>Package Contents:</span>
                      <span className="font-medium text-slate-700">
                        {(order.items || []).length} items (
                        {(order.items || []).map((i) => i.name).slice(0, 2).join(', ')}
                        {(order.items || []).length > 2 ? '…' : ''})
                      </span>
                    </div>

                    {/* NDR Alert info if failed */}
                    {isFailed && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-800">
                        <span className="font-bold">Attempt Failed ({s.ndrAttempts} attempts):</span>
                        <p className="mt-0.5 text-rose-700">{s.failedReason || 'Customer unreachable'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Updated: {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {!isDelivered ? (
                    <button
                      onClick={() => openUpdateModal(s)}
                      className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Update Status</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 size={16} />
                      <span>Delivered Successfully</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update Delivery Status Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Shipment Checkpoint</h3>
                <p className="text-xs text-slate-500">AWB: {selectedShipment.trackingNumber}</p>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              {/* New Status Select */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  New Delivery Milestone *
                </label>
                <select
                  value={modalForm.status}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="input font-semibold"
                  required
                >
                  <option value="Picked Up">Picked Up (From Hub/Seller)</option>
                  <option value="In Transit">In Transit (Between Hubs)</option>
                  <option value="Out for Delivery">Out for Delivery (Final Mile)</option>
                  <option value="Delivered">Delivered (Handed to Customer)</option>
                  <option value="Failed Delivery">Delivery Failed / NDR (Re-attempt needed)</option>
                  <option value="RTO Initiated">RTO Initiated (Return to Origin)</option>
                </select>
              </div>

              {/* Current Location Checkpoint */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Current Hub / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore Central Delivery Center"
                  value={modalForm.location}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Conditional fields based on status */}
              {modalForm.status === 'Delivered' && (
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={16} />
                    <span>Proof of Delivery Details</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-emerald-900 mb-1">
                      Received By (Customer / Representative Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Self, Security Guard, Family Member"
                      value={modalForm.receiverName}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, receiverName: e.target.value }))
                      }
                      className="input bg-white text-xs"
                      required
                    />
                  </div>

                  {selectedShipment.order?.paymentMethod === 'Cash on Delivery' && (
                    <div className="rounded-xl bg-amber-100 p-2.5 text-xs text-amber-900 font-semibold">
                      Confirm cash collected: {fmtINR(selectedShipment.order?.totalAmount || 0)}
                    </div>
                  )}
                </div>
              )}

              {modalForm.status === 'Failed Delivery' && (
                <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                    <AlertTriangle size={16} />
                    <span>Non-Delivery Report (NDR) Reason</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-rose-900 mb-1">
                      Failure Reason *
                    </label>
                    <select
                      value={modalForm.failedReason}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, failedReason: e.target.value }))
                      }
                      className="input bg-white text-xs"
                    >
                      {NDR_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-rose-900 mb-1">
                      Additional Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Called customer 3 times, phone switched off"
                      value={modalForm.failureNotes}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, failureNotes: e.target.value }))
                      }
                      className="input bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {modalForm.status === 'RTO Initiated' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <RotateCcw size={16} />
                    <span>Return to Origin (RTO) Initiation</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-amber-900 mb-1">
                      RTO Reason *
                    </label>
                    <select
                      value={modalForm.rtoReason}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, rtoReason: e.target.value }))
                      }
                      className="input bg-white text-xs"
                    >
                      {RTO_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* General Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Left with building reception"
                  value={modalForm.notes}
                  onChange={(e) => setModalForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedShipment(null)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn btn-primary text-xs px-6"
                >
                  {updating ? 'Updating Checkpoint…' : 'Confirm Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrders;
