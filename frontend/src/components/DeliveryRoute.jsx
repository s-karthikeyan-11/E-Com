import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const DeliveryRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [partner, setPartner] = useState(null);
  const [checkingPartner, setCheckingPartner] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    if (!loading && (user?.role === 'delivery' || user?.role === 'admin')) {
      api
        .get('/delivery/profile')
        .then(({ data }) => {
          setPartner(data.deliveryPartner);
          setErrorStatus(null);
        })
        .catch((err) => {
          const msg = err.response?.data?.message || 'error';
          setErrorStatus(msg);
        })
        .finally(() => setCheckingPartner(false));
    } else {
      setCheckingPartner(false);
    }
  }, [loading, user]);

  if (loading || checkingPartner) {
    return (
      <div className="section-shell flex min-h-[60vh] items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">Loading Delivery Hub…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/delivery/login" replace />;
  }

  if (user.role !== 'delivery' && user.role !== 'admin') {
    return <Navigate to="/delivery/login" replace />;
  }

  if (partner?.status === 'Suspended') {
    return (
      <div className="section-shell py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Delivery Account Suspended</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your delivery partner account has been suspended by the administrator. Please contact
            operations support.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default DeliveryRoute;
