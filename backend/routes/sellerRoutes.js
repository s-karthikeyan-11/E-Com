const express = require('express');
const router = express.Router();
const { protect, sellerOnly } = require('../middleware/auth');
const {
  registerSeller,
  loginSeller,
  getSellerProfile,
  updateSellerProfile,
  getSellerDashboard,
  getSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  getSellerOrders,
  updateSellerOrderStatus,
  getSellerEarnings,
  getPublicSellerStore,
} = require('../controllers/sellerController');

// Public seller routes
router.post('/register', registerSeller);
router.post('/login', loginSeller);
router.get('/store/:sellerId', getPublicSellerStore);
router.get('/:sellerId/store', getPublicSellerStore);

// Protected seller routes (requires authenticated seller account with Approved status)
router.use(protect, sellerOnly);

router.get('/profile', getSellerProfile);
router.put('/profile', updateSellerProfile);

router.get('/dashboard', getSellerDashboard);

router.get('/products', getSellerProducts);
router.post('/products', createSellerProduct);
router.put('/products/:id', updateSellerProduct);
router.delete('/products/:id', deleteSellerProduct);

router.get('/orders', getSellerOrders);
router.put('/orders/:id/status', updateSellerOrderStatus);

router.get('/earnings', getSellerEarnings);

module.exports = router;
