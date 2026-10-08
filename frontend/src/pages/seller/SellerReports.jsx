import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Package,
  Percent,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { BarList, Donut, LineChart } from '../../components/charts/Charts';
import { fmtINR } from '../../utils/currency';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'allTime', label: 'All Time' },
];

const toInputDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const getRangeForPreset = (presetId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);

  if (presetId === 'today') {
    // start is today
  } else if (presetId === 'last7') {
    start.setDate(start.getDate() - 6);
  } else if (presetId === 'last30') {
    start.setDate(start.getDate() - 29);
  } else if (presetId === 'thisMonth') {
    start.setDate(1);
  } else if (presetId === 'allTime') {
    start.setFullYear(start.getFullYear() - 5);
  }

  return { from: toInputDate(start), to: toInputDate(end) };
};

const STATUS_COLORS = {
  Pending: '#f59e0b',
  Confirmed: '#3b82f6',
  Packed: '#8b5cf6',
  Shipped: '#06b6d4',
  Delivered: '#10b981',
  Cancelled: '#ef4444',
};

const downloadBlob = (blob, filename) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SellerReports = () => {
  const [preset, setPreset] = useState('last30');
  const [dateRange, setDateRange] = useState(() => getRangeForPreset('last30'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const { data: res } = await api.get('/seller/reports', {
        params: { from: dateRange.from, to: dateRange.to },
      });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate seller reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePresetChange = (presetId) => {
    setPreset(presetId);
    setDateRange(getRangeForPreset(presetId));
  };

  const handleCustomDateChange = (field, value) => {
    setPreset('custom');
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const handleExportCSV = () => {
    if (!data) return;

    const { summary, topProducts, dailyTrend, categoryBreakdown } = data;
    const rows = [
      ['Shopping-Now Seller Performance & Sales Report'],
      [`Date Range: ${summary.from} to ${summary.to}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['=== FINANCIAL SUMMARY ==='],
      ['Metric', 'Value'],
      ['Gross Merchandise Value (GMV)', `Rs. ${summary.grossSales.toFixed(2)}`],
      ['Platform Commission Deducted', `Rs. ${summary.totalCommission.toFixed(2)}`],
      ['Net Seller Earnings', `Rs. ${summary.netEarnings.toFixed(2)}`],
      ['Platform Commission Rate', `${summary.commissionRate}%`],
      ['Total Orders Received', summary.totalOrders],
      ['Total Units Sold', summary.unitsSold],
      ['Average Order Value (AOV)', `Rs. ${summary.avgOrderValue.toFixed(2)}`],
      ['Delivered Orders', summary.deliveredOrders],
      ['Pending / In-Transit Orders', summary.pendingOrders],
      ['Cancelled Orders', summary.cancelledOrders],
      [],
      ['=== TOP SELLING PRODUCTS ==='],
      ['Product ID', 'Product Title', 'Units Sold', 'Total Revenue (INR)'],
      ...topProducts.map((p) => [
        `"${p.id}"`,
        `"${p.name?.replace(/"/g, '""') || 'Product'}"`,
        p.units,
        `Rs. ${p.revenue.toFixed(2)}`,
      ]),
      [],
      ['=== CATEGORY BREAKDOWN ==='],
      ['Category', 'Revenue (INR)', 'Revenue Share (%)'],
      ...categoryBreakdown.map((c) => [
        `"${c.category}"`,
        `Rs. ${c.revenue.toFixed(2)}`,
        `${c.share}%`,
      ]),
      [],
      ['=== DAILY SALES TIMELINE ==='],
      ['Date', 'Revenue (INR)', 'Orders Count', 'Units Sold'],
      ...dailyTrend.map((d) => [d.date, `Rs. ${d.sales.toFixed(2)}`, d.orders, d.units]),
    ];

    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Seller_Report_${summary.from}_to_${summary.to}.csv`);
  };

  const summary = data?.summary || {};
  const dailyTrend = data?.dailyTrend || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const topProducts = data?.topProducts || [];
  const statusBreakdown = data?.statusBreakdown || {};

  // Donut slices for status distribution
  const statusSlices = [
    { label: 'Delivered', value: statusBreakdown.Delivered || 0, color: STATUS_COLORS.Delivered },
    { label: 'Shipped', value: statusBreakdown.Shipped || 0, color: STATUS_COLORS.Shipped },
    { label: 'Packed', value: statusBreakdown.Packed || 0, color: STATUS_COLORS.Packed },
    { label: 'Confirmed', value: statusBreakdown.Confirmed || 0, color: STATUS_COLORS.Confirmed },
    { label: 'Pending', value: statusBreakdown.Pending || 0, color: STATUS_COLORS.Pending },
    { label: 'Cancelled', value: statusBreakdown.Cancelled || 0, color: STATUS_COLORS.Cancelled },
  ];

  // Bar list for categories
  const categoryBarItems = categoryBreakdown.map((c) => ({
    label: c.category,
    value: c.revenue,
    sub: `${c.share}% of total store sales`,
  }));

  const totalStatusCount = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
  const deliverySuccessRate =
    totalStatusCount > 0
      ? (((statusBreakdown.Delivered || 0) / totalStatusCount) * 100).toFixed(1)
      : '100.0';

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileSpreadsheet size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Analytics & Insights
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
            Seller Store Reports
          </h2>
          <p className="text-xs text-slate-500">
            Real-time sales analytics, order fulfillment rate, revenue trends, and inventory health
          </p>
        </div>

        {/* Action Buttons & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  preset === p.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker inputs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleCustomDateChange('from', e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleCustomDateChange('to', e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchReports(true)}
            disabled={loading || refreshing}
            className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={!data || loading}
            className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="card p-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-4 text-xs font-semibold text-slate-500">Generating store analytics report…</p>
        </div>
      ) : data ? (
        <>
          {/* 6 Key Financial & Volume Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Gross Sales */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900 truncate">
                {fmtINR(summary.grossSales || 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Total customer spend</p>
            </div>

            {/* Platform Commission */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Commission</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Percent size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900 truncate">
                −{fmtINR(summary.totalCommission || 0)}
              </p>
              <p className="mt-1 text-[11px] text-amber-600 font-medium">
                {summary.commissionRate || 10}% platform fee
              </p>
            </div>

            {/* Net Earnings */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-soft">
              <div className="flex items-center justify-between text-emerald-100">
                <span className="text-[11px] font-bold uppercase tracking-wider">Net Earnings</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-md">
                  <CircleDollarSign size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-white truncate">
                {fmtINR(summary.netEarnings || 0)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-100">Take-home payout</p>
            </div>

            {/* Total Orders */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Package size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900">{summary.totalOrders || 0}</p>
              <p className="mt-1 text-[11px] text-slate-400">Order count</p>
            </div>

            {/* Units Sold */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Units Sold</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <ShoppingBag size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900">{summary.unitsSold || 0}</p>
              <p className="mt-1 text-[11px] text-slate-400">Products dispatched</p>
            </div>

            {/* Average Order Value (AOV) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Order Value</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <Layers size={15} />
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-slate-900 truncate">
                {fmtINR(summary.avgOrderValue || 0)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Basket size average</p>
            </div>
          </div>

          {/* Charts Row: Sales Timeline & Order Status Funnel */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sales Timeline Line Chart (2 Cols) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Daily Sales Trend</h3>
                  <p className="text-xs text-slate-500">
                    Gross merchandise value over the selected date range
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  <span>Sales (₹)</span>
                </div>
              </div>

              {dailyTrend.length > 0 ? (
                <div className="pt-2">
                  <LineChart data={dailyTrend} valueKey="sales" color="#4f46e5" />
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No sales recorded for this period.
                </div>
              )}
            </div>

            {/* Status Breakdown Donut Chart (1 Col) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Fulfillment Status</h3>
                    <p className="text-xs text-slate-500">Order lifecycle distribution</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    {deliverySuccessRate}% Delivered
                  </span>
                </div>

                <div className="py-2">
                  <Donut slices={statusSlices} />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Total Orders In Window:</span>
                <span className="font-bold text-slate-800">{totalStatusCount}</span>
              </div>
            </div>
          </div>

          {/* Row 3: Category Share & Top Selling Products */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Category Breakdown (1 Col) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">Sales by Category</h3>
                <p className="text-xs text-slate-500">Revenue contribution across store departments</p>
              </div>

              {categoryBarItems.length > 0 ? (
                <BarList items={categoryBarItems} color="#6366f1" />
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No category data for this period.
                </div>
              )}
            </div>

            {/* Top Products Table (2 Cols) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Top Performing Products</h3>
                  <p className="text-xs text-slate-500">Ranked by total revenue generated</p>
                </div>
                <Link
                  to="/seller/products"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Manage Products →
                </Link>
              </div>

              {topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Rank</th>
                        <th className="pb-3">Product</th>
                        <th className="pb-3 text-right">Units Sold</th>
                        <th className="pb-3 text-right">Revenue</th>
                        <th className="pb-3 text-right pr-2">Avg Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {topProducts.map((p, idx) => {
                        const avgPrice = p.units > 0 ? p.revenue / p.units : 0;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 pl-2">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                  idx === 0
                                    ? 'bg-amber-100 text-amber-800'
                                    : idx === 1
                                    ? 'bg-slate-200 text-slate-800'
                                    : idx === 2
                                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                    : 'text-slate-500'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className="font-semibold text-slate-900 line-clamp-1">
                                {p.name}
                              </span>
                            </td>
                            <td className="py-3 text-right font-medium text-slate-700">
                              {p.units}
                            </td>
                            <td className="py-3 text-right font-bold text-indigo-700">
                              {fmtINR(p.revenue)}
                            </td>
                            <td className="py-3 text-right pr-2 text-slate-500">
                              {fmtINR(avgPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No products sold in this period.
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Inventory Health & Stock Risk Watch */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Catalogue & Inventory Health</h3>
                <p className="text-xs text-slate-500">
                  Keep stock levels healthy to prevent order cancellations and boost seller score
                </p>
              </div>
              <Link to="/seller/products" className="btn btn-secondary text-xs px-3 py-1.5 self-start">
                Update Stock In Product Hub
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <span className="text-[11px] font-bold uppercase text-slate-500">Active Catalogue</span>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {summary.totalProducts || 0}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Published items</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <span className="text-[11px] font-bold uppercase text-slate-500">Units in Warehouse</span>
                <p className="mt-1 text-2xl font-black text-indigo-700">
                  {summary.totalInventoryCount || 0}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Total available stock</p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-amber-700">Low Stock Risk</span>
                  <AlertTriangle size={16} className="text-amber-600" />
                </div>
                <p className="mt-1 text-2xl font-black text-amber-900">
                  {summary.lowStockCount || 0}
                </p>
                <p className="mt-1 text-[11px] text-amber-700">≤ threshold quantity</p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-rose-700">Out of Stock</span>
                  <XCircle size={16} className="text-rose-600" />
                </div>
                <p className="mt-1 text-2xl font-black text-rose-900">
                  {summary.outOfStockCount || 0}
                </p>
                <p className="mt-1 text-[11px] text-rose-700">Zero inventory</p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default SellerReports;
