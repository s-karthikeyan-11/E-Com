const mongoose = require('mongoose');
const Product = require('../models/Product');
const { SLOT_HOLD_MS, MAX_SCHEDULE_DAYS, toStr, todayStr, addDays, planForProduct } = require('./dates');

// Non-consuming delivery plan for a list of { product, name, quantity }.
// An order ships together, so the order date is the slowest item's date.
exports.planDelivery = async (items) => {
  const today = todayStr();
  const ids = items.map((i) => i.product);
  const products = await Product.find({ _id: mongoose.trusted({ $in: ids }) }).select('deliveryDays +releasedSlots');
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const plans = items.map((item) => ({
    product: item.product,
    name: item.name,
    quantity: item.quantity,
    ...planForProduct(byId.get(String(item.product)), item.quantity, today),
  }));
  const earliest = plans.reduce((max, p) => (p.date > max ? p.date : max), today);
  return { today, earliest, maxDate: addDays(earliest, MAX_SCHEDULE_DAYS), plans };
};

// Atomically take units from released slots. Returns which plans were consumed / lost to a race.
exports.consumeSlots = async (plans) => {
  const consumed = [];
  const lost = [];
  for (const plan of plans) {
    const result = await Product.updateOne(
      {
        _id: plan.product,
        releasedSlots: mongoose.trusted({ $elemMatch: { _id: plan.slotId, quantity: { $gte: plan.quantity } } }),
      },
      { $inc: { 'releasedSlots.$.quantity': -plan.quantity } }
    );
    (result.modifiedCount === 1 ? consumed : lost).push(plan);
  }
  return { consumed, lost };
};

// Undo consumeSlots when checkout fails after slots were taken.
exports.restoreSlots = async (plans) => {
  await Promise.all(plans.map((plan) => Product.updateOne(
    { _id: plan.product, 'releasedSlots._id': plan.slotId },
    { $inc: { 'releasedSlots.$.quantity': plan.quantity } }
  )));
};

// A cancelled order frees its delivery slot for SLOT_HOLD_MS so the same product
// can be promised the same date to another customer.
exports.releaseSlots = async (order) => {
  if (!order.estimatedDelivery) return;
  const date = toStr(order.estimatedDelivery);
  if (date < todayStr()) return;
  const cutoff = new Date(Date.now() - SLOT_HOLD_MS);
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product }, { $pull: { releasedSlots: { releasedAt: { $lt: cutoff } } } });
    await Product.updateOne(
      { _id: item.product },
      { $push: { releasedSlots: { quantity: item.quantity, deliveryDate: date, releasedAt: new Date() } } }
    );
  }
};
