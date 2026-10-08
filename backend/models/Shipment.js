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
      required: true,
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
    statusHistory: {
      type: [shipmentHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

shipmentSchema.index({ deliveryPartner: 1, status: 1 });
shipmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
