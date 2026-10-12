const mongoose = require('mongoose');

const commissionRateSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // The base upon which commission is computed:
    // 'final_price_ex_gst' computes on item finalPrice excluding GST
    // 'base_price' computes on base price before discount/tax
    commissionBase: {
      type: String,
      enum: ['final_price_ex_gst', 'base_price', 'line_total'],
      default: 'final_price_ex_gst',
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 250,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionRate', commissionRateSchema);
