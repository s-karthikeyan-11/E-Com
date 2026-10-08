import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  RotateCcw,
  ShieldAlert,
  Truck,
  XCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const DeliveryDashboard = () => {
  const { partner } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = () => {
    setLoading(true);
    api
      .get('/delivery/dashboard')
      .then(({ data: res }) => setData(res))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load delivery dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-rose-700 bg-rose-50 border-rose-200">
        <p className="font-semibold">{error}</p>
        <button onClick={loadDashboard} className="btn btn-secondary mt-3 text-xs">
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentShipments = data?.recentShipments || [];

  const statCards = [
    {
      label: 'Assigned Shipments',
      value: stats.totalAssigned || 0,
      icon: Package,
      tone: 'from-slate-800 to-slate-900',
      sub: 'All active assignments',
      link: '/delivery/orders',
    },
    {
      label: 'Ready For Pickup',
      value: stats.pendingPickup || 0,
      icon: Clock,
      tone: 'from-amber-500 to-amber-600',
      sub: 'Awaiting hub pickup',
      link: '/delivery/orders?status=Assigned',
    },
    {
      label: 'In Transit',
      value: stats.inTransit || 0,
      icon: Truck,
      tone: 'from-blue-600 to-indigo-700',
      sub: 'On the road / between hubs',
      link: '/delivery/orders?status=In Transit',
    },
    {
      label: 'Out for Delivery',
      value: stats.outForDelivery || 0,
      icon: Navigation,
      tone: 'from-purple-600 to-pink-700',
      sub: 'Final mile delivery',
      link: '/delivery/orders?status=Out for Delivery',
    },
    {
      label: 'Delivered',
      value: stats.delivered || 0,
      icon: CheckCircle2,
      tone: 'from-emerald-600 to-teal-700',
      sub: 'Successfully fulfilled',
      link: '/delivery/orders?status=Delivered',
    },
    {
      label: 'NDR / Failed Attempts',
      value: stats.failedDelivery || 0,
      icon: AlertTriangle,
      tone: stats.failedDelivery > 0 ? 'from-rose-600 to-red-700' : 'from-slate-600 to-slate-700',
      sub: 'Requires customer contact',
      link: '/delivery/orders?status=Failed Delivery',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Logistics Overview</h2>
          <p className="text-xs text-slate-500">Live package assignment counts and dispatch pipeline</p>
        </div>
        <Link
          to="/delivery/orders"
          className="btn btn-primary inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-wider shadow-sm sm:self-auto"
        >
          <Package size={15} />
          <span>View All Assigned Orders</span>
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className={`rounded-2xl bg-gradient-to-br ${card.tone} p-4 text-white shadow-soft transition hover:scale-[1.02] flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between text-white/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider">{card.label}</span>
                  <Icon size={16} />
                </div>
                <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
              </div>
              <p className="mt-2 text-[10px] text-white/70 font-medium">{card.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent Deliveries Pipeline */}
      <div className="card overflow-hidden shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Active Shipments Pipeline
            </h3>
            <p className="text-xs text-slate-500">Recent assignments requiring pickup or final delivery</p>
          </div>
          <Link
            to="/delivery/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 hover:text-sky-900"
          >
            <span>Manage Orders</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentShipments.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <Truck size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No active shipments assigned</p>
            <p className="text-xs text-slate-400 mt-1">
              New orders dispatched by warehouse administrators will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">AWB / Tracking</th>
                  <th className="px-5 py-3">Destination Address</th>
                  <th className="px-5 py-3">Payment Mode</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentShipments.map((s) => {
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
                            Order #{String(order._id).slice(-6).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-800">
                              {addr.city}, {addr.state} ({addr.pincode})
                            </span>
                            <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                              {addr.line1}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              order.paymentMethod === 'Cash on Delivery'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {order.paymentMethod || 'Online'}
                          </span>
                          {order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'Paid' && (
                            <div className="mt-1 font-bold text-rose-600 text-[11px]">
                              Collect {fmtINR(order.totalAmount || 0)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            s.status === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'Out for Delivery'
                              ? 'bg-purple-100 text-purple-800'
                              : s.status === 'In Transit'
                              ? 'bg-blue-100 text-blue-800'
                              : s.status === 'Failed Delivery'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to="/delivery/orders"
                          className="btn btn-secondary text-[11px] py-1 px-3"
                        >
                          Update
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryDashboard;
