const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    settlementNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    beneficiaryType: {
      type: String,
      enum: ['Seller', 'DeliveryPartner'],
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
      index: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true,
    },
    beneficiaryUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // One active request per beneficiary. This sparse unique key is the
    // database-level lock that prevents concurrent duplicate payouts.
    activeBeneficiaryKey: { type: String, unique: true, sparse: true, index: true },
    // Associated reconciled order items for seller settlements
    orderItems: [
      {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, default: '' },
        quantity: { type: Number, default: 1 },
        lineTotal: { type: Number, required: true },
        lineTotalInPaise: { type: Number, min: 0 },
        commissionAmount: { type: Number, required: true },
        commissionAmountInPaise: { type: Number, min: 0 },
        netEarning: { type: Number, required: true },
        netEarningInPaise: { type: Number, min: 0 },
      },
    ],
    // Associated shipments for delivery partner settlements
    shipments: [
      {
        shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        trackingNumber: { type: String, default: '' },
        deliveryFeeEarned: { type: Number, required: true },
        deliveryFeeEarnedInPaise: { type: Number, min: 0 },
      },
    ],
    // Monetary amounts stored in both integer paise (canonical) and standard INR floats
    amountInPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: [
        'Pending Review',
        'Approved',
        'Processing',
        'Paid',
        'Failed',
        'Rejected',
        'On Hold',
      ],
      default: 'Pending Review',
      index: true,
    },
    // Frozen bank details at the moment of settlement request
    bankDetailsSnapshot: {
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },
    // Verified payment reference entered by admin (Bank UTR, IMPS Ref, Razorpay Payout ID)
    payoutReference: {
      type: String,
      default: null,
      trim: true,
      unique: true,
      sparse: true,
    },
    payoutVerification: {
      method: { type: String, enum: ['Bank Statement', 'RazorpayX', 'UPI', 'Other'], default: null },
      evidenceReference: { type: String, default: '', trim: true },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null },
    },
    processingStartedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: '', trim: true },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    holdReason: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  { timestamps: true }
);

settlementSchema.index({ beneficiaryType: 1, status: 1 });
settlementSchema.index({ seller: 1, createdAt: -1 });
settlementSchema.index({ deliveryPartner: 1, createdAt: -1 });

settlementSchema.pre('validate', function normalizeSettlementPaise(next) {
  if (Number.isSafeInteger(this.amountInPaise)) this.amount = +(this.amountInPaise / 100).toFixed(2);
  next();
});

module.exports = mongoose.model('Settlement', settlementSchema);
