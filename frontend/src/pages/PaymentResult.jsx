import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import api from '../api/axios';

// Outcome screen after checkout. It reads the real order from the server, so it never
// shows "success" based on anything the browser says.
const PaymentResult = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`).then(({ data }) => setOrder(data)).catch((err) => setError(err.response?.data?.message || 'Could not load this order'));
  }, [id]);

  if (error) return <div className="section-shell py-16 text-center"><h1 className="text-2xl font-bold">Order unavailable</h1><p className="mt-2 text-slate-600">{error}</p><Link className="btn btn-primary mt-5" to="/orders">View my orders</Link></div>;
  if (!order) return <div className="section-shell py-16"><div className="mx-auto h-56 max-w-lg animate-pulse rounded-2xl bg-slate-200" /></div>;

  const paid = order.paymentStatus === 'Paid';
  const cod = order.paymentMethod === 'Cash on Delivery';
  const failed = order.paymentStatus === 'Failed' || order.status === 'Cancelled';
  const state = failed ? 'failed' : paid || cod ? 'success' : 'pending';
  const view = {
    success: { Icon: CheckCircle2, tone: 'text-green-600 bg-green-50', title: cod ? 'Order placed' : 'Payment successful', text: cod ? 'Pay in cash when your order arrives.' : 'We received your payment.' },
    pending: { Icon: Clock, tone: 'text-amber-600 bg-amber-50', title: 'Waiting for payment', text: 'Your order is held until the payment is confirmed.' },
    failed: { Icon: XCircle, tone: 'text-red-600 bg-red-50', title: 'Payment not completed', text: 'This order was not completed. You can try again from your cart.' },
  }[state];

  return (
    <div className="section-shell py-12">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${view.tone}`}><view.Icon size={32} /></span>
        <h1 className="mt-5 text-2xl font-bold">{view.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{view.text}</p>
        <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Order ID</dt><dd className="font-semibold">#{order._id.slice(-8).toUpperCase()}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Payment</dt><dd className="font-semibold">{order.paymentMethod} · {order.paymentStatus}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-semibold">₹{Number(order.totalAmount).toFixed(2)}</dd></div>
        </dl>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link className="btn btn-primary" to={`/order/${order._id}`}>Track order</Link>
          <Link className="btn btn-secondary" to={failed ? '/cart' : '/products'}>{failed ? 'Back to cart' : 'Continue shopping'}</Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentResult;
