import React, { useEffect, useState, useCallback } from 'react';
import {
  Star,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  MessageSquare,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react';
import api from '../../api/axios';
import StarRating from '../../components/StarRating';
import ConfirmDialog from '../../components/ConfirmDialog';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Moderation state
  const [modifyingReview, setModifyingReview] = useState(null);
  const [actionType, setActionType] = useState(''); // 'hide', 'publish'
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Delete modal state
  const [deleteReviewTarget, setDeleteReviewTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Image preview lightbox
  const [previewImage, setPreviewImage] = useState(null);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const loadReviews = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit: 15,
      });
      if (statusFilter) params.append('status', statusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const { data } = await api.get(`/reviews/admin?${params.toString()}`);
      setReviews(data.reviews);
      setPage(data.page);
      setPages(data.pages);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reviews for moderation');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  // Handle Hide / Publish moderation submit
  const handleModerateSubmit = async (e) => {
    e.preventDefault();
    if (!modifyingReview || !actionType) return;
    setActionLoading(true);
    try {
      const targetStatus = actionType === 'hide' ? 'Hidden' : 'Published';
      await api.patch(`/reviews/admin/${modifyingReview._id}/moderate`, {
        status: targetStatus,
        moderationReason: reason.trim(),
      });
      setModifyingReview(null);
      setActionType('');
      setReason('');
      await loadReviews(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Moderation action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete confirm
  const handleDeleteConfirm = async () => {
    if (!deleteReviewTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/reviews/${deleteReviewTarget._id}`);
      setDeleteReviewTarget(null);
      await loadReviews(page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Review Moderation</h2>
          <p className="text-xs text-slate-500">
            Audit, verify, and moderate customer reviews across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs">
            <MessageSquare size={13} className="text-indigo-600" />
            {totalCount} Total Reviews
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'All Reviews', value: '' },
            { label: 'Published', value: 'Published' },
            { label: 'Hidden', value: 'Hidden' },
            { label: 'Reported', value: 'Reported' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                statusFilter === tab.value
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews or comments…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Reviews Table / List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-indigo-600" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Loading customer reviews…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-700 bg-rose-50/50">
            {error}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900">No reviews found</h3>
            <p className="mt-1 text-xs text-slate-500">
              {search || statusFilter
                ? 'Try adjusting your search criteria or filter.'
                : 'Customer reviews will appear here once submitted.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => {
              const statusColors = {
                Published: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                Hidden: 'border-amber-200 bg-amber-50 text-amber-800',
                Reported: 'border-rose-200 bg-rose-50 text-rose-800',
              };

              return (
                <div key={rev._id} className="p-5 sm:p-6 transition hover:bg-slate-50/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Review content */}
                    <div className="space-y-2 min-w-0 flex-1">
                      {/* Product banner */}
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rev.product?.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80'}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {rev.product?.name || 'Deleted Product'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            By {rev.user?.name || 'Customer'} ({rev.user?.email || 'N/A'})
                          </p>
                        </div>
                      </div>

                      {/* Rating & Headline */}
                      <div className="flex items-center gap-2 pt-1">
                        <StarRating rating={rev.rating} size="xs" />
                        <span className="font-bold text-sm text-slate-900">{rev.title}</span>
                      </div>

                      {/* Comment */}
                      <p className="text-xs text-slate-600 leading-relaxed max-w-2xl whitespace-pre-line">
                        {rev.comment}
                      </p>

                      {/* Photos */}
                      {Array.isArray(rev.images) && rev.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rev.images.map((img, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreviewImage(img.url)}
                              className="h-12 w-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 hover:scale-105 transition"
                            >
                              <img src={img.url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Moderation audit info */}
                      {rev.moderatedBy && (
                        <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                          <span className="font-semibold text-slate-600">Moderated:</span>{' '}
                          {rev.status} by {rev.moderatedBy.name || 'Admin'}
                          {rev.moderationReason && ` • Reason: "${rev.moderationReason}"`}
                        </div>
                      )}

                      {/* Date & helpful stats */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>
                          Submitted on{' '}
                          {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span>{rev.helpfulCount || 0} helpful votes</span>
                      </div>
                    </div>

                    {/* Status badge & Moderation action buttons */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusColors[rev.status] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        {rev.status}
                      </span>

                      <div className="flex items-center gap-1.5 mt-2">
                        {rev.status === 'Published' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setModifyingReview(rev);
                              setActionType('hide');
                              setReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition shadow-2xs"
                            title="Hide review from customer view"
                          >
                            <EyeOff size={13} /> Hide
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setModifyingReview(rev);
                              setActionType('publish');
                              setReason('Re-approved by admin');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
                            title="Re-publish review"
                          >
                            <Eye size={13} /> Publish
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeleteReviewTarget(rev)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Permanently delete review"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => loadReviews(p)}
              className={`h-8 w-8 rounded-xl text-xs font-bold transition ${
                page === p
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Hide / Moderate Modal Dialog */}
      {modifyingReview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">
              {actionType === 'hide' ? 'Hide Customer Review' : 'Publish Customer Review'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {actionType === 'hide'
                ? 'Hiding this review will remove it from the product page and recalculate the product rating.'
                : 'Publishing will restore this review and update the product rating summary.'}
            </p>

            <form onSubmit={handleModerateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Moderation Note / Reason
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Contains inappropriate language, spam, or off-topic content"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-hidden"
                  required={actionType === 'hide'}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModifyingReview(null)}
                  disabled={actionLoading}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition ${
                    actionType === 'hide' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionLoading && <Loader2 size={13} className="animate-spin" />}
                  {actionType === 'hide' ? 'Confirm Hide' : 'Confirm Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Review Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteReviewTarget)}
        busy={deleting}
        danger
        title="Permanently Delete Review?"
        message="This will completely remove the customer's review and attached photos. The product average rating will be recalculated."
        confirmLabel="Delete Review"
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDeleteReviewTarget(null)}
      />

      {/* Lightbox Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-black">
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
    </div>
  );
};

export default AdminReviews;
