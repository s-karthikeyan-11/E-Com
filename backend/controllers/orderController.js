const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const DeliveryPartner = require('../models/DeliveryPartner');
const Seller = require('../models/Seller');
const SellerTransaction = require('../models/SellerTransaction');
const mongoose = require('mongoose');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const { toDate, toStr, todayStr, isDateStr } = require('../utils/dates');
const { planDelivery, consumeSlots, restoreSlots, releaseSlots } = require('../utils/delivery');
const { validateShippingAddress } = require('../utils/address');
const { getEligibleCoupon, getNextRewardOrderNumber, calculateCouponDiscount } = require('../utils/coupons');
const { recordSellerEarningsForOrder } = require('./sellerController');
const {
  getCategoryCommissionRule,
  calculateItemFinancials,
  toPaise,
  paiseForOrder,
  postLedgerEntry,
} = require('../utils/finance');

const errorStatus = (err) => (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);

const PAYMENT_METHODS = ['Cash on Delivery'];
const CHECKOUT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const STATUS_TRANSITIONS = {
  'Awaiting Payment': ['Cancelled'],
  Pending: ['Confirmed', 'Processing', 'Packed', 'Cancelled'],
  Confirmed: ['Packed', 'Processing', 'Shipped', 'Picked Up', 'Cancelled'],
  Packed: ['Shipped', 'Picked Up', 'Cancelled'],
  Processing: ['Packed', 'Shipped', 'Picked Up', 'Cancelled'],
  Shipped: ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled'],
  'Picked Up': ['In Transit', 'Out for Delivery', 'Failed Delivery', 'Cancelled'],
  'In Transit': ['Out for Delivery', 'Delivered', 'Failed Delivery', 'RTO Initiated', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Failed Delivery', 'RTO Initiated'],
  'Failed Delivery': ['Out for Delivery', 'RTO Initiated'],
  'RTO Initiated': ['RTO Delivered'],
  'RTO Delivered': [],
  Delivered: [],
  Cancelled: [],
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Enough context to diagnose Razorpay configuration or capture failures without
// ever writing credentials, signatures, or payment-card data to application logs.
const logRazorpayError = (context, err) => {
  console.error(`Razorpay ${context} failed`, {
    status: err?.statusCode || err?.status,
    code: err?.error?.code || err?.code,
    description: err?.error?.description || err?.description || err?.message,
  });
};

const mapRazorpayMethod = (method) => {
  if (!method) return 'Razorpay';
  const m = String(method).toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'card') return 'Credit/Debit Card';
  if (m === 'netbanking') return 'Net Banking';
  if (m === 'wallet') return 'Wallet';
  return 'Razorpay';
};

// Cost and gateway-fee snapshots are internal accounting data. `select: false`
// protects queried orders; this additionally protects the newly created order
// document returned before a query projection applies.
const toCustomerOrder = (order) => {
  const safeOrder = order.toObject ? order.toObject() : { ...order };
  safeOrder.items = (safeOrder.items || []).map(({ unitCost, ...item }) => item);
  delete safeOrder.paymentGatewayFee;
  return safeOrder;
};

const getRefundAmount = (order) => {
  const amount = Number(order.totalAmount);
  if (order.paymentStatus !== 'Paid' || !Number.isFinite(amount) || amount <= 0) return 0;
  return +amount.toFixed(2);
};

// Credits a paid cancellation only once. The balance increment and ledger entry live
// on the same user document, making this update atomic even if an admin retries it.
const creditWalletRefund = async (order) => {
  const amount = getRefundAmount(order);
  if (!amount) return null;

  const now = new Date();
  const transaction = { order: order._id, type: 'Refund', amount, createdAt: now };
  let user = await User.findOneAndUpdate(
    {
      _id: order.user,
      walletTransactions: mongoose.trusted({ $not: { $elemMatch: { order: order._id, type: 'Refund' } } }),
    },
    {
      $inc: { walletBalance: amount },
      $push: { walletTransactions: transaction },
    },
    { new: true, runValidators: true }
  );

  // A previous attempt may have already credited the wallet before the order's
  // refund marker was saved. Read that transaction instead of crediting again.
  let creditedAt = now;
  if (!user) {
    user = await User.findById(order.user).select('walletTransactions');
    if (!user) throw httpError(404, 'Customer account was not found for this refund');
    const existing = user.walletTransactions.find((entry) =>
      entry.type === 'Refund' && entry.order.toString() === order._id.toString()
    );
    if (!existing) throw httpError(409, 'This refund could not be credited to the customer wallet');
    creditedAt = existing.createdAt;
  }

  const walletRefund = { amount, creditedAt };
  await Order.updateOne(
    { _id: order._id, 'walletRefund.creditedAt': mongoose.trusted({ $exists: false }) },
    { $set: { walletRefund } }
  );
  return walletRefund;
};

const FREE_DELIVERY_THRESHOLD = 2000;
const DELIVERY_FEE = 99;
const REORDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_RENEWALS = 2;
const computeDeliveryFee = (itemTotal) => (itemTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE);

// Debits the refund wallet only when it contains the whole server-calculated
// renewal total. The balance check, debit, and ledger entry are one atomic
// document update, so concurrent renewal attempts cannot overspend it.
const debitWalletForRenewal = async (userId, orderId, amount) => {
  const now = new Date();
  const result = await User.updateOne(
    { _id: userId, walletBalance: mongoose.trusted({ $gte: amount }) },
    {
      $inc: { walletBalance: -amount },
      $push: { walletTransactions: { order: orderId, type: 'Payment', amount, createdAt: now } },
    },
    { runValidators: true }
  );
  if (result.modifiedCount !== 1) {
    throw httpError(409, 'Your wallet balance is insufficient for this renewal. Add funds or place a new order from your cart.');
  }
};

// A renewal can fail after the wallet has been debited (for example, while
// creating the order). Restore exactly that ledger entry and amount on rollback.
const reverseWalletRenewalPayment = async (userId, orderId, amount) => {
  const result = await User.updateOne(
    { _id: userId, walletTransactions: mongoose.trusted({ $elemMatch: { order: orderId, type: 'Payment' } }) },
    {
      $inc: { walletBalance: amount },
      $pull: { walletTransactions: { order: orderId, type: 'Payment' } },
    }
  );
  if (result.modifiedCount !== 1) throw new Error('Could not restore the wallet payment');
};

const getCheckoutLock = async (userId) => {
  const staleLock = new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS);
  return User.findOneAndUpdate(
    {
      _id: userId,
      // null also matches documents created before checkoutLock existed.
      $or: [
        { checkoutLock: null },
        { checkoutLock: mongoose.trusted({ $lt: staleLock }) },
      ],
    },
    { $set: { checkoutLock: new Date() } },
    { new: false }
  );
};

const countPlacedOrders = (userId) => Order.countDocuments({ user: userId, status: mongoose.trusted({ $ne: 'Cancelled' }) });

// Works out the coupon for this customer and cart. With `required` set (the customer asked
// for it), a coupon that no longer applies is an error, so the amount charged never
// differs from the amount shown at checkout.
const resolveCoupon = async (userId, itemTotal, required) => {
  const placed = await countPlacedOrders(userId);
  const coupon = getEligibleCoupon(placed);
  const discount = calculateCouponDiscount(coupon, itemTotal);
  if (required && !discount) {
    throw httpError(409, coupon
      ? `Your ${coupon.label.toLowerCase()} needs an order of at least ₹${coupon.minOrder}`
      : 'This coupon is not available for your account');
  }
  return { placed, coupon, discount };
};

const getCheckoutDetails = async (userId, applyCoupon = false) => {
  // Cost is server-only, but is snapshotted onto the order for profit reporting.
  const user = await User.findById(userId).populate({ path: 'cart.product', select: '+costPrice' });
  if (!user) throw httpError(401, 'User no longer exists');
  if (!user.cart.length) throw httpError(400, 'Cart is empty');

  const originalCart = user.cart.map((item) => ({ product: item.product._id || item.product, quantity: item.quantity }));
  const items = [];
  let subtotal = 0;
  let totalGst = 0;

  // Validate the complete cart before changing any stock.
  for (const cartItem of user.cart) {
    const product = cartItem.product;
    if (!product || !product.isActive) {
      throw httpError(400, 'A product in your cart is no longer available');
    }
    if (product.stock < cartItem.quantity) {
      throw httpError(400, `Insufficient stock for ${product.name}`);
    }
  }

  for (const cartItem of user.cart) {
    const product = cartItem.product;
    const discounted = +(product.price - (product.price * product.discountPercent) / 100).toFixed(2);
    const gstAmount = +((discounted * product.gstPercent) / 100).toFixed(2);
    const finalPrice = +(discounted + gstAmount).toFixed(2);
    const lineTotal = +(finalPrice * cartItem.quantity).toFixed(2);

    // Dynamic category commission rate snapshotting (excluding GST and delivery fee from commission base)
    const commissionRule = await getCategoryCommissionRule(product.category);
    const itemFin = calculateItemFinancials(
      { price: product.price, finalPrice, gstPercent: product.gstPercent, quantity: cartItem.quantity, lineTotal },
      commissionRule
    );

    items.push({
      product: product._id,
      name: product.name,
      seller: product.seller || null,
      sellerStatus: 'Pending',
      category: product.category,
      ...(Number.isFinite(product.costPrice) ? { unitCost: product.costPrice } : {}),
      quantity: cartItem.quantity,
      price: product.price,
      discountPercent: product.discountPercent,
      gstPercent: product.gstPercent,
      finalPrice,
      lineTotal,
      lineTotalInPaise: itemFin.amountInPaise,
      commissionRate: itemFin.commissionRate,
      commissionBaseAmount: itemFin.commissionBaseAmount,
      commissionBaseInPaise: itemFin.commissionBaseInPaise,
      commissionBaseType: itemFin.commissionBaseType,
      commissionAmount: itemFin.commissionAmount,
      commissionAmountInPaise: itemFin.commissionInPaise,
      netEarning: itemFin.netEarning,
      netEarningInPaise: itemFin.netEarningInPaise,
      isSettled: false,
    });
    subtotal += discounted * cartItem.quantity;
    totalGst += gstAmount * cartItem.quantity;
  }

  const itemTotal = +(subtotal + totalGst).toFixed(2);
  const deliveryFee = computeDeliveryFee(itemTotal); // based on the price before any coupon
  const { coupon, discount: couponDiscount } = applyCoupon
    ? await resolveCoupon(userId, itemTotal, true)
    : { coupon: null, discount: 0 };
  return {
    user,
    itemTotal,
    couponCode: couponDiscount ? coupon.code : undefined,
    couponDiscount,
    originalCart,
    items,
    subtotal: +subtotal.toFixed(2),
    subtotalInPaise: toPaise(subtotal),
    totalGst: +totalGst.toFixed(2),
    totalGstInPaise: toPaise(totalGst),
    deliveryFee,
    deliveryFeeInPaise: toPaise(deliveryFee),
    couponDiscountInPaise: toPaise(couponDiscount),
    totalAmount: +(itemTotal - couponDiscount + deliveryFee).toFixed(2),
    totalAmountInPaise: toPaise(itemTotal - couponDiscount + deliveryFee),
  };
};

const reserveStock = async (items) => {
  const reservedItems = [];
  for (const item of items) {
    // Conditional, atomic decrement prevents concurrent checkouts from
    // overselling a product.
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: item.product,
        isActive: true,
        stock: mongoose.trusted({ $gte: item.quantity }),
      },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );
    if (!updatedProduct) throw httpError(409, `Insufficient stock for ${item.name}`);
    reservedItems.push({ product: item.product, quantity: item.quantity });
  }
  return reservedItems;
};

const releaseStock = async (items) => {
  if (!items.length) return;
  await Promise.all(items.map((item) => Product.updateOne(
    { _id: item.product },
    { $inc: { stock: item.quantity } }
  )));
};

// Validates the customer's (optional) delivery date, uses any released slots needed to
// meet it, and returns what to store on the order. `consumed` must be passed to
// restoreSlots() if checkout fails afterwards.
const commitDelivery = async (items, requestedDate) => {
  const plan = await planDelivery(items);
  const hasRequest = requestedDate !== undefined && requestedDate !== null && requestedDate !== '';
  let committed = plan.earliest;

  if (hasRequest) {
    if (!isDateStr(requestedDate)) throw httpError(400, 'Choose a valid delivery date');
    if (requestedDate < plan.earliest) throw httpError(400, `The earliest delivery date for this order is ${plan.earliest}`);
    if (requestedDate > plan.maxDate) throw httpError(400, `Delivery can be scheduled up to ${plan.maxDate}`);
    committed = requestedDate;
  }

  // A slot is only needed for items whose normal lead time would miss the committed date.
  const needed = plan.plans.filter((p) => p.slotId && committed < p.standardDate);
  const { consumed, lost } = await consumeSlots(needed);

  if (lost.length) {
    // Someone else took the freed slot first: fall back to normal lead time for those items.
    const consumedIds = new Set(consumed.map((p) => String(p.product)));
    const fallback = plan.plans.reduce((max, p) => {
      const date = consumedIds.has(String(p.product)) ? p.date : p.standardDate;
      return date > max ? date : max;
    }, plan.today);
    if (fallback > committed) {
      if (hasRequest) {
        await restoreSlots(consumed);
        throw httpError(409, 'Delivery availability just changed. Please choose your delivery date again.');
      }
      committed = fallback;
    }
  }

  return {
    estimatedDelivery: toDate(committed),
    scheduledDelivery: hasRequest,
    fastTracked: consumed.length > 0,
    consumed,
  };
};

const restoreCart = async (userId, items) => {
  if (!items.length) return;
  const user = await User.findById(userId);
  if (!user) return;

  for (const item of items) {
    const existing = user.cart.find((cartItem) => cartItem.product.toString() === item.product.toString());
    if (existing) existing.quantity += item.quantity;
    else user.cart.push({ product: item.product, quantity: item.quantity });
  }
  await user.save();
};

const isValidSignature = (orderId, paymentId, signature) => {
  if (![orderId, paymentId, signature].every((value) => typeof value === 'string' && value.length)) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const actual = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};

const isCapturedGatewayPaymentForOrder = (order, payment) => (
  payment
  && payment.order_id === order.razorpayOrderId
  && payment.amount === paiseForOrder(order)
  && payment.currency === 'INR'
  && payment.status === 'captured'
);

// Both the signed Checkout response and the signed Razorpay webhook end here.
// The compare-and-set is the payment state authority; all financial posts have
// deterministic idempotency keys, so an interrupted request is safe to retry.
const finalizeRazorpayCapture = async ({ order, payment, signature = null }) => {
  if (!isCapturedGatewayPaymentForOrder(order, payment)) {
    throw httpError(409, 'Payment is not captured for this order yet');
  }

  if (order.paymentStatus === 'Paid') {
    if (order.razorpayPaymentId !== payment.id) throw httpError(409, 'This order has already been paid');
    await recordSellerEarningsForOrder(order);
    return order;
  }

  const now = new Date();
  const paidOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: 'Awaiting Payment',
      paymentStatus: 'Pending',
      razorpayOrderId: order.razorpayOrderId,
    },
    {
      $set: {
        status: 'Pending',
        paymentStatus: 'Paid',
        paymentMethod: mapRazorpayMethod(payment.method),
        razorpayPaymentId: payment.id,
        ...(signature ? { razorpaySignature: signature } : {}),
        ...(Number.isFinite(payment.fee) ? {
          paymentGatewayFee: payment.fee / 100,
          paymentGatewayFeeInPaise: payment.fee,
        } : {}),
        paidAt: now,
      },
      $push: { statusHistory: { status: 'Pending', at: now } },
    },
    { new: true, runValidators: true }
  );

  if (!paidOrder) {
    const current = await Order.findById(order._id);
    if (current?.paymentStatus === 'Paid' && current.razorpayPaymentId === payment.id) {
      await recordSellerEarningsForOrder(current);
      return current;
    }
    throw httpError(409, 'This payment is already being processed. Refresh the order history.');
  }

  await Payment.findOneAndUpdate(
    { order: paidOrder._id, razorpayOrderId: paidOrder.razorpayOrderId },
    {
      $set: {
        razorpayPaymentId: payment.id,
        ...(signature ? { razorpaySignature: signature } : {}),
        paymentMethod: mapRazorpayMethod(payment.method),
        amountInPaise: paiseForOrder(paidOrder),
        capturedAmountInPaise: payment.amount,
        status: 'SUCCESS',
        signatureVerified: true,
        reconciliationStatus: 'Captured',
        ...(Number.isFinite(payment.fee) ? { gatewayFee: payment.fee / 100, gatewayFeeInPaise: payment.fee } : {}),
        capturedAt: now,
        paidAt: now,
      },
    },
    { runValidators: true }
  );

  await postLedgerEntry({
    order: paidOrder._id,
    transactionReference: payment.id,
    idempotencyKey: `LED_PAY_CAPTURE_${paidOrder._id}`,
    eventType: 'ORDER_PAYMENT_CAPTURED',
    debitAccount: 'GatewayReceivable',
    creditAccount: 'CustomerCash',
    amountInPaise: paiseForOrder(paidOrder),
    description: `Razorpay captured payment for Order #${paidOrder._id.toString().slice(-6)}`,
  });

  await recordSellerEarningsForOrder(paidOrder);
  return paidOrder;
};

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
};

// Razorpay sends this independently of the browser. It is deliberately mounted
// before express.json() so the HMAC covers the original bytes.
exports.handleRazorpayWebhook = async (req, res) => {
  const rawBody = req.body;
  const signature = req.get('x-razorpay-signature');
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ message: 'Invalid Razorpay webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid Razorpay webhook payload' });
  }

  const eventType = String(payload.event || 'unknown');
  const paymentEntity = payload?.payload?.payment?.entity;
  const providerOrderId = paymentEntity?.order_id || '';
  const paymentId = paymentEntity?.id || '';
  const suppliedEventId = req.get('x-razorpay-event-id');
  const eventId = suppliedEventId || crypto.createHash('sha256').update(rawBody).digest('hex');
  const payloadDigest = crypto.createHash('sha256').update(rawBody).digest('hex');

  let webhookEvent;
  try {
    webhookEvent = await WebhookEvent.create({
      provider: 'Razorpay', eventId, eventType, payloadDigest, paymentId, providerOrderId,
    });
  } catch (err) {
    if (err.code !== 11000) {
      console.error('Could not record Razorpay webhook delivery:', err);
      return res.status(500).json({ message: 'Webhook persistence failed' });
    }
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing?.payloadDigest !== payloadDigest) {
      return res.status(409).json({ message: 'Webhook event ID payload mismatch' });
    }
    if (existing?.status === 'Processed') return res.status(200).json({ received: true, duplicate: true });
    webhookEvent = await WebhookEvent.findOneAndUpdate(
      { _id: existing._id, status: 'Failed' },
      { $set: { status: 'Processing', failureReason: '' } },
      { new: true }
    );
    if (!webhookEvent) return res.status(202).json({ received: true, processing: true });
  }

  try {
    if (eventType === 'payment.captured') {
      if (!providerOrderId || !paymentId) throw httpError(400, 'Captured payment webhook is incomplete');
      const order = await Order.findOne({ razorpayOrderId: providerOrderId });
      if (!order) throw httpError(404, 'No local order matches this gateway order');
      // A signed webhook is authoritative, but fetching the payment adds an
      // independent server-side amount/status/order validation.
      const payment = await razorpay.payments.fetch(paymentId);
      await finalizeRazorpayCapture({ order, payment });
    } else if (eventType === 'payment.failed' && providerOrderId) {
      await Payment.updateOne(
        { razorpayOrderId: providerOrderId, status: { $in: ['CREATED', 'PENDING'] } },
        { $set: { status: 'FAILED', errorDescription: 'Razorpay reported a failed payment attempt' } }
      );
    }

    await WebhookEvent.updateOne(
      { _id: webhookEvent._id, status: 'Processing' },
      { $set: { status: 'Processed', processedAt: new Date() } }
    );
    return res.status(200).json({ received: true });
  } catch (err) {
    await WebhookEvent.updateOne(
      { _id: webhookEvent._id },
      { $set: { status: 'Failed', failureReason: String(err.message || 'Webhook processing failed').slice(0, 500) } }
    );
    console.error('Razorpay webhook processing failed:', err.message);
    return res.status(err.status && err.status < 500 ? err.status : 500).json({ message: 'Webhook processing failed' });
  }
};

// POST /api/orders  { shippingAddress }  -- places order from current cart
// Note: uses plain sequential writes (no multi-document transaction) so it
// works against a standalone MongoDB instance, not just a replica set.
exports.placeOrder = async (req, res) => {
  let checkoutLocked = false;
  let cartCleared = false;
  let checkout;
  let originalCart = [];
  let reservedItems = [];
  let deliverySlots = [];

  try {
    const paymentMethod = req.body.paymentMethod || 'Cash on Delivery';
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Cash on Delivery is the only available payment method' });
    }
    const shippingAddress = validateShippingAddress(req.body.shippingAddress);
    if (!shippingAddress) {
      return res.status(400).json({ message: 'A complete valid shipping address is required' });
    }

    const lock = await getCheckoutLock(req.user._id);
    if (!lock) return res.status(409).json({ message: 'A checkout is already in progress' });
    checkoutLocked = true;

    checkout = await getCheckoutDetails(req.user._id, req.body.applyCoupon === true);
    originalCart = checkout.originalCart;
    const delivery = await commitDelivery(checkout.items, req.body.deliveryDate);
    deliverySlots = delivery.consumed;
    reservedItems = await reserveStock(checkout.items);
    // Empty the cart before creating the order while the checkout lock is held;
    // this prevents duplicate orders if a client retries a slow request.
    checkout.user.cart = [];
    await checkout.user.save();
    cartCleared = true;

    const order = await Order.create({
      user: checkout.user._id,
      items: checkout.items,
      subtotal: checkout.subtotal,
      subtotalInPaise: checkout.subtotalInPaise,
      totalGst: checkout.totalGst,
      totalGstInPaise: checkout.totalGstInPaise,
      totalAmount: checkout.totalAmount,
      totalAmountInPaise: checkout.totalAmountInPaise,
      deliveryFee: checkout.deliveryFee,
      deliveryFeeInPaise: checkout.deliveryFeeInPaise,
      couponCode: checkout.couponCode,
      couponDiscount: checkout.couponDiscount,
      couponDiscountInPaise: checkout.couponDiscountInPaise,
      paymentMethod,
      shippingAddress,
      status: 'Pending',
      estimatedDelivery: delivery.estimatedDelivery,
      scheduledDelivery: delivery.scheduledDelivery,
      fastTracked: delivery.fastTracked,
    });

    await recordSellerEarningsForOrder(order).catch(console.error);

    res.status(201).json(toCustomerOrder(order));
  } catch (err) {
    // Sequential writes are used so standalone MongoDB works. Compensate every
    // successful decrement if a later write fails.
    try {
      await restoreSlots(deliverySlots);
      await releaseStock(reservedItems);
      if (cartCleared && checkout?.user) {
        checkout.user.cart = originalCart;
        await checkout.user.save();
      }
    } catch (rollbackError) {
      console.error('Order rollback failed:', rollbackError);
    }
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Failed to place order' });
  } finally {
    if (checkoutLocked) {
      await User.updateOne({ _id: req.user._id }, { $unset: { checkoutLock: 1 } });
    }
  }
};

// POST /api/orders/razorpay  { shippingAddress }
// Creates both the local order and Razorpay order from server-calculated cart data.
exports.createRazorpayOrder = async (req, res) => {
  let checkoutLocked = false;
  let cartCleared = false;
  let checkout;
  let localOrder;
  let reservedItems = [];
  let deliverySlots = [];

  try {
    const shippingAddress = validateShippingAddress(req.body.shippingAddress);
    if (!shippingAddress) {
      return res.status(400).json({ message: 'A complete valid shipping address is required' });
    }

    const lock = await getCheckoutLock(req.user._id);
    if (!lock) return res.status(409).json({ message: 'A checkout is already in progress' });
    checkoutLocked = true;

    checkout = await getCheckoutDetails(req.user._id, req.body.applyCoupon === true);
    const delivery = await commitDelivery(checkout.items, req.body.deliveryDate);
    deliverySlots = delivery.consumed;
    reservedItems = await reserveStock(checkout.items);
    checkout.user.cart = [];
    await checkout.user.save();
    cartCleared = true;

    // Persist the inventory reservation first: an order id is only returned to
    // Checkout after the matching local order exists.
    localOrder = await Order.create({
      user: checkout.user._id,
      items: checkout.items,
      subtotal: checkout.subtotal,
      subtotalInPaise: checkout.subtotalInPaise,
      totalGst: checkout.totalGst,
      totalGstInPaise: checkout.totalGstInPaise,
      totalAmount: checkout.totalAmount,
      totalAmountInPaise: checkout.totalAmountInPaise,
      deliveryFee: checkout.deliveryFee,
      deliveryFeeInPaise: checkout.deliveryFeeInPaise,
      couponCode: checkout.couponCode,
      couponDiscount: checkout.couponDiscount,
      couponDiscountInPaise: checkout.couponDiscountInPaise,
      paymentMethod: 'Razorpay',
      paymentStatus: 'Pending',
      shippingAddress,
      status: 'Awaiting Payment',
      estimatedDelivery: delivery.estimatedDelivery,
      scheduledDelivery: delivery.scheduledDelivery,
      fastTracked: delivery.fastTracked,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: paiseForOrder(localOrder),
      currency: 'INR',
      receipt: `shopnow_${localOrder._id}`,
      notes: {
        localOrderId: localOrder._id.toString(),
        userId: checkout.user._id.toString(),
      },
    });

    localOrder.razorpayOrderId = razorpayOrder.id;
    await localOrder.save();

    await Payment.create({
      user: checkout.user._id,
      order: localOrder._id,
      razorpayOrderId: razorpayOrder.id,
      paymentMethod: 'Razorpay',
      amount: localOrder.totalAmount,
      amountInPaise: paiseForOrder(localOrder),
      currency: 'INR',
      status: 'CREATED',
    });

    res.status(201).json({
      orderId: localOrder._id,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (err) {
    logRazorpayError('order creation', err);
    try {
      if (localOrder) {
        await Payment.deleteMany({ order: localOrder._id });
        await localOrder.deleteOne();
      }
      await restoreSlots(deliverySlots);
      await releaseStock(reservedItems);
      if (cartCleared && checkout) await restoreCart(checkout.user._id, checkout.originalCart);
    } catch (rollbackError) {
      console.error('Razorpay checkout rollback failed:', rollbackError);
    }
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Failed to start Razorpay payment' });
  } finally {
    if (checkoutLocked) {
      await User.updateOne({ _id: req.user._id }, { $unset: { checkoutLock: 1 } });
    }
  }
};

// POST /api/orders/razorpay/verify
// Verifies the Checkout response using the server-side order id and secret.
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, razorpay_payment_id: paymentId, razorpay_order_id: razorpayOrderId, razorpay_signature: signature } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order || !order.razorpayOrderId) {
      return res.status(404).json({ message: 'Razorpay order not found' });
    }
    if (order.paymentStatus === 'Paid') {
      if (order.razorpayPaymentId === paymentId) {
        await recordSellerEarningsForOrder(order);
        return res.json({ order });
      }
      return res.status(409).json({ message: 'This order has already been paid' });
    }
    if (order.status !== 'Awaiting Payment' || order.razorpayOrderId !== razorpayOrderId) {
      return res.status(409).json({ message: 'This payment can no longer be verified' });
    }
    if (!isValidSignature(order.razorpayOrderId, paymentId, signature)) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    // A valid signature proves Checkout generated the response. Fetching the
    // payment also confirms that it belongs to this order, has the exact
    // server-calculated amount, and has been captured by Razorpay.
    const payment = await razorpay.payments.fetch(paymentId);
    const paidOrder = await finalizeRazorpayCapture({ order, payment, signature });

    res.json({ order: paidOrder });
  } catch (err) {
    logRazorpayError('payment verification', err);
    if (err?.code === 11000) return res.status(409).json({ message: 'This payment is already linked to another order' });
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Failed to verify Razorpay payment' });
  }
};

// POST /api/orders/:id/payment/cancel
// Called only when Checkout is dismissed or reports a failed payment. It first
// checks Razorpay so an already captured payment can never be released.
exports.cancelRazorpayPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order || !order.razorpayOrderId) {
      return res.status(404).json({ message: 'Razorpay order not found' });
    }
    if (order.paymentStatus === 'Paid') return res.status(409).json({ message: 'This order has already been paid' });
    if (order.status !== 'Awaiting Payment') {
      return res.status(409).json({ message: 'This payment can no longer be cancelled' });
    }

    const gatewayPayments = await razorpay.orders.fetchPayments(order.razorpayOrderId);
    const payments = Array.isArray(gatewayPayments) ? gatewayPayments : gatewayPayments.items || [];
    if (payments.some((payment) => ['authorized', 'captured'].includes(payment.status))) {
      return res.status(409).json({ message: 'A payment is being confirmed. Do not attempt to pay again.' });
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: 'Awaiting Payment', paymentStatus: 'Pending' },
      { $set: { status: 'Cancelled', paymentStatus: 'Failed' } },
      { new: true, runValidators: true }
    );
    if (!cancelledOrder) {
      return res.status(409).json({ message: 'This payment is already being processed. Refresh the order history.' });
    }

    await Payment.findOneAndUpdate(
      { razorpayOrderId: order.razorpayOrderId },
      {
        $set: {
          status: 'FAILED',
          errorDescription: req.body?.reason || 'Payment cancelled or dismissed by customer',
        },
      }
    );

    try {
      await releaseStock(order.items);
      await restoreCart(req.user._id, order.items);
      // An abandoned payment hands back any freed slot it had taken.
      if (order.fastTracked) {
        await releaseSlots(order).catch((slotError) => console.error('Delivery slot release failed:', slotError));
      }
    } catch (err) {
      await Order.updateOne(
        { _id: order._id, status: 'Cancelled', paymentStatus: 'Failed' },
        { $set: { status: 'Awaiting Payment', paymentStatus: 'Pending' } }
      );
      throw err;
    }

    res.json({ order: cancelledOrder });
  } catch (err) {
    logRazorpayError('payment cancellation', err);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Failed to cancel Razorpay payment' });
  }
};

// POST /api/orders/:id/payment/failed
exports.recordRazorpayPaymentFailure = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order || !order.razorpayOrderId) {
      return res.status(404).json({ message: 'Razorpay order not found' });
    }
    const { errorDescription } = req.body || {};
    await Payment.findOneAndUpdate(
      { razorpayOrderId: order.razorpayOrderId },
      {
        $set: {
          status: 'FAILED',
          errorDescription: errorDescription || 'Payment attempt failed',
        },
      }
    );
    res.json({ message: 'Payment failure recorded' });
  } catch (err) {
    logRazorpayError('failure recording', err);
    res.status(500).json({ message: 'Failed to record payment failure' });
  }
};

// GET /api/orders  -- current user's order history
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('deliveryPartner', 'name phone email serviceType rating')
      .populate('shipment')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch orders' });
  }
};

// GET /api/orders/:id -- single order (owner, admin, or assigned delivery partner)
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('deliveryPartner', 'name phone email serviceType vehicleType vehicleNumber rating')
      .populate('shipment');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const isOwner = order.user && order.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      if (req.user.role === 'delivery') {
        const partner = await DeliveryPartner.findOne({ user: req.user._id });
        if (!partner || !order.deliveryPartner || order.deliveryPartner._id.toString() !== partner._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to view this order' });
        }
      } else {
        return res.status(403).json({ message: 'Not authorized to view this order' });
      }
    }
    res.json(order);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch order' });
  }
};

// ---- Admin only ----

// GET /api/admin/orders
exports.adminGetOrders = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !Object.hasOwn(STATUS_TRANSITIONS, status)) {
      return res.status(400).json({ message: 'Invalid status filter' });
    }
    const filter = status ? { status } : {};
    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .populate('deliveryPartner', 'name phone serviceType status')
      .populate('shipment')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch orders' });
  }
};

// Moves an order to a new status (compare-and-set), restocking and freeing the
// delivery slot when it is cancelled. Shared by admin updates and customer cancellation.
const transitionOrder = async (order, status) => {
  // Compare-and-set makes a concurrent update fail rather than double-restock stock.
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: {
        status,
        // Cash on Delivery is collected by the courier, so delivery == payment received.
        ...(status === 'Delivered' && order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'Paid'
          ? { paymentStatus: 'Paid', paidAt: new Date() }
          : {}),
      },
      $push: { statusHistory: { status, at: new Date() } },
    },
    { new: true, runValidators: true }
  );
  if (!updatedOrder) {
    throw httpError(409, 'This order was just updated by someone else. Refresh and try again.');
  }

  // The status change is claimed first. Cancelled is terminal, so only the caller
  // that wins the compare-and-set can restore inventory.
  if (status === 'Cancelled') {
    if (order.items.length) {
      try {
        await Product.bulkWrite(order.items.map((item) => ({
          updateOne: { filter: { _id: item.product }, update: { $inc: { stock: item.quantity } } },
        })));
      } catch (err) {
        await Order.updateOne({ _id: order._id, status: 'Cancelled' }, { $set: { status: order.status } });
        throw err;
      }

      // Free the delivery slot: for the next 24h the same product can be promised the
      // same date to another customer. (Unpaid orders only free a slot they had taken.)
      if (order.status !== 'Awaiting Payment' || order.fastTracked) {
        try {
          await releaseSlots(order);
        } catch (slotError) {
          console.error('Delivery slot release failed:', slotError);
        }
      }
    }

    const walletRefund = await creditWalletRefund(order);
    if (walletRefund) updatedOrder.walletRefund = walletRefund;

    // Financial & Ledger reversals for paid or remitted orders upon cancellation
    if (order.paymentStatus === 'Paid') {
      await Payment.updateMany(
        { order: order._id, status: 'SUCCESS' },
        { $set: { status: 'REFUNDED' } }
      );

      for (const item of order.items) {
        if (item.seller) {
          await SellerTransaction.updateMany(
            { order: order._id, product: item.product },
            { $set: { status: 'Refunded' } }
          );

          await Seller.findByIdAndUpdate(item.seller, {
            $inc: {
              totalSales: -Number(item.lineTotal || 0),
              totalCommission: -Number(item.commissionAmount || 0),
              netEarnings: -Number(item.netEarning || 0),
            },
          });

          await postLedgerEntry({
            order: order._id,
            transactionReference: `REV-COMM-${order._id}`,
            idempotencyKey: `LED_REV_COMM_${order._id}_${item.product}`,
            eventType: 'COMMISSION_REVERSED',
            debitAccount: 'CommissionExpense',
            creditAccount: 'CustomerRefundPayable',
            amountInPaise: toPaise(item.commissionAmount),
            description: `Commission reversed on cancellation of ${item.name}`,
          }).catch(console.error);

          await postLedgerEntry({
            order: order._id,
            transactionReference: `REV-SELLER-${order._id}`,
            idempotencyKey: `LED_REV_SELLER_${order._id}_${item.product}`,
            eventType: 'REFUND_ISSUED',
            debitAccount: 'SellerPayable',
            creditAccount: 'CustomerRefundPayable',
            amountInPaise: toPaise(item.netEarning),
            description: `Seller earnings liability reversed on cancellation of ${item.name}`,
          }).catch(console.error);
        }
      }
    }
  }

  return updatedOrder;
};

// PUT /api/admin/orders/:id/status  { status }
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!Object.hasOwn(STATUS_TRANSITIONS, status)) return res.status(400).json({ message: 'Invalid status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (status === order.status) return res.json(order);
    if (!STATUS_TRANSITIONS[order.status].includes(status)) {
      return res.status(400).json({ message: `Cannot change ${order.status} orders to ${status}` });
    }

    res.json(await transitionOrder(order, status));
  } catch (err) {
    res.status(err.status || errorStatus(err)).json({ message: err.status ? err.message : 'Failed to update order status' });
  }
};

// POST /api/orders/:id/cancel -- customer cancels their own eligible order.
// Paid online orders are refunded to the wallet by transitionOrder; COD has no
// payment to refund before delivery.
exports.cancelMyOrder = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['Pending', 'Processing'].includes(order.status)) {
      return res.status(409).json({ message: `${order.status} orders can no longer be cancelled` });
    }
    res.json(await transitionOrder(order, 'Cancelled'));
  } catch (err) {
    res.status(err.status || errorStatus(err)).json({ message: err.status ? err.message : 'Failed to cancel order' });
  }
};

// GET /api/orders/delivery-estimate -- delivery dates for the current cart
exports.getDeliveryEstimate = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.product');
    const cartItems = (user?.cart || []).filter((item) => item.product);
    if (!cartItems.length) return res.status(400).json({ message: 'Cart is empty' });

    const { today, earliest, maxDate, plans } = await planDelivery(cartItems.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
    })));
    res.json({
      today,
      earliest,
      maxDate,
      items: plans.map((p) => ({ product: p.product, name: p.name, date: p.date, fastTracked: Boolean(p.slotId) })),
    });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to estimate delivery' });
  }
};

// When the order was cancelled, taken from its status timeline.
const getCancelledAt = (order) => {
  const entry = [...(order.statusHistory || [])].reverse().find((h) => h.status === 'Cancelled');
  return entry ? new Date(entry.at) : new Date(order.updatedAt);
};

// GET /api/orders/:id/reorder-preview
// Returns re-priced totals, wallet balance, and COD eligibility so the frontend
// can show a payment selection dialog. Read-only — no stock/wallet changes.
exports.reorderPreview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });
    const source = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!source) return res.status(404).json({ message: 'Order not found' });
    if (source.status !== 'Cancelled') return res.status(409).json({ message: 'Only cancelled orders can be renewed' });

    const cancelledAt = getCancelledAt(source);
    const msLeft = REORDER_WINDOW_MS - (Date.now() - cancelledAt.getTime());
    if (msLeft <= 0) return res.status(409).json({ message: 'The 24-hour renewal window for this order has ended.' });

    const renewalCount = Number.isInteger(source.renewalCount) ? source.renewalCount : 0;
    if (renewalCount >= MAX_RENEWALS) return res.status(409).json({ message: 'This order has already used both renewal opportunities.' });
    if (await Order.exists({ reorderedFrom: source._id })) return res.status(409).json({ message: 'This cancellation has already been renewed.' });

    // Re-price from current product data
    const products = await Product.find({ _id: mongoose.trusted({ $in: source.items.map((i) => i.product) }) });
    const byId = new Map(products.map((p) => [String(p._id), p]));
    let subtotal = 0;
    let totalGst = 0;
    const previewItems = [];
    for (const old of source.items) {
      const product = byId.get(String(old.product));
      if (!product || !product.isActive) return res.status(409).json({ message: `${old.name} is no longer available`, unavailable: true });
      if (product.stock < old.quantity) return res.status(409).json({ message: `Only ${product.stock} of ${product.name} left in stock`, lowStock: true });
      const discounted = +(product.price - (product.price * product.discountPercent) / 100).toFixed(2);
      const gstAmount = +((discounted * product.gstPercent) / 100).toFixed(2);
      const finalPrice = +(discounted + gstAmount).toFixed(2);
      previewItems.push({ name: product.name, quantity: old.quantity, finalPrice, lineTotal: +(finalPrice * old.quantity).toFixed(2) });
      subtotal += discounted * old.quantity;
      totalGst += gstAmount * old.quantity;
    }
    const itemTotal = +(subtotal + totalGst).toFixed(2);
    const deliveryFee = computeDeliveryFee(itemTotal);
    const totalAmount = +(itemTotal + deliveryFee).toFixed(2);

    const user = await User.findById(req.user._id).select('walletBalance');
    const walletBalance = +(user?.walletBalance || 0);
    const walletSufficient = walletBalance >= totalAmount;

    // COD eligible: the source order's shipping address is valid
    const shippingAddress = validateShippingAddress(source.shippingAddress?.toObject?.() || source.shippingAddress);
    const codEligible = Boolean(shippingAddress);

    const originalPaymentWasOnline = source.paymentMethod !== 'Cash on Delivery';
    const wasRefundedToWallet = Boolean(source.walletRefund?.creditedAt);

    res.json({
      totalAmount,
      itemTotal,
      deliveryFee,
      walletBalance,
      walletSufficient,
      codEligible,
      originalPaymentWasOnline,
      wasRefundedToWallet,
      renewalsLeft: MAX_RENEWALS - renewalCount,
      msLeft: Math.floor(msLeft),
      items: previewItems,
      estimatedDelivery: source.estimatedDelivery,
    });
  } catch (err) {
    res.status(err.status || errorStatus(err)).json({ message: err.status ? err.message : 'Failed to load renewal preview' });
  }
};

// POST /api/orders/:id/reorder
// Creates a NEW order from a cancelled order within 24 h of cancellation.
// paymentMethod: 'Wallet' (default) or 'Cash on Delivery'.
// Uses today's price and stock. The cancelled order is never modified.
exports.reorderCancelledOrder = async (req, res) => {
  let checkoutLocked = false;
  let reservedItems = [];
  let deliverySlots = [];
  let walletPayment; // tracks debit so it can be rolled back on failure

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid order ID' });

    // Validate requested payment method early
    const requestedMethod = (req.body.paymentMethod || 'Wallet').trim();
    if (!['Wallet', 'Cash on Delivery'].includes(requestedMethod)) {
      return res.status(400).json({ message: 'Payment method must be "Wallet" or "Cash on Delivery"' });
    }

    const source = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!source) return res.status(404).json({ message: 'Order not found' });
    if (source.status !== 'Cancelled') return res.status(409).json({ message: 'Only cancelled orders can be reordered' });
    if (Date.now() - getCancelledAt(source).getTime() > REORDER_WINDOW_MS) {
      return res.status(409).json({ message: 'The 24-hour reorder window for this order has ended. Please add the items to your cart instead.' });
    }
    const renewalCount = Number.isInteger(source.renewalCount) ? source.renewalCount : 0;
    if (renewalCount >= MAX_RENEWALS) {
      return res.status(409).json({ message: 'This order has already used both renewal opportunities.' });
    }
    if (await Order.exists({ reorderedFrom: source._id })) {
      return res.status(409).json({ message: 'This cancellation has already been renewed' });
    }
    const shippingAddress = validateShippingAddress(source.shippingAddress && source.shippingAddress.toObject());
    if (!shippingAddress) return res.status(400).json({ message: 'The saved address on this order is incomplete. Add the items to your cart and check out instead.' });

    const lock = await getCheckoutLock(req.user._id);
    if (!lock) return res.status(409).json({ message: 'A checkout is already in progress' });
    checkoutLocked = true;

    // Re-price from the CURRENT product data, never from the cancelled order.
    const products = await Product.find({ _id: mongoose.trusted({ $in: source.items.map((i) => i.product) }) }).select('+costPrice');
    const byId = new Map(products.map((p) => [String(p._id), p]));
    const items = [];
    let subtotal = 0;
    let totalGst = 0;
    for (const old of source.items) {
      const product = byId.get(String(old.product));
      if (!product || !product.isActive) throw httpError(409, `${old.name} is no longer available`);
      if (product.stock < old.quantity) throw httpError(409, `Only ${product.stock} of ${product.name} left in stock`);
      const discounted = +(product.price - (product.price * product.discountPercent) / 100).toFixed(2);
      const gstAmount = +((discounted * product.gstPercent) / 100).toFixed(2);
      const finalPrice = +(discounted + gstAmount).toFixed(2);
      items.push({
        product: product._id,
        name: product.name,
        category: product.category,
        ...(Number.isFinite(product.costPrice) ? { unitCost: product.costPrice } : {}),
        quantity: old.quantity,
        price: product.price,
        discountPercent: product.discountPercent,
        gstPercent: product.gstPercent,
        finalPrice,
        lineTotal: +(finalPrice * old.quantity).toFixed(2),
      });
      subtotal += discounted * old.quantity;
      totalGst += gstAmount * old.quantity;
    }
    const itemTotal = +(subtotal + totalGst).toFixed(2);
    const deliveryFee = computeDeliveryFee(itemTotal);
    const totalAmount = +(itemTotal + deliveryFee).toFixed(2);

    // Retain the original committed delivery day when still valid.
    const originalDeliveryDate = source.estimatedDelivery ? toStr(source.estimatedDelivery) : undefined;
    const delivery = await commitDelivery(
      items,
      originalDeliveryDate && originalDeliveryDate >= todayStr() ? originalDeliveryDate : undefined
    );
    deliverySlots = delivery.consumed;
    reservedItems = await reserveStock(items);

    // Payment: wallet debit (atomic, balance-checked) or COD (no debit).
    const orderId = new mongoose.Types.ObjectId();
    let paymentMethod, paymentStatus, paidAt;

    if (requestedMethod === 'Wallet') {
      // debitWalletForRenewal throws 409 if wallet balance is insufficient.
      await debitWalletForRenewal(req.user._id, orderId, totalAmount);
      walletPayment = { orderId, amount: totalAmount };
      paymentMethod = 'Wallet';
      paymentStatus = 'Paid';
      paidAt = new Date();
    } else {
      // COD: no wallet interaction; payment collected on delivery.
      paymentMethod = 'Cash on Delivery';
      paymentStatus = 'Pending';
      paidAt = undefined;
    }

    const order = await Order.create({
      _id: orderId,
      user: req.user._id,
      items,
      subtotal: +subtotal.toFixed(2),
      totalGst: +totalGst.toFixed(2),
      totalAmount,
      deliveryFee,
      paymentMethod,
      paymentStatus,
      ...(paidAt ? { paidAt } : {}),
      shippingAddress,
      status: 'Pending',
      estimatedDelivery: delivery.estimatedDelivery,
      scheduledDelivery: delivery.scheduledDelivery,
      fastTracked: delivery.fastTracked,
      reorderedFrom: source._id,
      renewalCount: renewalCount + 1,
    });
    res.status(201).json(toCustomerOrder(order));
  } catch (err) {
    try {
      await restoreSlots(deliverySlots);
      await releaseStock(reservedItems);
      if (walletPayment) await reverseWalletRenewalPayment(req.user._id, walletPayment.orderId, walletPayment.amount);
    } catch (rollbackError) {
      console.error('Reorder rollback failed:', rollbackError);
    }
    res.status(err.status || errorStatus(err)).json({ message: err.status ? err.message : 'Failed to reorder' });
  } finally {
    if (checkoutLocked) await User.updateOne({ _id: req.user._id }, { $unset: { checkoutLock: 1 } });
  }
};


// GET /api/orders/coupon
// Tells the checkout which automatic coupon (if any) this customer qualifies for, and what it
// would save on their current cart.
exports.getCouponStatus = async (req, res) => {
  try {
    const placed = await countPlacedOrders(req.user._id);
    const coupon = getEligibleCoupon(placed);
    let discount = 0;
    if (coupon) {
      try {
        const checkout = await getCheckoutDetails(req.user._id, false);
        discount = calculateCouponDiscount(coupon, checkout.itemTotal);
      } catch (_) { /* empty cart or stock problem: still report the coupon, with no amount */ }
    }
    res.json({
      eligible: Boolean(coupon),
      code: coupon ? coupon.code : null,
      label: coupon ? coupon.label : null,
      percent: coupon ? coupon.percent : null,
      maxDiscount: coupon ? coupon.maxDiscount : null,
      minOrder: coupon ? coupon.minOrder : null,
      discount,
      ordersPlaced: placed,
      nextRewardOrderNumber: getNextRewardOrderNumber(placed),
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not check coupons' });
  }
};
