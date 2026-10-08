import React from 'react';

const ORDER = {
  'Awaiting Payment': 'bg-amber-50 text-amber-800 ring-amber-200',
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  Confirmed: 'bg-blue-50 text-blue-800 ring-blue-200',
  Packed: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Processing: 'bg-blue-50 text-blue-800 ring-blue-200',
  Shipped: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Picked Up': 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  'In Transit': 'bg-sky-50 text-sky-800 ring-sky-200',
  'Out for Delivery': 'bg-purple-50 text-purple-800 ring-purple-200',
  Delivered: 'bg-green-50 text-green-800 ring-green-200',
  'Failed Delivery': 'bg-rose-50 text-rose-800 ring-rose-200',
  'RTO Initiated': 'bg-orange-50 text-orange-800 ring-orange-200',
  'RTO Delivered': 'bg-slate-100 text-slate-800 ring-slate-300',
  Cancelled: 'bg-red-50 text-red-800 ring-red-200',
};
const PAYMENT = {
  Pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  Paid: 'bg-green-50 text-green-800 ring-green-200',
  Failed: 'bg-red-50 text-red-800 ring-red-200',
};

// kind: 'order' | 'payment'
const StatusBadge = ({ status, kind = 'order' }) => {
  const map = kind === 'payment' ? PAYMENT : ORDER;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${map[status] || 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
      {kind === 'payment' ? `Payment: ${status}` : status}
    </span>
  );
};

export default StatusBadge;
