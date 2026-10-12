import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Sparkles, X, ArrowRight, Tag, ShieldCheck, Zap } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';

// ── Image assets (unchanged URLs from original) ────────────────────────────
const heroImage = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80';
const categoryImages = {
  Electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  Apparel: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
  Footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  Home: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  Mobiles: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
  Cosmetics: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
  General: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
};

// ── Trust bar items ─────────────────────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: Zap, label: 'Fast Delivery', sub: 'Tracked to your door' },
  { icon: ShieldCheck, label: 'Secure Payments', sub: 'Razorpay & COD' },
  { icon: Tag, label: 'Best Prices', sub: 'Curated deals daily' },
];

// ═══════════════════════════════════════════════════════════════════════════
const Home = () => {
  // ── ALL state and logic preserved verbatim from original ─────────────────
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured');

  const load = async (q = '') => {
    setLoading(true);
    setLoadError('');
    try {
      const params = {};
      if (q) params.search = q;
      const { data } = await api.get('/products', { params });
      setProducts(data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Products could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const query = searchParams.get('search') || '';
    const category = searchParams.get('category') || 'All';
    setSearch(query);
    setSelectedCategory(category);
    load(query);
  }, [location.pathname, location.search, searchParams]);

  useEffect(() => {
    const target = location.hash.slice(1) || (location.pathname === '/categories' ? 'categories' : '');
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  }, [location.pathname, location.hash, loading]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    navigate(`/products${params.size ? `?${params}` : ''}#shop`);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    const params = new URLSearchParams(location.search);
    params.delete('search');
    if (category === 'All') params.delete('category');
    else params.set('category', category);
    navigate(`/products${params.size ? `?${params}` : ''}#shop`);
  };

  const showToast = (name) => {
    setToast(`Added "${name}" to cart`);
    setTimeout(() => setToast(''), 2200);
  };

  const categories = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      const key = product.category || 'General';
      map[key] = (map[key] || 0) + 1;
    });
    return ['All', ...Object.keys(map)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const price = Number(product.finalPrice || 0);
      const categoryMatch = selectedCategory === 'All' || (product.category || 'General') === selectedCategory;
      return categoryMatch && (!minPrice || price >= Number(minPrice)) && (!maxPrice || price <= Number(maxPrice)) && (!inStockOnly || Number(product.stock) > 0);
    });
    if (sortBy === 'price-low') return filtered.sort((a, b) => Number(a.finalPrice) - Number(b.finalPrice));
    if (sortBy === 'price-high') return filtered.sort((a, b) => Number(b.finalPrice) - Number(a.finalPrice));
    if (sortBy === 'name') return filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [products, selectedCategory, minPrice, maxPrice, inStockOnly, sortBy]);

  // ── Filter panel (logic unchanged, styling enhanced) ─────────────────────
  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Category</h3>
        <div className="mt-3 space-y-1">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Price range</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input aria-label="Minimum price" className="input px-2 text-sm" type="number" min="0" placeholder="Min ₹" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
          <input aria-label="Maximum price" className="input px-2 text-sm" type="number" min="0" placeholder="Max ₹" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Availability</h3>
        <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-slate-600">
          <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} className="h-4 w-4 rounded accent-indigo-600" />
          In stock only
        </label>
      </div>

      <div>
        <label htmlFor="product-sort" className="text-xs font-bold uppercase tracking-widest text-slate-400">Sort by</label>
        <select id="product-sort" className="input mt-3" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="featured">Featured</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="name">Name</option>
        </select>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-20">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[80px]" />

        <div className="section-shell relative z-10 py-16 sm:py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">

            {/* Left copy */}
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300 backdrop-blur-sm">
                <Sparkles size={12} className="text-amber-400" />
                Fresh arrivals · Curated essentials
              </span>

              <div className="space-y-5">
                <h1 className="max-w-xl text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Everything{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                    you want.
                  </span>
                  <br />
                  <span className="text-white/90">One beautiful store.</span>
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-slate-300/90">
                  Discover products curated for your everyday life — quality, comfort, and effortless style, delivered to your door.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#shop"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                >
                  Shop Now
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#categories"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/15 hover:-translate-y-0.5"
                >
                  Explore Collection
                </a>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap gap-5 pt-2">
                {TRUST_ITEMS.map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-indigo-300">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white/90">{label}</p>
                      <p className="text-[11px] text-slate-400">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right image */}
            <div className="relative">
              {/* Decorative ring */}
              <div className="absolute -inset-4 rounded-[40px] border border-white/5" />
              <div className="absolute -inset-8 rounded-[50px] border border-white/[0.03]" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-2.5 shadow-2xl backdrop-blur-sm">
                <img
                  src={heroImage}
                  alt="Premium lifestyle shopping"
                  className="h-[480px] w-full rounded-[26px] object-cover opacity-90 transition duration-500 hover:opacity-100 hover:scale-[1.01]"
                />
                {/* Floating badge */}
                <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/20 bg-slate-950/75 p-4 text-white backdrop-blur-md">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400">New Season</div>
                  <div className="mt-1.5 text-xl font-black">Elevated Essentials</div>
                  <div className="mt-1 text-xs text-slate-300">Discounts shown on every product</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" className="section-shell py-16 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Browse Collections</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Shop by Category</h2>
          </div>
          <a href="#shop" className="group hidden items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-700 sm:flex">
            View all <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        {loading ? (
          /* Loading skeleton */
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="h-56 bg-slate-200" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-16 rounded-full bg-slate-200" />
                  <div className="h-5 w-24 rounded-full bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryChange(category)}
                className={`group relative overflow-hidden rounded-3xl border text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
                  selectedCategory === category
                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={categoryImages[category] || heroImage}
                    alt={category}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent" />
                  {/* Active shimmer */}
                  {selectedCategory === category && (
                    <div className="absolute inset-0 bg-indigo-600/20" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {category === 'All'
                        ? products.length
                        : products.filter((p) => (p.category || 'General') === category).length}{' '}
                      products
                    </p>
                    <h3 className="mt-1.5 text-xl font-black">{category}</h3>
                  </div>
                </div>
                {selectedCategory === category && (
                  <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── PRODUCTS ── */}
      <section id="shop" className="section-shell py-16 sm:py-20">

        {/* Section header + search */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Top Picks</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Featured Products</h2>
          </div>

          {/* Search bar — handler unchanged */}
          <form
            className="flex w-full max-w-sm items-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition focus-within:border-indigo-400 focus-within:shadow-md"
            onSubmit={handleSearch}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search products..."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700">
              Search
            </button>
          </form>
        </div>

        {/* Active filter pill */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700">
            <SlidersHorizontal size={14} />
            {selectedCategory === 'All' ? 'All products' : selectedCategory}
            {visibleProducts.length > 0 && !loading && (
              <span className="ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {visibleProducts.length}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="btn btn-secondary gap-2 text-sm lg:hidden"
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>

        {/* Toast notification (logic unchanged) */}
        {toast && (
          <div className="mb-6 inline-flex animate-[fadeIn_0.2s_ease] items-center gap-2.5 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {toast}
          </div>
        )}

        {/* States: loading / error / empty / products (all logic unchanged) */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="animate-pulse rounded-2xl bg-slate-200 h-64" />
                <div className="mt-4 space-y-3 px-1">
                  <div className="h-3 w-16 rounded-full bg-slate-200" />
                  <div className="h-4 w-36 rounded-full bg-slate-200" />
                  <div className="h-6 w-24 rounded-full bg-slate-200" />
                  <div className="h-10 rounded-xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-500">
              <X size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Catalog unavailable</h3>
            <p className="mt-2 text-sm text-rose-700">{loadError}</p>
            <button type="button" className="btn btn-secondary mt-6" onClick={() => load(search)}>
              Try again
            </button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
              ⌕
            </div>
            <h3 className="text-2xl font-black text-slate-900">No products found</h3>
            <p className="mt-2 text-slate-500">Try a broader search or switch category to see more items.</p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Desktop sidebar filter */}
            <aside className="sticky top-24 hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
              <div className="mb-5 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <SlidersHorizontal size={14} />
                </span>
                <h2 className="text-sm font-black text-slate-900">Filters</h2>
              </div>
              {filterPanel}
            </aside>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product._id} product={product} onAdded={showToast} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── MOBILE FILTER DRAWER (logic unchanged, styling enhanced) ── */}
      <div className={`fixed inset-0 z-[60] transition ${filterOpen ? 'visible' : 'invisible pointer-events-none'}`}>
        <button
          aria-label="Close filters"
          className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity ${filterOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setFilterOpen(false)}
        />
        <aside className={`absolute inset-y-0 right-0 w-[min(88vw,380px)] overflow-y-auto bg-white shadow-2xl transition-transform ${filterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <SlidersHorizontal size={14} />
              </span>
              <h2 className="text-base font-black text-slate-900">Filters</h2>
            </div>
            <button
              onClick={() => setFilterOpen(false)}
              aria-label="Close filters"
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-5">
            {filterPanel}
            <button
              className="btn btn-primary mt-8 w-full py-3 text-base"
              onClick={() => setFilterOpen(false)}
            >
              Show {visibleProducts.length} products
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Home;
