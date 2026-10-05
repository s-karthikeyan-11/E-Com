// Delivery dates come from the API as calendar dates (UTC midnight), so always format in UTC.
export const formatDay = (value, withYear = false) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });
};

// True when a delivery date (UTC midnight) is before today's local calendar date.
export const isPastDay = (value) => {
  if (!value) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(value).getTime() < todayUtc;
};

// Customers can reorder a cancelled order for 24 hours (the server enforces this too).
export const REORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export const getReorderDeadline = (order) => {
  if (!order || order.status !== 'Cancelled') return null;
  const entry = [...(order.statusHistory || [])].reverse().find((h) => h.status === 'Cancelled');
  const cancelledAt = new Date(entry ? entry.at : order.updatedAt).getTime();
  return Number.isNaN(cancelledAt) ? null : cancelledAt + REORDER_WINDOW_MS;
};

export const formatHoursLeft = (deadline) => {
  const ms = deadline - Date.now();
  if (ms <= 0) return '';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};
