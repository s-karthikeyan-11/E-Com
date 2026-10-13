import React, { useEffect, useState } from 'react';
import { Eye, Heart, ShoppingCart, Sparkles, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { readStoredArray, writeStoredValue } from '../utils/storage';

const fallbackImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80';

// ── All props, handlers, hooks, and business logic preserved verbatim ───────
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
    <article className="group flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(15,23,42,0.13)] hover:border-slate-300">

      {/* Image area */}
      <div className="relative overflow-hidden bg-slate-50">

        {/* Top overlay badges */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {salePercent > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-sm">
                <Sparkles size={9} />
                -{salePercent}%
              </span>
            )}
            {outOfStock && (
              <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                Sold out
              </span>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1.5">
            {/* Quick view */}
            <button
              type="button"
              aria-label={`View ${product.name}`}
              title="Quick view"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-indigo-700 hover:scale-110"
              onClick={() => navigate(`/product/${product._id}`)}
            >
              <Eye size={14} />
            </button>
            {/* Wishlist */}
            <button
              type="button"
              aria-label="Save item"
              className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition hover:scale-110 ${
                isWishlisted
                  ? 'border-rose-200 bg-rose-50 text-rose-500'
                  : 'border-white/80 bg-white/90 text-slate-500 hover:border-rose-200 hover:text-rose-500'
              }`}
              onClick={handleWishlistToggle}
            >
              <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Product image */}
        <div className="relative h-60 overflow-hidden">
          <img
            src={imageSrc}
            alt={product.name}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-108 ${outOfStock ? 'opacity-70 grayscale-[30%]' : ''}`}
            onError={() => setImageSrc(fallbackImage)}
          />
          {/* Subtle bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/20 to-transparent" />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">

        {/* Category + name */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600/80">
            {product.category || 'General'}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/product/${product._id}`)}
            className="mt-1 line-clamp-2 min-h-[2.6rem] text-left text-sm font-bold leading-snug text-slate-900 transition hover:text-indigo-700"
          >
            {product.name}
          </button>
        </div>

        {/* Star Rating row */}
        <div className="flex items-center gap-1.5 text-xs">
          {Number(product.numReviews || 0) > 0 ? (
            <>
              <div className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700 border border-amber-200/80 text-[11px]">
                <Star size={11} className="fill-amber-400 text-amber-500" />
                <span>{Number(product.rating || 0).toFixed(1)}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                ({product.numReviews})
              </span>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Star size={11} className="text-slate-300" />
              <span>No reviews yet</span>
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-end gap-2 mt-auto">
          <span className="text-2xl font-black tracking-tight text-slate-900">
            ₹{Number(product.finalPrice || 0).toFixed(2)}
          </span>
          {salePercent > 0 && (
            <span className="mb-0.5 text-sm font-medium text-slate-400 line-through">
              ₹{Number(price).toFixed(2)}
            </span>
          )}
        </div>

        {/* GST + stock */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{product.gstPercent || 0}% GST incl.</span>
          {!outOfStock ? (
            <span className="font-semibold text-emerald-600">{product.stock} in stock</span>
          ) : (
            <span className="font-semibold text-rose-500">Out of stock</span>
          )}
        </div>

        {/* Add to cart — logic and disabled states preserved */}
        {!isAdmin && (
          <div className="mt-auto">
            <button
              type="button"
              className={`w-full gap-2 rounded-2xl py-2.5 text-sm font-bold transition-all duration-200 inline-flex items-center justify-center
                ${outOfStock || adding
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0'
                }`}
              disabled={outOfStock || adding}
              onClick={handleAdd}
            >
              <ShoppingCart size={15} />
              {adding ? 'Adding…' : user ? 'Add to Cart' : 'Log in to buy'}
            </button>
            {cartError && (
              <p role="alert" className="mt-2 text-[11px] leading-5 text-rose-600">{cartError}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
