import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import api from '../api/axios';
import ConfirmDialog from './ConfirmDialog';
import { formatDay, formatHoursLeft, getReorderDeadline } from '../utils/dates';

const MAX_RENEWALS = 2;

// Shown only for cancelled orders inside the 24-hour window. The server re-checks
// the window, stock, wallet balance, current prices, and renewal limit.
const ReorderButton = ({ order, className = 'btn btn-primary' }) => {
  const navigate = useNavigate();
  const deadline = getReorderDeadline(order);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const originalDeliveryDay = order?.estimatedDelivery ? formatDay(order.estimatedDelivery, true) : '';
  const renewalCount = Math.max(0, Number(order?.renewalCount) || 0);
  const renewalsLeft = MAX_RENEWALS - renewalCount;

  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline || deadline <= now || renewalsLeft <= 0) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${order._id}/reorder`);
      navigate(`/payment-result/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not renew this order. Try again.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className={`${className} gap-2`} onClick={() => setOpen(true)}>
        <RotateCcw size={16} />Renew with wallet · {renewalsLeft} renewal{renewalsLeft === 1 ? '' : 's'} · {formatHoursLeft(deadline)} left
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <ConfirmDialog
        open={open}
        busy={busy}
        title="Pay from wallet and renew?"
        message={`By continuing, you authorize the current server-calculated total to be debited from your wallet. ${originalDeliveryDay ? `Its delivery date will remain ${originalDeliveryDay} while that date is still valid. ` : ''}${renewalsLeft === 1 ? 'This is the final renewal available for this order chain. ' : 'One more renewal remains if this renewed order is cancelled. '}Your cancelled order stays cancelled.`}
        confirmLabel="Pay from wallet"
        cancelLabel="Not now"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
};

export default ReorderButton;
