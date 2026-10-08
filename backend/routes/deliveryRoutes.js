const express = require('express');
const router = express.Router();
const { protect, deliveryOnly } = require('../middleware/auth');
const {
  loginDeliveryPartner,
  getDeliveryProfile,
  updateDeliveryProfile,
  getDeliveryDashboard,
  getAssignedOrders,
  getOrderShipmentDetails,
  updateDeliveryStatus,
  getDeliveryHistory,
} = require('../controllers/deliveryController');

// Public route: Delivery partner authentication
router.post('/login', loginDeliveryPartner);

// Protected routes (require delivery role or admin)
router.use(protect, deliveryOnly);

router.get('/profile', getDeliveryProfile);
router.put('/profile', updateDeliveryProfile);
router.get('/dashboard', getDeliveryDashboard);
router.get('/orders', getAssignedOrders);
router.get('/orders/:id', getOrderShipmentDetails);
router.put('/orders/:id/status', updateDeliveryStatus);
router.get('/history', getDeliveryHistory);

module.exports = router;
