import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import api from '../../api/axios';

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Van', 'Truck', 'Other'];
const SERVICE_TYPES = ['Standard', 'Express', 'Hyperlocal', 'Surface'];

const DeliveryRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    vehicleType: 'Bike',
    vehicleNumber: '',
    serviceType: 'Standard',
    serviceablePincodes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber.trim(),
        serviceType: formData.serviceType,
        serviceablePincodes: formData.serviceablePincodes
          ? formData.serviceablePincodes.split(',').map((p) => p.trim()).filter(Boolean)
          : [],
      };

      const { data } = await api.post('/delivery/register', payload);
      setSuccessMessage(
        data.message ||
          'Delivery partner application submitted successfully! Your account is pending admin approval.'
      );
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to submit registration. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="section-shell flex min-h-[75vh] items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 shadow-inner border border-amber-200">
              <Clock size={32} />
            </div>
            <span className="rounded-full bg-amber-100 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Pending Admin Approval
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-900 tracking-tight">
              Application Submitted!
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {successMessage}
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>What happens next?</span>
              </div>
              <p className="leading-relaxed">
                1. An administrator will review your driver credentials and serviceable area.
              </p>
              <p className="leading-relaxed">
                2. Once approved, your account will be activated immediately.
              </p>
              <p className="leading-relaxed">
                3. You can then log in to the Delivery Hub using your email and password.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/delivery/login"
                className="btn btn-primary py-3 px-6 text-xs font-bold uppercase tracking-wider shadow-md"
              >
                Go to Delivery Login
              </Link>
              <Link
                to="/"
                className="btn btn-outline py-3 px-6 text-xs font-bold uppercase tracking-wider"
              >
                Return to Store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell flex min-h-[85vh] items-center justify-center py-12">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 mb-3 shadow-inner border border-sky-100">
              <Truck size={28} />
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-800">
              Fleet Onboarding
            </span>
            <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
              Become a Delivery Partner
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Apply to join the Shopping Now delivery network
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={handleChange}
                    className="input pl-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Phone size={15} />
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input pl-10 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail size={15} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="rider@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="input pl-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    className="input pl-10 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Vehicle Type
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="input text-xs"
                >
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Vehicle Reg Number
                </label>
                <input
                  type="text"
                  name="vehicleNumber"
                  placeholder="e.g. KA-01-AB-1234"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  className="input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Service Type
                </label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  className="input text-xs"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5">
                  Serviceable Pincodes
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <MapPin size={15} />
                  </span>
                  <input
                    type="text"
                    name="serviceablePincodes"
                    placeholder="e.g. 560001, 560034"
                    value={formData.serviceablePincodes}
                    onChange={handleChange}
                    className="input pl-10 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5 text-xs text-sky-800 flex items-start gap-2.5">
              <ShieldCheck size={18} className="shrink-0 text-sky-600 mt-0.5" />
              <p className="leading-relaxed">
                By submitting your application, you acknowledge that partner accounts require
                verification and admin approval before receiving order assignments.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider shadow-md mt-3 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Submitting Application…' : 'Submit Partner Application'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
            <p>
              Already an approved delivery partner?{' '}
              <Link to="/delivery/login" className="font-bold text-sky-700 hover:underline">
                Sign In to Hub
              </Link>
            </p>
            <div className="mt-3 flex justify-center gap-4 text-slate-400">
              <Link to="/login" className="hover:text-indigo-600">Customer Login</Link>
              <span>·</span>
              <Link to="/seller/login" className="hover:text-indigo-600">Seller Portal</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryRegister;
