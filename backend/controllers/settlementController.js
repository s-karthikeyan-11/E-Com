const mongoose = require('mongoose');
const Settlement = require('../models/Settlement');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const Seller = require('../models/Seller');
const DeliveryPartner = require('../models/DeliveryPartner');
const Payment = require('../models/Payment');
const crypto = require('crypto');
const { toPaise, fromPaise, postLedgerEntry } = require('../utils/finance');

const generateSettlementNumber = (type) => {
  const prefix = type === 'Seller' ? 'SET-SLR' : 'SET-DEL';
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  return `${prefix}-${yyyymm}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
};

const moneyInPaise = (document, paiseField, amountField) => (
  Number.isSafeInteger(document?.[paiseField]) ? document[paiseField] : toPaise(document?.[amountField] || 0)
);

const suppliedIdempotencyKey = (req, prefix, beneficiaryId) => {
  const supplied = req.get('Idempotency-Key') || req.body?.idempotencyKey;
  if (supplied !== undefined && !/^[A-Za-z0-9:_-]{8,160}$/.test(String(supplied))) {
    const err = new Error('Idempotency-Key must be 8-160 letters, numbers, colon, underscore, or hyphen');
    err.status = 400;
    throw err;
  }
  return supplied ? `${prefix}_${beneficiaryId}_${supplied}` : `${prefix}_${beneficiaryId}_${crypto.randomUUID()}`;
};

const isOrderReconciledForSeller = (order, paymentByOrder) => {
  if (order.paymentStatus !== 'Paid') return false;
  if (order.paymentMethod === 'Cash on Delivery') return !!(order.codCollected && order.codRemitted);
  return paymentByOrder.get(String(order._id))?.reconciliationStatus === 'Reconciled';
};

const releaseSettlementReservations = async (settlement) => {
  if (settlement.beneficiaryType === 'Seller') {
    await Promise.all((settlement.orderItems || []).map((itemRef) => Order.updateOne(
      { _id: itemRef.order },
      { $unset: { 'items.$[item].settlementId': 1 } },
      { arrayFilters: [{ 'item.settlementId': settlement._id, 'item.product': itemRef.product }] }
    )));
  } else if (settlement.beneficiaryType === 'DeliveryPartner') {
    await Shipment.updateMany({ settlementId: settlement._id, isSettledToPartner: false }, { $unset: { settlementId: 1 } });
  }
};

// ==========================================
// SELLER SETTLEMENT WORKFLOWS
// ==========================================

// GET /api/seller/settlements
// Calculates current available balance and retrieves settlement history for authenticated seller
exports.getSellerSettlementOverview = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: 'Seller profile not found' });
    }

    // Find all orders that have items belonging to this seller
    const orders = await Order.find({
      'items.seller': seller._id,
      status: mongoose.trusted({ $ne: 'Cancelled' }),
    }).sort({ createdAt: -1 });
    const payments = await Payment.find({ order: { $in: orders.map((order) => order._id) } })
      .select('order reconciliationStatus');
    const paymentByOrder = new Map(payments.map((payment) => [String(payment.order), payment]));

    let availableInPaise = 0;
    let pendingFulfillmentInPaise = 0;
    const eligibleItems = [];
    const pendingItems = [];

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.seller || item.seller.toString() !== seller._id.toString()) continue;

        // Skip items that have already been settled
        if (item.isSettled) continue;

        const isDelivered = order.status === 'Delivered';
        const isReconciled = isOrderReconciledForSeller(order, paymentByOrder);
        const itemEarningInPaise = moneyInPaise(item, 'netEarningInPaise', 'netEarning');

        if (isDelivered && isReconciled && !item.settlementId) {
          availableInPaise += itemEarningInPaise;
          eligibleItems.push({
            orderId: order._id,
            orderDate: order.createdAt,
            product: item.product,
            name: item.name,
            quantity: item.quantity,
            lineTotal: fromPaise(moneyInPaise(item, 'lineTotalInPaise', 'lineTotal')),
            commissionAmount: fromPaise(moneyInPaise(item, 'commissionAmountInPaise', 'commissionAmount')),
            netEarning: fromPaise(itemEarningInPaise),
            netEarningInPaise: itemEarningInPaise,
          });
        } else {
          pendingFulfillmentInPaise += itemEarningInPaise;
          pendingItems.push({
            orderId: order._id,
            orderStatus: order.status,
            paymentStatus: order.paymentStatus,
            reconciliationStatus: order.paymentMethod === 'Cash on Delivery'
              ? (order.codRemitted ? 'Reconciled' : 'Awaiting COD remittance')
              : (paymentByOrder.get(String(order._id))?.reconciliationStatus || 'Not reconciled'),
            name: item.name,
            netEarning: fromPaise(itemEarningInPaise),
            settlementReserved: !!item.settlementId,
          });
        }
      }
    }

    const settlements = await Settlement.find({ seller: seller._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email');

    const totalPaid = settlements
      .filter((s) => s.status === 'Paid')
      .reduce((acc, s) => acc + moneyInPaise(s, 'amountInPaise', 'amount'), 0);

    res.json({
      summary: {
        availableForSettlement: fromPaise(availableInPaise),
        availableInPaise,
        pendingFulfillment: fromPaise(pendingFulfillmentInPaise),
        totalSettled: fromPaise(totalPaid),
        eligibleItemsCount: eligibleItems.length,
        settlementCount: settlements.length,
        bankDetailsConfigured: !!(seller.bankDetails && seller.bankDetails.accountNumber),
        bankDetails: seller.bankDetails || {},
      },
      eligibleItems,
      settlements,
    });
  } catch (err) {
    console.error('getSellerSettlementOverview error:', err);
    res.status(500).json({ message: 'Failed to fetch seller settlement overview' });
  }
};

// POST /api/seller/settlements/request
// Creates a new settlement request from all eligible, reconciled order items
exports.requestSellerSettlement = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    if (!seller.bankDetails || !seller.bankDetails.accountNumber || !seller.bankDetails.ifscCode) {
      return res.status(400).json({
        message: 'Please complete your bank account details in your profile before requesting a payout',
      });
    }

    const idempotencyKey = suppliedIdempotencyKey(req, 'REQ_SET_SLR', seller._id);
    const retriedRequest = await Settlement.findOne({ idempotencyKey });
    if (retriedRequest) return res.status(200).json({ message: 'Settlement request already recorded', settlement: retriedRequest });

    // Find delivered, paid, COD-remitted orders with items not yet settled or reserved
    const orders = await Order.find({
      'items.seller': seller._id,
      status: 'Delivered',
      paymentStatus: 'Paid',
    });
    const payments = await Payment.find({ order: { $in: orders.map((order) => order._id) } })
      .select('order reconciliationStatus');
    const paymentByOrder = new Map(payments.map((payment) => [String(payment.order), payment]));

    const itemsToSettle = [];
    let totalNetEarningInPaise = 0;

    for (const order of orders) {
      if (!isOrderReconciledForSeller(order, paymentByOrder)) continue;

      for (const item of order.items) {
        if (
          item.seller &&
          item.seller.toString() === seller._id.toString() &&
          !item.isSettled &&
          !item.settlementId
        ) {
          const earningInPaise = moneyInPaise(item, 'netEarningInPaise', 'netEarning');
          totalNetEarningInPaise += earningInPaise;
          itemsToSettle.push({
            order: order._id,
            product: item.product,
            name: item.name,
            quantity: item.quantity,
            lineTotal: fromPaise(moneyInPaise(item, 'lineTotalInPaise', 'lineTotal')),
            lineTotalInPaise: moneyInPaise(item, 'lineTotalInPaise', 'lineTotal'),
            commissionAmount: fromPaise(moneyInPaise(item, 'commissionAmountInPaise', 'commissionAmount')),
            commissionAmountInPaise: moneyInPaise(item, 'commissionAmountInPaise', 'commissionAmount'),
            netEarning: fromPaise(earningInPaise),
            netEarningInPaise: earningInPaise,
          });
        }
      }
    }

    if (!itemsToSettle.length || totalNetEarningInPaise < 1000) {
      return res.status(400).json({
        message: 'No eligible delivered orders found for payout (minimum payout threshold is ₹10.00)',
      });
    }

    const amountInPaise = totalNetEarningInPaise;
    const roundedAmount = fromPaise(amountInPaise);
    const settlementNumber = generateSettlementNumber('Seller');

    let settlement;
    try {
      settlement = await Settlement.create({
        settlementNumber,
        beneficiaryType: 'Seller',
        seller: seller._id,
        beneficiaryUser: req.user._id,
        activeBeneficiaryKey: `Seller:${seller._id}`,
        orderItems: itemsToSettle,
        amount: roundedAmount,
        amountInPaise,
        currency: 'INR',
        status: 'Pending Review',
        bankDetailsSnapshot: {
          accountHolder: seller.bankDetails.accountHolder || seller.name,
          accountNumber: seller.bankDetails.accountNumber,
          ifscCode: seller.bankDetails.ifscCode,
          bankName: seller.bankDetails.bankName || '',
          upiId: seller.bankDetails.upiId || '',
        },
        requestedAt: new Date(),
        idempotencyKey,
      });
    } catch (err) {
      if (err.code === 11000) {
        const active = await Settlement.findOne({ activeBeneficiaryKey: `Seller:${seller._id}` });
        return res.status(409).json({ message: `You already have an active settlement request (${active?.settlementNumber || 'in progress'})`, settlement: active });
      }
      throw err;
    }

    const reserved = [];
    for (const itemRef of itemsToSettle) {
      const result = await Order.updateOne(
        {
          _id: itemRef.order,
          items: { $elemMatch: { seller: seller._id, product: itemRef.product, isSettled: false, settlementId: null } },
        },
        { $set: { 'items.$.settlementId': settlement._id } }
      );
      if (result.modifiedCount === 1) reserved.push(itemRef);
    }
    if (reserved.length !== itemsToSettle.length) {
      await releaseSettlementReservations({ ...settlement.toObject(), orderItems: reserved });
      await Settlement.updateOne(
        { _id: settlement._id, status: 'Pending Review' },
        { $set: { status: 'Failed', failureReason: 'Eligible items changed while the request was being reserved', failedAt: new Date() }, $unset: { activeBeneficiaryKey: 1 } }
      );
      return res.status(409).json({ message: 'Eligible items changed. Refresh balances and request again.' });
    }

    res.status(201).json({
      message: `Settlement request ${settlementNumber} submitted successfully for review`,
      settlement,
    });
  } catch (err) {
    console.error('requestSellerSettlement error:', err);
    res.status(500).json({ message: 'Failed to create settlement request' });
  }
};

// ==========================================
// DELIVERY PARTNER SETTLEMENT WORKFLOWS
// ==========================================

// GET /api/delivery/earnings
// Shows internal delivery partner their completed deliveries, fee balance, and payout history
exports.getDeliveryPartnerEarnings = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner._id;
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    const shipments = await Shipment.find({
      deliveryPartner: partner._id,
      carrierType: { $ne: 'External' },
    })
      .populate('order', 'totalAmount paymentMethod paymentStatus status codCollected codRemitted')
      .sort({ updatedAt: -1 });

    let availableEarnings = 0;
    let pendingFulfillmentEarnings = 0;
    let codCashHeldByRider = 0;
    let codCashRemitted = 0;
    const eligibleShipments = [];

    for (const s of shipments) {
      const feeInPaise = moneyInPaise(s, 'deliveryFeeEarnedInPaise', 'deliveryFeeEarned');
      const fee = fromPaise(feeInPaise);
      const isDelivered = s.status === 'Delivered';
      const isCod = s.order?.paymentMethod === 'Cash on Delivery';

      if (isCod) {
        if (s.codCollected && !s.codRemitted) {
          codCashHeldByRider += Number(s.codAmount || s.order.totalAmount || 0);
        } else if (s.codCollected && s.codRemitted) {
          codCashRemitted += Number(s.codAmount || s.order.totalAmount || 0);
        }
      }

      if (s.isSettledToPartner) continue;

      // Eligible if delivered and if COD, cash must have been remitted
      const codReady = !isCod || s.codRemitted;

      if (isDelivered && codReady && !s.settlementId) {
        availableEarnings += fee;
        eligibleShipments.push({
          shipmentId: s._id,
          orderId: s.order?._id,
          trackingNumber: s.trackingNumber,
          deliveredAt: s.deliveredAt,
          deliveryFeeEarned: fee,
          deliveryFeeEarnedInPaise: feeInPaise,
        });
      } else if (!isDelivered) {
        pendingFulfillmentEarnings += fee;
      }
    }

    const settlements = await Settlement.find({ deliveryPartner: partner._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email');

    const totalPaid = settlements
      .filter((s) => s.status === 'Paid')
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    res.json({
      summary: {
        availableForSettlement: +availableEarnings.toFixed(2),
        availableInPaise: toPaise(availableEarnings),
        pendingDeliveries: pendingFulfillmentEarnings,
        totalSettled: +totalPaid.toFixed(2),
        totalDeliveredCount: partner.totalDeliveredCount || 0,
        codCashHeldByRider: +codCashHeldByRider.toFixed(2),
        codCashRemitted: +codCashRemitted.toFixed(2),
        eligibleShipmentsCount: eligibleShipments.length,
      },
      eligibleShipments,
      settlements,
      partner,
    });
  } catch (err) {
    console.error('getDeliveryPartnerEarnings error:', err);
    res.status(500).json({ message: 'Failed to fetch delivery partner earnings' });
  }
};

// POST /api/delivery/settlements/request
exports.requestDeliverySettlement = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner._id;
    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    // Prevent payouts if partner currently holds unremitted customer COD cash
    const unremittedShipments = await Shipment.find({
      deliveryPartner: partner._id,
      status: 'Delivered',
      codCollected: true,
      codRemitted: false,
    });
    if (unremittedShipments.length > 0) {
      const cashHeld = unremittedShipments.reduce((acc, s) => acc + Number(s.codAmount || 0), 0);
      return res.status(400).json({
        message: `You have ₹${cashHeld.toFixed(2)} in unremitted COD cash. Please remit cash to logistics hub before requesting earnings settlement.`,
      });
    }

    const idempotencyKey = suppliedIdempotencyKey(req, 'REQ_SET_DP', partner._id);
    const retriedRequest = await Settlement.findOne({ idempotencyKey });
    if (retriedRequest) return res.status(200).json({ message: 'Settlement request already recorded', settlement: retriedRequest });

    // Find delivered shipments eligible for partner payout
    const shipments = await Shipment.find({
      deliveryPartner: partner._id,
      carrierType: { $ne: 'External' },
      status: 'Delivered',
      isSettledToPartner: false,
      settlementId: null,
    });

    const eligibleShipments = shipments.filter((s) => !s.codCollected || s.codRemitted);
    if (!eligibleShipments.length) {
      return res.status(400).json({ message: 'No eligible completed deliveries found for payout' });
    }

    const amountInPaise = eligibleShipments.reduce(
      (acc, s) => acc + moneyInPaise(s, 'deliveryFeeEarnedInPaise', 'deliveryFeeEarned'), 0
    );
    const roundedAmount = fromPaise(amountInPaise);
    const settlementNumber = generateSettlementNumber('DeliveryPartner');

    let settlement;
    try {
      settlement = await Settlement.create({
      settlementNumber,
      beneficiaryType: 'DeliveryPartner',
      deliveryPartner: partner._id,
      beneficiaryUser: req.user._id,
      activeBeneficiaryKey: `DeliveryPartner:${partner._id}`,
      shipments: eligibleShipments.map((s) => ({
        shipment: s._id,
        order: s.order,
        trackingNumber: s.trackingNumber,
        deliveryFeeEarned: fromPaise(moneyInPaise(s, 'deliveryFeeEarnedInPaise', 'deliveryFeeEarned')),
        deliveryFeeEarnedInPaise: moneyInPaise(s, 'deliveryFeeEarnedInPaise', 'deliveryFeeEarned'),
      })),
      amount: roundedAmount,
      amountInPaise,
      currency: 'INR',
      status: 'Pending Review',
      bankDetailsSnapshot: {
        accountHolder: partner.name,
        accountNumber: partner.phone,
        ifscCode: 'INTERNAL-WALLET',
        bankName: 'Fleet Direct Deposit',
        upiId: `${partner.phone}@upi`,
      },
      requestedAt: new Date(),
      idempotencyKey,
      });
    } catch (err) {
      if (err.code === 11000) {
        const active = await Settlement.findOne({ activeBeneficiaryKey: `DeliveryPartner:${partner._id}` });
        return res.status(409).json({ message: `You already have an active settlement request (${active?.settlementNumber || 'in progress'})`, settlement: active });
      }
      throw err;
    }

    const reserved = await Shipment.updateMany(
      { _id: { $in: eligibleShipments.map((s) => s._id) }, settlementId: null, isSettledToPartner: false },
      { $set: { settlementId: settlement._id } }
    );
    if (reserved.modifiedCount !== eligibleShipments.length) {
      await Shipment.updateMany({ settlementId: settlement._id, isSettledToPartner: false }, { $unset: { settlementId: 1 } });
      await Settlement.updateOne(
        { _id: settlement._id, status: 'Pending Review' },
        { $set: { status: 'Failed', failureReason: 'Eligible deliveries changed while the request was being reserved', failedAt: new Date() }, $unset: { activeBeneficiaryKey: 1 } }
      );
      return res.status(409).json({ message: 'Eligible deliveries changed. Refresh balances and request again.' });
    }

    res.status(201).json({
      message: `Delivery earnings settlement request ${settlementNumber} submitted`,
      settlement,
    });
  } catch (err) {
    console.error('requestDeliverySettlement error:', err);
    res.status(500).json({ message: 'Failed to request delivery settlement' });
  }
};

// ==========================================
// ADMIN SETTLEMENT MANAGEMENT WORKFLOWS
// ==========================================

// GET /api/admin/settlements
exports.getAdminSettlements = async (req, res) => {
  try {
    const { beneficiaryType, status, search } = req.query;
    const filter = {};

    if (beneficiaryType && ['Seller', 'DeliveryPartner'].includes(beneficiaryType)) {
      filter.beneficiaryType = beneficiaryType;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (search) {
      filter.settlementNumber = new RegExp(search.trim(), 'i');
    }

    const settlements = await Settlement.find(filter)
      .populate('seller', 'name storeName email phone bankDetails')
      .populate('deliveryPartner', 'name phone vehicleType serviceType')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    const totalAmount = settlements.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const pendingReviewCount = settlements.filter((s) => s.status === 'Pending Review').length;
    const approvedCount = settlements.filter((s) => s.status === 'Approved').length;
    const paidCount = settlements.filter((s) => s.status === 'Paid').length;

    res.json({
      settlements,
      summary: {
        totalSettlements: settlements.length,
        totalAmount: +totalAmount.toFixed(2),
        pendingReviewCount,
        approvedCount,
        paidCount,
      },
    });
  } catch (err) {
    console.error('getAdminSettlements error:', err);
    res.status(500).json({ message: 'Failed to fetch settlements' });
  }
};

// PUT /api/admin/settlements/:id/approve
exports.approveSettlement = async (req, res) => {
  try {
    const settlement = await Settlement.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending Review' },
      {
        $set: {
          status: 'Approved',
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({
        message: 'Settlement not found or cannot be approved (only Pending Review can be approved)',
      });
    }

    res.json({ message: 'Settlement approved for disbursement', settlement });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve settlement' });
  }
};

// PUT /api/admin/settlements/:id/processing
// This is the explicit hand-off point to the bank/RazorpayX payout operation.
exports.startSettlementProcessing = async (req, res) => {
  try {
    const settlement = await Settlement.findOneAndUpdate(
      { _id: req.params.id, status: 'Approved' },
      { $set: { status: 'Processing', processingStartedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!settlement) return res.status(409).json({ message: 'Only an Approved settlement can enter Processing' });
    return res.json({ message: 'Settlement marked Processing; await verified payout confirmation before marking it Paid', settlement });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to start settlement processing' });
  }
};

// PUT /api/admin/settlements/:id/hold
exports.holdSettlement = async (req, res) => {
  try {
    const { reason = 'Under audit review' } = req.body;
    const settlement = await Settlement.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['Pending Review', 'Approved'] } },
      {
        $set: {
          status: 'On Hold',
          holdReason: String(reason).trim(),
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found or cannot be placed on hold' });
    }

    res.json({ message: 'Settlement placed on hold', settlement });
  } catch (err) {
    res.status(500).json({ message: 'Failed to hold settlement' });
  }
};

// PUT /api/admin/settlements/:id/reject
exports.rejectSettlement = async (req, res) => {
  try {
    const { reason = 'Compliance rejection' } = req.body;
    const settlement = await Settlement.findOneAndUpdate({
      _id: req.params.id,
      status: { $in: ['Pending Review', 'Approved', 'On Hold'] },
    }, {
      $set: {
        status: 'Rejected',
        rejectionReason: String(reason).trim(),
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      },
      $unset: { activeBeneficiaryKey: 1 },
    }, { new: true, runValidators: true });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found or already processed' });
    }

    await releaseSettlementReservations(settlement);

    res.json({ message: 'Settlement rejected and items released', settlement });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject settlement' });
  }
};

// PUT /api/admin/settlements/:id/fail
// Use only when the payout provider/bank confirms no money was sent. Unknown
// transfer outcomes stay Processing until they are reconciled.
exports.failSettlement = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'A bank/provider failure reason is required' });
    const settlement = await Settlement.findOneAndUpdate(
      { _id: req.params.id, status: 'Processing' },
      {
        $set: { status: 'Failed', failureReason: reason, failedAt: new Date(), reviewedBy: req.user._id, reviewedAt: new Date() },
        $unset: { activeBeneficiaryKey: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!settlement) return res.status(409).json({ message: 'Only a Processing settlement can be failed' });
    await releaseSettlementReservations(settlement);
    return res.json({ message: 'Settlement marked Failed and eligible items released', settlement });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to record settlement failure' });
  }
};

// PUT /api/admin/settlements/:id/payout
// Marks a settlement as PAID after verifying bank UTR / IMPS payout reference
exports.recordSettlementPayout = async (req, res) => {
  try {
    const { payoutReference, notes, verificationMethod, verificationEvidenceReference } = req.body || {};

    if (!payoutReference || !payoutReference.trim()) {
      return res.status(400).json({
        message: 'Bank UTR or Transaction Payout Reference is strictly required to mark payout as Paid',
      });
    }
    if (!verificationMethod || !verificationEvidenceReference || !String(verificationEvidenceReference).trim()) {
      return res.status(400).json({ message: 'Verified payout evidence and its verification method are required before marking Paid' });
    }
    if (!['Bank Statement', 'RazorpayX', 'UPI', 'Other'].includes(verificationMethod)) {
      return res.status(400).json({ message: 'Invalid payout verification method' });
    }

    const now = new Date();
    let settlement = await Settlement.findOneAndUpdate({
      _id: req.params.id,
      status: 'Processing',
    }, {
      $set: {
        status: 'Paid',
        payoutReference: payoutReference.trim(),
        ...(notes ? { notes: notes.trim() } : {}),
        paidAt: now,
        reviewedBy: req.user._id,
        reviewedAt: now,
        payoutVerification: {
          method: verificationMethod,
          evidenceReference: String(verificationEvidenceReference).trim(),
          verifiedBy: req.user._id,
          verifiedAt: now,
        },
      },
      $unset: { activeBeneficiaryKey: 1 },
    }, { new: true, runValidators: true });

    if (!settlement) {
      settlement = await Settlement.findById(req.params.id);
      if (!settlement || settlement.status !== 'Paid' || settlement.payoutReference !== payoutReference.trim()) {
        return res.status(409).json({ message: 'Settlement must be Approved then Processing before a verified payout can be recorded' });
      }
    }

    // 1. Permanently mark items / shipments as settled
    if (settlement.beneficiaryType === 'Seller') {
      for (const itemRef of settlement.orderItems) {
        await Order.updateOne(
          { _id: itemRef.order, items: { $elemMatch: { product: itemRef.product, settlementId: settlement._id } } },
          { $set: { 'items.$.isSettled': true } }
        );
      }
    } else if (settlement.beneficiaryType === 'DeliveryPartner') {
      await Shipment.updateMany(
        { settlementId: settlement._id, isSettledToPartner: false },
        { $set: { isSettledToPartner: true } }
      );
    }

    // 2. Post immutable double-entry to FinancialLedger:
    // Debit liability (SellerPayable / DeliveryPartnerPayable), Credit PlatformBank
    const debitAccount =
      settlement.beneficiaryType === 'Seller' ? 'SellerPayable' : 'DeliveryPartnerPayable';

    await postLedgerEntry({
      settlement: settlement._id,
      transactionReference: settlement.payoutReference,
      idempotencyKey: `LED_PAYOUT_${settlement._id}`,
      eventType:
        settlement.beneficiaryType === 'Seller'
          ? 'SELLER_PAYOUT_DISBURSED'
          : 'DELIVERY_PAYOUT_DISBURSED',
      debitAccount,
      creditAccount: 'PlatformBank',
      amountInPaise: settlement.amountInPaise,
      description: `Disbursed ₹${settlement.amount} to ${settlement.beneficiaryType} (${settlement.settlementNumber}) via UTR #${settlement.payoutReference}`,
      recordedBy: req.user._id,
    });

    res.json({
      message: `Payout successfully confirmed with reference #${settlement.payoutReference}`,
      settlement,
    });
  } catch (err) {
    console.error('recordSettlementPayout error:', err);
    res.status(500).json({ message: 'Failed to record settlement payout' });
  }
};
