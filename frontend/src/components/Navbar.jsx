import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Heart, House, LayoutGrid, LogOut, Search,
  ShoppingBag, ShoppingCart, Store, Truck,
  UserRound, WalletCards, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// ── All logic, handlers, auth context, cart context preserved verbatim ──────
const Navbar = () => {
  const { user, logout, isAdmin, isSeller, isDelivery } = useAuth();
  const { items } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(`/products${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  };

  const navLinks = [
    { to: '/', label: 'Home', end: true },
    { to: '/categories', label: 'Categories' },
  ];

  const mobileLinks = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/categories', label: 'Categories', icon: LayoutGrid },
    ...(!isAdmin && !isDelivery ? [{ to: '/wishlist', label: 'Wishlist', icon: Heart }] : []),
    ...(!isAdmin && !isDelivery ? [{ to: '/cart', label: 'Cart', icon: ShoppingCart, count: itemCount }] : []),
    ...(isSeller ? [{ to: '/seller/dashboard', label: 'Seller Hub', icon: Store }] : []),
    { to: user ? '/profile' : '/login', label: user ? 'Profile' : 'Login', icon: UserRound },
  ];

  return (
    <>
      {/* ── Desktop header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/96 shadow-[0_1px_12px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="section-shell flex min-h-[68px] items-center gap-4 py-2">

          {/* Logo */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 text-lg font-black text-slate-900 sm:text-xl"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200 transition group-hover:shadow-indigo-300">
              <ShoppingBag size={17} />
            </span>
            <span className="tracking-tight">
              SHOP<span className="text-indigo-600">-NOW</span>
            </span>
          </Link>

          {/* Search bar (desktop) — handler unchanged */}
          <form
            onSubmit={handleSearch}
            className="hidden min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 shadow-sm transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:shadow-md md:flex"
          >
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              aria-label="Search products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, brands and more"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700"
              type="submit"
            >
              Search
            </button>
          </form>

          {/* Desktop nav links */}
          <nav className="hidden shrink-0 items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => {
                  const active = isActive || (link.to === '/' && location.pathname === '/home');
                  return `relative rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`;
                }}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right action icons */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">

            {/* Role-based hub link */}
            {isDelivery ? (
              <Link
                to="/delivery/dashboard"
                className="hidden items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100 lg:inline-flex"
              >
                <Truck size={14} /> Delivery Hub
              </Link>
            ) : isSeller ? (
              <Link
                to="/seller/dashboard"
                className="hidden items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 lg:inline-flex"
              >
                <Store size={14} /> Seller Hub
              </Link>
            ) : !isAdmin ? (
              <Link
                to="/seller/register"
                className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 lg:inline-flex"
              >
                <Store size={14} className="text-slate-400" /> Become a Seller
              </Link>
            ) : null}

            {/* Wishlist */}
            {!isAdmin && !isDelivery && (
              <Link
                to="/wishlist"
                aria-label="Wishlist"
                title="Wishlist"
                className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-rose-500 lg:inline-flex"
              >
                <Heart size={18} />
              </Link>
            )}

            {/* Cart with badge */}
            {!isAdmin && !isDelivery && (
              <Link
                to="/cart"
                aria-label={`Cart, ${itemCount} items`}
                title="Cart"
                className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-indigo-700 lg:inline-flex"
              >
                <ShoppingCart size={18} />
                {itemCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white shadow-sm">
                    {itemCount}
                  </span>
                )}
              </Link>
            )}

            {/* Auth: Login/Register or Account dropdown */}
            {!user ? (
              <div className="hidden items-center gap-2 lg:flex">
                <Link to="/login" className="btn btn-secondary px-3.5 py-2 text-sm">Login</Link>
                <Link to="/register" className="btn btn-primary px-3.5 py-2 text-sm">Register</Link>
              </div>
            ) : (
              <div className="relative hidden lg:block">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <UserRound size={14} />
                  </span>
                  <span>{isAdmin ? 'Admin' : isSeller ? 'Seller' : isDelivery ? 'Delivery' : 'Account'}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu — all links preserved */}
                {profileOpen && (
                  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="truncate text-xs font-semibold text-slate-500">{user.name || user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        onClick={() => setProfileOpen(false)}
                        to={isAdmin ? '/admin' : '/profile'}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <UserRound size={15} className="text-slate-400" />
                        {isAdmin ? 'Admin dashboard' : 'My profile'}
                      </Link>
                      {isSeller && (
                        <Link
                          onClick={() => setProfileOpen(false)}
                          to="/seller/dashboard"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          <Store size={15} /> Seller Hub
                        </Link>
                      )}
                      {isDelivery && (
                        <Link
                          onClick={() => setProfileOpen(false)}
                          to="/delivery/dashboard"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                        >
                          <Truck size={15} /> Delivery Hub
                        </Link>
                      )}
                      {!isAdmin && !isSeller && !isDelivery && (
                        <Link
                          onClick={() => setProfileOpen(false)}
                          to="/seller/register"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Store size={15} className="text-slate-400" /> Become a Seller
                        </Link>
                      )}
                      {!isAdmin && (
                        <Link
                          onClick={() => setProfileOpen(false)}
                          to="/wallet"
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <WalletCards size={15} className="text-slate-400" /> Refund wallet
                        </Link>
                      )}
                      <Link
                        onClick={() => setProfileOpen(false)}
                        to="/orders"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ShoppingBag size={15} className="text-slate-400" /> Orders
                      </Link>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut size={15} /> Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile search bar — handler unchanged */}
        <form onSubmit={handleSearch} className="section-shell flex pb-2.5 md:hidden">
          <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white transition">
            <Search size={15} className="text-slate-400" />
            <input
              aria-label="Search products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button type="submit" className="text-xs font-bold text-indigo-600">Go</button>
          </div>
        </form>
      </header>

      {/* ── Mobile bottom nav — all links, icon, count, active logic unchanged */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:hidden"
      >
        <div className={`mx-auto grid h-16 max-w-xl ${isAdmin ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {mobileLinks.map(({ to, label, icon: Icon, count, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) => {
                const path = location.pathname;
                const active =
                  isActive ||
                  (label === 'Home' && ['/home', '/products', '/product'].some((r) => path === r || path.startsWith(`${r}/`))) ||
                  (label === 'Cart' && path === '/checkout') ||
                  ((label === 'Profile' || label === 'Login') && ['/profile', '/orders', '/order/', '/login', '/register'].some((r) => path === r || path.startsWith(r)));
                return `relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  active ? 'text-indigo-700' : 'text-slate-400'
                }`;
              }}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={2} />
                {count > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white">
                    {count}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
