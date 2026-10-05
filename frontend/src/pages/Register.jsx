import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate(location.state?.from?.pathname || location.state?.from || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-shell py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-soft lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden min-h-[560px] overflow-hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80"
            alt="Shopping and style"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/25 to-slate-900/10" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">New here</p>
            <h1 className="mt-3 text-4xl font-bold">Create your account.</h1>
            <p className="mt-3 max-w-sm text-sm text-slate-200">Join SHOP-NOW for exclusive offers, personalized shopping, and a seamless checkout experience.</p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Register</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Create account</h2>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700">
                Full name
                <input
                  className="input mt-2"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Email address
                <input
                  className="input mt-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Password
                <div className="relative mt-2">
                  <input
                    className="input pr-11"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
                {submitting ? 'Creating account...' : 'Sign up'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" state={{ from: location.state?.from }} className="font-semibold text-slate-900 underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
