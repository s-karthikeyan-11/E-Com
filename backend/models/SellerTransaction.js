const mongoose = require('mongoose');

const sellerTransactionSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['Order Sale', 'Commission Deduction', 'Payout', 'Refund'],
      default: 'Order Sale',
    },
    orderAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionRate: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    netEarning: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Refunded'],
      default: 'Pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      default: 'Pending',
    },
    orderStatus: {
      type: String,
      default: 'Pending',
    },
    description: {
      type: String,
      default: '',
      maxlength: 300,
    },
  },
  { timestamps: true }
);

sellerTransactionSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('SellerTransaction', sellerTransactionSchema);
