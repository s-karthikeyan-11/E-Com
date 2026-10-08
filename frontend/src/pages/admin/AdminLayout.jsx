import React, { useState } from 'react';
import { BarChart3, Boxes, CreditCard, FileText, LayoutDashboard, Menu, ShoppingCart, Store, Truck, Users, X } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/sellers', label: 'Sellers', icon: Store },
  { to: '/admin/products', label: 'Products', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/delivery-partners', label: 'Delivery', icon: Truck },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/users', label: 'Users', icon: Users },
];

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="section-shell py-8 sm:py-10 lg:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin panel</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Operations dashboard</h1>
        </div>

        <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-indigo-500" />
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            <BarChart3 size={14} /> Live overview
          </span>
        </div>

        <button
          type="button"
          aria-label="Open admin menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 xl:hidden"
          onClick={() => setIsSidebarOpen((open) => !open)}
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[220px_1fr]">
        <aside className="hidden overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 text-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.12)] xl:block">
          <div className="border-b border-white/10 bg-gradient-to-br from-slate-800 to-slate-950 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white">S</div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Store</p>
                <h2 className="mt-1 text-lg font-bold text-white">Shopfront</h2>
              </div>
            </div>
          </div>

          <nav className="space-y-2 p-3">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="admin-shell p-4 sm:p-6">
          <Outlet />
        </div>
      </div>

      <div className={`fixed inset-0 z-50 transition ${isSidebarOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible xl:hidden'}`}>
        <div
          className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        <aside
          className={`absolute left-0 top-0 flex h-full w-[82%] max-w-sm flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="text-xl font-black tracking-tight text-slate-900">SHOPFRONT</div>
            <button type="button" aria-label="Close admin menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700" onClick={() => setIsSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass} onClick={() => setIsSidebarOpen(false)}>
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};

export default AdminLayout;
