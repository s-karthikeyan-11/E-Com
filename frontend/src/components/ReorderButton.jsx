import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import api from '../api/axios';
import ConfirmDialog from './ConfirmDialog';
import { formatHoursLeft, getReorderDeadline } from '../utils/dates';

// Shown only for cancelled orders inside the 24-hour window. The server re-checks
// the window, stock and current prices, and creates a brand-new order.
const ReorderButton = ({ order, className = 'btn btn-primary' }) => {
  const navigate = useNavigate();
  const deadline = getReorderDeadline(order);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline || deadline <= now) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${order._id}/reorder`);
      navigate(`/payment-result/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reorder. Try again.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className={`${className} gap-2`} onClick={() => setOpen(true)}>
        <RotateCcw size={16} />Reorder · {formatHoursLeft(deadline)} left
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <ConfirmDialog
        open={open}
        busy={busy}
        title="Place this order again?"
        message="We will create a new Cash on Delivery order using today's prices and stock. Your cancelled order stays cancelled."
        confirmLabel="Place new order"
        cancelLabel="Not now"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
};

export default ReorderButton;
