import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';
import { readStoredArray } from '../utils/storage';

const Wishlist = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(() => readStoredArray('shopnowWishlist'));

  useEffect(() => {
    api.get('/products').then(({ data }) => setProducts(data)).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  const saved = products.filter((product) => savedIds.includes(product._id));
  const syncSaved = () => setSavedIds(readStoredArray('shopnowWishlist'));

  return <div className="section-shell py-8 sm:py-12">
    <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Saved for later</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your wishlist</h1></div>
    {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-2xl bg-slate-200" />)}</div> : saved.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{saved.map((product) => <ProductCard key={product._id} product={product} onWishlistChange={syncSaved} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center"><Heart size={28} className="mx-auto text-slate-400" /><h2 className="mt-4 text-xl font-bold">Nothing saved yet</h2><p className="mt-2 text-sm text-slate-500">Tap the heart on a product to keep it here.</p></div>}
  </div>;
};

export default Wishlist;
