import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Check,
  Edit2,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import { fmtINR } from '../../utils/currency';

const emptyProductForm = {
  name: '',
  description: '',
  category: 'Electronics',
  image: '',
  price: '',
  costPrice: '',
  discountPercent: 0,
  gstPercent: 18,
  stock: 10,
  lowStockThreshold: 5,
  deliveryDays: 4,
};

const CATEGORIES = ['Electronics', 'Mobiles', 'Apparel', 'Home', 'Cosmetics', 'Styles', 'General'];

const SellerProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyProductForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const loadProducts = () => {
    setLoading(true);
    api.get('/seller/products')
      .then(({ data }) => setProducts(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormData(emptyProductForm);
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingId(p._id);
    setModalError('');
    setFormData({
      name: p.name || '',
      description: p.description || '',
      category: p.category || 'General',
      image: p.image || '',
      price: p.price ?? '',
      costPrice: p.costPrice ?? '',
      discountPercent: p.discountPercent ?? 0,
      gstPercent: p.gstPercent ?? 18,
      stock: p.stock ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 5,
      deliveryDays: p.deliveryDays ?? 4,
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (modalError) setModalError('');
  };

  // Image upload simulation or URL
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setModalError('Image is too large (maximum 4MB). Please choose a smaller image.');
        return;
      }
      setModalError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setModalError('');

    try {
      const numPrice = Number(formData.price);
      if (formData.price === '' || isNaN(numPrice) || numPrice < 0) {
        setModalError('Please enter a valid base price.');
        setSaving(false);
        return;
      }

      const numStock = Number(formData.stock);
      if (formData.stock === '' || isNaN(numStock) || numStock < 0) {
        setModalError('Please enter a valid stock quantity.');
        setSaving(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        image: formData.image,
        price: numPrice,
        costPrice: formData.costPrice ? Number(formData.costPrice) : undefined,
        discountPercent: Number(formData.discountPercent) || 0,
        gstPercent: Number(formData.gstPercent) || 0,
        stock: numStock,
        lowStockThreshold: Number(formData.lowStockThreshold) || 5,
        deliveryDays: Number(formData.deliveryDays) || 4,
      };

      if (editingId) {
        await api.put(`/seller/products/${editingId}`, payload);
      } else {
        await api.post('/seller/products', payload);
      }

      setShowModal(false);
      loadProducts();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/seller/products/${id}`);
      setDeleteId(null);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  // Calculate live preview price
  const base = Number(formData.price) || 0;
  const disc = (base * (Number(formData.discountPercent) || 0)) / 100;
  const discounted = base - disc;
  const gst = (discounted * (Number(formData.gstPercent) || 0)) / 100;
  const finalPrice = discounted + gst;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Product Catalogue</h2>
          <p className="text-xs text-slate-500">Manage your product listings, pricing, and stock inventory</p>
        </div>
        <button
          onClick={openAddModal}
          className="btn btn-primary inline-flex items-center gap-2 self-start text-xs font-bold uppercase tracking-wider shadow-sm sm:self-auto"
        >
          <Plus size={16} />
          <span>Add New Product</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3.5 shadow-2xs focus-within:border-indigo-600">
        <Search size={18} className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by product name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-700">
            Clear
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden shadow-soft">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-indigo-700 border-t-transparent" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Boxes size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No products found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Try adjusting your search filter.' : 'Click "Add New Product" to list your first item.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Base Price</th>
                  <th className="px-4 py-3.5">Discount</th>
                  <th className="px-4 py-3.5">Final Price</th>
                  <th className="px-4 py-3.5">Stock</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= p.lowStockThreshold && p.stock > 0;
                  const isOut = p.stock === 0;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=120&q=80'}
                            alt={p.name}
                            className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover border border-slate-200"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate max-w-xs">{p.name}</p>
                            <span className="text-[11px] text-slate-400">ID: #{p._id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-600">
                        {p.category}
                      </td>
                      <td className="px-4 py-4 text-slate-900 font-semibold">
                        {fmtINR(p.price)}
                      </td>
                      <td className="px-4 py-4">
                        {p.discountPercent > 0 ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {p.discountPercent}% OFF
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {fmtINR(p.finalPrice || p.price)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isOut
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isLow && <AlertTriangle size={12} />}
                          {p.stock} units
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {p.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-700 transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(p._id)}
                            title="Delete Product"
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Product Details' : 'Add Product to Store'}
                </h3>
                <p className="text-xs text-slate-500">Provide pricing, tax, stock, and imagery</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span className="font-medium">{modalError}</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Product Title *
                  </label>
                  <input
                    name="name"
                    className="input"
                    placeholder="e.g. Wireless Bluetooth Noise Cancelling Headphones"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    className="input"
                    value={formData.category}
                    onChange={handleFormChange}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Delivery Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    name="deliveryDays"
                    min="1"
                    max="30"
                    className="input"
                    value={formData.deliveryDays}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Product Image (URL or Upload)
                  </label>
                  <div className="flex gap-3">
                    <input
                      name="image"
                      className="input flex-1"
                      placeholder="Paste image URL (https://...)"
                      value={formData.image}
                      onChange={handleFormChange}
                    />
                    <label className="btn btn-secondary cursor-pointer shrink-0">
                      <Upload size={16} className="mr-1.5" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                  {formData.image && (
                    <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 p-2 pr-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                        />
                        <span className="text-xs text-slate-600 font-medium">Image preview loaded</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Pricing & GST section */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0"
                    className="input font-semibold"
                    placeholder="999.00"
                    value={formData.price}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    name="discountPercent"
                    min="0"
                    max="99"
                    className="input"
                    placeholder="10"
                    value={formData.discountPercent}
                    onChange={handleFormChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    name="gstPercent"
                    min="0"
                    max="28"
                    className="input"
                    placeholder="18"
                    value={formData.gstPercent}
                    onChange={handleFormChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Cost Price (₹) (Private / Accounting)
                  </label>
                  <input
                    type="number"
                    name="costPrice"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="Your acquisition cost"
                    value={formData.costPrice}
                    onChange={handleFormChange}
                  />
                </div>

                {/* Inventory / Stock */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Available Stock (Units) *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    className="input font-semibold"
                    value={formData.stock}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    name="lowStockThreshold"
                    min="1"
                    className="input"
                    value={formData.lowStockThreshold}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    className="input min-h-[80px]"
                    placeholder="Key specifications, features, warranty, package contents..."
                    value={formData.description}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Price Preview Card */}
              {base > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-bold">Customer Final Price Preview:</span>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Base ₹{base.toFixed(2)} − {formData.discountPercent}% off + {formData.gstPercent}% GST
                    </p>
                  </div>
                  <span className="text-lg font-black text-indigo-950">
                    {fmtINR(finalPrice)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary text-xs px-6"
                >
                  {saving ? 'Saving…' : editingId ? 'Update Product' : 'Add to Catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
              <Trash2 size={24} />
            </div>
            <h4 className="text-base font-bold text-slate-900">Archive this product?</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              This will remove the product from customer storefront listings while preserving historical order logs.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn bg-rose-600 text-white hover:bg-rose-700 text-xs px-5 font-bold"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;
