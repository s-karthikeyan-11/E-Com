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
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active',
      index: true,
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
