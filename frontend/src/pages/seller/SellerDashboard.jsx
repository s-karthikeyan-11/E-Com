import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const SellerDashboard = () => {
  const outletContext = useOutletContext() || {};
  const seller = outletContext.seller;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/seller/dashboard')
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-rose-700 bg-rose-50 border-rose-200">
        <p className="font-semibold">{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary mt-3 text-xs">
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentOrders = data?.recentOrders || [];

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts || 0,
      icon: Boxes,
      tone: 'from-blue-600 to-indigo-700',
      sub: 'Active in catalogue',
      link: '/seller/products',
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders || 0,
      icon: Package,
      tone: 'from-indigo-600 to-purple-700',
      sub: `${stats.totalItemsSold || 0} items sold`,
      link: '/seller/orders',
    },
    {
      label: 'Gross Sales',
      value: fmtINR(stats.totalSales || 0),
      icon: TrendingUp,
      tone: 'from-emerald-600 to-teal-700',
      sub: 'Total customer purchases',
      link: '/seller/earnings',
    },
    {
      label: 'Net Earnings',
      value: fmtINR(stats.netEarnings || 0),
      icon: CircleDollarSign,
      tone: 'from-amber-600 to-orange-700',
      sub: `After ${stats.commissionRate || 10}% platform fee`,
      link: '/seller/earnings',
    },
    {
      label: 'Pending Orders',
      value: stats.pendingOrders || 0,
      icon: Clock,
      tone: stats.pendingOrders > 0 ? 'from-rose-600 to-pink-700' : 'from-slate-600 to-slate-700',
      sub: 'Awaiting fulfillment',
      link: '/seller/orders',
    },
    {
      label: 'Low-Stock Alerts',
      value: stats.lowStockProducts || 0,
      icon: AlertTriangle,
      tone: stats.lowStockProducts > 0 ? 'from-amber-500 to-yellow-600' : 'from-slate-600 to-slate-700',
      sub: 'Items below threshold',
      link: '/seller/products',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header with Quick Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Overview Dashboard</h2>
          <p className="text-xs text-slate-500">Live store performance and order fulfillment metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link
            to="/seller/reports"
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
          >
            <BarChart3 size={15} />
            <span>Reports</span>
          </Link>
          <Link
            to="/seller/products"
            className="btn btn-primary inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider shadow-sm"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* 6 Key Flipkart Seller KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.tone} p-5 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">{card.label}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
                  <Icon size={18} />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{card.value}</div>
              <p className="mt-1 text-xs text-white/80">{card.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Low-Stock Notification Banner (if any) */}
      {stats.lowStockProducts > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="shrink-0 text-amber-600" />
            <p className="text-xs font-semibold">
              You have <strong>{stats.lowStockProducts} products</strong> running low on inventory. Restock soon to prevent order delays.
            </p>
          </div>
          <Link to="/seller/products" className="shrink-0 text-xs font-bold text-amber-900 hover:underline">
            View Inventory →
          </Link>
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="card overflow-hidden shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Recent Customer Orders</h3>
            <p className="text-xs text-slate-500">Orders containing your products</p>
          </div>
          <Link
            to="/seller/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 hover:text-indigo-900"
          >
            <span>All Orders</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <ShoppingBag size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No customer orders yet</p>
            <p className="text-xs text-slate-400 mt-1">Orders with your products will appear here once placed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Items Sold</th>
                  <th className="px-5 py-3">Subtotal</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-900">
                      #{order._id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        {(order.items || []).slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-xs font-medium text-slate-700">
                            {item.name} <span className="text-slate-400 font-semibold">×{item.quantity}</span>
                          </div>
                        ))}
                        {(order.items || []).length > 2 && (
                          <span className="text-[10px] text-slate-400">+{(order.items || []).length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {fmtINR(order.sellerSubtotal)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        order.paymentStatus === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.paymentMethod} · {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString()}
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

export default SellerDashboard;
