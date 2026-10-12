import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { formatHoursLeft, getReorderDeadline } from '../utils/dates';
import ReorderDialog from './ReorderDialog';

const MAX_RENEWALS = 2;

/**
 * Renders "Renew order" button for eligible cancelled orders.
 * Opens ReorderDialog which lets the customer choose Wallet or COD
 * and shows the re-priced total from the server before committing.
 */
const ReorderButton = ({ order, className = 'btn btn-primary', onRenewed }) => {
  const deadline = getReorderDeadline(order);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  const renewalCount = Math.max(0, Number(order?.renewalCount) || 0);
  const renewalsLeft = MAX_RENEWALS - renewalCount;

  // Tick the countdown timer every minute so the button disappears on expiry.
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Only show for cancelled orders inside the 24 h window with renewals remaining.
  if (!deadline || deadline <= now || renewalsLeft <= 0) return null;

  const hoursLeft = formatHoursLeft(deadline);

  return (
    <>
      <button
        id={`reorder-btn-${order._id}`}
        type="button"
        className={`${className} gap-2`}
        onClick={() => setOpen(true)}
      >
        <RotateCcw size={16} />
        Renew order · {renewalsLeft} renewal{renewalsLeft === 1 ? '' : 's'} · {hoursLeft} left
      </button>

      {open && (
        <ReorderDialog
          order={order}
          onClose={() => setOpen(false)}
          onSuccess={onRenewed}
        />
      )}
    </>
  );
};

export default ReorderButton;
