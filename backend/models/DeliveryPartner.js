const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    serviceType: {
      type: String,
      enum: ['Express', 'Standard', 'Hyperlocal', 'Surface'],
      default: 'Standard',
    },
    vehicleType: {
      type: String,
      enum: ['Bike', 'Scooter', 'Van', 'Truck', 'Other'],
      default: 'Bike',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    serviceablePincodes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Inactive', 'Suspended', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    activeShipmentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDeliveredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    payoutPricing: {
      mode: { type: String, enum: ['Per Delivery', 'Distance'], default: 'Per Delivery' },
      perDeliveryFeeInPaise: { type: Number, default: 4000, min: 0 },
      perKmRateInPaise: { type: Number, default: 0, min: 0 },
    },
    bankDetails: {
      accountHolder: { type: String, default: '', maxlength: 100 },
      accountNumber: { type: String, default: '', maxlength: 40 },
      ifscCode: { type: String, default: '', maxlength: 20 },
      bankName: { type: String, default: '', maxlength: 100 },
      upiId: { type: String, default: '', maxlength: 120 },
    },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

deliveryPartnerSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
