const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, sparse: true, index: true },
    razorpaySignature: { type: String, select: false },
    paymentMethod: {
      type: String,
      default: 'Razorpay',
    },
    // Canonical gateway amounts; `amount` is retained for existing responses.
    amountInPaise: { type: Number, min: 0, index: true },
    capturedAmountInPaise: { type: Number, default: 0, min: 0 },
    refundedAmountInPaise: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    signatureVerified: { type: Boolean, default: false },
    errorDescription: { type: String, default: null },
    gatewayFee: { type: Number, min: 0, select: false },
    gatewayFeeInPaise: { type: Number, min: 0, select: false },
    reconciliationStatus: {
      type: String,
      enum: ['Not Applicable', 'Captured', 'Reconciled', 'Disputed'],
      default: 'Not Applicable',
      index: true,
    },
    reconciledAt: { type: Date, default: null },
    reconciliationReference: { type: String, default: '', trim: true },
    capturedAt: { type: Date, default: null },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.pre('validate', function normalizePaymentPaise(next) {
  if (!Number.isSafeInteger(this.amountInPaise) && Number.isFinite(this.amount)) {
    this.amountInPaise = Math.round(this.amount * 100);
  }
  if (Number.isSafeInteger(this.amountInPaise)) this.amount = +(this.amountInPaise / 100).toFixed(2);
  if (Number.isSafeInteger(this.gatewayFeeInPaise)) this.gatewayFee = +(this.gatewayFeeInPaise / 100).toFixed(2);
  next();
});

paymentSchema.index({ order: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
