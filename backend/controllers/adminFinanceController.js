const mongoose = require('mongoose');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const Settlement = require('../models/Settlement');
const CommissionRate = require('../models/CommissionRate');
const FinancialLedger = require('../models/FinancialLedger');
const Seller = require('../models/Seller');
const DeliveryPartner = require('../models/DeliveryPartner');
const Payment = require('../models/Payment');
const razorpay = require('../config/razorpay');
const { toPaise, fromPaise, paiseForOrder, postLedgerEntry } = require('../utils/finance');

// GET /api/admin/finance/overview
exports.getFinanceOverview = async (req, res) => {
  try {
    const [orders, shipments, settlements, ledgerEntries] = await Promise.all([
      Order.find({ status: mongoose.trusted({ $ne: 'Cancelled' }) }),
      Shipment.find(),
      Settlement.find(),
      FinancialLedger.find().sort({ createdAt: -1 }),
    ]);

    // 1. Sales & Revenue
    let totalGrossSales = 0;
    let onlineCapturedCash = 0;
    let codTotalOrderAmount = 0;
    let codCashCollected = 0;
    let codCashRemitted = 0;
    let totalCustomerDeliveryFee = 0;
    let totalPlatformCommission = 0;
    let totalSellerNetEarnings = 0;

    for (const order of orders) {
      const orderTotal = Number(order.totalAmount || 0);
      totalGrossSales += orderTotal;
      totalCustomerDeliveryFee += Number(order.deliveryFee || 0);

      if (order.paymentMethod === 'Cash on Delivery') {
        codTotalOrderAmount += orderTotal;
        if (order.codCollected) codCashCollected += orderTotal;
        if (order.codRemitted) codCashRemitted += orderTotal;
      } else if (order.paymentStatus === 'Paid') {
        onlineCapturedCash += orderTotal;
      }

      for (const item of order.items) {
        totalPlatformCommission += Number(item.commissionAmount || 0);
        totalSellerNetEarnings += Number(item.netEarning || 0);
      }
    }

    // 2. COD in transit with riders
    const codInTransitWithRiders = Math.max(0, codCashCollected - codCashRemitted);

    // 3. Delivery Costs & Partner Earnings
    let totalPartnerDeliveryEarnings = 0;
    let totalExternalCourierCosts = 0;
    let totalRtoCosts = 0;

    for (const s of shipments) {
      if (s.status === 'Delivered') {
        totalPartnerDeliveryEarnings += Number(s.deliveryFeeEarned || 40);
      }
      totalExternalCourierCosts += Number(s.externalCourierCost || 0);
      totalRtoCosts += Number(s.rtoCost || 0);
    }

    const totalDeliveryExpense = totalPartnerDeliveryEarnings + totalExternalCourierCosts + totalRtoCosts;
    const shippingMargin = +(totalCustomerDeliveryFee - totalDeliveryExpense).toFixed(2);

    // 4. Settlements breakdown
    const sellerSettlements = settlements.filter((s) => s.beneficiaryType === 'Seller');
    const partnerSettlements = settlements.filter((s) => s.beneficiaryType === 'DeliveryPartner');

    const sellerPaidOut = sellerSettlements
      .filter((s) => s.status === 'Paid')
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const sellerPendingPayout = sellerSettlements
      .filter((s) => ['Pending Review', 'Approved', 'Processing'].includes(s.status))
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const partnerPaidOut = partnerSettlements
      .filter((s) => s.status === 'Paid')
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    const partnerPendingPayout = partnerSettlements
      .filter((s) => ['Pending Review', 'Approved', 'Processing'].includes(s.status))
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    // 5. Total refunds
    const cancelledOrders = await Order.find({ status: 'Cancelled' });
    const totalRefundsIssued = cancelledOrders.reduce(
      (acc, o) => acc + Number(o.walletRefund?.amount || 0),
      0
    );

    // 6. Double-entry ledger audit verification
    const totalLedgerDebitsPaise = ledgerEntries.reduce((acc, l) => acc + l.amountInPaise, 0);
    const totalLedgerCreditsPaise = ledgerEntries.reduce((acc, l) => acc + l.amountInPaise, 0);
    const ledgerBalanced = totalLedgerDebitsPaise === totalLedgerCreditsPaise;

    res.json({
      metrics: {
        totalGrossSales: +totalGrossSales.toFixed(2),
        totalOrdersCount: orders.length,
        onlineCapturedCash: +onlineCapturedCash.toFixed(2),
        codSummary: {
          totalCodOrders: +codTotalOrderAmount.toFixed(2),
          collected: +codCashCollected.toFixed(2),
          remitted: +codCashRemitted.toFixed(2),
          inTransitWithRiders: +codInTransitWithRiders.toFixed(2),
        },
        platformCommission: {
          totalCommissionEarned: +totalPlatformCommission.toFixed(2),
        },
        sellerPayables: {
          totalNetEarned: +totalSellerNetEarnings.toFixed(2),
          paidOut: +sellerPaidOut.toFixed(2),
          pendingReviewOrDisbursement: +sellerPendingPayout.toFixed(2),
          unsettledPool: +(totalSellerNetEarnings - sellerPaidOut).toFixed(2),
        },
        deliveryFinances: {
          customerShippingFeeCollected: +totalCustomerDeliveryFee.toFixed(2),
          partnerEarningsPaidOut: +partnerPaidOut.toFixed(2),
          partnerEarningsPending: +partnerPendingPayout.toFixed(2),
          totalDeliveryExpenses: +totalDeliveryExpense.toFixed(2),
          shippingMargin,
        },
        refundsIssued: +totalRefundsIssued.toFixed(2),
        ledgerAudit: {
          totalEntriesCount: ledgerEntries.length,
          totalVolumePaise: totalLedgerDebitsPaise,
          totalVolumeINR: fromPaise(totalLedgerDebitsPaise),
          isBalanced: ledgerBalanced,
        },
      },
      recentLedger: ledgerEntries.slice(0, 15),
    });
  } catch (err) {
    console.error('getFinanceOverview error:', err);
    res.status(500).json({ message: 'Failed to generate financial overview' });
  }
};

// GET /api/admin/commissions
exports.getCategoryCommissions = async (req, res) => {
  try {
    const rates = await CommissionRate.find().sort({ category: 1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch commission rates' });
  }
};

// PUT /api/admin/commissions/:id
exports.updateCategoryCommission = async (req, res) => {
  try {
    const { commissionPercent, commissionBase, description, isActive } = req.body;
    const rate = await CommissionRate.findById(req.params.id);
    if (!rate) {
      return res.status(404).json({ message: 'Commission rate not found' });
    }

    if (commissionPercent !== undefined) {
      const num = Number(commissionPercent);
      if (num < 0 || num > 100) return res.status(400).json({ message: 'Rate must be between 0 and 100%' });
      rate.commissionPercent = num;
    }
    if (commissionBase) rate.commissionBase = commissionBase;
    if (description !== undefined) rate.description = description.trim();
    if (isActive !== undefined) rate.isActive = !!isActive;

    await rate.save();
    res.json({ message: `Commission rate for ${rate.category} updated`, rate });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update commission rate' });
  }
};

// POST /api/admin/commissions
exports.createCategoryCommission = async (req, res) => {
  try {
    const { category, commissionPercent, commissionBase = 'final_price_ex_gst', description = '' } = req.body;
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const percent = Number(commissionPercent);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      return res.status(400).json({ message: 'Commission percent must be between 0 and 100%' });
    }

    const rate = await CommissionRate.create({
      category: category.trim(),
      commissionPercent: percent,
      commissionBase,
      description: description.trim(),
    });
    res.status(201).json(rate);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A commission rate for this category already exists' });
    }
    res.status(500).json({ message: 'Failed to create commission rate' });
  }
};

// PUT /api/admin/shipments/:id/remit-cod
// Reconciles and confirms cash collected by rider has been remitted to platform bank/vault
exports.remitCodCash = async (req, res) => {
  try {
    const { remittanceReference = '' } = req.body;
    if (!String(remittanceReference).trim()) {
      return res.status(400).json({ message: 'A physical deposit or bank remittance reference is required' });
    }
    const shipment = await Shipment.findById(req.params.id).populate('order');

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }
    if (!shipment.codCollected) {
      return res.status(400).json({ message: 'COD cash has not been recorded as collected yet' });
    }
    if (shipment.codRemitted) {
      return res.status(409).json({ message: 'This shipment COD has already been remitted' });
    }

    const now = new Date();
    const amountInPaise = Number.isSafeInteger(shipment.codAmountInPaise)
      ? shipment.codAmountInPaise
      : paiseForOrder(shipment.order);
    const codAmount = fromPaise(amountInPaise);
    const reference = String(remittanceReference).trim();
    const claimed = await Shipment.updateOne(
      { _id: shipment._id, codCollected: true, codRemitted: false },
      { $set: { codRemitted: true, codRemittedAt: now, codRemittanceReference: reference } }
    );
    if (claimed.modifiedCount !== 1) return res.status(409).json({ message: 'This shipment COD has already been remitted or changed' });
    shipment.codRemitted = true;
    shipment.codRemittedAt = now;
    shipment.codRemittanceReference = reference;

    if (shipment.order) {
      const orderUpdate = await Order.updateOne(
        { _id: shipment.order._id, codCollected: true, codRemitted: false },
        { $set: { codRemitted: true, codRemittedAt: now, codRemittanceReference: reference } }
      );
      if (orderUpdate.modifiedCount !== 1) {
        // Do not silently claim platform funds if the linked order is no longer
        // in the expected state; the shipment remains auditable for review.
        await Shipment.updateOne(
          { _id: shipment._id, codRemitted: true, codRemittanceReference: reference },
          { $set: { codRemitted: false, codRemittedAt: null, codRemittanceReference: '' } }
        );
        return res.status(409).json({ message: 'The linked order is not eligible for COD reconciliation' });
      }

      // Post double-entry to FinancialLedger:
      // Debit PlatformBank (cash deposited), Credit CODReceivable (clears rider held cash)
      await postLedgerEntry({
        order: shipment.order._id,
        shipment: shipment._id,
        transactionReference: reference,
        idempotencyKey: `LED_COD_REMIT_${shipment._id}`,
        eventType: 'COD_REMITTED',
        debitAccount: 'PlatformBank',
        creditAccount: 'CODReceivable',
        amountInPaise,
        description: `Rider remitted ₹${codAmount} COD cash for AWB #${shipment.trackingNumber}`,
        recordedBy: req.user._id,
      });

    }

    res.json({
      message: `COD cash of ₹${codAmount.toFixed(2)} successfully remitted and reconciled`,
      shipment,
    });
  } catch (err) {
    console.error('remitCodCash error:', err);
    res.status(500).json({ message: 'Failed to record COD remittance' });
  }
};

// PUT /api/admin/payments/:orderId/reconcile
// Captured gateway money is not treated as bank cash until an administrator
// reconciles it with a provider settlement/bank reference.
exports.reconcileRazorpayPayment = async (req, res) => {
  try {
    const reference = String(req.body?.settlementReference || '').trim();
    if (!reference) return res.status(400).json({ message: 'Gateway settlement or bank reference is required' });

    const payment = await Payment.findOne({ order: req.params.orderId, status: 'SUCCESS' });
    if (!payment) return res.status(404).json({ message: 'Captured Razorpay payment not found for this order' });
    if (payment.reconciliationStatus === 'Reconciled') {
      return res.json({ message: 'Payment is already reconciled', payment });
    }
    if (!payment.razorpayPaymentId) return res.status(409).json({ message: 'Gateway payment identifier is missing' });

    // Re-check directly with Razorpay before moving the receivable into cash.
    const gatewayPayment = await razorpay.payments.fetch(payment.razorpayPaymentId);
    const expectedPaise = Number.isSafeInteger(payment.capturedAmountInPaise)
      ? payment.capturedAmountInPaise
      : moneyToPaise(payment.amount);
    if (gatewayPayment.status !== 'captured' || gatewayPayment.amount !== expectedPaise || gatewayPayment.order_id !== payment.razorpayOrderId) {
      return res.status(409).json({ message: 'Razorpay capture details no longer match the local payment' });
    }

    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, reconciliationStatus: 'Captured' },
      { $set: { reconciliationStatus: 'Reconciled', reconciledAt: new Date(), reconciliationReference: reference } },
      { new: true, runValidators: true }
    );
    const reconciled = claimed || await Payment.findById(payment._id);
    if (!reconciled || reconciled.reconciliationStatus !== 'Reconciled') {
      return res.status(409).json({ message: 'Payment reconciliation is already being processed' });
    }

    await postLedgerEntry({
      order: reconciled.order,
      transactionReference: reference,
      idempotencyKey: `LED_GATEWAY_SETTLE_${reconciled._id}`,
      eventType: 'PAYMENT_GATEWAY_SETTLED',
      debitAccount: 'PlatformBank',
      creditAccount: 'GatewayReceivable',
      amountInPaise: expectedPaise,
      description: `Razorpay settlement reconciled for payment ${reconciled.razorpayPaymentId}`,
      recordedBy: req.user._id,
    });
    return res.json({ message: 'Gateway payment reconciled', payment: reconciled });
  } catch (err) {
    console.error('reconcileRazorpayPayment error:', err);
    return res.status(500).json({ message: 'Failed to reconcile Razorpay payment' });
  }
};

const moneyToPaise = (amount) => toPaise(amount || 0);

// PUT /api/admin/shipments/:id/financials
// Records one immutable external-courier invoice and/or one RTO charge. Internal
// partner delivery payouts are calculated from the assignment-time snapshot.
exports.recordShipmentFinancials = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    const body = req.body || {};
    const hasExternalCost = body.externalCourierCostInPaise !== undefined;
    const hasRtoCost = body.rtoCostInPaise !== undefined;
    if (!hasExternalCost && !hasRtoCost) return res.status(400).json({ message: 'Provide an external courier or RTO cost in integer paise' });

    const parsePaise = (value, label) => {
      if (!Number.isSafeInteger(value) || value < 0) {
        const error = new Error(`${label} must be a non-negative integer paise amount`);
        error.status = 400;
        throw error;
      }
      return value;
    };

    if (hasExternalCost) {
      if (shipment.carrierType !== 'External') return res.status(400).json({ message: 'External courier cost can only be recorded for an External shipment' });
      const costInPaise = parsePaise(body.externalCourierCostInPaise, 'externalCourierCostInPaise');
      const invoiceReference = String(body.externalCourierInvoiceReference || '').trim();
      if (!invoiceReference) return res.status(400).json({ message: 'External courier invoice reference is required' });
      if (shipment.externalCourierCostRecordedAt) return res.status(409).json({ message: 'External courier cost is already recorded and cannot be edited' });
      const now = new Date();
      const claimed = await Shipment.findOneAndUpdate(
        { _id: shipment._id, carrierType: 'External', externalCourierCostRecordedAt: null },
        {
          $set: {
            externalCourierCostInPaise: costInPaise,
            externalCourierCost: fromPaise(costInPaise),
            externalCourierCostRecordedAt: now,
            'externalCourier.invoiceReference': invoiceReference,
            'externalCourier.invoiceReceivedAt': now,
          },
        },
        { new: true, runValidators: true }
      );
      if (!claimed) return res.status(409).json({ message: 'External courier cost was already recorded' });
      if (costInPaise > 0) {
        await postLedgerEntry({
          order: claimed.order,
          shipment: claimed._id,
          transactionReference: invoiceReference,
          idempotencyKey: `LED_EXT_COURIER_${claimed._id}`,
          eventType: 'EXTERNAL_COURIER_EXPENSE_INCURRED',
          debitAccount: 'DeliveryExpense',
          creditAccount: 'CourierPayable',
          amountInPaise: costInPaise,
          description: `External courier invoice ${invoiceReference} for AWB #${claimed.trackingNumber}`,
          recordedBy: req.user._id,
        });
      }
    }

    if (hasRtoCost) {
      const costInPaise = parsePaise(body.rtoCostInPaise, 'rtoCostInPaise');
      const rtoReference = String(body.rtoCostReference || '').trim();
      if (!rtoReference) return res.status(400).json({ message: 'RTO charge reference is required' });
      const claimed = await Shipment.findOneAndUpdate(
        { _id: shipment._id, rtoCostRecordedAt: null },
        { $set: { rtoCostInPaise: costInPaise, rtoCost: fromPaise(costInPaise), rtoCostReference: rtoReference, rtoCostRecordedAt: new Date() } },
        { new: true, runValidators: true }
      );
      if (!claimed) return res.status(409).json({ message: 'RTO cost was already recorded' });
      if (costInPaise > 0) {
        await postLedgerEntry({
          order: claimed.order,
          shipment: claimed._id,
          transactionReference: rtoReference,
          idempotencyKey: `LED_RTO_COST_${claimed._id}`,
          eventType: 'RTO_EXPENSE_INCURRED',
          debitAccount: 'DeliveryExpense',
          creditAccount: 'CourierPayable',
          amountInPaise: costInPaise,
          description: `RTO expense ${rtoReference} for AWB #${claimed.trackingNumber}`,
          recordedBy: req.user._id,
        });
      }
    }

    return res.json({ message: 'Shipment financials recorded', shipment: await Shipment.findById(shipment._id) });
  } catch (err) {
    console.error('recordShipmentFinancials error:', err);
    return res.status(err.status || 500).json({ message: err.status ? err.message : 'Failed to record shipment financials' });
  }
};

// GET /api/admin/ledger
exports.getFinancialLedgerEntries = async (req, res) => {
  try {
    const { eventType, debitAccount, creditAccount, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (debitAccount) filter.debitAccount = debitAccount;
    if (creditAccount) filter.creditAccount = creditAccount;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      FinancialLedger.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('recordedBy', 'name email'),
      FinancialLedger.countDocuments(filter),
    ]);

    res.json({
      entries,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch financial ledger' });
  }
};
