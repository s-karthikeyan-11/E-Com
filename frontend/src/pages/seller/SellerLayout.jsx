import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const navItems = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/seller/products', label: 'Products', icon: Boxes },
  { to: '/seller/orders', label: 'Orders', icon: Package },
  { to: '/seller/earnings', label: 'Earnings', icon: CircleDollarSign },
  { to: '/seller/reports', label: 'Reports', icon: BarChart3 },
  { to: '/seller/profile', label: 'Store Profile', icon: Settings },
];

const SellerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    api.get('/seller/profile')
      .then(({ data }) => setSeller(data))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/seller/login');
  };

  return (
    <div className="section-shell py-6 sm:py-8">
      {/* Top Banner / Store Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md border border-white/20 shadow-inner">
            <Store size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-400/30">
                Verified Seller
              </span>
              <span className="text-xs text-indigo-200">
                ⭐ {seller?.rating?.toFixed(1) || '4.8'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {seller?.storeName || 'Seller Hub'}
            </h1>
            <p className="text-xs text-indigo-200/80">
              {seller?.email || user?.email} · Manage your products, orders and earnings
            </p>
          </div>
        </div>

        {seller?._id && (
          <Link
            to={`/store/${seller._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-indigo-900 shadow-sm transition hover:bg-indigo-50 hover:shadow"
          >
            <span>View Public Store</span>
            <ExternalLink size={14} />
          </Link>
        )}
      </div>

      {/* Main Grid: Sidebar + Outlet */}
      <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Sidebar Nav */}
        <aside className="card overflow-hidden p-3 shadow-soft">
          <div className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-indigo-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3">
            {seller?._id && (
              <Link
                to={`/store/${seller._id}`}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-indigo-700 transition"
              >
                <Store size={16} />
                <span>Customer Storefront</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Nested Content */}
        <section className="min-w-0">
          <Outlet context={{ seller, refreshSeller: () => api.get('/seller/profile').then(({ data }) => setSeller(data)) }} />
        </section>
      </div>
    </div>
  );
};

export default SellerLayout;
