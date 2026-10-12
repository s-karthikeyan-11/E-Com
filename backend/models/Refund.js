const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
    provider: { type: String, enum: ['Razorpay', 'Wallet', 'Manual'], required: true },
    providerRefundId: { type: String, unique: true, sparse: true, trim: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true, index: true },
    amountInPaise: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['Created', 'Processing', 'Succeeded', 'Failed', 'Unknown'],
      default: 'Created',
      index: true,
    },
    reason: { type: String, default: '', trim: true, maxlength: 500 },
    failureReason: { type: String, default: '', trim: true, maxlength: 500 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    ledgerPostedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

refundSchema.pre('validate', function normalizeRefundAmount(next) {
  if (!Number.isSafeInteger(this.amountInPaise) || this.amountInPaise <= 0) {
    return next(new Error('Refund amountInPaise must be a positive safe integer'));
  }
  this.amount = +(this.amountInPaise / 100).toFixed(2);
  return next();
});

refundSchema.index({ order: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);
