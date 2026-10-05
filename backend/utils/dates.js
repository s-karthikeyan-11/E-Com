// Pure date + delivery-planning helpers (no database access, easy to unit test).
// Delivery dates are calendar dates ("YYYY-MM-DD") in the store's timezone and are
// persisted as UTC-midnight Date values so they never shift when displayed.

const TIMEZONE = process.env.STORE_TIMEZONE || 'Asia/Kolkata';
const SLOT_HOLD_MS = (Number(process.env.DELIVERY_SLOT_HOLD_HOURS) || 24) * 60 * 60 * 1000;
const MAX_SCHEDULE_DAYS = Number(process.env.MAX_SCHEDULE_DAYS) || 30;
const DEFAULT_DELIVERY_DAYS = 4;

const toDate = (str) => new Date(`${str}T00:00:00.000Z`);
const toStr = (date) => new Date(date).toISOString().slice(0, 10);

const todayStr = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const addDays = (str, days) => {
  const d = toDate(str);
  d.setUTCDate(d.getUTCDate() + days);
  return toStr(d);
};

const isDateStr = (str) => {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = toDate(str);
  return !Number.isNaN(d.getTime()) && toStr(d) === str;
};

// Delivery date for `quantity` units of one product.
// Normal date = today + the product's lead time. If a cancelled order released units
// in the last 24h for an EARLIER date, the new order can reuse that same date.
const planForProduct = (product, quantity, today = todayStr(), now = Date.now()) => {
  const standardDate = addDays(today, product?.deliveryDays ?? DEFAULT_DELIVERY_DAYS);
  const slot = (product?.releasedSlots || [])
    .filter((s) =>
      s.quantity >= quantity &&
      new Date(s.releasedAt).getTime() >= now - SLOT_HOLD_MS &&
      s.deliveryDate >= today &&
      s.deliveryDate < standardDate)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))[0];
  return { date: slot ? slot.deliveryDate : standardDate, standardDate, slotId: slot ? slot._id : undefined };
};

module.exports = {
  SLOT_HOLD_MS, MAX_SCHEDULE_DAYS, DEFAULT_DELIVERY_DAYS,
  toDate, toStr, todayStr, addDays, isDateStr, planForProduct,
};
