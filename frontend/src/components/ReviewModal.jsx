import React, { useEffect, useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Image as ImageIcon, ShieldCheck, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import api from '../api/axios';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const ReviewModal = ({
  open,
  onClose,
  product,
  existingReview = null,
  onReviewSaved,
}) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]); // array of { file, preview, url, filename }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const isEditing = Boolean(existingReview);

  useEffect(() => {
    if (open) {
      if (existingReview) {
        setRating(existingReview.rating || 5);
        setTitle(existingReview.title || '');
        setComment(existingReview.comment || '');
        setSelectedPhotos(
          (existingReview.images || []).map((img) => ({
            url: img.url,
            filename: img.filename,
            preview: img.url,
          }))
        );
      } else {
        setRating(5);
        setTitle('');
        setComment('');
        setSelectedPhotos([]);
      }
      setError('');
      setSuccess('');
    }
  }, [open, existingReview]);

  if (!open) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError('');
    const validPhotos = [];

    if (selectedPhotos.length + files.length > MAX_FILES) {
      setError(`You can upload a maximum of ${MAX_FILES} photos.`);
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
        setError(`"${file.name}" is not a supported image format. Use JPG, PNG, or WebP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" is larger than 5MB. Please choose a smaller photo.`);
        return;
      }

      validPhotos.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setSelectedPhotos((prev) => [...prev, ...validPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index) => {
    setSelectedPhotos((prev) => {
      const removed = prev[index];
      if (removed?.preview && removed?.file) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }
    if (title.trim().length < 2) {
      setError('Please enter a review headline (at least 2 characters).');
      return;
    }
    if (comment.trim().length < 5) {
      setError('Please write a review comment (at least 5 characters).');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('rating', rating);
      formData.append('title', title.trim());
      formData.append('comment', comment.trim());

      // Separate existing preserved images and new file uploads
      const existingImages = selectedPhotos
        .filter((p) => !p.file && p.url)
        .map((p) => ({ url: p.url, filename: p.filename }));

      formData.append('images', JSON.stringify(existingImages));

      selectedPhotos.forEach((p) => {
        if (p.file) {
          formData.append('images', p.file);
        }
      });

      let res;
      if (isEditing) {
        res = await api.put(`/reviews/${existingReview._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post(`/reviews/product/${product._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSuccess(res.data.message || (isEditing ? 'Review updated!' : 'Review submitted!'));

      setTimeout(() => {
        onReviewSaved && onReviewSaved(res.data.review);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing ? 'Edit Your Review' : 'Write a Customer Review'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Share your genuine experience with other shoppers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Product mini-card */}
        {product && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-100">
            <img
              src={product.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80'}
              alt={product.name}
              className="h-14 w-14 rounded-xl object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{product.category || 'Product'}</p>
              <h3 className="truncate text-sm font-bold text-slate-900">{product.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck size={12} /> Verified Purchase
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Rating selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Overall Rating <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
              <StarRating
                rating={rating}
                interactive
                onRatingChange={setRating}
                size="lg"
                showLabel
              />
            </div>
          </div>

          {/* Headline / Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Review Headline <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.length}/120</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              placeholder="What's most important to know? (e.g. Great sound quality, fits comfortably)"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              required
            />
          </div>

          {/* Written comment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Detailed Review <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{comment.length}/2000</span>
            </div>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 2000))}
              placeholder="What did you like or dislike? How does it compare to your expectations? Mention battery life, build quality, comfort, etc."
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-100 leading-relaxed"
              required
            />
          </div>

          {/* Photo uploads */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Add Photos <span className="text-slate-400 font-normal lowercase">(optional, max 5)</span>
              </label>
              <span className="text-[11px] text-slate-400">{selectedPhotos.length}/{MAX_FILES}</span>
            </div>

            {/* Photo thumbnails */}
            {selectedPhotos.length > 0 && (
              <div className="grid grid-cols-5 gap-2.5 mb-3">
                {selectedPhotos.map((photo, idx) => (
                  <div key={idx} className="group relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                    <img
                      src={photo.preview}
                      alt={`Upload preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-xs transition hover:bg-rose-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {selectedPhotos.length < MAX_FILES && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-indigo-600 shadow-xs mb-2">
                  <Upload size={18} />
                </div>
                <p className="text-xs font-bold text-slate-700">Click to upload product photos</p>
                <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, or WebP up to 5MB each</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Submitting…' : isEditing ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
