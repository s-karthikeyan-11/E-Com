import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const STATUS_STYLES = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
  Failed: 'bg-rose-100 text-rose-700',
};
const METHODS = ['Razorpay', 'UPI', 'Credit/Debit Card', 'Net Banking', 'Wallet', 'Cash on Delivery'];

const AdminPayments = () => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: res } = await api.get('/admin/payments', { params: { status: status || undefined, method: method || undefined } });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load payments');
    }
  }, [status, method]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = data
    ? [
        { label: 'Paid', ...data.summary.paid, tone: 'from-emerald-500 to-teal-500' },
        { label: 'Pending', ...data.summary.pending, tone: 'from-amber-500 to-orange-500' },
        { label: 'Failed', ...data.summary.failed, tone: 'from-rose-500 to-pink-500' },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Payments</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Payment status">
            <option value="">All statuses</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>
          <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
            <option value="">All methods</option>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-[24px] bg-gradient-to-br ${c.tone} p-5 text-white`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{c.label}</div>
            <div className="mt-3 text-3xl font-bold">{fmtINR(c.amount)}</div>
            <div className="mt-1 text-sm text-white/80">{c.count} payment{c.count === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-[24px] border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="table-th">Order</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Method</th>
              <th className="table-th">Amount</th>
              <th className="table-th">Payment</th>
              <th className="table-th">Transaction ID</th>
              <th className="table-th">Paid on</th>
            </tr>
          </thead>
          <tbody>
            {(data?.payments || []).map((p) => (
              <tr key={p._id}>
                <td className="table-td font-semibold text-slate-800">#{p._id.slice(-6).toUpperCase()}</td>
                <td className="table-td">
                  <div className="font-medium text-slate-800">{p.user?.name || 'Deleted user'}</div>
                  <div className="text-xs text-slate-500">{p.user?.email}</div>
                </td>
                <td className="table-td">{p.paymentMethod}</td>
                <td className="table-td font-semibold text-slate-800">{fmtINR(p.totalAmount)}</td>
                <td className="table-td"><span className={`table-chip ${STATUS_STYLES[p.paymentStatus]}`}>{p.paymentStatus}</span></td>
                <td className="table-td font-mono text-xs">{p.razorpayPaymentId || '—'}</td>
                <td className="table-td text-slate-600">{p.paidAt ? new Date(p.paidAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {data && data.payments.length === 0 && (
              <tr><td colSpan={7} className="table-td py-8 text-center text-slate-500">No payments found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPayments;
