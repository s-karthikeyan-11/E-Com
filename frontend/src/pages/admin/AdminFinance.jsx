import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  Package,
  Percent,
  PiggyBank,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';

const cls = (...args) => args.filter(Boolean).join(' ');

// ─── Sub-components ──────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, tone = 'from-slate-800 to-slate-900', className }) => (
  <div className={cls('rounded-[22px] bg-gradient-to-br p-5 text-white shadow-sm', tone, className)}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">{label}</p>
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icon size={16} />
        </span>
      )}
    </div>
    <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
    {sub && <p className="mt-1 text-xs text-white/65">{sub}</p>}
  </div>
);

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50/60 transition"
      >
        <span className="text-sm font-bold uppercase tracking-wider text-slate-800">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 px-6 pb-6 pt-5">{children}</div>}
    </div>
  );
};

const StatusChip = ({ status }) => {
  const TONES = {
    Reconciled: 'bg-emerald-100 text-emerald-800',
    Captured: 'bg-blue-100 text-blue-800',
    Disputed: 'bg-red-100 text-red-800',
    'Not Applicable': 'bg-slate-100 text-slate-600',
    SUCCESS: 'bg-emerald-100 text-emerald-800',
    CREATED: 'bg-slate-100 text-slate-600',
    PENDING: 'bg-amber-100 text-amber-800',
    FAILED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-purple-100 text-purple-800',
    PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-800',
    Paid: 'bg-emerald-100 text-emerald-800',
    'Pending Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Processing: 'bg-cyan-100 text-cyan-800',
    Failed: 'bg-red-100 text-red-800',
    Rejected: 'bg-rose-100 text-rose-800',
    'On Hold': 'bg-orange-100 text-orange-800',
  };
  const tone = TONES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={cls('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', tone)}>
      {status}
    </span>
  );
};

// ─── Admin Finance Dashboard ──────────────────────────────────────────────────
const AdminFinance = () => {
  const [overview, setOverview] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [ledger, setLedger] = useState({ entries: [], total: 0, page: 1, pages: 1 });
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Commission editing
  const [editingRate, setEditingRate] = useState(null); // { _id, commissionPercent, commissionBase, description }
  const [newRate, setNewRate] = useState({ category: '', commissionPercent: '', commissionBase: 'final_price_ex_gst', description: '' });
  const [showNewRateForm, setShowNewRateForm] = useState(false);
  const [commMsg, setCommMsg] = useState('');
  const [commErr, setCommErr] = useState('');

  // Reconcile form
  const [reconcileOrderId, setReconcileOrderId] = useState('');
  const [reconcileRef, setReconcileRef] = useState('');
  const [reconcileMsg, setReconcileMsg] = useState('');
  const [reconcileErr, setReconcileErr] = useState('');

  // Ledger filter
  const [ledgerEventType, setLedgerEventType] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);

  const loadOverview = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/finance/overview');
      setOverview(data.metrics);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load finance overview');
    }
  }, []);

  const loadCommissions = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/commissions');
      setCommissions(Array.isArray(data) ? data : []);
    } catch { /* swallow */ }
  }, []);

  const loadLedger = useCallback(async (page = 1, eventType = '') => {
    try {
      const { data } = await api.get('/admin/ledger', {
        params: { page, limit: 20, ...(eventType ? { eventType } : {}) },
      });
      setLedger(data);
    } catch { /* swallow */ }
  }, []);

  const loadSettlements = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/settlements');
      setSettlements(Array.isArray(data.settlements || data) ? (data.settlements || data) : []);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOverview(), loadCommissions(), loadLedger(), loadSettlements()])
      .finally(() => setLoading(false));
  }, [loadOverview, loadCommissions, loadLedger, loadSettlements]);

  // Commission handlers
  const handleSaveRate = async (rate) => {
    setCommMsg('');
    setCommErr('');
    try {
      await api.put(`/admin/commissions/${rate._id}`, {
        commissionPercent: rate.commissionPercent,
        commissionBase: rate.commissionBase,
        description: rate.description,
        isActive: rate.isActive,
      });
      setCommMsg(`Updated commission rate for ${rate.category}`);
      setEditingRate(null);
      await loadCommissions();
    } catch (err) {
      setCommErr(err.response?.data?.message || 'Failed to update commission rate');
    }
  };

  const handleCreateRate = async () => {
    setCommMsg('');
    setCommErr('');
    try {
      await api.post('/admin/commissions', newRate);
      setCommMsg('New commission rate created');
      setShowNewRateForm(false);
      setNewRate({ category: '', commissionPercent: '', commissionBase: 'final_price_ex_gst', description: '' });
      await loadCommissions();
    } catch (err) {
      setCommErr(err.response?.data?.message || 'Failed to create commission rate');
    }
  };

  // Reconcile
  const handleReconcile = async () => {
    setReconcileMsg('');
    setReconcileErr('');
    if (!reconcileOrderId.trim() || !reconcileRef.trim()) {
      setReconcileErr('Both Order ID and gateway settlement reference are required');
      return;
    }
    try {
      const { data } = await api.put(`/admin/payments/${reconcileOrderId.trim()}/reconcile`, {
        settlementReference: reconcileRef.trim(),
      });
      setReconcileMsg(data.message || 'Payment reconciled successfully');
      setReconcileOrderId('');
      setReconcileRef('');
      await loadOverview();
    } catch (err) {
      setReconcileErr(err.response?.data?.message || 'Reconciliation failed');
    }
  };

  // Ledger pagination + filter
  const handleLedgerFilter = (e) => {
    setLedgerEventType(e.target.value);
    setLedgerPage(1);
    loadLedger(1, e.target.value);
  };

  const handleLedgerPage = (p) => {
    setLedgerPage(p);
    loadLedger(p, ledgerEventType);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  const m = overview || {};
  const cod = m.codSummary || {};
  const comm = m.platformCommission || {};
  const sellerP = m.sellerPayables || {};
  const delivery = m.deliveryFinances || {};
  const audit = m.ledgerAudit || {};

  return (
    <div className="space-y-6 px-1">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Finance</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-[28px]">Finance Dashboard</h2>
          <p className="mt-1 text-xs text-slate-500">Revenue, settlements, COD, commissions &amp; ledger audit</p>
        </div>
        <button
          onClick={() => { setLoading(true); Promise.all([loadOverview(), loadCommissions(), loadLedger(ledgerPage, ledgerEventType), loadSettlements()]).finally(() => setLoading(false)); }}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle size={14} className="mr-1.5 inline" />{error}
        </div>
      )}

      {/* ── Section 1: Revenue KPIs ── */}
      <Section title="Revenue Overview" defaultOpen>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Gross Sales" value={fmtINR(m.totalGrossSales)} sub={`${m.totalOrdersCount || 0} non-cancelled orders`} icon={BarChart3} tone="from-indigo-600 to-violet-600" />
          <KpiCard label="Online Captured" value={fmtINR(m.onlineCapturedCash)} sub="Razorpay captured payments" icon={CreditCard} tone="from-blue-600 to-cyan-600" />
          <KpiCard label="Platform Commission" value={fmtINR(comm.totalCommissionEarned)} sub="Category-wise commission earned" icon={Percent} tone="from-amber-500 to-orange-500" />
          <KpiCard label="Refunds Issued" value={fmtINR(m.refundsIssued)} sub="Wallet credits to customers" icon={RotateCcw} tone="from-rose-500 to-pink-500" />
        </div>
      </Section>

      {/* ── Section 2: COD ── */}
      <Section title="COD Cash Lifecycle" defaultOpen>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="COD Order Value" value={fmtINR(cod.totalCodOrders)} sub="Total COD order amount" icon={Package} tone="from-slate-700 to-slate-900" />
          <KpiCard label="COD Collected" value={fmtINR(cod.collected)} sub="Cash in hand with riders/hub" icon={CircleDollarSign} tone="from-teal-500 to-emerald-600" />
          <KpiCard label="COD Remitted" value={fmtINR(cod.remitted)} sub="Deposited to platform bank" icon={PiggyBank} tone="from-green-600 to-emerald-700" />
          <KpiCard label="In Transit" value={fmtINR(cod.inTransitWithRiders)} sub="Collected but not yet remitted" icon={Truck} tone="from-orange-500 to-amber-500" />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          COD remittance must be recorded via the Shipments panel before a COD order's seller earnings become eligible for settlement.
        </p>
      </Section>

      {/* ── Section 3: Seller & Delivery ── */}
      <Section title="Seller Payables &amp; Delivery Finances">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Total Seller Net Earned" value={fmtINR(sellerP.totalNetEarned)} sub="Across all delivered orders" icon={BadgeDollarSign} tone="from-violet-600 to-purple-600" />
          <KpiCard label="Seller Paid Out" value={fmtINR(sellerP.paidOut)} sub="Verified completed payouts" icon={CheckCircle2} tone="from-emerald-600 to-teal-600" />
          <KpiCard label="Seller Unsettled Pool" value={fmtINR(sellerP.unsettledPool)} sub="Earned but not yet paid" icon={BadgeDollarSign} tone="from-amber-600 to-orange-500" />
          <KpiCard label="Shipping Revenue" value={fmtINR(delivery.customerShippingFeeCollected)} sub="Collected from customers" icon={Truck} tone="from-sky-600 to-blue-600" />
          <KpiCard label="Delivery Expenses" value={fmtINR(delivery.totalDeliveryExpenses)} sub="Partner fees + courier + RTO" icon={Truck} tone="from-slate-600 to-slate-800" />
          <KpiCard
            label="Shipping Margin"
            value={fmtINR(delivery.shippingMargin)}
            sub="Revenue minus expenses"
            icon={BarChart3}
            tone={delivery.shippingMargin >= 0 ? 'from-green-600 to-emerald-600' : 'from-red-600 to-rose-600'}
          />
        </div>
      </Section>

      {/* ── Section 4: Ledger Audit ── */}
      <Section title="Financial Ledger Audit">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className={cls('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold',
            audit.isBalanced ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          )}>
            {audit.isBalanced ? <ShieldCheck size={16} /> : <XCircle size={16} />}
            {audit.isBalanced ? 'Ledger is balanced' : 'Ledger discrepancy detected'}
          </div>
          <span className="text-xs text-slate-500">{audit.totalEntriesCount} entries · {fmtINR(audit.totalVolumeINR)} total volume</span>
        </div>

        {/* Filter */}
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={ledgerEventType}
            onChange={handleLedgerFilter}
          >
            <option value="">All event types</option>
            {[
              'ORDER_PAYMENT_CAPTURED', 'PAYMENT_GATEWAY_SETTLED', 'MERCHANDISE_SALE_RECORDED',
              'SHIPPING_REVENUE_RECORDED', 'COD_COLLECTED', 'COD_REMITTED', 'COMMISSION_EARNED',
              'SELLER_PAYABLE_CREDITED', 'DELIVERY_PAYABLE_CREDITED', 'SELLER_PAYOUT_DISBURSED',
              'DELIVERY_PAYOUT_DISBURSED', 'REFUND_ISSUED', 'COMMISSION_REVERSED',
              'RTO_EXPENSE_INCURRED', 'EXTERNAL_COURIER_EXPENSE_INCURRED', 'MANUAL_ADJUSTMENT',
            ].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse bg-white text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Entry #</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Debit</th>
                <th className="px-4 py-3">Credit</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(ledger.entries || []).map((e) => (
                <tr key={e._id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{e.entryNumber}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block max-w-[160px] truncate rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-700 font-medium">{e.debitAccount}</td>
                  <td className="px-4 py-3 text-emerald-700 font-medium">{e.creditAccount}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{fmtINR(e.amount)}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-slate-600">{e.description}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(e.createdAt)}</td>
                </tr>
              ))}
              {!(ledger.entries || []).length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No ledger entries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {ledger.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Page {ledger.page} of {ledger.pages} · {ledger.total} entries</span>
            <div className="flex gap-2">
              <button disabled={ledger.page <= 1} onClick={() => handleLedgerPage(ledger.page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-slate-50 transition">← Prev</button>
              <button disabled={ledger.page >= ledger.pages} onClick={() => handleLedgerPage(ledger.page + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-slate-50 transition">Next →</button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 5: Commission Rates ── */}
      <Section title="Category Commission Rates">
        {commMsg && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">{commMsg}</div>}
        {commErr && <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-800 font-medium">{commErr}</div>}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[700px] border-collapse bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Category</th>
                <th className="px-4 py-3">Rate %</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {commissions.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50/40 transition">
                  {editingRate?._id === r._id ? (
                    <>
                      <td className="px-5 py-3 font-semibold text-slate-900">{r.category}</td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" max="100" step="0.1" value={editingRate.commissionPercent}
                          onChange={(e) => setEditingRate({ ...editingRate, commissionPercent: e.target.value })}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={editingRate.commissionBase}
                          onChange={(e) => setEditingRate({ ...editingRate, commissionBase: e.target.value })}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
                          <option value="final_price_ex_gst">Ex-GST Price</option>
                          <option value="base_price">Base Price</option>
                          <option value="line_total">Line Total</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEditingRate({ ...editingRate, isActive: !editingRate.isActive })}
                          className={cls('rounded-full px-3 py-0.5 text-[10px] font-bold', editingRate.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                          {editingRate.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <input value={editingRate.description || ''} maxLength={250}
                          onChange={(e) => setEditingRate({ ...editingRate, description: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveRate(editingRate)}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">Save</button>
                          <button onClick={() => setEditingRate(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 font-semibold text-slate-900">{r.category}</td>
                      <td className="px-4 py-3 font-bold text-indigo-700">{r.commissionPercent}%</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.commissionBase}</td>
                      <td className="px-4 py-3">
                        <span className={cls('rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                          r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{r.description || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEditingRate({ ...r })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          {!showNewRateForm ? (
            <button onClick={() => setShowNewRateForm(true)}
              className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
              + Add New Category Rate
            </button>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-5">
              <input placeholder="Category name" value={newRate.category}
                onChange={(e) => setNewRate({ ...newRate, category: e.target.value })}
                className="col-span-2 sm:col-span-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <input type="number" placeholder="Rate %" min="0" max="100" value={newRate.commissionPercent}
                onChange={(e) => setNewRate({ ...newRate, commissionPercent: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <select value={newRate.commissionBase}
                onChange={(e) => setNewRate({ ...newRate, commissionBase: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="final_price_ex_gst">Ex-GST Price</option>
                <option value="base_price">Base Price</option>
                <option value="line_total">Line Total</option>
              </select>
              <input placeholder="Description (optional)" value={newRate.description}
                onChange={(e) => setNewRate({ ...newRate, description: e.target.value })}
                className="col-span-2 sm:col-span-1 rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <div className="col-span-2 flex gap-2 sm:col-span-5">
                <button onClick={handleCreateRate}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition">Create</button>
                <button onClick={() => setShowNewRateForm(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Section 6: Payment Reconciliation ── */}
      <Section title="Gateway Payment Reconciliation">
        <p className="mb-4 text-xs text-slate-500">
          Reconcile a captured Razorpay payment with your bank settlement reference. This moves the payment from
          "GatewayReceivable" to "PlatformBank" in the financial ledger.
        </p>
        {reconcileMsg && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">{reconcileMsg}</div>}
        {reconcileErr && <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-800 font-medium">{reconcileErr}</div>}
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Order ID (MongoDB _id)"
            value={reconcileOrderId}
            onChange={(e) => setReconcileOrderId(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            placeholder="Razorpay settlement / bank reference"
            value={reconcileRef}
            onChange={(e) => setReconcileRef(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={handleReconcile}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            Reconcile
          </button>
        </div>
      </Section>

      {/* ── Section 7: Recent Settlements ── */}
      <Section title="Recent Settlements">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[860px] border-collapse bg-white text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Settlement #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Beneficiary</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Payout Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(settlements.slice(0, 20)).map((s) => (
                <tr key={s._id} className="hover:bg-slate-50/40 transition">
                  <td className="px-5 py-3 font-mono text-[10px] text-slate-600">{s.settlementNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cls('rounded-full px-2 py-0.5 text-[10px] font-bold',
                      s.beneficiaryType === 'Seller' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700')}>
                      {s.beneficiaryType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.bankDetailsSnapshot?.accountHolder || '—'}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{fmtINR(s.amount)}</td>
                  <td className="px-4 py-3"><StatusChip status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(s.requestedAt)}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{s.payoutReference || '—'}</td>
                </tr>
              ))}
              {!settlements.length && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No settlements found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">Showing latest 20 settlements. Manage full settlement workflow in Sellers &amp; Delivery Partners pages.</p>
      </Section>
    </div>
  );
};

export default AdminFinance;
