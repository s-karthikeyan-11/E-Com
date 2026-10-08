import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck, Truck } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const DeliveryLogin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in as delivery partner, redirect
  if (user && (user.role === 'delivery' || user.role === 'admin')) {
    navigate('/delivery/dashboard');
  }

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/delivery/login', formData);
      if (data.token) {
        // Trigger page reload or auth refresh so AuthContext updates
        window.location.href = '/delivery/dashboard';
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-shell flex min-h-[75vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 mb-3 shadow-inner border border-sky-100">
              <Truck size={28} />
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-800">
              Logistics Portal
            </span>
            <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
              Delivery Partner Hub
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Sign in with your registered delivery fleet account
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                Delivery Agent Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="agent@delivery.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider shadow-md mt-2 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating…' : 'Access Delivery Hub'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
            <p>Need delivery partner access? Contact your logistics administrator.</p>
            <div className="mt-3 flex justify-center gap-4 text-slate-500">
              <Link to="/login" className="hover:text-indigo-600 font-medium">Customer Login</Link>
              <span>·</span>
              <Link to="/seller/login" className="hover:text-indigo-600 font-medium">Seller Login</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryLogin;
