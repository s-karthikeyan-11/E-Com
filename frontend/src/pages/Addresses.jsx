import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY = { label: 'Home', line1: '', city: '', state: '', pincode: '', phone: '', isDefault: false };

const validate = (f) => {
  if (!f.line1.trim() || !f.city.trim() || !f.state.trim()) return 'Fill in street, city and state.';
  if (!/^\d{6}$/.test(f.pincode.trim())) return 'PIN code must be 6 digits.';
  if (!/^[0-9+()\-\s]{7,20}$/.test(f.phone.trim())) return 'Enter a valid phone number.';
  return '';
};

const Addresses = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // null = closed, else form values (with _id when editing)
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/addresses').then(({ data }) => setList(data)).catch((e) => setError(e.response?.data?.message || 'Could not load addresses')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const change = (e) => setForm((c) => ({ ...c, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const problem = validate(form);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const body = { ...form };
      delete body._id;
      const { data } = form._id ? await api.put(`/addresses/${form._id}`, body) : await api.post('/addresses', body);
      setList(data);
      setForm(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this address');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const { data } = await api.delete(`/addresses/${toDelete._id}`);
      setList(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this address');
    } finally {
      setSaving(false);
      setToDelete(null);
    }
  };

  return (
    <div className="section-shell py-8 sm:py-12">
      <Link to="/profile" className="text-sm font-semibold text-slate-600 hover:text-slate-900">← Profile</Link>
      <div className="mb-6 mt-3 flex items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Saved addresses</h1>
        {!form && list.length < 5 && <button type="button" className="btn btn-primary gap-2" onClick={() => { setError(''); setForm(EMPTY); }}><Plus size={16} />Add address</button>}
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {form && (
        <form onSubmit={save} noValidate className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h2 className="text-lg font-bold sm:col-span-2">{form._id ? 'Edit address' : 'New address'}</h2>
          <label className="text-sm font-medium">Label<input className="input mt-2" name="label" value={form.label} onChange={change} maxLength={30} /></label>
          <label className="text-sm font-medium">Phone<input className="input mt-2" name="phone" inputMode="tel" autoComplete="tel" value={form.phone} onChange={change} required /></label>
          <label className="text-sm font-medium sm:col-span-2">Street address<input className="input mt-2" name="line1" autoComplete="street-address" value={form.line1} onChange={change} required /></label>
          <label className="text-sm font-medium">City<input className="input mt-2" name="city" value={form.city} onChange={change} required /></label>
          <label className="text-sm font-medium">State<input className="input mt-2" name="state" value={form.state} onChange={change} required /></label>
          <label className="text-sm font-medium">PIN code<input className="input mt-2" name="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={change} required /></label>
          <label className="flex items-center gap-2 self-end text-sm font-medium"><input type="checkbox" name="isDefault" checked={form.isDefault} onChange={change} />Use as default</label>
          <div className="flex gap-3 sm:col-span-2"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save address'}</button><button type="button" className="btn btn-secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button></div>
        </form>
      )}

      {loading ? <div className="h-32 animate-pulse rounded-2xl bg-slate-200" /> : list.length === 0 && !form ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><MapPin className="mx-auto text-slate-400" size={32} /><h2 className="mt-3 text-xl font-bold">No saved addresses</h2><p className="mt-2 text-slate-600">Save one to check out faster.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <article key={a._id} className="card p-5">
              <div className="flex items-center justify-between"><h2 className="font-bold">{a.label}</h2>{a.isDefault && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Default</span>}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{a.line1}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn btn-outline gap-2" onClick={() => { setError(''); setForm({ ...EMPTY, ...a }); }}><Pencil size={14} />Edit</button>
                <button type="button" className="btn btn-outline gap-2 text-red-700" onClick={() => setToDelete(a)}><Trash2 size={14} />Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={Boolean(toDelete)} busy={saving} danger title="Delete this address?" message="Past orders keep their own delivery address." confirmLabel="Delete" onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
};

export default Addresses;
