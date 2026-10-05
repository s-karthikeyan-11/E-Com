// Automatic loyalty coupons, based on how many orders a customer has placed.
//   - First order:      10% off (up to Rs 300), on orders of Rs 499 or more
//   - Every 10th order: 15% off (up to Rs 750), on orders of Rs 999 or more (10th, 20th, 30th ...)
// These numbers are business decisions: change them here and nothing else needs editing.
const FIRST_ORDER = { code: 'WELCOME10', label: 'First order offer', percent: 10, maxDiscount: 300, minOrder: 499 };
const LOYALTY = { code: 'LOYAL15', label: 'Loyalty reward', percent: 15, maxDiscount: 750, minOrder: 999 };
const LOYALTY_EVERY = 10;

// `placedCount` = the customer's orders that are not cancelled. The order being placed
// now is number placedCount + 1. Cancelled orders do not count, so cancelling an order
// that used a coupon gives the coupon back.
const getEligibleCoupon = (placedCount) => {
  if (placedCount === 0) return FIRST_ORDER;
  if ((placedCount + 1) % LOYALTY_EVERY === 0) return LOYALTY;
  return null;
};

// The order number of the next loyalty reward after the orders placed so far.
const getNextRewardOrderNumber = (placedCount) => (Math.floor(placedCount / LOYALTY_EVERY) + 1) * LOYALTY_EVERY;

// itemTotal = price after product discount, with GST, before delivery fee.
const calculateCouponDiscount = (coupon, itemTotal) => {
  if (!coupon || itemTotal < coupon.minOrder) return 0;
  const raw = (itemTotal * coupon.percent) / 100;
  return +Math.min(raw, coupon.maxDiscount, itemTotal).toFixed(2);
};

module.exports = { FIRST_ORDER, LOYALTY, LOYALTY_EVERY, getEligibleCoupon, getNextRewardOrderNumber, calculateCouponDiscount };
