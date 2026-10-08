import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  Clock,
  History,
  LayoutDashboard,
  LogOut,
  Navigation,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const navItems = [
  { to: '/delivery/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/delivery/orders', label: 'Assigned Orders', icon: Package },
  { to: '/delivery/history', label: 'Delivery History', icon: History },
];

const DeliveryLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    api
      .get('/delivery/profile')
      .then(({ data }) => setPartner(data.deliveryPartner))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/delivery/login');
  };

  return (
    <div className="section-shell py-6 sm:py-8">
      {/* Top Banner / Courier Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-sky-100 bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 p-6 text-white shadow-md sm:flex-row sm:items-center sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300 backdrop-blur-md border border-sky-400/30 shadow-inner">
            <Truck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 border border-sky-400/30">
                Logistics Partner
              </span>
              <span className="text-xs text-sky-200">
                ⭐ {partner?.rating?.toFixed(1) || '4.8'}
              </span>
              <span className="text-xs text-sky-300/80">
                · {partner?.serviceType || 'Standard'} ({partner?.vehicleType || 'Bike'})
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {partner?.name || user?.name || 'Delivery Hub'}
            </h1>
            <p className="text-xs text-sky-200/80">
              {partner?.email || user?.email} · Manage assigned shipments, order pickups, and proof of delivery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-soft'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Main Content Area */}
      <Outlet context={{ partner }} />
    </div>
  );
};

export default DeliveryLayout;
