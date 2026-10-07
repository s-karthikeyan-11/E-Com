import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, House, LayoutGrid, LogOut, Search, ShoppingBag, ShoppingCart, Store, UserRound, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const navClass = ({ isActive }) =>
  `relative px-2 py-2 text-sm font-medium transition ${
    isActive ? 'text-emerald-800' : 'text-slate-600 hover:text-slate-900'
  }`;

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const { items } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [profileOpen, setProfileOpen] = useState(false);

  const isSeller = user?.role === 'seller';

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
    // { to: '/products', label: 'Shop' },
  ];

  const mobileLinks = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/categories', label: 'Categories', icon: LayoutGrid },
    ...(!isAdmin && !isSeller ? [{ to: '/wishlist', label: 'Wishlist', icon: Heart }] : []),
    ...(!isAdmin && !isSeller ? [{ to: '/cart', label: 'Cart', icon: ShoppingCart, count: itemCount }] : []),
    ...(isSeller ? [{ to: '/seller/dashboard', label: 'Seller Hub', icon: Store }] : []),
    { to: user ? '/profile' : '/login', label: user ? 'Profile' : 'Login', icon: UserRound },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="section-shell flex min-h-16 items-center gap-4 py-2.5 sm:min-h-[76px]">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-black text-slate-900 sm:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-700 text-white"><ShoppingBag size={17} /></span>
            <span>SHOP-NOW</span>
          </Link>

          <form onSubmit={handleSearch} className="hidden min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-600 md:flex">
            <Search size={17} className="shrink-0 text-slate-500" />
            <input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, brands and more" className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400" />
            <button className="text-sm font-semibold text-indigo-700" type="submit">Search</button>
          </form>

          <nav className="hidden shrink-0 items-center gap-3 lg:flex">
            {navLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => navClass({ isActive: isActive || (link.to === '/' && location.pathname === '/home') })}>{link.label}</NavLink>)}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {isSeller ? (
              <Link to="/seller/dashboard" className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-xs">
                <Store size={15} />
                Seller Hub
              </Link>
            ) : !isAdmin ? (
              <Link to="/seller/register" className="hidden lg:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs">
                <Store size={15} className="text-slate-500" />
                Become a Seller
              </Link>
            ) : null}

            {!isAdmin && !isSeller && <Link to="/wishlist" aria-label="Wishlist" title="Wishlist" className="hidden h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 lg:inline-flex"><Heart size={19} /></Link>}
            {!isAdmin && !isSeller && <Link to="/cart" aria-label={`Cart, ${itemCount} items`} title="Cart" className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 lg:inline-flex">
              <ShoppingCart size={19} />
              {itemCount > 0 && <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-indigo-700 px-1 text-[10px] font-bold text-white">{itemCount}</span>}
            </Link>}
            {!user ? <div className="hidden items-center gap-2 lg:flex"><Link to="/login" className="btn btn-secondary px-3 py-2">Login</Link><Link to="/register" className="btn btn-primary px-3 py-2">Register</Link></div> : (
              <div className="relative hidden lg:block">
                <button type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><UserRound size={17} /><span>{isAdmin ? 'Admin' : isSeller ? 'Seller Account' : 'Account'}</span></button>
                {profileOpen && <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><p className="truncate px-3 py-2 text-xs text-slate-500">{user.name || user.email}</p><Link onClick={() => setProfileOpen(false)} to={isAdmin ? '/admin' : '/profile'} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{isAdmin ? 'Admin dashboard' : 'My profile'}</Link>{isSeller && <Link onClick={() => setProfileOpen(false)} to="/seller/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"><Store size={15} />Seller Hub</Link>}{!isAdmin && !isSeller && <Link onClick={() => setProfileOpen(false)} to="/seller/register" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Store size={15} />Become a Seller</Link>}{!isAdmin && <Link onClick={() => setProfileOpen(false)} to="/wallet" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><WalletCards size={15} />Refund wallet</Link>}<Link onClick={() => setProfileOpen(false)} to="/orders" className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Orders</Link><button type="button" onClick={() => { setProfileOpen(false); handleLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"><LogOut size={15} />Log out</button></div>}
              </div>
            )}
          </div>
        </div>
        <form onSubmit={handleSearch} className="section-shell flex pb-2 md:hidden">
          <div className="flex w-full items-center rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={16} className="text-slate-500" /><input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button type="submit" className="sr-only">Search</button></div>
        </form>
      </header>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden">
        <div className={`mx-auto grid h-16 max-w-xl ${isAdmin ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {mobileLinks.map(({ to, label, icon: Icon, count, end }) => <NavLink key={label} to={to} end={end} className={({ isActive }) => {
            const path = location.pathname;
            const active = isActive || (label === 'Home' && ['/home', '/products', '/product'].some((route) => path === route || path.startsWith(`${route}/`))) || (label === 'Cart' && path === '/checkout') || ((label === 'Profile' || label === 'Login') && ['/profile', '/orders', '/order/', '/login', '/register'].some((route) => path === route || path.startsWith(route)));
            return `relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition ${active ? 'text-indigo-700' : 'text-slate-500'}`;
          }}>
            <span className="relative"><Icon size={19} strokeWidth={2} />{count > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-700 px-1 text-[9px] font-bold text-white">{count}</span>}</span>
            <span>{label}</span>
          </NavLink>)}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
