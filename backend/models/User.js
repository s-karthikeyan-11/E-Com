const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletTransactionSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    type: { type: String, enum: ['Refund', 'Payment'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
    isBlocked: { type: Boolean, default: false },
    // Prevents the same account from submitting its cart twice concurrently.
    // It is cleared after checkout and can be reclaimed after a short timeout.
    checkoutLock: { type: Date, default: null, select: false },
    addresses: {
      type: [
        {
          label: { type: String, default: 'Home', trim: true, maxlength: 30 },
          line1: { type: String, required: true, trim: true, maxlength: 180 },
          city: { type: String, required: true, trim: true, maxlength: 80 },
          state: { type: String, required: true, trim: true, maxlength: 80 },
          pincode: { type: String, required: true, match: /^\d{6}$/ },
          phone: { type: String, required: true },
          isDefault: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    cart: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
      },
    ],
    walletBalance: { type: Number, default: 0, min: 0 },
    walletTransactions: { type: [walletTransactionSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    isBlocked: this.isBlocked,
    walletBalance: this.walletBalance || 0,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
