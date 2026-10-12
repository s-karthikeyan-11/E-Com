import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  RotateCcw,
  Wallet,
  Truck,
} from 'lucide-react';
import api from '../api/axios';
import { formatDay, formatHoursLeft, getReorderDeadline } from '../utils/dates';

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

// ── Payment option card ──────────────────────────────────────────────────────
const MethodCard = ({ id, selected, disabled, onSelect, icon: Icon, title, subtitle, badge }) => (
  <button
    type="button"
    id={id}
    disabled={disabled}
    onClick={() => !disabled && onSelect()}
    className={`w-full rounded-2xl border-2 p-4 text-left transition-all
      ${disabled
        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
        : selected
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
      }`}
  >
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
        ${disabled ? 'bg-slate-200 text-slate-400' : selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`font-bold ${disabled ? 'text-slate-400' : 'text-slate-900'}`}>{title}</p>
          {badge && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">{badge}</span>}
        </div>
        <p className={`mt-0.5 text-sm ${disabled ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
      </div>
      {!disabled && (
        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2
          ${selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      )}
    </div>
  </button>
);

// ── Main dialog ──────────────────────────────────────────────────────────────
const ReorderDialog = ({ order, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null); // 'Wallet' | 'Cash on Delivery'
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const deadline = getReorderDeadline(order);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError('');
    try {
      const { data } = await api.get(`/orders/${order._id}/reorder-preview`);
      setPreview(data);
      // Pre-select: if wallet is sufficient and order was originally online-paid → Wallet
      // If COD only → COD. Otherwise let the user choose.
      if (data.walletSufficient && data.wasRefundedToWallet) setSelectedMethod('Wallet');
      else if (!data.walletSufficient && data.codEligible) setSelectedMethod('Cash on Delivery');
      else if (data.walletSufficient) setSelectedMethod('Wallet');
      else if (data.codEligible) setSelectedMethod('Cash on Delivery');
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Could not load renewal details. Please try again.');
    } finally {
      setLoadingPreview(false);
    }
  }, [order._id]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitting, onClose]);

  const handleConfirm = async () => {
    if (!selectedMethod || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data } = await api.post(`/orders/${order._id}/reorder`, { paymentMethod: selectedMethod });
      if (onSuccess) onSuccess(data);
      navigate(`/payment-result/${data._id}`);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Could not renew this order. Please try again.');
      setSubmitting(false);
    }
  };

  const shortfall = preview ? Math.max(0, preview.totalAmount - preview.walletBalance) : 0;
  const hoursLeft = deadline ? formatHoursLeft(deadline) : '';
  const deliveryDay = order.estimatedDelivery ? formatDay(order.estimatedDelivery, true) : '';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-700 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <RotateCcw size={20} />
            </span>
            <div>
              <h2 id="reorder-dialog-title" className="text-lg font-black">Renew Order</h2>
              <p className="text-sm text-white/80">#{order._id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          {hoursLeft && (
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-1.5 text-center text-xs font-semibold text-white/90">
              ⏳ {hoursLeft} remaining to renew
            </p>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">

          {/* Loading skeleton */}
          {loadingPreview && (
            <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
              <Loader2 size={22} className="animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Calculating renewal amount…</span>
            </div>
          )}

          {/* Preview error */}
          {!loadingPreview && previewError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>{previewError}</p>
              </div>
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-rose-700 underline"
                onClick={loadPreview}
              >
                Try again
              </button>
            </div>
          )}

          {/* Preview loaded */}
          {!loadingPreview && preview && (
            <div className="space-y-5">

              {/* Order summary */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Package size={13} /> Items
                </div>
                <ul className="mt-3 space-y-1.5">
                  {preview.items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{item.name} × {item.quantity}</span>
                      <span className="font-semibold text-slate-900">{fmt(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t border-slate-200 pt-3 space-y-1 text-sm">
                  {preview.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Delivery fee</span><span>{fmt(preview.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Total payable</span><span>{fmt(preview.totalAmount)}</span>
                  </div>
                </div>
                {deliveryDay && (
                  <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-1.5 text-center text-xs font-semibold text-indigo-700">
                    📦 Original delivery date: {deliveryDay}
                  </p>
                )}
              </div>

              {/* Wallet balance info */}
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <Wallet size={16} /> Wallet balance
                </div>
                <span className="font-bold text-emerald-700">{fmt(preview.walletBalance)}</span>
              </div>

              {/* Insufficient wallet note */}
              {!preview.walletSufficient && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <p>
                    Your wallet is short by <strong>{fmt(shortfall)}</strong>.
                    {preview.codEligible ? ' You can still renew with Cash on Delivery below.' : ' Add funds to your wallet or add items to cart to place a new order.'}
                  </p>
                </div>
              )}

              {/* Refund note */}
              {preview.wasRefundedToWallet && (
                <p className="text-xs text-slate-500 text-center">
                  Your previous refund of {fmt(preview.walletBalance >= preview.totalAmount ? preview.totalAmount : preview.walletBalance)} is in your wallet and can be used to renew.
                </p>
              )}

              {/* Payment method selection */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Choose payment method</p>
                <div className="space-y-3">
                  <MethodCard
                    id="reorder-method-wallet"
                    selected={selectedMethod === 'Wallet'}
                    disabled={!preview.walletSufficient}
                    onSelect={() => setSelectedMethod('Wallet')}
                    icon={Wallet}
                    title="Pay from Wallet"
                    subtitle={preview.walletSufficient
                      ? `Deduct ${fmt(preview.totalAmount)} from your wallet (balance: ${fmt(preview.walletBalance)})`
                      : `Wallet balance insufficient — need ${fmt(shortfall)} more`}
                    badge={!preview.walletSufficient ? `Short by ${fmt(shortfall)}` : undefined}
                  />
                  {preview.codEligible && (
                    <MethodCard
                      id="reorder-method-cod"
                      selected={selectedMethod === 'Cash on Delivery'}
                      disabled={false}
                      onSelect={() => setSelectedMethod('Cash on Delivery')}
                      icon={Truck}
                      title="Cash on Delivery"
                      subtitle={`Pay ${fmt(preview.totalAmount)} when your order is delivered. Wallet balance stays unchanged.`}
                    />
                  )}
                </div>
              </div>

              {/* renewals left info */}
              {preview.renewalsLeft === 1 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 font-medium">
                  ⚠️ This is your final renewal for this order chain.
                </p>
              )}

              {/* Submit error */}
              {submitError && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <p>{submitError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          {!loadingPreview && preview && (
            <button
              type="button"
              id="reorder-confirm-btn"
              disabled={!selectedMethod || submitting}
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 size={16} />
                  {selectedMethod === 'Cash on Delivery' ? `Renew with COD · ${fmt(preview.totalAmount)}` : `Pay ${fmt(preview.totalAmount)} from Wallet`}
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReorderDialog;
