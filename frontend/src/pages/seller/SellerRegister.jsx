import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import api from '../../api/axios';

const SellerRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    storeName: '',
    storeDescription: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        storeName: formData.storeName,
        storeDescription: formData.storeDescription,
        storeAddress: {
          line1: formData.line1,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
      };

      await api.post('/seller/register', payload);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="section-shell py-16">
        <div className="card mx-auto max-w-lg p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Application Submitted!</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Thank you for registering your store, <strong className="text-slate-900">{formData.storeName}</strong>! Your account is currently <span className="font-bold text-amber-600">Pending Admin Approval</span>.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Clock size={16} className="text-indigo-600" />
              <span>Admin Verification Process</span>
            </div>
            <p>Our team verifies store documents and details within 24 business hours.</p>
            <p>Once approved, you can log in to your Seller Hub and start listing products immediately.</p>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/seller/login" className="btn btn-primary">
              Go to Seller Login
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm">
            <Store size={28} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Seller Onboarding</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Start Selling on SHOPPING-NOW
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">
            Join thousands of merchants, list your products, and reach customers across the country.
          </p>
        </div>

        <div className="card p-6 sm:p-10 shadow-soft">
          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Merchant Information */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
                <User size={15} className="text-indigo-600" /> Merchant Contact Details
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Full Name *</label>
                  <input
                    name="name"
                    className="input"
                    placeholder="Your legal name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    className="input"
                    placeholder="merchant@business.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    name="password"
                    className="input"
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    className="input"
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Store Information */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Store size={15} className="text-indigo-600" /> Business & Store Profile
              </h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Store / Business Name *</label>
                  <input
                    name="storeName"
                    className="input"
                    placeholder="e.g. Apex Electronics, TrendStyle Apparel"
                    value={formData.storeName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Store Description</label>
                  <textarea
                    name="storeDescription"
                    className="input min-h-[75px] py-2"
                    placeholder="Tell buyers what makes your products and store unique..."
                    value={formData.storeDescription}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Registered Business Address */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
                <MapPin size={15} className="text-indigo-600" /> Store / Pickup Address
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Street Address *</label>
                  <input
                    name="line1"
                    className="input"
                    placeholder="Shop No., Warehouse, Street"
                    value={formData.line1}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">City *</label>
                  <input
                    name="city"
                    className="input"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">State *</label>
                  <input
                    name="state"
                    className="input"
                    placeholder="State"
                    value={formData.state}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">PIN Code *</label>
                  <input
                    name="pincode"
                    className="input"
                    placeholder="6-digit PIN"
                    value={formData.pincode}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 flex items-start gap-3">
              <ShieldCheck size={20} className="shrink-0 text-emerald-600 mt-0.5" />
              <span>
                By registering, you agree to our Marketplace Seller Agreement and standard 10% platform commission policy on successful deliveries.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3.5 text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              {loading ? 'Submitting Application…' : 'Register as Seller'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have a seller account?{' '}
            <Link to="/seller/login" className="font-bold text-indigo-700 hover:underline">
              Log in to Seller Hub
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SellerRegister;
