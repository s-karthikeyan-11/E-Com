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

// Requires req.user to have role 'admin'
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

const customerOnly = (req, res, next) => {
  if (req.user && req.user.role !== 'admin') return next();
  return res.status(403).json({ message: 'Only customers can place orders' });
};

module.exports = { protect, adminOnly, customerOnly };
