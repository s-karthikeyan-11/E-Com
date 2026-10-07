import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  MapPin,
  Save,
  ShieldCheck,
  Store,
} from 'lucide-react';
import api from '../../api/axios';

const SellerProfile = () => {
  const { seller, refreshSeller } = useOutletContext();
  const [formData, setFormData] = useState({
    storeName: '',
    storeDescription: '',
    storeLogo: '',
    storeBanner: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (seller) {
      setFormData({
        storeName: seller.storeName || '',
        storeDescription: seller.storeDescription || '',
        storeLogo: seller.storeLogo || '',
        storeBanner: seller.storeBanner || '',
        phone: seller.phone || '',
        line1: seller.storeAddress?.line1 || '',
        city: seller.storeAddress?.city || '',
        state: seller.storeAddress?.state || '',
        pincode: seller.storeAddress?.pincode || '',
        accountHolder: seller.bankDetails?.accountHolder || '',
        accountNumber: seller.bankDetails?.accountNumber || '',
        ifscCode: seller.bankDetails?.ifscCode || '',
        bankName: seller.bankDetails?.bankName || '',
      });
    }
  }, [seller]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        storeName: formData.storeName,
        storeDescription: formData.storeDescription,
        storeLogo: formData.storeLogo,
        storeBanner: formData.storeBanner,
        phone: formData.phone,
        storeAddress: {
          line1: formData.line1,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        bankDetails: {
          accountHolder: formData.accountHolder,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          bankName: formData.bankName,
        },
      };

      await api.put('/seller/profile', payload);
      setSuccess('Store profile and settlement details saved successfully!');
      if (refreshSeller) refreshSeller();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Store Settings & Profile</h2>
        <p className="text-xs text-slate-500">
          Configure your public storefront branding, pickup address, and settlement bank details
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Store Branding */}
        <div className="card p-6 shadow-soft space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Store size={16} className="text-indigo-600" /> Store Branding
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Store Name *
              </label>
              <input
                name="storeName"
                className="input font-semibold"
                value={formData.storeName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Merchant Phone *
              </label>
              <input
                name="phone"
                className="input"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Store Description
              </label>
              <textarea
                name="storeDescription"
                className="input min-h-[75px]"
                placeholder="About your store..."
                value={formData.storeDescription}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Store Logo Image URL
              </label>
              <input
                name="storeLogo"
                className="input"
                placeholder="https://..."
                value={formData.storeLogo}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Store Banner Image URL
              </label>
              <input
                name="storeBanner"
                className="input"
                placeholder="https://..."
                value={formData.storeBanner}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Store / Warehouse Address */}
        <div className="card p-6 shadow-soft space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
            <MapPin size={16} className="text-indigo-600" /> Dispatch / Pickup Address
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Street Address *
              </label>
              <input
                name="line1"
                className="input"
                value={formData.line1}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                City *
              </label>
              <input
                name="city"
                className="input"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                State *
              </label>
              <input
                name="state"
                className="input"
                value={formData.state}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                PIN Code *
              </label>
              <input
                name="pincode"
                className="input"
                value={formData.pincode}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 3: Bank Account for Payouts */}
        <div className="card p-6 shadow-soft space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Landmark size={16} className="text-indigo-600" /> Bank Settlement Account (Payouts)
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Account Holder Name
              </label>
              <input
                name="accountHolder"
                className="input"
                placeholder="Beneficiary name on bank account"
                value={formData.accountHolder}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Bank Name
              </label>
              <input
                name="bankName"
                className="input"
                placeholder="e.g. HDFC Bank, SBI, ICICI"
                value={formData.bankName}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                Bank Account Number
              </label>
              <input
                name="accountNumber"
                className="input font-mono"
                placeholder="10-16 digit account number"
                value={formData.accountNumber}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                IFSC Code
              </label>
              <input
                name="ifscCode"
                className="input font-mono uppercase"
                placeholder="e.g. HDFC0001234"
                value={formData.ifscCode}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Save size={16} />
            <span>{saving ? 'Saving Changes…' : 'Save Store Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellerProfile;
