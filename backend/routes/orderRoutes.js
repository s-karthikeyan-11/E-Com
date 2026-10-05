const express = require('express');
const router = express.Router();
const { protect, customerOnly } = require('../middleware/auth');
const {
  placeOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  cancelRazorpayPayment,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  reorderCancelledOrder,
  getDeliveryEstimate,
  getCouponStatus,
} = require('../controllers/orderController');

router.use(protect);

router.post('/razorpay', customerOnly, createRazorpayOrder);
router.post('/razorpay/verify', customerOnly, verifyRazorpayPayment);
router.post('/:id/payment/cancel', customerOnly, cancelRazorpayPayment);
router.get('/delivery-estimate', customerOnly, getDeliveryEstimate);
router.get('/coupon', customerOnly, getCouponStatus);
router.post('/:id/cancel', customerOnly, cancelMyOrder);
router.post('/:id/reorder', customerOnly, reorderCancelledOrder);
router.post('/', customerOnly, placeOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrderById);

module.exports = router;
