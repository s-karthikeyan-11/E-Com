import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Heart,
  LogOut,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const isSeller = user?.role === 'seller';
  const isDelivery = user?.role === 'delivery';
  const isAdmin = user?.role === 'admin';

  const links = [
    { label: 'Orders', detail: 'View and track your purchases', to: '/orders', icon: Package },
    ...(!isAdmin
      ? [{ label: 'Wishlist', detail: 'Your saved products', to: '/wishlist', icon: Heart }]
      : []),
    ...(!isAdmin
      ? [
          {
            label: 'Refund wallet',
            detail: `Balance ₹${Number(user?.walletBalance || 0).toFixed(2)}`,
            to: '/wallet',
            icon: WalletCards,
          },
        ]
      : []),
    { label: 'Addresses', detail: 'Manage saved delivery addresses', to: '/addresses', icon: MapPin },
    { label: 'Payment methods', detail: 'Choose a method at checkout', to: '/checkout', icon: CreditCard },
    {
      label: isSeller ? 'Seller Hub' : 'Become a Seller',
      detail: isSeller ? 'Manage products, orders & earnings' : 'Register your store and sell products',
      to: isSeller ? '/seller/dashboard' : '/seller/register',
      icon: Store,
      badge: isSeller ? 'Active' : 'Earn',
      highlight: !isSeller,
    },
    {
      label: isDelivery ? 'Delivery Hub' : 'Earn as Delivery Partner',
      detail: isDelivery ? 'View assigned shipments & routes' : 'Deliver packages & earn with our fleet',
      to: isDelivery ? '/delivery/dashboard' : '/delivery/register',
      icon: Truck,
      badge: isDelivery ? 'Active' : 'Earn',
      highlight: !isDelivery,
    },
    {
      label: 'Settings',
      detail: 'Account preferences & partner programs',
      action: () => setShowSettingsModal(true),
      icon: Settings,
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="section-shell py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Your account</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Profile</h1>
      </div>

      {/* User Information Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:gap-5 sm:p-7">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
          <UserRound size={28} />
        </div>
        <div className="mt-4 min-w-0 sm:mt-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
            {isAdmin && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-800">
                Admin
              </span>
            )}
            {isSeller && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-800">
                Seller
              </span>
            )}
            {isDelivery && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                Courier Fleet
              </span>
            )}
          </div>
          <p className="mt-1 break-all text-sm text-slate-500">{user?.email}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {isAdmin
              ? 'Administrator'
              : isSeller
              ? 'Verified Seller'
              : isDelivery
              ? 'Delivery Partner'
              : 'Shop Member'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-outline mt-5 gap-2 sm:ml-auto sm:mt-0 text-slate-700 hover:text-rose-700"
        >
          <LogOut size={16} />
          Log out
        </button>
      </section>

      {/* Account Navigation Grid */}
      <div className="mt-6">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Account Shortcuts
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    item.highlight
                      ? 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100'
                      : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700'
                  }`}
                >
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="block font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500 leading-relaxed">
                    {item.detail}
                  </span>
                </span>
              </>
            );

            if (item.action) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="group flex min-h-24 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-600 hover:shadow-md"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.to}
                className="group flex min-h-24 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-600 hover:shadow-md"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Earn & Partner Opportunities Section */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
              Grow & Earn With Us
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              Partner Opportunities
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Card 1: Become a Seller */}
          <div className="relative overflow-hidden rounded-3xl border border-purple-200/80 bg-gradient-to-br from-white via-purple-50/30 to-indigo-50/50 p-6 sm:p-7 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-200">
                <Store size={24} />
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-800">
                {isSeller ? 'Your Store' : 'E-Commerce Seller'}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
              {isSeller ? 'Access Seller Hub' : 'Become a Seller & Sell Online'}
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed sm:text-sm">
              {isSeller
                ? 'Manage your live inventory, track customer orders, view commission statements, and grow your sales.'
                : 'List your products in front of thousands of customers. Enjoy simple catalog onboarding, low commission fees, and fast weekly payouts.'}
            </p>

            <div className="mt-5 pt-4 border-t border-purple-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-900">
                {isSeller ? 'Seller Portal Active' : 'Start Selling Today'}
              </span>
              <Link
                to={isSeller ? '/seller/dashboard' : '/seller/register'}
                className="btn btn-primary py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
              >
                <span>{isSeller ? 'Go to Dashboard' : 'Apply as Seller'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2: Earn as Delivery Partner */}
          <div className="relative overflow-hidden rounded-3xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/30 to-blue-50/50 p-6 sm:p-7 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-200">
                <Truck size={24} />
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-800">
                {isDelivery ? 'Fleet Member' : 'Courier Fleet'}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
              {isDelivery ? 'Access Delivery Hub' : 'Earn as a Delivery Partner'}
            </h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed sm:text-sm">
              {isDelivery
                ? 'View your assigned dispatches, update customer checkpoint milestones, and monitor delivery history.'
                : 'Deliver packages with flexible working hours, transparent per-delivery payouts, and local neighborhood routes with our delivery app.'}
            </p>

            <div className="mt-5 pt-4 border-t border-sky-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-900">
                {isDelivery ? 'Rider Account Active' : 'Flexible Earnings'}
              </span>
              <Link
                to={isDelivery ? '/delivery/dashboard' : '/delivery/register'}
                className="btn btn-primary bg-sky-600 hover:bg-sky-700 py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs border-sky-600"
              >
                <span>{isDelivery ? 'Go to Hub' : 'Become a Partner'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Account Settings</h3>
                <p className="text-xs text-slate-500">Preferences, security & partner programs</p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Profile Details */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Account Information
                </span>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Name:</span>
                    <p className="font-semibold text-slate-800">{user?.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <p className="font-semibold text-slate-800 truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Partner Programs */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Partner Programs & Earning
                </span>
                <div className="mt-2 space-y-2">
                  <Link
                    to={isSeller ? '/seller/dashboard' : '/seller/register'}
                    onClick={() => setShowSettingsModal(false)}
                    className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/50 p-3 hover:bg-purple-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white">
                        <Store size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {isSeller ? 'Seller Hub (Active)' : 'Become a Seller'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isSeller ? 'Open store management' : 'Register your store and sell products'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-purple-600" />
                  </Link>

                  <Link
                    to={isDelivery ? '/delivery/dashboard' : '/delivery/register'}
                    onClick={() => setShowSettingsModal(false)}
                    className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50/50 p-3 hover:bg-sky-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white">
                        <Truck size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {isDelivery ? 'Delivery Hub (Active)' : 'Earn as Delivery Partner'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isDelivery ? 'Open courier portal' : 'Join our logistics fleet and earn'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-sky-600" />
                  </Link>
                </div>
              </div>

              {/* Security info */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Password & Session Protected</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleLogout();
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="btn btn-secondary text-xs px-5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
