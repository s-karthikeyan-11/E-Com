import React, { useEffect, useState } from 'react';
import { Eye, Heart, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { readStoredArray, writeStoredValue } from '../utils/storage';

const fallbackImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80';

const ProductCard = ({ product, onAdded, onWishlistChange }) => {
  const { user, isAdmin } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [imageSrc, setImageSrc] = useState(product.image || product.imageUrl || product.imageURL || fallbackImage);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cartError, setCartError] = useState('');
  const outOfStock = Number(product.stock) <= 0;

  useEffect(() => {
    const saved = readStoredArray('shopnowWishlist');
    setIsWishlisted(saved.includes(product._id));
  }, [product._id]);

  const handleWishlistToggle = () => {
    const saved = readStoredArray('shopnowWishlist');
    const next = isWishlisted ? saved.filter((id) => id !== product._id) : [...saved, product._id];
    writeStoredValue('shopnowWishlist', next);
    setIsWishlisted(!isWishlisted);
    onWishlistChange?.();
  };

  const handleAdd = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setAdding(true);
    setCartError('');
    try {
      await addToCart(product._id, 1);
      onAdded && onAdded(product.name);
    } catch (err) {
      setCartError(err.response?.data?.message || 'Could not reach the cart service. Please make sure the backend is running and try again.');
    } finally {
      setAdding(false);
    }
  };

  const salePercent = Math.max(Number(product.discountPercent || 0), 0);
  const price = Number(product.price || 0);

  return (
    <article className="group flex h-full min-h-[410px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.11)]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {salePercent > 0 && (
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                -{salePercent}%
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Save item"
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition ${
              isWishlisted
                ? 'border-rose-200 bg-rose-50 text-rose-500'
                : 'border-white/80 bg-white/80 text-slate-700 hover:border-slate-200 hover:text-rose-500'
            }`}
            onClick={handleWishlistToggle}
          >
            <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
          <button type="button" aria-label={`View ${product.name}`} title="Quick view" className="absolute right-12 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/85 text-slate-700 shadow-sm backdrop-blur-sm transition hover:text-indigo-700" onClick={() => navigate(`/product/${product._id}`)}>
            <Eye size={16} />
          </button>
        </div>

        <div className="relative h-64 overflow-hidden bg-slate-100">
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            onError={() => setImageSrc(fallbackImage)}
          />
          {outOfStock && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 px-3 py-2 text-center text-xs font-medium tracking-[0.1em] text-white uppercase">
              Out of stock
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{product.category || 'General'}</p>
            <button type="button" onClick={() => navigate(`/product/${product._id}`)} className="mt-2 line-clamp-2 min-h-12 text-left text-base font-semibold text-slate-900 hover:text-indigo-700">{product.name}</button>
          </div>
        </div>

        <div className="mt-auto flex items-end gap-2">
          <span className="text-2xl font-bold text-slate-900">₹{Number(product.finalPrice || 0).toFixed(2)}</span>
          {salePercent > 0 && <span className="pb-1 text-sm text-slate-400 line-through">₹{Number(price).toFixed(2)}</span>}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{product.gstPercent || 0}% GST included</span>
          {!outOfStock && <span className="font-medium text-emerald-600">{product.stock} in stock</span>}
        </div>

        {!isAdmin && (
          <>
          <button
            type="button"
            className="btn btn-primary w-full gap-2"
            disabled={outOfStock || adding}
            onClick={handleAdd}
          >
            <ShoppingCart size={16} />
            {adding ? 'Adding…' : user ? 'Add to Cart' : 'Log in to buy'}
          </button>
          {cartError && <p role="alert" className="text-xs leading-5 text-rose-700">{cartError}</p>}
          </>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
