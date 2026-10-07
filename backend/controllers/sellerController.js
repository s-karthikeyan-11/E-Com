const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const SellerTransaction = require('../models/SellerTransaction');
const { getCookieSameSite } = require('../config/env');

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value);

const cookieOptions = (remember = true) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: getCookieSameSite(),
  path: '/api',
  ...(remember ? { maxAge: Number.parseInt(process.env.JWT_COOKIE_MAX_AGE_MS || '604800000', 10) } : {}),
});

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Record seller earnings & transaction ledger for an order
exports.recordSellerEarningsForOrder = async (order) => {
  try {
    if (!order || !order.items || !order.items.length) return;

    // Group items by seller
    const sellerItems = new Map();
    for (const item of order.items) {
      if (item.seller) {
        const sId = item.seller.toString();
        if (!sellerItems.has(sId)) sellerItems.set(sId, []);
        sellerItems.get(sId).push(item);
      }
    }

    for (const [sellerId, items] of sellerItems.entries()) {
      const seller = await Seller.findById(sellerId);
      if (!seller) continue;

      const rate = seller.commissionRate || 10;
      let totalOrderAmount = 0;

      for (const item of items) {
        const itemTotal = Number(item.lineTotal || 0);
        totalOrderAmount += itemTotal;

        const commissionAmount = +(itemTotal * (rate / 100)).toFixed(2);
        const netEarning = +(itemTotal - commissionAmount).toFixed(2);

        // Check if transaction already exists for this order & product
        const existingTx = await SellerTransaction.findOne({ order: order._id, product: item.product });
        if (!existingTx) {
          await SellerTransaction.create({
            seller: seller._id,
            order: order._id,
            product: item.product,
            type: 'Order Sale',
            orderAmount: itemTotal,
            commissionRate: rate,
            commissionAmount,
            netEarning,
            status: order.paymentStatus === 'Paid' ? 'Completed' : 'Pending',
            paymentStatus: order.paymentStatus,
            orderStatus: item.sellerStatus || order.status,
            description: `Sale of ${item.name} (x${item.quantity})`,
          });
        }
      }

      const commission = +(totalOrderAmount * (rate / 100)).toFixed(2);
      const net = +(totalOrderAmount - commission).toFixed(2);

      await Seller.findByIdAndUpdate(seller._id, {
        $inc: {
          totalSales: totalOrderAmount,
          totalCommission: commission,
          netEarnings: net,
          totalOrders: 1,
        },
      });
    }
  } catch (err) {
    console.error('Failed to record seller earnings:', err);
  }
};

// POST /api/seller/register
exports.registerSeller = async (req, res) => {
  try {
    const { name, email, password, phone, storeName, storeDescription, storeAddress } = req.body;

    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !password || !phone || !storeName || !storeAddress) {
      return res.status(400).json({ message: 'Please provide all required fields including store address' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const { line1, city, state, pincode } = storeAddress;
    if (!line1 || !city || !state || !pincode) {
      return res.status(400).json({ message: 'Complete street, city, state, and pincode are required for store address' });
    }

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email is already registered. Please login or use another email.' });
    }

    const existingStore = await Seller.findOne({ storeName: new RegExp(`^${storeName.trim()}$`, 'i') });
    if (existingStore) {
      return res.status(409).json({ message: 'This store name is already taken. Please choose another store name.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'seller',
    });

    const seller = await Seller.create({
      user: user._id,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      storeName: storeName.trim(),
      storeDescription: storeDescription ? storeDescription.trim() : '',
      storeAddress: {
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
      },
      status: 'Pending',
    });

    res.status(201).json({
      message: 'Seller application submitted successfully! Your account is pending admin approval.',
      seller: {
        _id: seller._id,
        storeName: seller.storeName,
        status: seller.status,
        email: seller.email,
      },
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Seller registration error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email or store name is already registered' });
    }
    res.status(500).json({ message: 'Failed to submit seller registration' });
  }
};

// POST /api/seller/login
exports.loginSeller = async (req, res) => {
  try {
    const { email, password, remember = true } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role !== 'seller') {
      return res.status(403).json({ message: 'This account is not registered as a seller' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked' });
    }

    const seller = await Seller.findOne({ user: user._id });
    if (!seller) {
      return res.status(404).json({ message: 'Seller profile could not be found' });
    }

    if (seller.status === 'Pending') {
      return res.status(403).json({
        message: 'Your seller account is pending admin approval. You will be able to access the seller hub once approved.',
        sellerStatus: 'Pending',
      });
    }

    if (seller.status === 'Rejected') {
      return res.status(403).json({
        message: seller.rejectionReason
          ? `Your seller application was rejected: ${seller.rejectionReason}`
          : 'Your seller application was rejected by the admin',
        sellerStatus: 'Rejected',
      });
    }

    if (seller.status === 'Suspended') {
      return res.status(403).json({
        message: 'Your seller account has been suspended by the admin. Please contact support.',
        sellerStatus: 'Suspended',
      });
    }

    const token = signToken(user._id);
    res.cookie('token', token, cookieOptions(remember !== false)).json({
      user: user.toSafeObject(),
      seller,
      token,
    });
  } catch (err) {
    console.error('Seller login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

// GET /api/seller/profile
exports.getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.seller._id).populate('user', 'name email createdAt');
    if (!seller) return res.status(404).json({ message: 'Seller profile not found' });
    res.json(seller);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch seller profile' });
  }
};

// PUT /api/seller/profile
exports.updateSellerProfile = async (req, res) => {
  try {
    const { storeName, storeDescription, storeLogo, storeBanner, phone, storeAddress, bankDetails } = req.body;
    const seller = req.seller;

    if (storeName && storeName.trim() !== seller.storeName) {
      const existing = await Seller.findOne({
        _id: { $ne: seller._id },
        storeName: new RegExp(`^${storeName.trim()}$`, 'i'),
      });
      if (existing) {
        return res.status(409).json({ message: 'This store name is already in use by another seller' });
      }
      seller.storeName = storeName.trim();
    }

    if (storeDescription !== undefined) seller.storeDescription = storeDescription.trim();
    if (storeLogo !== undefined) seller.storeLogo = storeLogo.trim();
    if (storeBanner !== undefined) seller.storeBanner = storeBanner.trim();
    if (phone !== undefined) seller.phone = phone.trim();

    if (storeAddress) {
      const { line1, city, state, pincode } = storeAddress;
      if (line1) seller.storeAddress.line1 = line1.trim();
      if (city) seller.storeAddress.city = city.trim();
      if (state) seller.storeAddress.state = state.trim();
      if (pincode) seller.storeAddress.pincode = pincode.trim();
    }

    if (bankDetails) {
      const { accountHolder, accountNumber, ifscCode, bankName } = bankDetails;
      seller.bankDetails = {
        accountHolder: accountHolder?.trim() || '',
        accountNumber: accountNumber?.trim() || '',
        ifscCode: ifscCode?.trim() || '',
        bankName: bankName?.trim() || '',
      };
    }

    await seller.save();
    res.json(seller);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update seller profile' });
  }
};

// GET /api/seller/dashboard
exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const [totalProducts, lowStockProducts, sellerOrders, recentOrders] = await Promise.all([
      Product.countDocuments({ seller: sellerId, isActive: true }),
      Product.countDocuments({ seller: sellerId, isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
      Order.find({ 'items.seller': sellerId }),
      Order.find({ 'items.seller': sellerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('items totalAmount paymentMethod paymentStatus status createdAt shippingAddress'),
    ]);

    let totalItemsSold = 0;
    let pendingOrdersCount = 0;
    let totalSalesCalculated = 0;

    for (const order of sellerOrders) {
      const relevantItems = (order.items || []).filter((i) => i.seller && i.seller.toString() === sellerId.toString());
      for (const item of relevantItems) {
        totalItemsSold += item.quantity;
        totalSalesCalculated += Number(item.lineTotal || 0);
        if (['Pending', 'Confirmed', 'Packed'].includes(item.sellerStatus || order.status)) {
          pendingOrdersCount++;
        }
      }
    }

    const commissionRate = req.seller.commissionRate || 10;
    const totalCommission = +(totalSalesCalculated * (commissionRate / 100)).toFixed(2);
    const netEarnings = +(totalSalesCalculated - totalCommission).toFixed(2);

    res.json({
      seller: {
        _id: req.seller._id,
        storeName: req.seller.storeName,
        rating: req.seller.rating,
        commissionRate,
      },
      stats: {
        totalProducts,
        totalOrders: sellerOrders.length,
        totalItemsSold,
        pendingOrders: pendingOrdersCount,
        lowStockProducts,
        totalSales: +totalSalesCalculated.toFixed(2),
        totalCommission,
        netEarnings,
      },
      recentOrders: recentOrders.map((o) => {
        const sellerSpecificItems = o.items.filter((i) => i.seller && i.seller.toString() === sellerId.toString());
        const sellerSubtotal = sellerSpecificItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);
        return {
          _id: o._id,
          createdAt: o.createdAt,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          status: o.status,
          itemsCount: sellerSpecificItems.length,
          items: sellerSpecificItems,
          sellerSubtotal: +sellerSubtotal.toFixed(2),
          customerCity: o.shippingAddress?.city,
        };
      }),
    });
  } catch (err) {
    console.error('Seller dashboard error:', err);
    res.status(500).json({ message: 'Failed to load seller dashboard' });
  }
};

// GET /api/seller/products
exports.getSellerProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.seller._id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch seller products' });
  }
};

// POST /api/seller/products
exports.createSellerProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      image,
      price,
      costPrice,
      discountPercent = 0,
      gstPercent = 0,
      stock = 0,
      lowStockThreshold = 5,
      deliveryDays = 4,
    } = req.body;

    if (!name || price == null || stock == null) {
      return res.status(400).json({ message: 'Product name, price, and stock are required' });
    }

    const product = await Product.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      category: category ? category.trim() : 'General',
      seller: req.seller._id,
      image: image || '',
      price: Number(price),
      costPrice: costPrice != null ? Number(costPrice) : undefined,
      discountPercent: Number(discountPercent) || 0,
      gstPercent: Number(gstPercent) || 0,
      stock: Number(stock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 5,
      deliveryDays: Number(deliveryDays) || 4,
      isActive: true,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('Create seller product error:', err);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// PUT /api/seller/products/:id
exports.updateSellerProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or you are not authorized to edit it' });
    }

    const {
      name,
      description,
      category,
      image,
      price,
      costPrice,
      discountPercent,
      gstPercent,
      stock,
      lowStockThreshold,
      deliveryDays,
      isActive,
    } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description.trim();
    if (category !== undefined) product.category = category.trim();
    if (image !== undefined) product.image = image;
    if (price !== undefined) product.price = Number(price);
    if (costPrice !== undefined) product.costPrice = Number(costPrice);
    if (discountPercent !== undefined) product.discountPercent = Number(discountPercent);
    if (gstPercent !== undefined) product.gstPercent = Number(gstPercent);
    if (stock !== undefined) product.stock = Number(stock);
    if (lowStockThreshold !== undefined) product.lowStockThreshold = Number(lowStockThreshold);
    if (deliveryDays !== undefined) product.deliveryDays = Number(deliveryDays);
    if (isActive !== undefined) product.isActive = Boolean(isActive);

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// DELETE /api/seller/products/:id
exports.deleteSellerProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or not owned by you' });
    }

    // Soft delete (archive) to retain historical order integrity
    product.isActive = false;
    await product.save();

    res.json({ message: 'Product removed from active listings' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// GET /api/seller/orders
exports.getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const orders = await Order.find({ 'items.seller': sellerId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => {
      const sellerItems = order.items.filter((i) => i.seller && i.seller.toString() === sellerId.toString());
      const sellerSubtotal = sellerItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);

      return {
        _id: order._id,
        createdAt: order.createdAt,
        user: order.user,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        estimatedDelivery: order.estimatedDelivery,
        items: sellerItems,
        sellerSubtotal: +sellerSubtotal.toFixed(2),
      };
    });

    res.json(formattedOrders);
  } catch (err) {
    console.error('Failed to fetch seller orders:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// PUT /api/seller/orders/:id/status
exports.updateSellerOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed statuses are: ${allowedStatuses.join(', ')}` });
    }

    const sellerId = req.seller._id;
    const order = await Order.findOne({ _id: req.params.id, 'items.seller': sellerId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or contains no products from your store' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot update status of a cancelled order' });
    }

    let updatedAny = false;
    for (const item of order.items) {
      if (item.seller && item.seller.toString() === sellerId.toString()) {
        item.sellerStatus = status;
        updatedAny = true;
      }
    }

    if (!updatedAny) {
      return res.status(403).json({ message: 'No items in this order belong to your store' });
    }

    // Check if all items in order have reached the new status or higher
    const allItemsStatus = order.items.every((i) => (i.sellerStatus || order.status) === status);
    if (allItemsStatus) {
      order.status = status;
      order.statusHistory.push({ status, at: new Date() });
    }

    // Update corresponding seller transaction records
    await SellerTransaction.updateMany(
      { order: order._id, seller: sellerId },
      { $set: { orderStatus: status } }
    );

    await order.save();

    res.json({
      message: `Order fulfillment status updated to ${status}`,
      orderId: order._id,
      status: order.status,
      items: order.items.filter((i) => i.seller && i.seller.toString() === sellerId.toString()),
    });
  } catch (err) {
    console.error('Failed to update seller order status:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// GET /api/seller/earnings
exports.getSellerEarnings = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const [transactions, seller] = await Promise.all([
      SellerTransaction.find({ seller: sellerId })
        .populate('order', '_id paymentMethod paymentStatus createdAt')
        .populate('product', 'name image price')
        .sort({ createdAt: -1 }),
      Seller.findById(sellerId),
    ]);

    const totalSales = transactions.reduce((acc, t) => acc + Number(t.orderAmount || 0), 0);
    const totalCommission = transactions.reduce((acc, t) => acc + Number(t.commissionAmount || 0), 0);
    const netEarnings = transactions.reduce((acc, t) => acc + Number(t.netEarning || 0), 0);

    res.json({
      summary: {
        totalSales: +totalSales.toFixed(2),
        commissionRate: seller.commissionRate || 10,
        totalCommission: +totalCommission.toFixed(2),
        netEarnings: +netEarnings.toFixed(2),
        transactionCount: transactions.length,
      },
      transactions,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch earnings' });
  }
};

// GET /api/sellers/:sellerId/store (Public store view)
exports.getPublicSellerStore = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID' });
    }

    const seller = await Seller.findOne({ _id: sellerId, status: 'Approved' }).select(
      'name storeName storeDescription storeLogo storeBanner storeAddress rating createdAt'
    );

    if (!seller) {
      return res.status(404).json({ message: 'Seller store not found or not currently active' });
    }

    const products = await Product.find({ seller: seller._id, isActive: true }).sort({ createdAt: -1 });

    res.json({
      seller,
      products,
      totalProducts: products.length,
    });
  } catch (err) {
    console.error('Store fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch seller store' });
  }
};
