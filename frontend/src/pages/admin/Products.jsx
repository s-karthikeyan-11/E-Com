import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

const emptyForm = {
  name: '', description: '', category: '', image: '',
  price: '', costPrice: '', discountPercent: 0, gstPercent: 0, stock: '', lowStockThreshold: 5, deliveryDays: 4,
};

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/products').then(({ data }) => setProducts(data));

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name, description: p.description, category: p.category, image: p.image,
      price: p.price, costPrice: p.costPrice ?? '', discountPercent: p.discountPercent, gstPercent: p.gstPercent,
      stock: p.stock, lowStockThreshold: p.lowStockThreshold, deliveryDays: p.deliveryDays ?? 4,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      price: Number(form.price),
      ...(form.costPrice === '' ? {} : { costPrice: Number(form.costPrice) }),
      discountPercent: Number(form.discountPercent),
      gstPercent: Number(form.gstPercent),
      stock: Number(form.stock),
      lowStockThreshold: Number(form.lowStockThreshold),
      deliveryDays: Number(form.deliveryDays),
    };
    try {
      if (editingId) {
        await api.put(`/admin/products/${editingId}`, payload);
      } else {
        await api.post('/admin/products', payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save product');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await api.delete(`/admin/products/${id}`);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Catalog</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Products</h2>
        </div>
        <span className="admin-badge border-slate-200 bg-slate-50 text-slate-600">{products.length} items</span>
      </div>

      <form className="admin-card mb-8 p-5 sm:p-6" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-900">{editingId ? 'Edit product' : 'Add product'}</h3>
          <span className="admin-badge border-violet-200 bg-violet-50 text-violet-700">Inventory</span>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Name</label>
            <input className="input" name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
            <input className="input" name="category" placeholder="Category" value={form.category} onChange={handleChange} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Price</label>
            <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Unit cost (internal)</label>
            <input className="input" name="costPrice" type="number" min="0" step="0.01" placeholder="Optional" value={form.costPrice} onChange={handleChange} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Discount %</label>
            <input className="input" name="discountPercent" type="number" min="0" max="100" placeholder="Discount %" value={form.discountPercent} onChange={handleChange} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">GST %</label>
            <input className="input" name="gstPercent" type="number" min="0" max="100" placeholder="GST %" value={form.gstPercent} onChange={handleChange} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stock</label>
            <input className="input" name="stock" type="number" min="0" placeholder="Stock" value={form.stock} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Low stock threshold</label>
            <input className="input" name="lowStockThreshold" type="number" min="0" placeholder="Low stock threshold" value={form.lowStockThreshold} onChange={handleChange} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Delivery time (days)</label>
            <input className="input" name="deliveryDays" type="number" min="0" max="60" step="1" placeholder="Delivery days" value={form.deliveryDays} onChange={handleChange} required />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Image URL</label>
            <input className="input" name="image" placeholder="Image URL (optional)" value={form.image} onChange={handleChange} />
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
          <textarea className="input min-h-[110px]" name="description" placeholder="Description" value={form.description} onChange={handleChange} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" type="submit">{editingId ? 'Save changes' : 'Add product'}</button>
          {editingId && <button className="btn btn-outline" type="button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="table-th">Name</th><th className="table-th">Price</th><th className="table-th">Unit cost</th><th className="table-th">Discount</th>
              <th className="table-th">GST</th><th className="table-th">Final</th><th className="table-th">Stock</th>
              <th className="table-th">Status</th><th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id}>
                <td className="table-td font-medium text-slate-800">{p.name}</td>
                <td className="table-td">₹{Number(p.price || 0).toFixed(2)}</td>
                <td className="table-td">{p.costPrice == null ? 'Not recorded' : `Cost: ${Number(p.costPrice).toFixed(2)}`}</td>
                <td className="table-td">{p.discountPercent}%</td>
                <td className="table-td">{p.gstPercent}%</td>
                <td className="table-td">₹{Number(p.finalPrice || 0).toFixed(2)}</td>
                <td className="table-td">
                  <span className={`table-chip ${p.stock <= p.lowStockThreshold ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {p.stock}
                  </span>
                </td>
                <td className="table-td">{p.isActive ? 'Active' : 'Inactive'}</td>
                <td className="table-td">
                  <div className="flex gap-3">
                    <button className="link-btn" onClick={() => startEdit(p)}>Edit</button>
                    <button className="link-btn text-rose-600" onClick={() => handleDelete(p._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminProducts;
