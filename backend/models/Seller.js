const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    storeName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
    },
    storeDescription: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    storeLogo: {
      type: String,
      default: '',
      maxlength: 2048,
    },
    storeBanner: {
      type: String,
      default: '',
      maxlength: 2048,
    },
    storeAddress: {
      line1: { type: String, required: true, trim: true, maxlength: 200 },
      city: { type: String, required: true, trim: true, maxlength: 80 },
      state: { type: String, required: true, trim: true, maxlength: 80 },
      pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Suspended'],
      default: 'Pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    commissionRate: {
      type: Number,
      default: 10, // 10% platform commission
      min: 0,
      max: 100,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    totalSales: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCommission: {
      type: Number,
      default: 0,
      min: 0,
    },
    netEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    bankDetails: {
      accountHolder: { type: String, default: '', maxlength: 100 },
      accountNumber: { type: String, default: '', maxlength: 40 },
      ifscCode: { type: String, default: '', maxlength: 20 },
      bankName: { type: String, default: '', maxlength: 100 },
    },
  },
  { timestamps: true }
);

sellerSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Seller', sellerSchema);
