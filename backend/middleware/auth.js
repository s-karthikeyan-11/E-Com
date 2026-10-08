const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies JWT and attaches the user to req.user
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearerToken || req.cookies?.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    if (user.isBlocked) return res.status(403).json({ message: 'Account is blocked' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const Seller = require('../models/Seller');

// Requires req.user to have role 'admin'
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

// Requires req.user to have role 'seller' and an Approved seller status
const sellerOnly = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (req.user.role !== 'seller') {
    return res.status(403).json({ message: 'Seller access required' });
  }
  const seller = await Seller.findOne({ user: req.user._id });
  if (!seller) {
    return res.status(404).json({ message: 'Seller profile not found' });
  }
  if (seller.status === 'Pending') {
    return res.status(403).json({
      message: 'Your seller account is pending admin approval',
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
      message: 'Your seller account has been suspended by the admin',
      sellerStatus: 'Suspended',
    });
  }
  req.seller = seller;
  next();
};

const DeliveryPartner = require('../models/DeliveryPartner');

const deliveryOnly = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (req.user.role !== 'delivery' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Delivery partner access required' });
  }
  const partner = await DeliveryPartner.findOne({ user: req.user._id });
  if (!partner && req.user.role !== 'admin') {
    return res.status(404).json({ message: 'Delivery partner profile not found' });
  }
  if (partner && partner.status === 'Inactive') {
    return res.status(403).json({ message: 'Your delivery partner account is inactive. Please contact admin.' });
  }
  if (partner && partner.status === 'Suspended') {
    return res.status(403).json({ message: 'Your delivery partner account has been suspended by the admin.' });
  }
  req.deliveryPartner = partner;
  next();
};

const customerOnly = (req, res, next) => {
  if (req.user && req.user.role !== 'admin') return next();
  return res.status(403).json({ message: 'Only customers can place orders' });
};

module.exports = { protect, adminOnly, sellerOnly, customerOnly, deliveryOnly };
