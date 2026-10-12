const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const {
  getDashboard,
  getUsers,
  setUserBlocked,
  deleteUser,
  getAnalytics,
  getPayments,
  getReport,
  getReports,
  getSellers,
  getSellerById,
  updateSellerStatus,
} = require('../controllers/adminController');
const {
  adminGetProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { adminGetOrders, updateOrderStatus, getOrderById } = require('../controllers/orderController');
const {
  getDeliveryPartners,
  getDeliveryPartnerById,
  createDeliveryPartner,
  updateDeliveryPartner,
  toggleDeliveryPartnerStatus,
  approveDeliveryPartner,
  rejectDeliveryPartner,
  assignOrderDelivery,
  getAllShipments,
} = require('../controllers/adminDeliveryController');
const {
  getFinanceOverview,
  getCategoryCommissions,
  updateCategoryCommission,
  createCategoryCommission,
  remitCodCash,
  getFinancialLedgerEntries,
  reconcileRazorpayPayment,
  recordShipmentFinancials,
} = require('../controllers/adminFinanceController');
const {
  getAdminSettlements,
  approveSettlement,
  startSettlementProcessing,
  holdSettlement,
  rejectSettlement,
  failSettlement,
  recordSettlementPayout,
} = require('../controllers/settlementController');

router.use(protect, adminOnly); // every admin route requires an admin JWT

router.get('/dashboard', getDashboard);

router.get('/analytics', getAnalytics);
router.get('/payments', getPayments);
router.get('/report', getReport);
router.get('/reports', getReports);

// Financial Management, Ledger & Commission routes
router.get('/finance/overview', getFinanceOverview);
router.get('/commissions', getCategoryCommissions);
router.post('/commissions', createCategoryCommission);
router.put('/commissions/:id', updateCategoryCommission);
router.put('/shipments/:id/remit-cod', remitCodCash);
router.put('/shipments/:id/financials', recordShipmentFinancials);
router.put('/payments/:orderId/reconcile', reconcileRazorpayPayment);
router.get('/ledger', getFinancialLedgerEntries);

// Settlement & Payout routes
router.get('/settlements', getAdminSettlements);
router.put('/settlements/:id/approve', approveSettlement);
router.put('/settlements/:id/processing', startSettlementProcessing);
router.put('/settlements/:id/hold', holdSettlement);
router.put('/settlements/:id/reject', rejectSettlement);
router.put('/settlements/:id/fail', failSettlement);
router.put('/settlements/:id/payout', recordSettlementPayout);

// Seller Management routes
router.get('/sellers', getSellers);
router.get('/sellers/:id', getSellerById);
router.put('/sellers/:id/status', updateSellerStatus);

// Logistics & Delivery Partner Management routes
router.get('/delivery-partners', getDeliveryPartners);
router.get('/delivery-partners/:id', getDeliveryPartnerById);
router.post('/delivery-partners', createDeliveryPartner);
router.put('/delivery-partners/:id', updateDeliveryPartner);
router.put('/delivery-partners/:id/status', toggleDeliveryPartnerStatus);
router.put('/delivery-partners/:id/approve', approveDeliveryPartner);
router.put('/delivery-partners/:id/reject', rejectDeliveryPartner);
router.post('/orders/:id/assign-delivery', assignOrderDelivery);
router.get('/shipments', getAllShipments);

router.get('/products', adminGetProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

router.get('/orders', adminGetOrders);
router.get('/orders/:id', getOrderById);
router.put('/orders/:id/status', updateOrderStatus);

router.get('/users', getUsers);
router.put('/users/:id/block', setUserBlocked);
router.delete('/users/:id', deleteUser);

module.exports = router;
