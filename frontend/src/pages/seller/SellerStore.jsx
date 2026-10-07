import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Store,
  Star,
  ShieldCheck,
  MapPin,
  Calendar,
  Search,
  Package,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../../api/axios';
import ProductCard from '../../components/ProductCard';

const SellerStore = () => {
  const { sellerId } = useParams();
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Local filter states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    api
      .get(`/seller/store/${sellerId}`)
      .then(({ data }) => {
        if (isMounted) {
          setStoreData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Fallback check on /sellers/:id/store
          api
            .get(`/sellers/${sellerId}/store`)
            .then(({ data }) => {
              if (isMounted) {
                setStoreData(data);
                setLoading(false);
              }
            })
            .catch((fallbackErr) => {
              if (isMounted) {
                setError(
                  fallbackErr.response?.data?.message ||
                    err.response?.data?.message ||
                    'Seller storefront not found or currently inactive.'
                );
                setLoading(false);
              }
            });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sellerId]);

  const showToast = (productName) => {
    setToast(`"${productName}" added to your cart`);
    setTimeout(() => setToast(''), 3000);
  };

  const seller = storeData?.seller;
  const rawProducts = storeData?.products || [];

  // Extract unique categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(rawProducts.map((p) => p.category).filter(Boolean)));
    return ['All', ...list];
  }, [rawProducts]);

  // Filtered & sorted products
  const products = useMemo(() => {
    let result = [...rawProducts];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (sortBy === 'price-low') {
      result.sort((a, b) => (a.finalPrice || a.price) - (b.finalPrice || b.price));
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => (b.finalPrice || b.price) - (a.finalPrice || a.price));
    } else if (sortBy === 'discount') {
      result.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
    } else {
      // featured / newest
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  }, [rawProducts, search, selectedCategory, sortBy]);

  if (loading) {
    return (
      <div className="section-shell py-12">
        <div className="h-48 w-full animate-pulse rounded-3xl bg-slate-200" />
        <div className="-mt-16 ml-8 flex items-center gap-6">
          <div className="h-28 w-28 animate-pulse rounded-2xl bg-slate-300" />
          <div className="space-y-3 pt-16">
            <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="section-shell py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
          <Store size={36} />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Seller Storefront Not Found</h1>
        <p className="mt-2 text-slate-600 max-w-md mx-auto">{error || 'This seller does not exist or their store is temporarily inactive.'}</p>
        <Link to="/products" className="btn btn-primary mt-6 inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Explore All Products
        </Link>
      </div>
    );
  }

  const memberYear = seller.createdAt ? new Date(seller.createdAt).getFullYear() : '2024';
  const ratingValue = Number(seller.rating || 4.8).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-2xl">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Breadcrumb Nav */}
      <div className="border-b border-slate-200/80 bg-white py-3">
        <div className="section-shell flex items-center justify-between">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Back to Marketplace
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Verified Flipkart Merchant
          </span>
        </div>
      </div>

      <div className="section-shell mt-6">
        {/* Store Banner & Profile Header */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Banner */}
          <div className="relative h-44 w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 sm:h-56">
            {seller.storeBanner ? (
              <img
                src={seller.storeBanner}
                alt={seller.storeName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>

          {/* Store Info Bar */}
          <div className="relative px-6 pb-6 pt-4 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              {/* Logo + Titles */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="-mt-16 sm:-mt-20 relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
                  {seller.storeLogo ? (
                    <img
                      src={seller.storeLogo}
                      alt={seller.storeName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-600 text-3xl font-extrabold text-white">
                      {seller.storeName ? seller.storeName.charAt(0).toUpperCase() : 'S'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                      {seller.storeName}
                    </h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Verified Merchant
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-amber-900 font-bold">
                      <Star size={13} className="fill-amber-400 text-amber-500" />
                      {ratingValue} / 5.0
                    </span>
                    {seller.storeAddress?.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} />
                        {seller.storeAddress.city}
                        {seller.storeAddress.state ? `, ${seller.storeAddress.state}` : ''}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} />
                      Seller since {memberYear}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                      <Package size={13} />
                      {rawProducts.length} Listed {rawProducts.length === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges / Guarantees */}
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  ✓ 100% Genuine Products
                </span>
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  ✓ Fast Dispatch & Safe Delivery
                </span>
              </div>
            </div>

            {seller.storeDescription && (
              <p className="mt-5 text-sm leading-relaxed text-slate-600 max-w-3xl border-t border-slate-100 pt-4">
                {seller.storeDescription}
              </p>
            )}
          </div>
        </div>

        {/* Filter and Catalogue Section */}
        <div className="mt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Store Catalogue ({products.length})
              </h2>
              <p className="text-xs text-slate-500">
                Explore authentic collections fulfilled directly by {seller.storeName}
              </p>
            </div>

            {/* In-store Search & Sort */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search in this store..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-indigo-600 focus:outline-none"
              >
                <option value="featured">Featured / Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="discount">Biggest Discount</option>
              </select>
            </div>
          </div>

          {/* Category Chips */}
          {categories.length > 2 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="mt-6">
            {products.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center">
                <Package size={40} className="mx-auto text-slate-300" />
                <h3 className="mt-4 text-base font-bold text-slate-800">
                  No matching products found
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {search || selectedCategory !== 'All'
                    ? 'Try adjusting your search keywords or category filters.'
                    : 'This seller has not published active inventory yet.'}
                </p>
                {(search || selectedCategory !== 'All') && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSelectedCategory('All');
                    }}
                    className="btn btn-secondary mt-4 text-xs"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    onAdded={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerStore;
