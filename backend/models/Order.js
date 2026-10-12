const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', default: null, index: true },
    sellerStatus: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
    // Immutable analytics snapshots for orders placed after cost reporting was added.
    category: { type: String, trim: true, maxlength: 60 },
    unitCost: { type: Number, min: 0, select: false },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // base price at time of order
    discountPercent: { type: Number, required: true, default: 0 },
    gstPercent: { type: Number, required: true, default: 0 },
    finalPrice: { type: Number, required: true }, // per-unit final price at order time
    lineTotal: { type: Number, required: true }, // finalPrice * quantity
    // Canonical monetary snapshots. Legacy INR fields above remain read-compatible.
    lineTotalInPaise: { type: Number, min: 0 },
    // Snapshots of commission & net earning at order confirmation time
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    commissionBaseAmount: { type: Number, default: 0, min: 0 },
    commissionBaseInPaise: { type: Number, default: 0, min: 0 },
    commissionBaseType: {
      type: String,
      enum: ['final_price_ex_gst', 'base_price', 'line_total'],
      default: 'final_price_ex_gst',
    },
    commissionAmount: { type: Number, default: 0, min: 0 },
    commissionAmountInPaise: { type: Number, default: 0, min: 0 },
    netEarning: { type: Number, default: 0, min: 0 },
    netEarningInPaise: { type: Number, default: 0, min: 0 },
    isSettled: { type: Boolean, default: false, index: true },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null, index: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    subtotalInPaise: { type: Number, min: 0 },
    totalGst: { type: Number, required: true },
    totalGstInPaise: { type: Number, min: 0 },
    totalAmount: { type: Number, required: true },
    totalAmountInPaise: { type: Number, min: 0, index: true },
    deliveryFee: { type: Number, default: 0, min: 0 },
    deliveryFeeInPaise: { type: Number, default: 0, min: 0 },
    // Loyalty coupon used on this order (see utils/coupons.js). totalAmount already has it subtracted.
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0, min: 0 },
    couponDiscountInPaise: { type: Number, default: 0, min: 0 },
    // A paid order cancelled by the store is refunded to the customer's wallet.
    // Its presence also makes the credit safe to retry without duplicating money.
    walletRefund: {
      amount: { type: Number, min: 0.01 },
      amountInPaise: { type: Number, min: 1 },
      creditedAt: { type: Date },
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Credit/Debit Card', 'Net Banking', 'Razorpay', 'Wallet', 'Cash on Delivery'],
      default: 'Cash on Delivery',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Partially Refunded', 'Refunded', 'Failed'],
      default: 'Pending',
    },
    // COD Cash Collection & Hub Remittance Lifecycle
    codCollected: { type: Boolean, default: false, index: true },
    codCollectedAt: { type: Date, default: null },
    codRemitted: { type: Boolean, default: false, index: true },
    codRemittedAt: { type: Date, default: null },
    codRemittanceReference: { type: String, default: '' },
    // Gateway identifiers are stored only after the server creates/verifies them.
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String, select: false },
    paymentGatewayFee: { type: Number, min: 0, select: false },
    paymentGatewayFeeInPaise: { type: Number, min: 0, select: false },
    paidAt: { type: Date },
    refundedAmountInPaise: { type: Number, default: 0, min: 0 },
    refundReservedInPaise: { type: Number, default: 0, min: 0, select: false },
    shippingAddress: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: [
        'Awaiting Payment',
        'Pending',
        'Confirmed',
        'Packed',
        'Processing',
        'Shipped',
        'Picked Up',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Failed Delivery',
        'RTO Initiated',
        'RTO Delivered',
        'Cancelled',
      ],
      default: 'Pending',
    },
    // Logistics & Delivery Partner Assignment
    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null, index: true },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    trackingNumber: { type: String, default: null, index: true },
    deliveryStatus: {
      type: String,
      enum: [
        'Pending Assignment',
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
      default: 'Pending Assignment',
    },
    // Committed delivery date (calendar date stored as UTC midnight).
    // Set on an order created by "reorder"; the cancelled source order is never modified.
    reorderedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, sparse: true },
    // A cancelled-order chain can be renewed at most twice. This value is carried
    // forward to the new order so a cancellation cannot restart the allowance.
    renewalCount: { type: Number, default: 0, min: 0, max: 2 },
    estimatedDelivery: { type: Date },
    scheduledDelivery: { type: Boolean, default: false }, // customer picked this date
    fastTracked: { type: Boolean, default: false },       // date came from a cancelled order's released slot
    // Timeline used by the customer's order-tracking page.
    statusHistory: {
      type: [
        new mongoose.Schema(
          { status: { type: String, required: true }, at: { type: Date, default: Date.now } },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

orderSchema.pre('save', function recordInitialStatus(next) {
  if (this.isNew && !this.statusHistory.length) this.statusHistory.push({ status: this.status, at: new Date() });
  next();
});

orderSchema.index({ user: 1, createdAt: -1 });        // user's orders sorted by creation date //
orderSchema.index({ status: 1, createdAt: -1 });       // orders sorted by status and creation date in admin //
orderSchema.index({ createdAt: -1, paymentStatus: 1, paymentMethod: 1 }); // report filters

module.exports = mongoose.model('Order', orderSchema);
