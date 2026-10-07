import React, { useEffect, useState, useMemo } from 'react';
import {
  Store,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Search,
  Eye,
  Percent,
  TrendingUp,
  Package,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const STATUS_TABS = ['ALL', 'Pending', 'Approved', 'Suspended', 'Rejected'];

const AdminSellers = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState(null);
  const [sellerDetails, setSellerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionModal, setActionModal] = useState({ open: false, type: '', seller: null, reason: '', commission: 10 });
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState('');

  const loadSellers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/sellers');
      setSellers(data || []);
    } catch (err) {
      console.error('Failed to load sellers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const openDetails = async (sellerId) => {
    setSelectedSellerId(sellerId);
    setLoadingDetails(true);
    try {
      const { data } = await api.get(`/admin/sellers/${sellerId}`);
      setSellerDetails(data);
    } catch (err) {
      console.error('Failed to load seller details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedSellerId(null);
    setSellerDetails(null);
  };

  const handleStatusUpdate = async () => {
    if (!actionModal.seller) return;
    setUpdating(true);
    try {
      await api.put(`/admin/sellers/${actionModal.seller._id}/status`, {
        status: actionModal.type,
        rejectionReason: actionModal.reason,
        commissionRate: Number(actionModal.commission),
      });

      showToastMsg(`Seller "${actionModal.seller.storeName}" marked as ${actionModal.type}`);
      setActionModal({ open: false, type: '', seller: null, reason: '', commission: 10 });
      loadSellers();
      if (selectedSellerId === actionModal.seller._id) {
        openDetails(actionModal.seller._id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update seller status');
    } finally {
      setUpdating(false);
    }
  };

  const filteredSellers = useMemo(() => {
    return sellers.filter((s) => {
      const matchesTab = activeTab === 'ALL' || s.status === activeTab;
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        s.storeName?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [sellers, activeTab, search]);

  const counts = useMemo(() => {
    return {
      all: sellers.length,
      pending: sellers.filter((s) => s.status === 'Pending').length,
      approved: sellers.filter((s) => s.status === 'Approved').length,
      suspended: sellers.filter((s) => s.status === 'Suspended').length,
      rejected: sellers.filter((s) => s.status === 'Rejected').length,
    };
  }, [sellers]);

  const totalGMV = useMemo(() => {
    return sellers.reduce((acc, s) => acc + Number(s.totalSales || 0), 0);
  }, [sellers]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
      case 'Pending':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'Suspended':
        return 'border-orange-200 bg-orange-50 text-orange-800';
      case 'Rejected':
        return 'border-rose-200 bg-rose-50 text-rose-800';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <CheckCircle size={18} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header and KPIs */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Multi-Seller Operations
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">
            Merchant Partners
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Merchants</p>
            <p className="text-lg font-bold text-slate-900">{counts.all}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 shadow-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Awaiting Approval</p>
            <p className="text-lg font-bold text-amber-800">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Seller GMV</p>
            <p className="text-lg font-bold text-slate-900">₹{totalGMV.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'ALL'
                ? counts.all
                : tab === 'Pending'
                ? counts.pending
                : tab === 'Approved'
                ? counts.approved
                : tab === 'Suspended'
                ? counts.suspended
                : counts.rejected;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    activeTab === tab
                      ? 'bg-white/20 text-white'
                      : tab === 'Pending' && count > 0
                      ? 'bg-amber-100 text-amber-800 font-extrabold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by store, name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Sellers Table */}
      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[850px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-4">Store & Merchant</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4 text-center">Products</th>
              <th className="px-5 py-4 text-right">Total GMV</th>
              <th className="px-5 py-4 text-center">Comm. %</th>
              <th className="px-5 py-4 text-center">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Loading seller directory...
                </td>
              </tr>
            ) : filteredSellers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No sellers found in this category.
                </td>
              </tr>
            ) : (
              filteredSellers.map((seller) => (
                <tr key={seller._id} className="hover:bg-slate-50/60 transition">
                  {/* Store & Merchant */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-indigo-50 font-bold text-indigo-700">
                        {seller.storeLogo ? (
                          <img
                            src={seller.storeLogo}
                            alt=""
                            className="h-full w-full rounded-xl object-cover"
                          />
                        ) : (
                          seller.storeName?.charAt(0).toUpperCase() || 'S'
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {seller.storeName}
                          </span>
                          {seller.status === 'Approved' && (
                            <Link
                              to={`/store/${seller._id}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Visit live store"
                              className="text-slate-400 hover:text-indigo-600"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {seller.name} • {seller.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-5 py-4 text-slate-600">
                    {seller.storeAddress?.city ? (
                      <span>
                        {seller.storeAddress.city}
                        {seller.storeAddress.state ? `, ${seller.storeAddress.state}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Products */}
                  <td className="px-5 py-4 text-center font-semibold text-slate-700">
                    {seller.productCount ?? 0}
                  </td>

                  {/* Total Sales */}
                  <td className="px-5 py-4 text-right font-bold text-slate-900">
                    ₹{Number(seller.totalSales || 0).toLocaleString('en-IN')}
                  </td>

                  {/* Commission */}
                  <td className="px-5 py-4 text-center font-medium text-slate-600">
                    {seller.commissionRate || 10}%
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                        seller.status
                      )}`}
                    >
                      {seller.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDetails(seller._id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-medium"
                      >
                        <Eye size={13} /> Details
                      </button>

                      {seller.status === 'Pending' && (
                        <>
                          <button
                            onClick={() =>
                              setActionModal({
                                open: true,
                                type: 'Approved',
                                seller,
                                reason: '',
                                commission: seller.commissionRate || 10,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button
                            onClick={() =>
                              setActionModal({
                                open: true,
                                type: 'Rejected',
                                seller,
                                reason: '',
                                commission: seller.commissionRate || 10,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      )}

                      {seller.status === 'Approved' && (
                        <button
                          onClick={() =>
                            setActionModal({
                              open: true,
                              type: 'Suspended',
                              seller,
                              reason: '',
                              commission: seller.commissionRate || 10,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 font-semibold text-orange-700 hover:bg-orange-100"
                        >
                          Suspend
                        </button>
                      )}

                      {(seller.status === 'Suspended' || seller.status === 'Rejected') && (
                        <button
                          onClick={() =>
                            setActionModal({
                              open: true,
                              type: 'Approved',
                              seller,
                              reason: '',
                              commission: seller.commissionRate || 10,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-2.5 py-1 font-semibold text-white hover:bg-indigo-800"
                        >
                          Re-activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Seller Details Drawer / Modal */}
      {selectedSellerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={closeDetails}
              className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>

            {loadingDetails || !sellerDetails ? (
              <div className="py-20 text-center text-slate-500">
                Loading partner profile & catalogue...
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-700 text-2xl font-bold text-white shadow-md">
                    {sellerDetails.seller.storeLogo ? (
                      <img
                        src={sellerDetails.seller.storeLogo}
                        alt=""
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      sellerDetails.seller.storeName?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">
                        {sellerDetails.seller.storeName}
                      </h3>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-bold ${getStatusBadge(
                          sellerDetails.seller.status
                        )}`}
                      >
                        {sellerDetails.seller.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Managed by {sellerDetails.seller.name} • {sellerDetails.seller.email} •{' '}
                      {sellerDetails.seller.phone}
                    </p>
                    {sellerDetails.seller.status === 'Approved' && (
                      <Link
                        to={`/store/${sellerDetails.seller._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        <ExternalLink size={13} /> View Customer Storefront
                      </Link>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Total Sales</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      ₹{Number(sellerDetails.seller.totalSales || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Net Earnings</p>
                    <p className="mt-1 text-base font-bold text-emerald-800">
                      ₹{Number(sellerDetails.seller.netEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Commission Rate</p>
                    <p className="mt-1 text-base font-bold text-indigo-600">
                      {sellerDetails.seller.commissionRate || 10}%
                    </p>
                  </div>
                </div>

                {/* Rejection / Suspension Notice */}
                {sellerDetails.seller.rejectionReason && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                    <strong>Admin Note:</strong> {sellerDetails.seller.rejectionReason}
                  </div>
                )}

                {/* Bank Settlement Info */}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Building size={14} /> Bank Payout Account
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-slate-400">Account Holder</p>
                      <p className="font-semibold text-slate-800">
                        {sellerDetails.seller.bankDetails?.accountHolder || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Account Number</p>
                      <p className="font-semibold text-slate-800 font-mono">
                        {sellerDetails.seller.bankDetails?.accountNumber || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">IFSC Code</p>
                      <p className="font-semibold text-slate-800 uppercase font-mono">
                        {sellerDetails.seller.bankDetails?.ifscCode || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Bank Name</p>
                      <p className="font-semibold text-slate-800">
                        {sellerDetails.seller.bankDetails?.bankName || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Products List */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Active Catalogue ({sellerDetails.products?.length || 0})
                    </h4>
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-center">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sellerDetails.products?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400">
                              No products listed yet
                            </td>
                          </tr>
                        ) : (
                          sellerDetails.products?.map((p) => (
                            <tr key={p._id}>
                              <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                              <td className="px-3 py-2 text-slate-500">{p.category}</td>
                              <td className="px-3 py-2 text-right font-semibold">₹{p.price}</td>
                              <td className="px-3 py-2 text-center">{p.stock}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  {sellerDetails.seller.status !== 'Approved' && (
                    <button
                      onClick={() => {
                        setActionModal({
                          open: true,
                          type: 'Approved',
                          seller: sellerDetails.seller,
                          reason: '',
                          commission: sellerDetails.seller.commissionRate || 10,
                        });
                      }}
                      className="btn btn-primary text-xs"
                    >
                      Approve / Activate Seller
                    </button>
                  )}
                  {sellerDetails.seller.status === 'Approved' && (
                    <button
                      onClick={() => {
                        setActionModal({
                          open: true,
                          type: 'Suspended',
                          seller: sellerDetails.seller,
                          reason: '',
                          commission: sellerDetails.seller.commissionRate || 10,
                        });
                      }}
                      className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100"
                    >
                      Suspend Merchant
                    </button>
                  )}
                  {sellerDetails.seller.status === 'Pending' && (
                    <button
                      onClick={() => {
                        setActionModal({
                          open: true,
                          type: 'Rejected',
                          seller: sellerDetails.seller,
                          reason: '',
                          commission: sellerDetails.seller.commissionRate || 10,
                        });
                      }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      Reject Application
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve / Reject / Suspend Action Modal */}
      {actionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">
              {actionModal.type === 'Approved'
                ? 'Approve Merchant Application'
                : actionModal.type === 'Suspended'
                ? 'Suspend Merchant Account'
                : 'Reject Merchant Application'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Store: <strong>{actionModal.seller?.storeName}</strong> ({actionModal.seller?.email})
            </p>

            <div className="mt-4 space-y-4">
              {actionModal.type === 'Approved' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Platform Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={actionModal.commission}
                    onChange={(e) =>
                      setActionModal((prev) => ({ ...prev, commission: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Standard commission is 10% on every fulfilled order item.
                  </p>
                </div>
              )}

              {(actionModal.type === 'Rejected' || actionModal.type === 'Suspended') && (
                <div>
                  <label className="text-xs font-semibold text-slate-700">Reason / Notice</label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason for rejection or suspension..."
                    value={actionModal.reason}
                    onChange={(e) =>
                      setActionModal((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setActionModal({ open: false, type: '', seller: null, reason: '', commission: 10 })
                }
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={handleStatusUpdate}
                className={`btn text-xs ${
                  actionModal.type === 'Approved'
                    ? 'btn-primary'
                    : 'border-rose-200 bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                {updating ? 'Updating...' : `Confirm ${actionModal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSellers;
