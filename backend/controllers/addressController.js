const User = require('../models/User');
const mongoose = require('mongoose');
const { validateShippingAddress } = require('../utils/address');

const MAX_ADDRESSES = 5;

const clean = (body) => {
  const address = validateShippingAddress(body);
  if (!address) return null;
  const label = String(body.label || 'Home').trim().slice(0, 30) || 'Home';
  return { ...address, label };
};

const send = (res, user, status = 200) => res.status(status).json(user.addresses);

// GET /api/addresses
exports.getAddresses = async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  res.json(user ? user.addresses : []);
};

// POST /api/addresses
exports.addAddress = async (req, res) => {
  const data = clean(req.body);
  if (!data) return res.status(400).json({ message: 'Enter a complete address with a 6-digit PIN code and valid phone number' });
  const user = await User.findById(req.user._id).select('addresses');
  if (user.addresses.length >= MAX_ADDRESSES) return res.status(400).json({ message: `You can save up to ${MAX_ADDRESSES} addresses` });
  const makeDefault = Boolean(req.body.isDefault) || !user.addresses.length;
  if (makeDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  user.addresses.push({ ...data, isDefault: makeDefault });
  await user.save();
  send(res, user, 201);
};

// PUT /api/addresses/:addressId
exports.updateAddress = async (req, res) => {
  const data = clean(req.body);
  if (!data) return res.status(400).json({ message: 'Enter a complete address with a 6-digit PIN code and valid phone number' });
  const user = await User.findById(req.user._id).select('addresses');
  const address = mongoose.Types.ObjectId.isValid(req.params.addressId) && user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });
  if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
  address.set({ ...data, ...(req.body.isDefault ? { isDefault: true } : {}) });
  await user.save();
  send(res, user);
};

// DELETE /api/addresses/:addressId
exports.deleteAddress = async (req, res) => {
  const user = await User.findById(req.user._id).select('addresses');
  const address = mongoose.Types.ObjectId.isValid(req.params.addressId) && user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: 'Address not found' });
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  send(res, user);
};
