import React, { useEffect, useState, useCallback } from 'react';
import {
  Star,
  ThumbsUp,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Edit3,
  MessageSquare,
  Filter,
  ArrowUpDown,
  Sparkles,
  X,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StarRating from './StarRating';
import ReviewModal from './ReviewModal';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rating' },
  { value: 'lowest', label: 'Lowest Rating' },
  { value: 'helpful', label: 'Most Helpful' },
];

const ProductReviews = ({ productId, product }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const [sort, setSort] = useState('recent');
  const [starFilter, setStarFilter] = useState(null);

  // Customer eligibility state
  const [eligibility, setEligibility] = useState({
    canReview: false,
    isVerifiedPurchase: false,
    existingReview: null,
    reason: null,
  });
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Modal states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [deleteModalReview, setDeleteModalReview] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch reviews feed
  const loadReviews = useCallback(async (targetPage = 1, append = false) => {
    if (!productId) return;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit: 8,
        sort,
      });
      if (starFilter) params.append('star', starFilter);

      const { data } = await api.get(`/reviews/product/${productId}?${params.toString()}`);

      setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
      setPage(data.page);
      setPages(data.pages);
      setTotalCount(data.totalCount);
      setAverageRating(data.averageRating);
      setTotalReviews(data.totalReviews);
      setRatingDistribution(data.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load customer reviews');
    } finally {
      setLoading(false);
    }
  }, [productId, sort, starFilter]);

  // Check customer verified purchase eligibility
  const checkEligibility = useCallback(async () => {
    if (!user || !productId) return;
    setEligibilityLoading(true);
    try {
      const { data } = await api.get(`/reviews/product/${productId}/eligibility`);
      setEligibility(data);
    } catch (err) {
      void err;
    } finally {
      setEligibilityLoading(false);
    }
  }, [user, productId]);

  useEffect(() => {
    loadReviews(1, false);
  }, [loadReviews]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  // Helpful vote toggle
  const handleHelpfulClick = async (reviewId) => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/product/${productId}` } } });
      return;
    }

    try {
      const { data } = await api.post(`/reviews/${reviewId}/helpful`);
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId
            ? { ...r, helpfulCount: data.helpfulCount, hasHelpfulVoted: data.hasHelpfulVoted }
            : r
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update helpful vote');
    }
  };

  // Delete review handler
  const handleDeleteConfirm = async () => {
    if (!deleteModalReview) return;
    setDeleting(true);
    try {
      await api.delete(`/reviews/${deleteModalReview._id}`);
      setDeleteModalReview(null);
      await loadReviews(1, false);
      await checkEligibility();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  // Distribution calculations
  const totalDistributionReviews = Object.values(ratingDistribution).reduce((a, b) => a + Number(b || 0), 0) || totalReviews || 1;

  return (
    <section id="reviews-section" className="mt-16 border-t border-slate-200/80 pt-12">
      {/* Section Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Customer Feedback</p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">Ratings & Reviews</h2>
        </div>

        {/* Write/Edit Review CTA Button */}
        <div>
          {!user ? (
            <button
              type="button"
              onClick={() => navigate('/login', { state: { from: { pathname: `/product/${productId}` } } })}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100/80 transition"
            >
              <LogIn size={15} /> Log in to write a review
            </button>
          ) : eligibility.existingReview ? (
            <button
              type="button"
              onClick={() => setReviewModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white px-5 py-2.5 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-50 transition"
            >
              <Edit3 size={15} /> Edit Your Review
            </button>
          ) : eligibility.canReview ? (
            <button
              type="button"
              onClick={() => setReviewModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition"
            >
              <Sparkles size={15} /> Write a Verified Review
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Available after delivery</span>
            </div>
          )}
        </div>
      </div>

      {/* RATINGS SUMMARY BREAKDOWN (Amazon/Flipkart style) */}
      <div className="grid gap-8 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-6 sm:p-8 md:grid-cols-[280px_1fr] shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        {/* Left: Overall score box */}
        <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-6 md:border-b-0 md:border-r md:pr-8 md:pb-0 text-center">
          <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900">
            {Number(averageRating || 0).toFixed(1)}
          </span>
          <div className="mt-3">
            <StarRating rating={averageRating} size="lg" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Based on {totalReviews} {totalReviews === 1 ? 'verified review' : 'verified reviews'}
          </p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
            <CheckCircle2 size={13} /> 100% Verified Purchases
          </div>
        </div>

        {/* Right: 5-to-1 Star Progress Bar Distribution */}
        <div className="space-y-2.5 flex flex-col justify-center">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingDistribution[stars] || 0;
            const percentage = Math.round((count / totalDistributionReviews) * 100);
            const isSelected = starFilter === stars;

            return (
              <button
                key={stars}
                type="button"
                onClick={() => setStarFilter(isSelected ? null : stars)}
                className={`group flex w-full items-center gap-3 rounded-xl p-1.5 text-xs transition text-left ${
                  isSelected ? 'bg-indigo-50/80 ring-1 ring-indigo-200' : 'hover:bg-slate-100/60'
                }`}
              >
                <span className="flex w-10 items-center gap-1 font-bold text-slate-700">
                  {stars} <Star size={12} className="fill-amber-400 text-amber-400" />
                </span>

                {/* Progress bar container */}
                <div className="flex-1 h-3 rounded-full bg-slate-200/80 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSelected
                        ? 'bg-indigo-600'
                        : stars >= 4
                        ? 'bg-emerald-500'
                        : stars === 3
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <span className="w-12 text-right font-semibold text-slate-500 group-hover:text-slate-900">
                  {percentage}%
                </span>
                <span className="w-8 text-right text-[11px] text-slate-400">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTER & SORT TOOLBAR */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {totalCount} {totalCount === 1 ? 'Review' : 'Reviews'}
          </span>
          {starFilter && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
              {starFilter} Stars only
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="ml-1 text-indigo-400 hover:text-indigo-800"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-slate-400" />
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-indigo-600 focus:outline-hidden"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* REVIEW CARDS LIST */}
      <div className="mt-6 space-y-6">
        {loading && reviews.length === 0 ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl border border-slate-100 bg-white p-6 space-y-3">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-16 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-800">
            {error}
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
              <MessageSquare size={26} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {starFilter ? `No ${starFilter}-star reviews yet` : 'No customer reviews yet'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              {starFilter
                ? 'Try clearing the star filter to see all reviews for this product.'
                : 'Be the first verified customer to share your thoughts after delivery!'}
            </p>
            {starFilter ? (
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear star filter
              </button>
            ) : eligibility.canReview ? (
              <button
                type="button"
                onClick={() => setReviewModalOpen(true)}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
              >
                Write a Review
              </button>
            ) : null}
          </div>
        ) : (
          reviews.map((rev) => {
            const isOwner = user && (rev.user?._id === user._id || rev.user === user._id);
            const reviewerName = rev.user?.name || 'Verified Customer';
            const initial = reviewerName.charAt(0).toUpperCase();

            return (
              <article
                key={rev._id}
                className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs hover:border-slate-300 transition"
              >
                {/* Reviewer Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* User initial avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-xs">
                      {initial}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{reviewerName}</h4>
                      {rev.isVerifiedPurchase && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          Verified Purchase
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Edit / Delete actions for owner */}
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        title="Edit your review"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModalReview(rev)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete your review"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Rating & Headline */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StarRating rating={rev.rating} size="sm" />
                  <h5 className="font-bold text-slate-900 text-base">{rev.title}</h5>
                </div>

                {/* Date */}
                <p className="mt-1 text-xs text-slate-400">
                  Reviewed on{' '}
                  {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>

                {/* Written comment */}
                <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                  {rev.comment}
                </p>

                {/* Photo thumbnails gallery */}
                {Array.isArray(rev.images) && rev.images.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {rev.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewImage(img.url)}
                        className="group relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:scale-105"
                      >
                        <img
                          src={img.url}
                          alt="Customer review photo"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Helpful voting */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isOwner}
                      onClick={() => handleHelpfulClick(rev._id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold transition ${
                        rev.hasHelpfulVoted
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-xs'
                          : isOwner
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsUp size={13} className={rev.hasHelpfulVoted ? 'fill-indigo-600 text-indigo-600' : ''} />
                      <span>{rev.hasHelpfulVoted ? 'Helpful' : 'Helpful'}</span>
                      {rev.helpfulCount > 0 && <span>({rev.helpfulCount})</span>}
                    </button>
                    {rev.helpfulCount > 0 && !rev.hasHelpfulVoted && (
                      <span>{rev.helpfulCount} {rev.helpfulCount === 1 ? 'person found this helpful' : 'people found this helpful'}</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Pagination / Load more */}
      {pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loadReviews(p, false)}
              className={`h-9 w-9 rounded-xl text-xs font-bold transition ${
                page === p
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Review Modal for Creating/Editing */}
      <ReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        product={product}
        existingReview={eligibility.existingReview}
        onReviewSaved={async () => {
          await loadReviews(1, false);
          await checkEligibility();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteModalReview)}
        busy={deleting}
        danger
        title="Delete your review?"
        message="This action cannot be undone. Your rating and photos will be removed from this product."
        confirmLabel="Delete review"
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteModalReview(null)}
      />

      {/* Lightbox Photo Preview Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-black">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-slate-700 transition"
              aria-label="Close photo preview"
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Customer photo enlarged"
              className="max-h-[85vh] w-auto max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductReviews;
