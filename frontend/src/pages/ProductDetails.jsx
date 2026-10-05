import React, { useEffect, useState } from 'react';
import { ArrowLeft, Heart, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { readStoredArray, writeStoredValue } from '../utils/storage';
import { formatDay } from '../utils/dates';

const ProductDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(() => readStoredArray('shopnowWishlist').includes(id));

  useEffect(() => {
    setProduct(null);
    setError('');
    setWishlisted(readStoredArray('shopnowWishlist').includes(id));
    api.get(`/products/${id}`).then(({ data }) => setProduct(data))
    .catch((err) => setError(err.response?.data?.message || 'Could not load this product'));
  }, [id]);

  const toggleWishlist = () => {
    const saved = readStoredArray('shopnowWishlist');
    const next = wishlisted ? saved.filter((savedId) => savedId !== id) : [...saved, id];
    writeStoredValue('shopnowWishlist', next);
    setWishlisted(!wishlisted);
  };

  const add = async () => {
    if (!user) return navigate('/login', { state: { from: { pathname: `/product/${id}` } } });
    try { await addToCart(id); setAdded(true); } catch (err) { setError(err.response?.data?.message || 'Could not add this item'); }
  };

  if (error && !product) return <div className="section-shell py-16 text-center"><h1 className="text-2xl font-bold">Product unavailable</h1><p className="mt-2 text-slate-600">{error}</p><button className="btn btn-primary mt-5" onClick={() => navigate('/products')}>Browse products</button></div>;
  if (!product) return <div className="section-shell py-16"><div className="grid animate-pulse gap-8 md:grid-cols-2"><div className="aspect-square rounded-2xl bg-slate-200" /><div className="h-80 rounded-2xl bg-slate-200" /></div></div>;

  return <div className="section-shell py-8 sm:py-12">
    <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />Back</button>
    <div className="grid items-start gap-8 md:grid-cols-2 md:gap-12">
      <div className="overflow-hidden rounded-2xl bg-slate-100"><img src={product.image || product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85'} alt={product.name} className="aspect-square w-full object-cover" /></div>
      <div className="py-2"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">{product.category || 'Collection'}</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{product.name}</h1><div className="mt-5 flex flex-wrap items-baseline gap-3"><span className="text-3xl font-bold">₹{Number(product.finalPrice || 0).toFixed(2)}</span>{Number(product.discountPercent) > 0 && <><span className="text-slate-400 line-through">₹{Number(product.price).toFixed(2)}</span><span className="text-sm font-semibold text-emerald-800">{product.discountPercent}% off</span></>}</div><p className="mt-6 whitespace-pre-line leading-7 text-slate-600">{product.description || 'A considered everyday essential, selected for quality and lasting use.'}</p>
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-600"><span className={`h-2 w-2 rounded-full ${product.stock > 0 ? 'bg-emerald-600' : 'bg-rose-500'}`} />{product.stock > 0 ? `${product.stock} available` : 'Out of stock'}</div>
        {product.estimatedDelivery && <div className="mt-3 flex items-center gap-2 text-sm text-slate-700"><Truck size={16} className="text-indigo-700" />Get it by <strong>{formatDay(product.estimatedDelivery)}</strong><span className="text-slate-500">({product.deliveryDays ?? 4}-day delivery)</span></div>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
        <div className="mt-7 flex gap-3"><button disabled={!product.stock} onClick={add} className="btn btn-primary flex-1 gap-2"><ShoppingCart size={17} />{added ? 'Added to bag' : 'Add to bag'}</button><button onClick={toggleWishlist} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${wishlisted ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-600'}`}><Heart size={18} fill={wishlisted ? 'currentColor' : 'none'} /></button></div>
        <div className="mt-8 grid gap-3 border-t border-slate-200 pt-5 text-sm text-slate-600 sm:grid-cols-2"><span className="flex items-center gap-2"><Truck size={16} className="text-emerald-800" />Free delivery over ₹2,000</span><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-800" />Secure checkout</span></div>
      </div>
    </div>
  </div>;
};

export default ProductDetails;
