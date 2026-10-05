import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CircleDollarSign, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const formatINR = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/wallet')
      .then(({ data }) => setWallet(data))
      .catch((err) => setError(err.response?.data?.message || 'Your wallet could not be loaded.'));
  }, []);

  if (error) {
    return <div className="section-shell py-16 text-center"><h1 className="text-2xl font-bold">Wallet unavailable</h1><p className="mt-2 text-slate-600">{error}</p></div>;
  }

  if (!wallet) {
    return <div className="section-shell py-12"><div className="h-48 animate-pulse rounded-3xl bg-slate-200" /></div>;
  }

  return (
    <div className="section-shell py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Your account</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Wallet</h1>
      </div>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 to-violet-600 p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-white/75">Available balance</p><p className="mt-3 text-4xl font-bold tracking-tight">{formatINR(wallet.balance)}</p></div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><CircleDollarSign size={25} /></span>
        </div>
        <p className="mt-6 max-w-xl text-sm leading-6 text-white/80">Refunds for cancelled, paid orders are added here automatically. Renewing a cancelled order uses this balance.</p>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><History className="text-indigo-700" size={21} /><h2 className="text-xl font-bold">Wallet activity</h2></div>
        {wallet.transactions.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Your refunds will appear here.</p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100">
            {wallet.transactions.map((transaction) => {
              const isPayment = transaction.type === 'Payment';
              return <li key={transaction._id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0"><p className="font-semibold text-slate-900">{isPayment ? 'Renewal payment' : 'Order refund'}</p><p className="mt-1 text-sm text-slate-500">{new Date(transaction.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                <div className="flex items-center gap-3"><span className={`font-bold ${isPayment ? 'text-rose-700' : 'text-emerald-700'}`}>{isPayment ? '−' : '+'}{formatINR(transaction.amount)}</span><Link className="text-slate-500 hover:text-indigo-700" to={`/order/${transaction.order}`} aria-label="View related order"><ArrowUpRight size={18} /></Link></div>
              </li>;
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Wallet;
