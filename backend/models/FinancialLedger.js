const mongoose = require('mongoose');

const financialLedgerSchema = new mongoose.Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    settlement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
      default: null,
      index: true,
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
      index: true,
    },
    transactionReference: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'ORDER_PAYMENT_CAPTURED',
        'PAYMENT_GATEWAY_SETTLED',
        'MERCHANDISE_SALE_RECORDED',
        'SHIPPING_REVENUE_RECORDED',
        'PROMOTION_SUBSIDY_RECORDED',
        'COD_COLLECTED',
        'COD_REMITTED',
        'COMMISSION_EARNED',
        'SELLER_PAYABLE_CREDITED',
        'DELIVERY_PAYABLE_CREDITED',
        'SELLER_PAYOUT_DISBURSED',
        'DELIVERY_PAYOUT_DISBURSED',
        'REFUND_ISSUED',
        'COMMISSION_REVERSED',
        'RTO_EXPENSE_INCURRED',
        'EXTERNAL_COURIER_EXPENSE_INCURRED',
        'REFUND_LIABILITY_CREATED',
        'REFUND_PAYMENT_CONFIRMED',
        'MANUAL_ADJUSTMENT',
      ],
      required: true,
      index: true,
    },
    debitAccount: {
      type: String,
      enum: [
        'CustomerCash',
        'GatewayReceivable',
        'CODReceivable',
        'SellerPayable',
        'DeliveryPartnerPayable',
        'CustomerRefundPayable',
        'DeliveryExpense',
        'PromotionExpense',
        'CommissionExpense',
        'PlatformCommissionRevenue',
        'ShippingRevenue',
        'MerchandiseSalesRevenue',
        'CourierPayable',
        'SellerReceivable',
        'PlatformBank',
      ],
      required: true,
      index: true,
    },
    creditAccount: {
      type: String,
      enum: [
        'GatewayReceivable',
        'CODReceivable',
        'SellerPayable',
        'DeliveryPartnerPayable',
        'PlatformCommissionRevenue',
        'ShippingRevenue',
        'MerchandiseSalesRevenue',
        'CourierPayable',
        'SellerReceivable',
        'CustomerRefundPayable',
        'PlatformBank',
        'CustomerCash',
      ],
      required: true,
      index: true,
    },
    // Canonical monetary value in integer paise (1 INR = 100 paise)
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
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // append-only: no updates allowed!
);

financialLedgerSchema.pre('validate', function validateCanonicalAmount(next) {
  if (!Number.isSafeInteger(this.amountInPaise) || this.amountInPaise <= 0) {
    return next(new Error('Financial ledger amountInPaise must be a positive safe integer'));
  }
  const canonicalAmount = +(this.amountInPaise / 100).toFixed(2);
  if (this.amount !== canonicalAmount) this.amount = canonicalAmount;
  return next();
});

// Accounting facts are never edited or deleted. Corrections are represented by
// a new, compensating journal entry with its own idempotency key and audit trail.
const rejectMutation = function rejectMutation(next) {
  next(new Error('Financial ledger is append-only; post a compensating entry instead'));
};
financialLedgerSchema.pre('updateOne', rejectMutation);
financialLedgerSchema.pre('updateMany', rejectMutation);
financialLedgerSchema.pre('findOneAndUpdate', rejectMutation);
financialLedgerSchema.pre('replaceOne', rejectMutation);
financialLedgerSchema.pre('deleteOne', rejectMutation);
financialLedgerSchema.pre('deleteMany', rejectMutation);
financialLedgerSchema.pre('findOneAndDelete', rejectMutation);
financialLedgerSchema.pre('findOneAndReplace', rejectMutation);

financialLedgerSchema.index({ eventType: 1, createdAt: -1 });
financialLedgerSchema.index({ debitAccount: 1, createdAt: -1 });
financialLedgerSchema.index({ creditAccount: 1, createdAt: -1 });

module.exports = mongoose.model('FinancialLedger', financialLedgerSchema);
