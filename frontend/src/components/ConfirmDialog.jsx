import React, { useEffect, useRef } from 'react';

// Accessible replacement for window.confirm: Esc cancels, focus starts on the safe button.
const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Keep it', danger = false, busy = false, onConfirm, onCancel }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={() => !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-bold text-slate-900">{title}</h2>
        <p id="confirm-message" className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" ref={cancelRef} className="btn btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
