const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const Product = require('../models/Product');
const Seller = require('../models/Seller');
const DeliveryPartner = require('../models/DeliveryPartner');
const FinancialLedger = require('../models/FinancialLedger');
const {
  seedDefaultCommissionRates,
  getCategoryCommissionRate,
  calculateItemFinancials,
  toPaise,
  postLedgerEntry,
} = require('../utils/finance');

const runMigration = async () => {
  console.log('--- Starting Safe Financial Ledger & Commission Migration ---');
  await connectDB();
  await seedDefaultCommissionRates();

  const orders = await Order.find().populate('items.product');
  console.log(`Auditing ${orders.length} orders for commission snapshots and ledger entries...`);

  let updatedOrdersCount = 0;
  let ledgerEntriesCreated = 0;

  for (const order of orders) {
    let orderModified = false;

    // 1. Backfill snapshot values on items
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      if (!item.commissionAmount || !item.commissionRate || item.netEarning === undefined) {
        const category = item.category || item.product?.category || 'Default';
        const rate = await getCategoryCommissionRate(category);
        const financials = calculateItemFinancials(item, rate);

        item.commissionRate = financials.commissionRate;
        item.commissionBaseAmount = financials.commissionBaseAmount;
        item.commissionAmount = financials.commissionAmount;
        item.netEarning = financials.netEarning;
        orderModified = true;
      }
    }

    // 2. COD Historical Reconciliation
    if (order.paymentMethod === 'Cash on Delivery' && order.status === 'Delivered') {
      if (!order.codCollected) {
        order.codCollected = true;
        order.codCollectedAt = order.updatedAt || order.createdAt;
        order.codRemitted = true; // Historical delivered orders are treated as reconciled
        order.codRemittedAt = order.updatedAt || order.createdAt;
        order.paymentStatus = 'Paid';
        orderModified = true;
      }
    }

    if (orderModified) {
      await order.save();
      updatedOrdersCount++;
    }

    // 3. Post historical ledger entries for non-cancelled paid orders
    if (order.status !== 'Cancelled' && order.paymentStatus === 'Paid') {
      const isCod = order.paymentMethod === 'Cash on Delivery';
      const debitAccount = isCod ? 'PlatformBank' : 'GatewayReceivable';

      for (let idx = 0; idx < order.items.length; idx++) {
        const item = order.items[idx];
        const itemProdId = item.product?._id || item.product || idx;
        const idempotencyKeySeller = `LED_MIGRATE_SELLER_${order._id}_${itemProdId}`;
        const existing = await FinancialLedger.findOne({ idempotencyKey: idempotencyKeySeller });

        if (!existing && item.netEarning > 0) {
          await postLedgerEntry({
            order: order._id,
            transactionReference: order.razorpayPaymentId || order.trackingNumber || `HIST-${order._id}`,
            idempotencyKey: idempotencyKeySeller,
            eventType: 'SELLER_PAYABLE_CREDITED',
            debitAccount,
            creditAccount: 'SellerPayable',
            amountInPaise: toPaise(item.netEarning),
            description: `Historical ledger backfill: Net earnings for ${item.name}`,
          });
          ledgerEntriesCreated++;
        }

        const idempotencyKeyComm = `LED_MIGRATE_COMM_${order._id}_${itemProdId}`;
        const existingComm = await FinancialLedger.findOne({ idempotencyKey: idempotencyKeyComm });
        if (!existingComm && item.commissionAmount > 0) {
          await postLedgerEntry({
            order: order._id,
            transactionReference: order.razorpayPaymentId || order.trackingNumber || `HIST-${order._id}`,
            idempotencyKey: idempotencyKeyComm,
            eventType: 'COMMISSION_EARNED',
            debitAccount,
            creditAccount: 'PlatformCommissionRevenue',
            amountInPaise: toPaise(item.commissionAmount),
            description: `Historical ledger backfill: Platform commission on ${item.name}`,
          });
          ledgerEntriesCreated++;
        }
      }

      if (order.deliveryFee > 0) {
        const idempotencyKeyShip = `LED_MIGRATE_SHIP_${order._id}`;
        const existingShip = await FinancialLedger.findOne({ idempotencyKey: idempotencyKeyShip });
        if (!existingShip) {
          await postLedgerEntry({
            order: order._id,
            transactionReference: `HIST-SHIP-${order._id}`,
            idempotencyKey: idempotencyKeyShip,
            eventType: 'ORDER_PAYMENT_CAPTURED',
            debitAccount,
            creditAccount: 'ShippingRevenue',
            amountInPaise: toPaise(order.deliveryFee),
            description: `Historical ledger backfill: Delivery fee on order #${order._id}`,
          });
          ledgerEntriesCreated++;
        }
      }
    }
  }

  // 4. Backfill shipments
  const shipments = await Shipment.find().populate('order');
  console.log(`Auditing ${shipments.length} shipments...`);
  let updatedShipmentsCount = 0;

  for (const s of shipments) {
    let sModified = false;
    if (!s.deliveryFeeEarned) {
      s.deliveryFeeEarned = 40;
      sModified = true;
    }
    if (s.order?.paymentMethod === 'Cash on Delivery' && s.status === 'Delivered') {
      if (!s.codCollected) {
        s.codCollected = true;
        s.codCollectedAt = s.deliveredAt || s.updatedAt;
        s.codRemitted = true;
        s.codRemittedAt = s.deliveredAt || s.updatedAt;
        s.codAmount = s.order.totalAmount;
        sModified = true;
      }
    }
    if (sModified) {
      await s.save();
      updatedShipmentsCount++;
    }
  }

  console.log('--- Migration Completed Successfully ---');
  console.log({
    updatedOrdersCount,
    updatedShipmentsCount,
    ledgerEntriesCreated,
  });
  process.exit(0);
};

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
