const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');

const { getDashboard, getUsers, setUserBlocked, deleteUser, getAnalytics, getPayments, getReport, getReports } = require('../controllers/adminController');
const {
  adminGetProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { adminGetOrders, updateOrderStatus, getOrderById } = require('../controllers/orderController');

router.use(protect, adminOnly); // every admin route requires an admin JWT

router.get('/dashboard', getDashboard);

router.get('/analytics', getAnalytics);
router.get('/payments', getPayments);
router.get('/report', getReport);
router.get('/reports', getReports);

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
