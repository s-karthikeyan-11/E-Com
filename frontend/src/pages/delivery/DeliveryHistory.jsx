import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  Package,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const DeliveryHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get('/delivery/history')
      .then(({ data }) => setHistory(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load delivery history'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = history.filter((s) => {
    const q = search.toLowerCase();
    const order = s.order || {};
    const addr = order.shippingAddress || {};
    return (
      s.trackingNumber?.toLowerCase().includes(q) ||
      addr.city?.toLowerCase().includes(q) ||
      s.receiverName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Fulfilled Deliveries History</h2>
          <p className="text-xs text-slate-500">
            Log of completed drop-offs, proof of delivery timestamps, and RTO events
          </p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search completed AWB, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full sm:w-64"
          />
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-rose-50 border-rose-200 text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-sky-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <History size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold">No delivery records found</p>
          <p className="text-xs text-slate-400 mt-1">
            Packages marked as Delivered or RTO will be archived here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">AWB / Order</th>
                  <th className="px-5 py-3">Destination City</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Final Status</th>
                  <th className="px-5 py-3">Delivered / Handed To</th>
                  <th className="px-5 py-3 text-right">Completion Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const order = s.order || {};
                  const addr = order.shippingAddress || {};
                  return (
                    <tr key={s._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-900 text-[11px]">
                          {s.trackingNumber}
                        </span>
                        {order._id && (
                          <div className="text-[10px] text-slate-400">
                            #{String(order._id).slice(-6).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-800">
                          {addr.city}, {addr.state}
                        </span>
                        <div className="text-[10px] text-slate-400">{addr.pincode}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-700">
                          {fmtINR(order.totalAmount || 0)}
                        </span>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          {order.paymentMethod || 'Online'} · {order.paymentStatus}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            s.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {s.receiverName ? (
                          <span className="font-medium">Received by: {s.receiverName}</span>
                        ) : s.failedReason ? (
                          <span className="text-rose-600 font-medium">NDR: {s.failedReason}</span>
                        ) : (
                          'Customer'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-medium">
                        {new Date(s.deliveredAt || s.updatedAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryHistory;
