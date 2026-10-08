import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import api from '../../api/axios';

const emptyPartnerForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  serviceType: 'Standard',
  vehicleType: 'Bike',
  vehicleNumber: '',
  serviceablePincodes: '',
  addressLine1: '',
  city: '',
  state: '',
  pincode: '',
};

const DeliveryPartners = () => {
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [formData, setFormData] = useState(emptyPartnerForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // View Shipments Drawer state
  const [selectedPartnerDetails, setSelectedPartnerDetails] = useState(null);
  const [partnerShipments, setPartnerShipments] = useState([]);
  const [loadingShipments, setLoadingShipments] = useState(false);

  const loadPartners = () => {
    setLoading(true);
    setError('');
    api
      .get('/admin/delivery-partners', {
        params: {
          search: search || undefined,
          status: statusFilter || undefined,
        },
      })
      .then(({ data }) => {
        setPartners(data.partners || []);
        setSummary(data.summary || {});
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load delivery partners'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPartners();
  }, [statusFilter]);

  const openAddModal = () => {
    setEditingPartner(null);
    setFormData(emptyPartnerForm);
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingPartner(p);
    setModalError('');
    setFormData({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      password: '', // password left blank if unchanged
      serviceType: p.serviceType || 'Standard',
      vehicleType: p.vehicleType || 'Bike',
      vehicleNumber: p.vehicleNumber || '',
      serviceablePincodes: (p.serviceablePincodes || []).join(', '),
      addressLine1: p.address?.line1 || '',
      city: p.address?.city || '',
      state: p.address?.state || '',
      pincode: p.address?.pincode || '',
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (modalError) setModalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');

    try {
      const pincodesArray = formData.serviceablePincodes
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        serviceType: formData.serviceType,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber.trim(),
        serviceablePincodes: pincodesArray,
        address: {
          line1: formData.addressLine1.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
        },
      };

      if (!editingPartner) {
        payload.password = formData.password;
        await api.post('/admin/delivery-partners', payload);
      } else {
        await api.put(`/admin/delivery-partners/${editingPartner._id}`, payload);
      }

      setShowModal(false);
      loadPartners();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save delivery partner');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (partnerId, newStatus) => {
    try {
      await api.put(`/admin/delivery-partners/${partnerId}/status`, { status: newStatus });
      loadPartners();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Failed to update partner status');
    }
  };

  const openPartnerShipments = async (partner) => {
    setSelectedPartnerDetails(partner);
    setLoadingShipments(true);
    try {
      const { data } = await api.get(`/admin/delivery-partners/${partner._id}`);
      setPartnerShipments(data.shipments || []);
    } catch (err) {
      setPartnerShipments([]);
    } finally {
      setLoadingShipments(false);
    }
  };

  const filteredPartners = partners.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.serviceType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Logistics & Operations
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Delivery Partners
          </h2>
          <p className="text-xs text-slate-500">
            Manage courier agencies, fleet riders, coverage pincodes, and active shipments
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-primary inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-wider shadow-sm sm:self-auto"
        >
          <Plus size={16} />
          <span>Add Delivery Partner</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Partners</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Truck size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.totalPartners || partners.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Registered courier accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Partners</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {summary.activePartners || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Eligible for dispatch</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">In-Transit Shipments</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-indigo-700">
            {summary.inTransitShipments || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Active on the road</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered Packages</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {summary.totalDelivered || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">All-time completions</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search partners by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs w-auto min-w-[140px]"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>

          <button
            onClick={loadPartners}
            className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Partners Table */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <Truck size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold">No delivery partners found</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Add Delivery Partner" to onboard your first courier agent.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Partner / Courier</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Vehicle & Type</th>
                  <th className="px-5 py-3.5">Coverage Pincodes</th>
                  <th className="px-5 py-3.5">Active Shipments</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPartners.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-500">⭐ {p.rating?.toFixed(1) || '4.8'} rating</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{p.phone}</div>
                      <div className="text-[11px] text-slate-400">{p.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-700">
                        {p.serviceType}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {p.vehicleType} {p.vehicleNumber ? `(${p.vehicleNumber})` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {(p.serviceablePincodes || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.serviceablePincodes.slice(0, 3).map((pin) => (
                            <span
                              key={pin}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 font-semibold"
                            >
                              {pin}
                            </span>
                          ))}
                          {p.serviceablePincodes.length > 3 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{p.serviceablePincodes.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">All regions</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openPartnerShipments(p)}
                        className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline"
                        title="View active shipments"
                      >
                        <span>{p.activeShipmentsCount || 0} active</span>
                        <ExternalLink size={12} />
                      </button>
                      <div className="text-[10px] text-slate-400">
                        {p.totalDeliveredCount || 0} fulfilled
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          p.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'Inactive'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit Partner"
                        >
                          <Edit2 size={15} />
                        </button>

                        {p.status === 'Active' ? (
                          <button
                            onClick={() => handleStatusToggle(p._id, 'Inactive')}
                            className="btn btn-secondary text-[11px] py-1 px-2.5 text-amber-700 hover:bg-amber-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusToggle(p._id, 'Active')}
                            className="btn btn-secondary text-[11px] py-1 px-2.5 text-emerald-700 hover:bg-emerald-50"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Partner Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingPartner ? 'Edit Delivery Partner' : 'Onboard New Delivery Partner'}
                </h3>
                <p className="text-xs text-slate-500">Provide contact, fleet, and coverage details</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Courier Partner Name *
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Ramesh Kumar / Bluedart Logistics"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="agent@logistics.com"
                    value={formData.email}
                    onChange={handleFormChange}
                    disabled={!!editingPartner}
                    className="input disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={handleFormChange}
                    className="input"
                  />
                </div>

                {!editingPartner && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                      Portal Password (Min 8 Characters) *
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleFormChange}
                      className="input"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Service Type
                  </label>
                  <select
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleFormChange}
                    className="input"
                  >
                    <option value="Standard">Standard Delivery</option>
                    <option value="Express">Express Air</option>
                    <option value="Hyperlocal">Hyperlocal Instant</option>
                    <option value="Surface">Surface Cargo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleFormChange}
                    className="input"
                  >
                    <option value="Bike">Motorcycle / Bike</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Van">Delivery Van</option>
                    <option value="Truck">Medium Truck</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Vehicle Registration No.
                  </label>
                  <input
                    name="vehicleNumber"
                    placeholder="e.g. KA-01-AB-1234"
                    value={formData.vehicleNumber}
                    onChange={handleFormChange}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Serviceable Pincodes (Comma separated)
                  </label>
                  <input
                    name="serviceablePincodes"
                    placeholder="e.g. 560001, 560034, 560078"
                    value={formData.serviceablePincodes}
                    onChange={handleFormChange}
                    className="input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Hub Base Address / Location
                  </label>
                  <input
                    name="addressLine1"
                    placeholder="Base hub facility or office address"
                    value={formData.addressLine1}
                    onChange={handleFormChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary text-xs px-6"
                >
                  {saving ? 'Saving…' : editingPartner ? 'Save Changes' : 'Onboard Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Shipments Drawer Modal */}
      {selectedPartnerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Assigned Shipments: {selectedPartnerDetails.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedPartnerDetails.phone} · {selectedPartnerDetails.serviceType}
                </p>
              </div>
              <button
                onClick={() => setSelectedPartnerDetails(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {loadingShipments ? (
              <div className="p-8 text-center">
                <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
              </div>
            ) : partnerShipments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No shipments currently assigned to this delivery partner.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {partnerShipments.map((s) => {
                  const order = s.order || {};
                  const addr = order.shippingAddress || {};
                  return (
                    <div key={s._id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {s.trackingNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            #{String(order._id).slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {addr.city}, {addr.state} ({addr.pincode})
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            s.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {s.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryPartners;
