import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, PackageCheck } from 'lucide-react';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { BarList, Donut, LineChart } from '../../components/charts/Charts';
import { fmtINR } from '../../utils/currency';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(30);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data);
    } catch (requestError) {
      setStats(null);
      setError(requestError.response?.data?.message || 'The dashboard could not be loaded. Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const to = new Date();
    const from = new Date(Date.now() - (days - 1) * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    api.get('/admin/analytics', { params: { from: fmt(from), to: fmt(to) } })
      .then(({ data }) => setAnalytics(data))
      .catch(() => setAnalytics(null));
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-[24px] bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div role="alert" className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <h2 className="text-xl font-bold">Dashboard unavailable</h2>
        <p className="mt-2 text-sm text-rose-700">{error || 'The dashboard did not return any data.'}</p>
        <button type="button" className="btn btn-primary mt-5" onClick={loadDashboard}>Try again</button>
      </div>
    );
  }

  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const ordersByStatus = stats.ordersByStatus || {};
  const lowStockProducts = Array.isArray(stats.lowStockProducts) ? stats.lowStockProducts : [];
  const statusColors = {
    Pending: 'bg-amber-100 text-amber-700',
    Processing: 'bg-sky-100 text-sky-700',
    Shipped: 'bg-violet-100 text-violet-700',
    Delivered: 'bg-emerald-100 text-emerald-700',
    Cancelled: 'bg-rose-100 text-rose-700',
  };
  const totalOrders = Number(stats.totalOrders || 0);
  const deliveredOrders = Number(ordersByStatus.Delivered || 0);
  const activeFulfillment = ['Pending', 'Processing', 'Shipped']
    .reduce((sum, status) => sum + Number(ordersByStatus[status] || 0), 0);
  const deliveryCompletion = totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Dashboard</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="admin-badge border-slate-200 bg-slate-50 text-slate-600">Live store data</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-600">
            <PackageCheck size={12} /> {activeFulfillment} active fulfillment{activeFulfillment === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total users', value: stats.totalUsers, tone: 'from-slate-900 to-slate-700', icon: 'U' },
          { label: 'Total products', value: stats.totalProducts, tone: 'from-violet-600 to-indigo-500', icon: 'P' },
          { label: 'Total orders', value: stats.totalOrders, tone: 'from-indigo-500 to-teal-500', icon: 'O' },
          { label: 'Total sales', value: `₹${Number(stats.totalSales || 0).toFixed(2)}`, tone: 'from-amber-500 to-orange-500', icon: '₹' },
        ].map((item) => (
          <div key={item.label} className="overflow-hidden rounded-[26px] border border-slate-200 bg-gradient-to-br p-[1px] shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
            <div className={`h-full rounded-[25px] bg-gradient-to-br ${item.tone} p-5 text-white`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{item.label}</div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">{item.icon}</div>
              </div>
              <div className="mt-5 text-3xl font-bold tracking-tight">{item.value}</div>
            </div>
          </div>
        ))}
      </div>


      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="admin-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">Revenue trend</h3>
            <select className="input w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Chart period">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <LineChart data={analytics?.salesByDay} />
          <p className="mt-2 text-xs text-slate-500">Excludes cancelled and unpaid (awaiting payment) orders.</p>
        </div>

        <div className="admin-card p-5">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Orders by status</h3>
          <Donut
            slices={[
              { label: 'Pending', value: analytics?.ordersByStatus?.find((s) => s.status === 'Pending')?.count || 0, color: '#f59e0b' },
              { label: 'Processing', value: analytics?.ordersByStatus?.find((s) => s.status === 'Processing')?.count || 0, color: '#0ea5e9' },
              { label: 'Shipped', value: analytics?.ordersByStatus?.find((s) => s.status === 'Shipped')?.count || 0, color: '#8b5cf6' },
              { label: 'Delivered', value: analytics?.ordersByStatus?.find((s) => s.status === 'Delivered')?.count || 0, color: '#10b981' },
              { label: 'Cancelled', value: analytics?.ordersByStatus?.find((s) => s.status === 'Cancelled')?.count || 0, color: '#f43f5e' },
            ]}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="admin-card p-5">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Top products by revenue</h3>
          <BarList
            items={(analytics?.topProducts || []).map((p) => ({ label: p.name, value: p.revenue, sub: `${p.quantity} sold` }))}
          />
        </div>
        <div className="admin-card p-5">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Revenue by payment method</h3>
          <BarList
            color="#059669"
            items={(analytics?.paymentMethods || []).map((m) => ({ label: m.method, value: m.amount, sub: `${m.count} orders` }))}
            format={fmtINR}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-slate-900">Orders by status</h3>
            <span className="text-sm text-slate-500">All orders</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statuses.map((s) => (
              <div key={s} className="admin-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`admin-badge ${statusColors[s]}`}>{s}</span>
                </div>
                <div className="mt-5 text-3xl font-bold text-slate-900">{ordersByStatus[s] || 0}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-900">Operational health</h3>
            <PackageCheck className="text-emerald-600" size={18} />
          </div>

          <div className="mt-5 space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-600">
                <span>Products needing restock</span>
                <span className={`font-semibold ${lowStockProducts.length ? 'text-amber-700' : 'text-indigo-600'}`}>{lowStockProducts.length}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className={`h-2 rounded-full ${lowStockProducts.length ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: lowStockProducts.length ? '100%' : '0%' }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery completion</span>
                <span className="font-semibold text-violet-700">{deliveryCompletion}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-violet-500" style={{ width: `${deliveryCompletion}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-slate-600">
                <span>Orders delivered</span>
                <span className="font-semibold text-indigo-600">{deliveredOrders}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${deliveryCompletion}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-slate-900">Low stock products</h3>
          <span className="inline-flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle size={14} /> Needs attention
          </span>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-600">
            No products are low on stock.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[24px] border border-slate-200">
            <table className="w-full min-w-[560px] border-collapse bg-white">
              <thead>
                <tr>
                  <th className="table-th">Product</th>
                  <th className="table-th">Stock</th>
                  <th className="table-th">Threshold</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((p) => (
                  <tr key={p._id}>
                    <td className="table-td font-medium text-slate-800">{p.name}</td>
                    <td className="table-td">
                      <span className="table-chip bg-rose-100 text-rose-700">{p.stock}</span>
                    </td>
                    <td className="table-td">{p.lowStockThreshold}</td>
                    <td className="table-td">
                      <Link to="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-slate-700">
                        Manage stock <ArrowUpRight size={14} />
                      </Link>
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

export default Dashboard;
