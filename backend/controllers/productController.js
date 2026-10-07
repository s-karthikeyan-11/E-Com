const Product = require('../models/Product');
const mongoose = require('mongoose');
const { planForProduct } = require('../utils/dates');

const errorStatus = (err) => (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getQueryText = (value) => (typeof value === 'string' ? value.trim() : '');

// GET /api/products  (public) - list active products, with optional search/category filter
exports.getProducts = async (req, res) => {
  try {
    const search = getQueryText(req.query.search);
    const category = getQueryText(req.query.category);
    if (search.length > 100 || category.length > 60) {
      return res.status(400).json({ message: 'Search and category filters are too long' });
    }
    const filter = { isActive: true };
    // sanitizeFilter is globally enabled. Search across the fields customers
    // can see, using an escaped regular expression so search text is literal.
    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = mongoose.trusted([
        { name: searchPattern },
        { description: searchPattern },
        { category: searchPattern },
      ]);
    }
    if (category) filter.category = category;
    const products = await Product.find(filter).populate('seller', 'storeName rating').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch products' });
  }
};

// GET /api/products/:id (public)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true })
      .populate('seller', 'storeName rating storeDescription storeLogo')
      .select('+releasedSlots');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ ...product.toJSON(), estimatedDelivery: planForProduct(product, 1).date });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch product' });
  }
};

// ---- Admin only below ----

// GET /api/admin/products (includes inactive)
exports.adminGetProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('seller', 'storeName email').select('+costPrice').sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch products' });
  }
};

// POST /api/admin/products
exports.createProduct = async (req, res) => {
  try {
    const { name, description, category, image, price, costPrice, discountPercent, gstPercent, stock, lowStockThreshold, deliveryDays } = req.body;
    if (!name || price == null || stock == null) {
      return res.status(400).json({ message: 'name, price and stock are required' });
    }
    const product = await Product.create({
      name, description, category, image,
      price, costPrice, discountPercent, gstPercent, stock, lowStockThreshold, deliveryDays,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to create product' });
  }
};

// PUT /api/admin/products/:id  (edit details, price, discount, gst, stock)
exports.updateProduct = async (req, res) => {
  try {
    const updates = (({ name, description, category, image, price, costPrice, discountPercent, gstPercent, stock, lowStockThreshold, isActive, deliveryDays }) =>
      ({ name, description, category, image, price, costPrice, discountPercent, gstPercent, stock, lowStockThreshold, isActive, deliveryDays }))(req.body);

    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to update product' });
  }
};

// DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    // Archive rather than hard-delete so historical orders and carts retain a valid reference.
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product archived' });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to archive product' });
  }
};
