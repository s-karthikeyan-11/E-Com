import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Percent,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const SellerEarnings = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/seller/earnings')
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load earnings records'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-rose-700 bg-rose-50 border-rose-200">
        <p className="font-semibold">{error}</p>
      </div>
    );
  }

  const summary = data?.summary || {};
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Seller Earnings & Financials</h2>
        <p className="text-xs text-slate-500">
          Transparent breakdown of total revenue, marketplace platform fees, and net payouts
        </p>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Gross Sales</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp size={18} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
            {fmtINR(summary.totalSales || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-400">Total customer orders fulfilled</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Commission</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Percent size={18} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
            −{fmtINR(summary.totalCommission || 0)}
          </div>
          <p className="mt-1 text-xs text-amber-700 font-medium">
            Standard {summary.commissionRate || 10}% marketplace fee
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Net Seller Earnings</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-md">
              <CircleDollarSign size={18} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-white sm:text-3xl">
            {fmtINR(summary.netEarnings || 0)}
          </div>
          <p className="mt-1 text-xs text-emerald-100">Available for settlement & payout</p>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="card overflow-hidden shadow-soft">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Earnings Transaction Ledger</h3>
          <p className="text-xs text-slate-500">Item-by-item accounting of each order sale</p>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No transactions recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Earnings transactions will appear when customers place orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-4 py-3.5">Order</th>
                  <th className="px-4 py-3.5">Item Description</th>
                  <th className="px-4 py-3.5">Sale Amount</th>
                  <th className="px-4 py-3.5">Commission ({summary.commissionRate || 10}%)</th>
                  <th className="px-4 py-3.5 font-bold text-emerald-700">Net Earning</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-5 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      #{tx._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-bold text-slate-900">
                      #{tx.order?._id ? tx.order._id.slice(-6).toUpperCase() : 'ORDER'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900 text-xs">{tx.description || tx.product?.name || 'Item sale'}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {fmtINR(tx.orderAmount)}
                    </td>
                    <td className="px-4 py-4 text-rose-600 font-semibold text-xs">
                      −{fmtINR(tx.commissionAmount)}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-700">
                      +{fmtINR(tx.netEarning)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        tx.paymentStatus === 'Paid' || tx.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tx.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerEarnings;
