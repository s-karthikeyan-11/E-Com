const mongoose = require('mongoose');

const shipmentHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      enum: ['admin', 'delivery_partner', 'system'],
      default: 'admin',
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true,
    },
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'Assigned',
        'Picked Up',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Failed Delivery',
        'RTO Initiated',
        'RTO Delivered',
        'Cancelled',
      ],
      default: 'Assigned',
      index: true,
    },
    currentLocation: {
      type: String,
      default: 'Central Logistics Hub',
      trim: true,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    pickedUpAt: {
      type: Date,
    },
    outForDeliveryAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    failedReason: {
      type: String,
      default: '',
    },
    ndrAttempts: {
      type: Number,
      default: 0,
    },
    failureNotes: {
      type: String,
      default: '',
    },
    rtoReason: {
      type: String,
      default: '',
    },
    rtoInitiatedAt: {
      type: Date,
    },
    rtoDeliveredAt: {
      type: Date,
    },
    receiverName: {
      type: String,
      default: '',
    },
    deliveryNotes: {
      type: String,
      default: '',
    },
    // Partner Earnings & Courier Financials
    carrierType: {
      type: String,
      enum: ['Internal', 'External'],
      default: 'Internal',
      index: true,
    },
    externalCourier: {
      companyName: { type: String, default: '', trim: true, maxlength: 120 },
      accountReference: { type: String, default: '', trim: true, maxlength: 120 },
      invoiceReference: { type: String, default: '', trim: true, maxlength: 120 },
      invoiceReceivedAt: { type: Date, default: null },
    },
    payoutPricing: {
      mode: { type: String, enum: ['Per Delivery', 'Distance'], default: 'Per Delivery' },
      distanceKm: { type: Number, default: 0, min: 0 },
      perDeliveryFeeInPaise: { type: Number, default: 4000, min: 0 },
      perKmRateInPaise: { type: Number, default: 0, min: 0 },
    },
    deliveryFeeEarned: {
      type: Number,
      default: 40, // Base default payout per successful delivery
      min: 0,
    },
    deliveryFeeEarnedInPaise: { type: Number, default: 4000, min: 0 },
    isInternalPartner: {
      type: Boolean,
      default: true,
    },
    externalCourierCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    externalCourierCostInPaise: { type: Number, default: 0, min: 0 },
    externalCourierCostRecordedAt: { type: Date, default: null },
    rtoCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    rtoCostInPaise: { type: Number, default: 0, min: 0 },
    rtoCostReference: { type: String, default: '', trim: true, maxlength: 120 },
    rtoCostRecordedAt: { type: Date, default: null },
    codAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    codAmountInPaise: { type: Number, default: 0, min: 0 },
    codCollected: {
      type: Boolean,
      default: false,
      index: true,
    },
    codCollectedAt: {
      type: Date,
      default: null,
    },
    codRemitted: {
      type: Boolean,
      default: false,
      index: true,
    },
    codRemittedAt: {
      type: Date,
      default: null,
    },
    codRemittanceReference: {
      type: String,
      default: '',
    },
    isSettledToPartner: {
      type: Boolean,
      default: false,
      index: true,
    },
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
      default: null,
      index: true,
    },
    statusHistory: {
      type: [shipmentHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

shipmentSchema.pre('validate', function normalizeShipmentMoney(next) {
  const pairs = [
    ['deliveryFeeEarnedInPaise', 'deliveryFeeEarned'],
    ['externalCourierCostInPaise', 'externalCourierCost'],
    ['rtoCostInPaise', 'rtoCost'],
    ['codAmountInPaise', 'codAmount'],
  ];
  for (const [paiseField, amountField] of pairs) {
    if (!Number.isSafeInteger(this[paiseField]) && Number.isFinite(this[amountField])) {
      this[paiseField] = Math.round(this[amountField] * 100);
    }
    if (Number.isSafeInteger(this[paiseField])) this[amountField] = +(this[paiseField] / 100).toFixed(2);
  }
  if (this.carrierType === 'Internal' && !this.deliveryPartner) {
    return next(new Error('An internal shipment requires a delivery partner'));
  }
  if (this.carrierType === 'External' && !this.externalCourier?.companyName) {
    return next(new Error('An external shipment requires a courier company name'));
  }
  return next();
});

shipmentSchema.index({ deliveryPartner: 1, status: 1 });
shipmentSchema.index({ createdAt: -1 });
shipmentSchema.index(
  { 'externalCourier.invoiceReference': 1 },
  { unique: true, sparse: true, partialFilterExpression: { carrierType: 'External' } }
);

module.exports = mongoose.model('Shipment', shipmentSchema);
