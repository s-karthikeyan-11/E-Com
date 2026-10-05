import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';

const heroImage = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80';
const categoryImages = {
  Electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  Apparel: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
  Footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  Home: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  Mobiles:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
  Cosmetics:'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
  General: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
};

const Home = () => {
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

  const filterPanel = <div className="space-y-5">
    <div><h3 className="text-sm font-bold text-slate-900">Category</h3><div className="mt-2 space-y-1">{categories.map((category) => <button type="button" key={category} onClick={() => handleCategoryChange(category)} className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm ${selectedCategory === category ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>{category}</button>)}</div></div>
    <div><h3 className="text-sm font-bold text-slate-900">Price range</h3><div className="mt-2 grid grid-cols-2 gap-2"><input aria-label="Minimum price" className="input px-2" type="number" min="0" placeholder="Min ₹" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /><input aria-label="Maximum price" className="input px-2" type="number" min="0" placeholder="Max ₹" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></div></div>
    <div><h3 className="text-sm font-bold text-slate-900">Availability</h3><label className="mt-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} className="h-4 w-4 accent-emerald-800" />In stock only</label></div>
    <div><label htmlFor="product-sort" className="text-sm font-bold text-slate-900">Sort by</label><select id="product-sort" className="input mt-2" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></div>
  </div>;

  return (
    <div className="pb-20">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_#f8fafc_55%,_#f1f5f9)]">
        <div className="section-shell py-8 sm:py-12 lg:py-16">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                <Sparkles size={12} />
                Fresh arrivals · Curated essentials
              </span>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-black leading-[1.05] text-slate-900 sm:text-5xl lg:text-6xl">
                  Everything you want.<br />
                  One beautiful store.
                </h1>
                <p className="max-w-xl text-lg text-slate-600">
                  Discover products curated for your everyday life, designed to blend quality, comfort, and effortless style.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="#shop" className="btn btn-primary px-6 py-3 text-base">Shop Now</a>
                <a href="#categories" className="btn btn-secondary px-6 py-3 text-base">Explore Collection</a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 top-8 h-32 w-32 rounded-full bg-amber-200/60 blur-3xl" />
              <div className="absolute -right-10 bottom-4 h-40 w-40 rounded-full bg-sky-200/60 blur-3xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-3 shadow-soft">
                <img src={heroImage} alt="Premium lifestyle shopping" className="h-[520px] w-full rounded-[24px] object-cover" />
                <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/60 bg-slate-900/70 p-4 text-white backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-300">New season</div>
                  <div className="mt-2 text-2xl font-bold">Elevated essentials</div>
                  <div className="mt-1 text-sm text-slate-200">Discounts shown on every product</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="section-shell py-14 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Curated picks</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Shop by Category</h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="animate-pulse overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200/80">
                <div className="h-52 bg-slate-300" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-20 rounded bg-slate-300" />
                  <div className="h-3 w-28 rounded bg-slate-300" />
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
                className={`group relative overflow-hidden rounded-[26px] border text-left shadow-sm transition hover:-translate-y-1 hover:shadow-soft ${
                  selectedCategory === category ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={categoryImages[category] || heroImage}
                    alt={category}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-200">{category === 'All' ? products.length : (products.filter((product) => (product.category || 'General') === category).length)} products</p>
                    <h3 className="mt-2 text-2xl font-bold">{category}</h3>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section id="shop" className="section-shell py-14 sm:py-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Top picks</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Featured Products</h2>
          </div>
          <form className="flex w-full max-w-md items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:max-w-sm" onSubmit={handleSearch}>
            <Search size={18} className="ml-2 text-slate-500" />
            <input
              type="text"
              placeholder="Search products..."
              className="input border-0 bg-transparent px-1 py-2.5 shadow-none focus:ring-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary whitespace-nowrap">Search</button>
          </form>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
            <SlidersHorizontal size={15} /> Filtered by: {selectedCategory}
          </span>
          <button type="button" onClick={() => setFilterOpen(true)} className="btn btn-secondary gap-2 lg:hidden"><SlidersHorizontal size={16} />Filters</button>
        </div>

        {toast && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
            {toast}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className="animate-pulse rounded-[20px] bg-slate-200 h-64" />
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-5 w-32 rounded bg-slate-200" />
                  <div className="h-5 w-24 rounded bg-slate-200" />
                  <div className="h-10 rounded-xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"><h3 className="text-lg font-bold text-slate-900">We could not load the catalog</h3><p className="mt-2 text-sm text-rose-800">{loadError}</p><button type="button" className="btn btn-secondary mt-4" onClick={() => load(search)}>Try again</button></div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">⌕</div>
            <h3 className="text-2xl font-bold text-slate-900">No products found</h3>
            <p className="mt-2 text-slate-500">Try a broader search or switch category to see more items.</p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="sticky top-24 hidden rounded-2xl border border-slate-200 bg-white p-4 lg:block">{filterPanel}</aside>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product._id} product={product} onAdded={showToast} />)}</div>
          </div>
        )}
      </section>

      <div className={`fixed inset-0 z-[60] transition ${filterOpen ? 'visible' : 'invisible pointer-events-none'}`}>
        <button aria-label="Close filters" className={`absolute inset-0 bg-slate-950/45 transition-opacity ${filterOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setFilterOpen(false)} />
        <aside className={`absolute inset-y-0 right-0 w-[min(88vw,360px)] overflow-y-auto bg-white p-5 shadow-2xl transition-transform ${filterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-bold">Filters</h2><button onClick={() => setFilterOpen(false)} aria-label="Close filters" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={19} /></button></div>
          {filterPanel}<button className="btn btn-primary mt-7 w-full" onClick={() => setFilterOpen(false)}>Show {visibleProducts.length} products</button>
        </aside>
      </div>
    </div>
  );
};

export default Home;
