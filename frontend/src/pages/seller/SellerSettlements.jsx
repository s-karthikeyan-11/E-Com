import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtINR = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';

const cls = (...args) => args.filter(Boolean).join(' ');

// ─── Status Chip ─────────────────────────────────────────────────────────────
const STATUS_TONES = {
  'Pending Review': 'bg-amber-100 text-amber-800 border-amber-200',
  Approved: 'bg-blue-100 text-blue-800 border-blue-200',
  Processing: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Failed: 'bg-red-100 text-red-800 border-red-200',
  Rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  'On Hold': 'bg-orange-100 text-orange-800 border-orange-200',
};

const StatusChip = ({ status }) => (
  <span className={cls(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
    STATUS_TONES[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  )}>
    {status}
  </span>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const SellerSettlements = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [requesting, setRequesting] = useState(false);
  const [requestMsg, setRequestMsg] = useState('');
  const [requestErr, setRequestErr] = useState('');

  const [tab, setTab] = useState('overview'); // 'overview' | 'history'

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: res } = await api.get('/seller/settlements');
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRequestPayout = async () => {
    setRequestMsg('');
    setRequestErr('');
    setRequesting(true);
    try {
      const { data: res } = await api.post('/seller/settlements/request');
      setRequestMsg(res.message || 'Settlement request submitted successfully. Admin will review it shortly.');
      await load();
    } catch (err) {
      setRequestErr(err.response?.data?.message || 'Failed to submit settlement request');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
        <AlertTriangle size={20} className="mx-auto mb-2" />
        <p className="font-semibold">{error}</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary || {};
  const eligibleItems = data?.eligibleItems || [];
  const settlements = data?.settlements || [];

  const hasEligible = summary.eligibleItemsCount > 0;
  const hasPendingRequest = settlements.some((s) => ['Pending Review', 'Approved', 'Processing'].includes(s.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Seller Settlements</h2>
          <p className="text-xs text-slate-500 mt-0.5">Request payouts for delivered and reconciled orders</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[22px] bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Available for Payout</p>
            <CircleDollarSign size={18} className="text-white/70 shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-bold">{fmtINR(summary.availableForSettlement)}</p>
          <p className="mt-1 text-xs text-white/65">{summary.eligibleItemsCount || 0} delivered reconciled items</p>
        </div>
        <div className="rounded-[22px] bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Pending Fulfillment</p>
            <Clock size={18} className="text-white/70 shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-bold">{fmtINR(summary.pendingFulfillment)}</p>
          <p className="mt-1 text-xs text-white/65">Orders not yet delivered or reconciled</p>
        </div>
        <div className="rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Total Settled</p>
            <CheckCircle2 size={18} className="text-white/70 shrink-0" />
          </div>
          <p className="mt-3 text-3xl font-bold">{fmtINR(summary.totalSettled)}</p>
          <p className="mt-1 text-xs text-white/65">Across {summary.settlementCount || 0} settlements</p>
        </div>
      </div>

      {/* Bank Details Warning */}
      {!summary.bankDetailsConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={14} className="mr-1.5 inline" />
          <strong>Bank details not configured.</strong> Please complete your bank account details in{' '}
          <a href="/seller/profile" className="underline font-semibold">Seller Profile</a>{' '}
          before requesting a payout.
        </div>
      )}

      {/* Pending Request Banner */}
      {hasPendingRequest && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <ShieldCheck size={14} className="mr-1.5 inline" />
          You have an active settlement request under review. You can request again once it is resolved.
        </div>
      )}

      {/* Request Payout */}
      {hasEligible && !hasPendingRequest && summary.bankDetailsConfigured && (
        <div className="rounded-[22px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-emerald-900">Ready for Payout</h3>
              <p className="text-sm text-emerald-700 mt-0.5">
                {summary.eligibleItemsCount} item{summary.eligibleItemsCount !== 1 ? 's' : ''} · {fmtINR(summary.availableForSettlement)} net earnings
              </p>
            </div>
            <button
              onClick={handleRequestPayout}
              disabled={requesting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {requesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {requesting ? 'Requesting…' : 'Request Payout'}
            </button>
          </div>
          {requestMsg && <div className="mt-3 rounded-xl bg-emerald-100 px-4 py-2 text-xs text-emerald-800 font-medium">{requestMsg}</div>}
          {requestErr && <div className="mt-3 rounded-xl bg-red-100 px-4 py-2 text-xs text-red-800 font-medium">{requestErr}</div>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
        {['overview', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cls(
              'rounded-lg px-4 py-2 text-xs font-semibold capitalize transition',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t === 'overview' ? 'Eligible Items' : 'Settlement History'}
          </button>
        ))}
      </div>

      {/* Eligible Items Tab */}
      {tab === 'overview' && (
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Eligible Items for Payout</h3>
            <p className="text-xs text-slate-500 mt-0.5">Delivered &amp; reconciled orders not yet settled</p>
          </div>
          {eligibleItems.length === 0 ? (
            <div className="p-12 text-center">
              <BadgeDollarSign size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-500">No items ready for payout</p>
              <p className="text-xs text-slate-400 mt-1">Items appear here once the order is delivered and payment is reconciled.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Order</th>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">Qty</th>
                    <th className="px-4 py-3.5">Line Total</th>
                    <th className="px-4 py-3.5 text-rose-600">Commission</th>
                    <th className="px-4 py-3.5 text-emerald-700">Net Earning</th>
                    <th className="px-6 py-3.5">Order Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {eligibleItems.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-700">
                        #{String(item.orderId).slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900 max-w-[160px] truncate">{item.name}</td>
                      <td className="px-4 py-4 text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{fmtINR(item.lineTotal)}</td>
                      <td className="px-4 py-4 text-rose-600 font-semibold">−{fmtINR(item.commissionAmount)}</td>
                      <td className="px-4 py-4 font-bold text-emerald-700">+{fmtINR(item.netEarning)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(item.orderDate)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
                    <td className="px-6 py-4 text-slate-700" colSpan={3}>Total ({eligibleItems.length} items)</td>
                    <td className="px-4 py-4 text-slate-900">
                      {fmtINR(eligibleItems.reduce((s, i) => s + (i.lineTotal || 0), 0))}
                    </td>
                    <td className="px-4 py-4 text-rose-600">
                      −{fmtINR(eligibleItems.reduce((s, i) => s + (i.commissionAmount || 0), 0))}
                    </td>
                    <td className="px-4 py-4 text-emerald-700 text-base">
                      +{fmtINR(summary.availableForSettlement)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settlement History Tab */}
      {tab === 'history' && (
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Settlement History</h3>
            <p className="text-xs text-slate-500 mt-0.5">{settlements.length} settlement request{settlements.length !== 1 ? 's' : ''}</p>
          </div>
          {settlements.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-500">No settlement history yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Settlement #</th>
                    <th className="px-4 py-3.5">Amount</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Requested</th>
                    <th className="px-4 py-3.5">Reviewed</th>
                    <th className="px-4 py-3.5">Paid On</th>
                    <th className="px-6 py-3.5">Payout Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {settlements.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-700">{s.settlementNumber}</td>
                      <td className="px-4 py-4 font-bold text-slate-900 text-base">{fmtINR(s.amount)}</td>
                      <td className="px-4 py-4"><StatusChip status={s.status} /></td>
                      <td className="px-4 py-4 text-xs text-slate-400">{fmtDate(s.requestedAt)}</td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {s.reviewedAt ? (
                          <span>{fmtDate(s.reviewedAt)}{s.reviewedBy?.name && <span className="block text-slate-500 font-medium">{s.reviewedBy.name}</span>}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">{fmtDate(s.paidAt)}</td>
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{s.payoutReference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SellerSettlements;
