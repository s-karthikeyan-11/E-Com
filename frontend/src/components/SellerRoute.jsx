import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Clock, ShieldAlert, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const SellerRoute = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const [seller, setSeller] = useState(null);
  const [checkingSeller, setCheckingSeller] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    if (!loading && user?.role === 'seller') {
      api.get('/seller/profile')
        .then(({ data }) => {
          setSeller(data);
          setErrorStatus(null);
        })
        .catch((err) => {
          const status = err.response?.data?.sellerStatus;
          setErrorStatus(status || 'error');
        })
        .finally(() => setCheckingSeller(false));
    } else {
      setCheckingSeller(false);
    }
  }, [loading, user]);

  if (loading || checkingSeller) {
    return (
      <div className="section-shell flex min-h-[60vh] items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">Loading Seller Portal…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/seller/login" replace />;
  }

  if (user.role !== 'seller') {
    return <Navigate to="/seller/register" replace />;
  }

  // Handle pending or non-approved seller statuses
  if (errorStatus === 'Pending' || seller?.status === 'Pending') {
    return (
      <div className="section-shell py-16">
        <div className="card mx-auto max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Application Under Review</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your seller application for <strong className="text-slate-900">{seller?.storeName || 'your store'}</strong> has been submitted and is awaiting approval by the Admin team.
          </p>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-xs text-slate-500">
            <p className="font-semibold text-slate-700">What happens next?</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li>Our admin reviews your business details.</li>
              <li>Once approved, your seller dashboard and product listing features unlock automatically.</li>
            </ul>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Check Status
            </button>
            <button
              onClick={logout}
              className="btn btn-secondary"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (errorStatus === 'Suspended' || seller?.status === 'Suspended') {
    return (
      <div className="section-shell py-16">
        <div className="card mx-auto max-w-lg p-8 text-center border-rose-200 shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldAlert size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Store Suspended</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your seller account has been temporarily suspended by the administrator. Please contact support.
          </p>
          <button onClick={logout} className="btn btn-secondary mt-6">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default SellerRoute;
