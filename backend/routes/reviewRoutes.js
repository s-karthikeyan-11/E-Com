const express = require('express');
const router = express.Router();
const { protect, customerOnly, adminOnly } = require('../middleware/auth');
const { handleReviewUpload } = require('../middleware/upload');
const {
  getProductReviews,
  checkReviewEligibility,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpfulVote,
  uploadReviewPhotos,
  adminGetReviews,
  adminModerateReview,
} = require('../controllers/reviewController');

// Public route: Fetch reviews for a product
router.get('/product/:productId', getProductReviews);

// Protected routes (Customer)
router.get('/product/:productId/eligibility', protect, customerOnly, checkReviewEligibility);
router.post('/product/:productId', protect, customerOnly, handleReviewUpload, createReview);
router.post('/upload', protect, customerOnly, handleReviewUpload, uploadReviewPhotos);

// Review interaction & ownership routes
router.put('/:id', protect, handleReviewUpload, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/helpful', protect, toggleHelpfulVote);

// Admin moderation routes
router.get('/admin', protect, adminOnly, adminGetReviews);
router.patch('/admin/:id/moderate', protect, adminOnly, adminModerateReview);

module.exports = router;
