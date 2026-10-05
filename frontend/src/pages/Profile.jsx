import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Heart, LogOut, MapPin, Package, Settings, UserRound, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = [
    { label: 'Orders', detail: 'View and track your purchases', to: '/orders', icon: Package },
    ...(user?.role !== 'admin' ? [{ label: 'Wishlist', detail: 'Your saved products', to: '/wishlist', icon: Heart }] : []),
    ...(user?.role !== 'admin' ? [{ label: 'Refund wallet', detail: `Balance ₹${Number(user?.walletBalance || 0).toFixed(2)}`, to: '/wallet', icon: WalletCards }] : []),
    { label: 'Addresses', detail: 'Manage saved delivery addresses', to: '/addresses', icon: MapPin },
    { label: 'Payment methods', detail: 'Choose a method at checkout', to: '/checkout', icon: CreditCard },
    { label: 'Settings', detail: 'Account preferences', to: '/profile', icon: Settings },
  ];
  const handleLogout = () => { logout(); navigate('/'); };

  return <div className="section-shell py-8 sm:py-12">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Your account</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Profile</h1></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:gap-5 sm:p-7">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700"><UserRound size={28} /></div>
      <div className="mt-4 min-w-0 sm:mt-0"><h2 className="text-xl font-bold">{user?.name}</h2><p className="mt-1 break-all text-sm text-slate-500">{user?.email}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">{user?.role === 'admin' ? 'Administrator' : 'Shop member'}</p></div>
      <button onClick={handleLogout} className="btn btn-outline mt-5 gap-2 sm:ml-auto sm:mt-0"><LogOut size={16} />Log out</button>
    </section>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map(({ label, detail, to, icon: Icon }) => <Link key={label} to={to} className="group flex min-h-28 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-600 hover:shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700"><Icon size={19} /></span><span><span className="block font-semibold text-slate-900">{label}</span><span className="mt-1 block text-sm text-slate-500">{detail}</span></span></Link>)}
    </div>
  </div>;
};

export default Profile;
