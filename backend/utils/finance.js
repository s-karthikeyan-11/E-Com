const mongoose = require('mongoose');
const crypto = require('crypto');
const CommissionRate = require('../models/CommissionRate');
const FinancialLedger = require('../models/FinancialLedger');

// Integer Paise Conversion Utilities
const toPaise = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) throw new TypeError('A finite monetary amount is required');
  return Math.round(value * 100);
};
const fromPaise = (paise) => {
  const value = Number(paise);
  if (!Number.isSafeInteger(value)) throw new TypeError('A safe integer paise amount is required');
  return +(value / 100).toFixed(2);
};

const paiseForOrder = (order) => {
  if (Number.isSafeInteger(order?.totalAmountInPaise)) return order.totalAmountInPaise;
  return toPaise(order?.totalAmount || 0);
};

const paiseForDeliveryFee = (order) => {
  if (Number.isSafeInteger(order?.deliveryFeeInPaise)) return order.deliveryFeeInPaise;
  return toPaise(order?.deliveryFee || 0);
};

// Standard category default commission rates as specified by requirements
const DEFAULT_COMMISSION_RATES = {
  Electronics: 6,
  Fashion: 12,
  'Home & Kitchen': 10,
  'Beauty & Accessories': 12,
  Default: 10,
};

// Seed standard category rates into MongoDB if not present
const seedDefaultCommissionRates = async () => {
  try {
    for (const [category, percent] of Object.entries(DEFAULT_COMMISSION_RATES)) {
      const existing = await CommissionRate.findOne({ category });
      if (!existing) {
        await CommissionRate.create({
          category,
          commissionPercent: percent,
          commissionBase: 'final_price_ex_gst',
          description: `Standard platform rate for ${category}`,
          isActive: true,
        });
      }
    }
  } catch (err) {
    console.error('Failed to seed default commission rates:', err);
  }
};

// Get the effective commission percent for a category (or seller custom override)
const getCategoryCommissionRate = async (category, sellerCustomRate = null) => {
  if (sellerCustomRate !== null && sellerCustomRate !== undefined && !Number.isNaN(Number(sellerCustomRate))) {
    // If a seller has an individually agreed commission rate, respect it
    return Number(sellerCustomRate);
  }

  try {
    if (category) {
      const trimmed = category.trim();
      const rateDoc = await CommissionRate.findOne({
        category: new RegExp(`^${trimmed}$`, 'i'),
        isActive: true,
      });
      if (rateDoc) return rateDoc.commissionPercent;
    }

    const defaultDoc = await CommissionRate.findOne({ category: 'Default', isActive: true });
    if (defaultDoc) return defaultDoc.commissionPercent;
  } catch (err) {
    console.error('Error fetching commission rate:', err);
  }

  // Fallback to in-memory defaults
  if (category && DEFAULT_COMMISSION_RATES[category]) {
    return DEFAULT_COMMISSION_RATES[category];
  }
  return DEFAULT_COMMISSION_RATES.Default;
};

const getCategoryCommissionRule = async (category, sellerCustomRate = null) => {
  if (sellerCustomRate !== null && sellerCustomRate !== undefined && !Number.isNaN(Number(sellerCustomRate))) {
    return { commissionPercent: Number(sellerCustomRate), commissionBase: 'final_price_ex_gst' };
  }

  if (category) {
    const trimmed = category.trim();
    const rateDoc = await CommissionRate.findOne({
      category: new RegExp(`^${trimmed}$`, 'i'),
      isActive: true,
    }).lean();
    if (rateDoc) {
      return {
        commissionPercent: Number(rateDoc.commissionPercent),
        commissionBase: rateDoc.commissionBase || 'final_price_ex_gst',
      };
    }
  }

  const defaultDoc = await CommissionRate.findOne({ category: 'Default', isActive: true }).lean();
  if (defaultDoc) {
    return {
      commissionPercent: Number(defaultDoc.commissionPercent),
      commissionBase: defaultDoc.commissionBase || 'final_price_ex_gst',
    };
  }

  return {
    commissionPercent: DEFAULT_COMMISSION_RATES[category] || DEFAULT_COMMISSION_RATES.Default,
    commissionBase: 'final_price_ex_gst',
  };
};

/**
 * Calculates item financials ensuring commission is NOT charged on GST or shipping:
 * - basePriceExGst: per-unit price before tax
 * - commissionBaseAmount: total line price before tax upon which commission applies
 * - commissionAmount: commissionBaseAmount * (rate / 100)
 * - netEarning: lineTotal - commissionAmount
 */
const calculateItemFinancials = (item, rule = {}) => {
  const quantity = Number(item.quantity || 1);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new TypeError('Item quantity must be a positive integer');

  const lineTotalInPaise = Number.isSafeInteger(item.lineTotalInPaise)
    ? item.lineTotalInPaise
    : toPaise(item.lineTotal || 0);
  const gstPercent = Number(item.gstPercent || 0);
  const rate = Number(typeof rule === 'number' ? rule : rule.commissionPercent);
  const commissionBaseType = typeof rule === 'object' && rule.commissionBase
    ? rule.commissionBase
    : 'final_price_ex_gst';
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new TypeError('Commission rate must be between 0 and 100');

  let commissionBaseInPaise;
  if (commissionBaseType === 'base_price') {
    commissionBaseInPaise = toPaise(item.price || 0) * quantity;
  } else if (commissionBaseType === 'line_total') {
    commissionBaseInPaise = lineTotalInPaise;
  } else {
    // Work from the recorded line total so rounding stays deterministic. GST is
    // excluded by default and shipping is never part of an order-item line.
    commissionBaseInPaise = Math.round((lineTotalInPaise * 100) / (100 + gstPercent));
  }

  const commissionInPaise = Math.round((commissionBaseInPaise * rate) / 100);
  const netEarningInPaise = lineTotalInPaise - commissionInPaise;
  if (netEarningInPaise < 0) throw new RangeError('Commission cannot exceed the item total');

  return {
    commissionRate: rate,
    commissionBaseType,
    commissionBaseAmount: fromPaise(commissionBaseInPaise),
    commissionAmount: fromPaise(commissionInPaise),
    netEarning: fromPaise(netEarningInPaise),
    lineTotal: fromPaise(lineTotalInPaise),
    amountInPaise: lineTotalInPaise,
    commissionBaseInPaise,
    commissionInPaise,
    netEarningInPaise,
  };
};

const generateLedgerNumber = () => {
  const prefix = 'LED';
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  return `${prefix}-${yyyymm}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
};

/**
 * Append-only immutable ledger posting with idempotency protection
 */
const postLedgerEntry = async ({
  order = null,
  settlement = null,
  shipment = null,
  transactionReference = '',
  idempotencyKey = null,
  eventType,
  debitAccount,
  creditAccount,
  amountInPaise,
  description,
  metadata = {},
  recordedBy = null,
  session = null,
}) => {
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
    throw new TypeError('Ledger amounts must be positive integer paise');
  }
  if (debitAccount === creditAccount) throw new TypeError('Ledger debit and credit accounts must differ');

  try {
    if (idempotencyKey) {
      const existing = await FinancialLedger.findOne({ idempotencyKey }).session(session);
      if (existing) return existing;
    }

    const [entry] = await FinancialLedger.create([{
      entryNumber: generateLedgerNumber(),
      order,
      settlement,
      shipment,
      transactionReference,
      idempotencyKey,
      eventType,
      debitAccount,
      creditAccount,
      amountInPaise,
      amount: fromPaise(amountInPaise),
      description,
      metadata,
      recordedBy,
    }], session ? { session } : undefined);

    return entry;
  } catch (err) {
    if (err.code === 11000 && idempotencyKey) {
      // Duplicate idempotency key caught safely
      return FinancialLedger.findOne({ idempotencyKey }).session(session);
    }
    console.error('Failed to post financial ledger entry:', err);
    throw err;
  }
};

module.exports = {
  toPaise,
  fromPaise,
  paiseForOrder,
  paiseForDeliveryFee,
  DEFAULT_COMMISSION_RATES,
  seedDefaultCommissionRates,
  getCategoryCommissionRate,
  getCategoryCommissionRule,
  calculateItemFinancials,
  generateLedgerNumber,
  postLedgerEntry,
};
