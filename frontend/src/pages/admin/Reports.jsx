import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/axios';
import { BarList, Donut, LineChart } from '../../components/charts/Charts';
import { fmtINR } from '../../utils/currency';

const PAGE_SIZE = 25;
const REPORT_TIME_ZONE = 'Asia/Kolkata';
const PIE_COLORS = ['#4f46e5', '#059669', '#f59e0b', '#e11d48', '#0ea5e9', '#8b5cf6', '#f97316', '#64748b'];

const toInputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const inrWithCents = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayMoney = (value) => (value == null ? 'Not tracked' : fmtINR(value));
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: REPORT_TIME_ZONE }) : '—');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: REPORT_TIME_ZONE }) : '—');

const rangeForPreset = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);
  if (preset === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  else if (preset === 'last7') start.setDate(start.getDate() - 6);
  else if (preset === 'last30') start.setDate(start.getDate() - 29);
  else if (preset === 'thisMonth') start.setDate(1);
  else if (preset === 'lastMonth') { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); }
  else if (preset === 'thisYear') start.setMonth(0, 1);
  return { from: toInputDate(start), to: toInputDate(end) };
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const xmlEscape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const reportRows = (report) => [
  ['Shopping Now — Admin Reports'],
  [`Period: ${report.filters.from} to ${report.filters.to}`],
  [`Generated: ${formatDateTime(report.generatedAt)}`], [],
  ['Summary metric', 'Value'],
  ['Total sales', inrWithCents(report.summary.totalSales)],
  ['Total revenue', inrWithCents(report.summary.totalRevenue)],
  ['Net profit', report.summary.netProfit == null ? 'Not tracked' : inrWithCents(report.summary.netProfit)],
  ['Orders', report.summary.totalOrders],
  ['Average order value', inrWithCents(report.summary.averageOrderValue)],
  ['Customers', report.summary.totalCustomers],
  ['Refund amount', inrWithCents(report.summary.totalRefunds)], [],
  ['Order ID', 'Order date', 'Customer', 'Email', 'Items', 'Amount', 'Payment method', 'Payment status', 'Order status', 'Transaction ID', 'Refund status'],
  ...report.orderHistory.items.map((order) => [
    `#${String(order._id).slice(-6).toUpperCase()}`, formatDate(order.createdAt), order.customer?.name || 'Deleted customer', order.customer?.email || '',
    (order.items || []).map((item) => `${item.name} x${item.quantity}`).join(', '), inrWithCents(order.reportAmount), order.paymentMethod,
    order.paymentStatus, order.status, order.razorpayPaymentId || order.razorpayOrderId || '—', order.refundStatus,
  ]),
];

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

const KpiCard = ({ label, value, detail, tone = 'from-slate-900 to-slate-700' }) => (
  <div className={`rounded-[24px] bg-gradient-to-br ${tone} p-5 text-white shadow-sm`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">{label}</p>
    <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
    {detail && <p className="mt-2 text-xs leading-5 text-white/75">{detail}</p>}
  </div>
);

const SectionTitle = ({ eyebrow, title, detail }) => (
  <div className="mb-4">
    {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>}
    <h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3>
    {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
  </div>
);

const AdminReports = () => {
  const initial = rangeForPreset('last30');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState('last30');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const paramsFor = useCallback((reportPage = page, limit = PAGE_SIZE) => ({
    from, to, ...(category ? { category } : {}), ...(paymentMethod ? { paymentMethod } : {}), ...(orderStatus ? { orderStatus } : {}), page: reportPage, limit,
  }), [from, to, category, paymentMethod, orderStatus, page]);

  const load = useCallback(async () => {
    if (!from || !to || from > to) {
      setError('Choose a valid date range. The start date must not be after the end date.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/reports', { params: paramsFor() });
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError.response?.data?.message || 'Could not load the reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to, paramsFor]);

  useEffect(() => { void load(); }, [load]);

  const setFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const changePreset = (event) => {
    const value = event.target.value;
    setPreset(value);
    if (value !== 'custom') {
      const range = rangeForPreset(value);
      setFrom(range.from); setTo(range.to); setPage(1);
    }
  };

  const exportReport = async (kind) => {
    setExporting(true);
    setError('');
    try {
      const { data } = await api.get('/admin/reports', { params: paramsFor(1, 10000) });
      const rows = reportRows(data);
      const fileBase = `shopping-now-report_${data.filters.from}_to_${data.filters.to}`;
      if (kind === 'csv') {
        downloadBlob(new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${fileBase}.csv`);
      } else if (kind === 'excel') {
        const cells = rows.map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join('')}</Row>`).join('');
        const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Reports"><Table>${cells}</Table></Worksheet></Workbook>`;
        downloadBlob(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${fileBase}.xls`);
      } else {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18); doc.text('Shopping Now — Admin Report', 14, 17);
        doc.setFontSize(9); doc.setTextColor(90); doc.text(`Period: ${data.filters.from} to ${data.filters.to}  |  Generated: ${formatDateTime(data.generatedAt)}`, 14, 24); doc.setTextColor(0);
        autoTable(doc, {
          startY: 30, head: [['Sales', 'Revenue', 'Net profit', 'Orders', 'AOV', 'Refunds']],
          body: [[inrWithCents(data.summary.totalSales), inrWithCents(data.summary.totalRevenue), data.summary.netProfit == null ? 'Not tracked' : inrWithCents(data.summary.netProfit), data.summary.totalOrders, inrWithCents(data.summary.averageOrderValue), inrWithCents(data.summary.totalRefunds)]],
          headStyles: { fillColor: [30, 41, 59] },
        });
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 7, head: [['Order', 'Date', 'Customer', 'Items', 'Amount', 'Payment', 'Status', 'Refund']],
          body: data.orderHistory.items.map((order) => [
            `#${String(order._id).slice(-6).toUpperCase()}`, formatDate(order.createdAt), order.customer?.name || 'Deleted customer',
            (order.items || []).map((item) => `${item.name} x${item.quantity}`).join(', '), inrWithCents(order.reportAmount), `${order.paymentMethod} (${order.paymentStatus})`, order.status, order.refundStatus,
          ]), headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 7, cellPadding: 2 }, columnStyles: { 3: { cellWidth: 70 } },
        });
        const pages = doc.getNumberOfPages();
        for (let number = 1; number <= pages; number += 1) {
          doc.setPage(number); doc.setFontSize(8); doc.setTextColor(100);
          doc.text(`Page ${number} of ${pages}`, doc.internal.pageSize.getWidth() - 31, doc.internal.pageSize.getHeight() - 8);
        }
        doc.save(`${fileBase}.pdf`);
      }
      if (data.orderHistory.truncated) setError('The export is limited to the first 10,000 matching orders. Narrow the filters to export the rest.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create the export.');
    } finally {
      setExporting(false);
    }
  };

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report?.orderHistory.items || [];
    return (report?.orderHistory.items || []).filter((order) => [order._id, order.customer?.name, order.customer?.email, order.paymentMethod, order.status, order.paymentStatus].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [report, search]);

  const statusSlices = report ? Object.entries(report.orders.statuses).filter(([, count]) => count > 0).map(([label, value], index) => ({ label, value, color: PIE_COLORS[index % PIE_COLORS.length] })) : [];
  const categorySlices = (report?.sales.categories || []).map((item, index) => ({ label: item.category, value: item.revenue, color: PIE_COLORS[index % PIE_COLORS.length] }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Business intelligence</p><h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Reports & analytics</h2><p className="mt-2 max-w-3xl text-sm text-slate-500">Live order, payment, customer, catalog, and financial performance from your store database.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn btn-outline" type="button" onClick={() => exportReport('csv')} disabled={!report || exporting}><Download size={16} className="mr-2" />CSV</button><button className="btn btn-outline" type="button" onClick={() => exportReport('excel')} disabled={!report || exporting}><FileSpreadsheet size={16} className="mr-2" />Excel</button><button className="btn btn-primary" type="button" onClick={() => exportReport('pdf')} disabled={!report || exporting}><FileText size={16} className="mr-2" />{exporting ? 'Preparing…' : 'PDF'}</button></div>
      </div>

      <div className="admin-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Period<select className="input mt-1 font-normal normal-case tracking-normal" value={preset} onChange={changePreset}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="thisYear">This year</option><option value="custom">Custom range</option></select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">From<input className="input mt-1 font-normal normal-case tracking-normal" type="date" value={from} max={to} onChange={(event) => { setPreset('custom'); setFrom(event.target.value); setPage(1); }} /></label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">To<input className="input mt-1 font-normal normal-case tracking-normal" type="date" value={to} min={from} max={toInputDate(new Date())} onChange={(event) => { setPreset('custom'); setTo(event.target.value); setPage(1); }} /></label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Category<select className="input mt-1 font-normal normal-case tracking-normal" value={category} onChange={setFilter(setCategory)}><option value="">All categories</option>{(report?.filterOptions.categories || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Payment method<select className="input mt-1 font-normal normal-case tracking-normal" value={paymentMethod} onChange={setFilter(setPaymentMethod)}><option value="">All methods</option>{(report?.filterOptions.paymentMethods || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Order status<select className="input mt-1 font-normal normal-case tracking-normal" value={orderStatus} onChange={setFilter(setOrderStatus)}><option value="">All statuses</option>{(report?.filterOptions.orderStatuses || []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>Dates are evaluated in {REPORT_TIME_ZONE}. Filters update every KPI, chart, and table.</span><button className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900" type="button" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button></div>
      </div>

      {error && <div role="alert" className="mt-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="shrink-0" size={18} /><span>{error}</span></div>}
      {loading && <div className="mt-6 space-y-5" aria-label="Loading reports"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-[24px] bg-slate-200" />)}</div><div className="h-72 animate-pulse rounded-[26px] bg-slate-100" /></div>}

      {!loading && report && <div className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total sales" value={fmtINR(report.summary.totalSales)} detail="Settled item sales, including GST" tone="from-indigo-600 to-violet-600" />
          <KpiCard label="Total revenue" value={fmtINR(report.summary.totalRevenue)} detail={report.summary.salesGrowthPercentage == null ? 'No comparable previous-period sales' : `${report.summary.salesGrowthPercentage >= 0 ? '+' : ''}${report.summary.salesGrowthPercentage}% vs previous period`} tone="from-emerald-600 to-teal-500" />
          <KpiCard label="Net profit" value={displayMoney(report.summary.netProfit)} detail={report.summary.netProfit == null ? 'Costs or gateway fees are not fully recorded' : 'Estimated before operating overhead'} tone="from-slate-900 to-slate-700" />
          <KpiCard label="Total orders" value={report.summary.totalOrders} detail={`${report.orders.statuses.Delivered || 0} delivered`} tone="from-sky-600 to-cyan-500" />
          <KpiCard label="Average order value" value={fmtINR(report.summary.averageOrderValue)} detail="Based on settled, non-cancelled orders" tone="from-fuchsia-600 to-pink-500" />
          <KpiCard label="Customers" value={report.summary.totalCustomers} detail={`${report.customers.repeat} repeat · ${report.customers.new} new registrations`} tone="from-amber-500 to-orange-500" />
          <KpiCard label="Sellers" value="Not available" detail="No seller, commission, or payout records exist" tone="from-slate-500 to-slate-600" />
          <KpiCard label="Refunds" value={fmtINR(report.summary.totalRefunds)} detail={`${report.orders.refunded} wallet-credit refund${report.orders.refunded === 1 ? '' : 's'}`} tone="from-rose-600 to-red-500" />
        </div>

        {!report.sellers.available && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Seller reports are unavailable:</strong> {report.sellers.note}</div>}
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><div className="admin-card p-5"><SectionTitle eyebrow="Sales" title="Daily sales trend" detail="Only successfully collected, non-cancelled orders are included." /><LineChart data={report.sales.daily} valueKey="sales" color="#4f46e5" /></div><div className="admin-card p-5"><SectionTitle eyebrow="Order reports" title="Order status distribution" /><Donut slices={statusSlices} /></div></div>
        <div className="grid gap-6 lg:grid-cols-2"><div className="admin-card p-5"><SectionTitle eyebrow="Sales" title="Monthly revenue comparison" /><BarList items={report.sales.monthly.map((item) => ({ label: item.month, value: item.sales, sub: `${item.orders} settled orders` }))} color="#4f46e5" /></div><div className="admin-card p-5"><SectionTitle eyebrow="Sales" title="Category-wise sales" /><Donut slices={categorySlices} /></div></div>
        <div className="grid gap-6 lg:grid-cols-2"><div className="admin-card p-5"><SectionTitle eyebrow="Products" title="Top products by revenue" /><BarList items={report.sales.topProducts.map((item) => ({ label: item.name, value: item.revenue, sub: `${item.quantity} units sold` }))} color="#059669" /></div><div className="admin-card p-5"><SectionTitle eyebrow="Customers" title="Top customer spending" /><BarList items={report.customers.top.map((item) => ({ label: item.name, value: item.spending, sub: `${item.orderCount} order${item.orderCount === 1 ? '' : 's'}` }))} color="#0ea5e9" /></div></div>

        <div className="admin-card p-5"><SectionTitle eyebrow="Revenue and profit" title="Financial breakdown" detail={report.financials.profitNote} /><div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">{[
          ['Gross product value', report.financials.grossProductValue], ['Product markdowns', report.financials.productDiscount], ['Coupon discounts', report.financials.couponDiscount], ['GST collected', report.financials.gstCollected], ['Delivery charges', report.financials.deliveryCharges], ['Product cost', report.financials.productCost], ['Gateway fees', report.financials.paymentGatewayFees], ['Refund amount', report.financials.refundAmount], ['Net revenue', report.financials.netRevenue], ['Estimated net profit', report.financials.estimatedNetProfit], ['Platform commission', report.financials.platformCommission], ['Seller earnings', report.financials.sellerEarnings],
        ].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-900">{displayMoney(value)}</span></div>)}</div></div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><div className="admin-card p-5"><SectionTitle eyebrow="Payments" title="Collection analytics" /><div className="grid gap-3 sm:grid-cols-2">{[
          ['Successful payments', report.payments.successful.amount, report.payments.successful.count], ['Failed payments', report.payments.failed.amount, report.payments.failed.count], ['Pending payments', report.payments.pending.amount, report.payments.pending.count], ['COD collection', report.payments.codCollection, null], ['Online collection', report.payments.onlineCollection, null], ['Refund amount', report.payments.refundAmount, null],
        ].map(([label, amount, count]) => <div key={label} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{fmtINR(amount)}</p>{count != null && <p className="text-xs text-slate-500">{count} transaction{count === 1 ? '' : 's'}</p>}</div>)}</div></div><div className="admin-card p-5"><SectionTitle eyebrow="Order reports" title="Cancellation and returns analysis" /><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-2xl font-bold text-rose-600">{report.orders.cancellation.count}</p><p className="mt-1 text-sm text-slate-500">Cancelled orders</p></div><div><p className="text-2xl font-bold text-slate-900">{fmtINR(report.orders.cancellation.refundAmount)}</p><p className="mt-1 text-sm text-slate-500">Cancelled-order refunds</p></div><div><p className="text-2xl font-bold text-slate-500">Not tracked</p><p className="mt-1 text-sm text-slate-500">Returns require a return workflow</p></div></div><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{report.orders.cancellation.note}</p></div></div>

        <div className="grid gap-6 lg:grid-cols-2"><div className="admin-card p-5"><SectionTitle eyebrow="Product reports" title="Best-selling products" /><BarList items={report.products.bestSelling.map((item) => ({ label: item.name, value: item.quantity, sub: fmtINR(item.revenue) }))} color="#f59e0b" format={(value) => `${value} units`} /></div><div className="admin-card p-5"><SectionTitle eyebrow="Inventory" title="Low-stock and out-of-stock products" /><div className="space-y-3">{[...report.products.outOfStock, ...report.products.lowStock].slice(0, 10).map((item) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="truncate font-medium text-slate-800">{item.name}</span><span className={`shrink-0 font-semibold ${item.stock === 0 ? 'text-rose-600' : 'text-amber-700'}`}>{item.stock === 0 ? 'Out of stock' : `${item.stock} in stock`}</span></div>)}{report.products.lowStock.length === 0 && report.products.outOfStock.length === 0 && <p className="py-5 text-center text-sm text-slate-500">No low-stock products.</p>}</div></div></div>

        <div className="admin-card p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionTitle eyebrow="Order and payment history" title="Transactions" detail={`${report.orderHistory.total} matching order${report.orderHistory.total === 1 ? '' : 's'}`} /><input className="input max-w-xs" placeholder="Search this page" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[1120px] border-collapse bg-white"><thead><tr>{['Transaction ID', 'Order ID', 'Customer', 'Method', 'Amount', 'Payment date', 'Payment status', 'Refund status', 'Order status'].map((label) => <th key={label} className="table-th">{label}</th>)}</tr></thead><tbody>{visibleOrders.map((order) => <tr key={order._id}><td className="table-td font-mono text-xs">{order.razorpayPaymentId || order.razorpayOrderId || '—'}</td><td className="table-td font-semibold text-slate-800">#{String(order._id).slice(-6).toUpperCase()}</td><td className="table-td"><p className="font-medium text-slate-800">{order.customer?.name || 'Deleted customer'}</p><p className="text-xs text-slate-500">{order.customer?.email}</p></td><td className="table-td">{order.paymentMethod}</td><td className="table-td font-semibold">{fmtINR(order.reportAmount)}</td><td className="table-td">{formatDateTime(order.paidAt || order.createdAt)}</td><td className="table-td">{order.paymentStatus}</td><td className="table-td">{order.refundStatus}</td><td className="table-td">{order.status}</td></tr>)}{visibleOrders.length === 0 && <tr><td className="table-td py-10 text-center text-slate-500" colSpan={9}>No matching orders found.</td></tr>}</tbody></table></div><div className="mt-4 flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Page {report.orderHistory.page} of {Math.max(1, Math.ceil(report.orderHistory.total / report.orderHistory.limit))}</span><div className="flex gap-2"><button className="btn btn-outline px-3 py-2" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="btn btn-outline px-3 py-2" type="button" disabled={page * report.orderHistory.limit >= report.orderHistory.total || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></div></div>

        <details className="admin-card p-5 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-900">Calculation formulas and data availability</summary><div className="mt-3 space-y-2 leading-6"><p><strong>Total sales:</strong> {report.formulas.totalSales}</p><p><strong>Total revenue:</strong> {report.formulas.totalRevenue}</p><p><strong>Net revenue:</strong> {report.formulas.netRevenue}</p><p><strong>Estimated net profit:</strong> {report.formulas.estimatedNetProfit}</p><p>Returns, partial refunds, sellers, commissions, and payouts are labeled unavailable because this database does not store those records. No placeholder values are used.</p></div></details>
      </div>}
    </div>
  );
};

export default AdminReports;
