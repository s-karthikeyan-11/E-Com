const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const { getCookieSameSite } = require('../config/env');

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const isValidPassword = (value) =>
  typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
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

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (
      !normalizedName || normalizedName.length > 100 || normalizedEmail.length > 254 ||
      !isValidEmail(normalizedEmail) || !isValidPassword(password)
    ) {
      return res.status(400).json({ message: 'Provide a name, valid email, and password between 8 and 72 characters' });
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const user = await User.create({ name: normalizedName, email: normalizedEmail, password });
    const token = signToken(user._id);
    res.status(201).cookie('token', token, cookieOptions(true)).json({ user: user.toSafeObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: 'Registration details are invalid' });
    res.status(500).json({ message: 'Registration failed' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
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
    if (user.isBlocked) return res.status(403).json({ message: 'Account is blocked' });

    const token = signToken(user._id);
    let seller = null;
    if (user.role === 'seller') {
      seller = await Seller.findOne({ user: user._id });
    }
    res.cookie('token', token, cookieOptions(remember !== false)).json({ user: user.toSafeObject(), seller });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const safeUser = req.user.toSafeObject();
  let seller = null;
  if (req.user.role === 'seller') {
    seller = await Seller.findOne({ user: req.user._id });
  }
  res.json({ user: safeUser, seller });
};

// GET /api/auth/wallet -- the signed-in customer's refund wallet and history
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance walletTransactions');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });

    const transactions = [...user.walletTransactions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((transaction) => ({
        _id: transaction._id,
        order: transaction.order,
        type: transaction.type,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      }));

    res.json({ balance: user.walletBalance || 0, transactions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load wallet' });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  res.clearCookie('token', cookieOptions(false)).status(204).send();
};
