import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, Lock, Mail, ShieldAlert, Store } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const SellerLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sellerStatus, setSellerStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSellerStatus(null);
    setLoading(true);

    try {
      const { data } = await api.post('/seller/login', { email, password });
      // Reload auth context
      await login(email, password);
      navigate('/seller/dashboard');
    } catch (err) {
      const res = err.response?.data;
      setError(res?.message || 'Login failed. Please check your credentials.');
      if (res?.sellerStatus) {
        setSellerStatus(res.sellerStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-shell py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm">
            <Store size={28} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Merchant Access</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Seller Hub Login
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage your inventory, orders, and payouts.
          </p>
        </div>

        <div className="card p-6 sm:p-8 shadow-soft">
          {error && (
            <div
              role="alert"
              className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                sellerStatus === 'Pending'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {sellerStatus === 'Pending' ? (
                <Clock size={20} className="shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">
                  {sellerStatus === 'Pending'
                    ? 'Application Under Review'
                    : sellerStatus === 'Suspended'
                    ? 'Account Suspended'
                    : 'Access Restricted'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Merchant Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="seller@store.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  className="input pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              {loading ? 'Verifying Credentials…' : 'Sign In to Seller Hub'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Want to start selling?{' '}
              <Link to="/seller/register" className="font-bold text-indigo-700 hover:underline">
                Register as a Seller
              </Link>
            </p>
            <p className="text-xs text-slate-400">
              Looking to buy products?{' '}
              <Link to="/login" className="text-slate-600 hover:underline font-semibold">
                Customer Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerLogin;
