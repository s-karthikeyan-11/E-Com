const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Seller = require('../models/Seller');
const { deleteReviewImages } = require('../middleware/upload');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/reviews/product/:productId
// Public - Returns paginated, sorted reviews for a product along with summary metrics
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const sortType = String(req.query.sort || 'recent').toLowerCase();
    const starFilter = req.query.star ? Number.parseInt(req.query.star, 10) : null;

    let sortOption = { createdAt: -1 };
    if (sortType === 'highest') sortOption = { rating: -1, createdAt: -1 };
    else if (sortType === 'lowest') sortOption = { rating: 1, createdAt: -1 };
    else if (sortType === 'helpful') sortOption = { helpfulCount: -1, createdAt: -1 };

    const query = {
      product: productId,
      status: 'Published',
    };

    if (starFilter && starFilter >= 1 && starFilter <= 5) {
      query.rating = starFilter;
    }

    const [reviews, totalCount, product] = await Promise.all([
      Review.find(query)
        .populate('user', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(query),
      Product.findById(productId).select('rating numReviews ratingDistribution name image').lean(),
    ]);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Attach user helpful vote marker if user is logged in
    const userIdStr = req.user ? String(req.user._id) : null;
    const sanitizedReviews = reviews.map((r) => ({
      ...r,
      hasHelpfulVoted: userIdStr ? (r.helpfulVotes || []).some((v) => String(v) === userIdStr) : false,
      helpfulVotes: undefined, // Protect user ID voter list
    }));

    const distribution = product.ratingDistribution instanceof Map
      ? Object.fromEntries(product.ratingDistribution)
      : product.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    res.json({
      reviews: sanitizedReviews,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      totalCount,
      averageRating: product.rating || 0,
      totalReviews: product.numReviews || 0,
      ratingDistribution: distribution,
    });
  } catch (err) {
    console.error('Error in getProductReviews:', err);
    res.status(500).json({ message: 'Failed to retrieve product reviews' });
  }
};

// GET /api/reviews/product/:productId/eligibility
// Protected - Verifies if the customer is eligible to submit a verified purchase review
exports.checkReviewEligibility = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).populate('seller', 'user');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if customer is the seller of the product
    if (product.seller && String(product.seller.user) === String(req.user._id)) {
      return res.json({
        canReview: false,
        isVerifiedPurchase: false,
        reason: 'Sellers are not permitted to review their own products.',
      });
    }

    // Check if customer already submitted a review
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id,
    }).lean();

    // Check if customer has an eligible delivered order for this product
    const eligibleOrder = await Order.findOne({
      user: req.user._id,
      status: 'Delivered',
      'items.product': productId,
    })
      .sort({ createdAt: -1 })
      .select('_id createdAt status')
      .lean();

    if (!eligibleOrder) {
      return res.json({
        canReview: false,
        isVerifiedPurchase: false,
        existingReview: existingReview || null,
        reason: 'Only customers who have purchased and received this product can write a verified review.',
      });
    }

    if (existingReview) {
      return res.json({
        canReview: false,
        isVerifiedPurchase: true,
        orderId: eligibleOrder._id,
        existingReview,
        reason: 'You have already reviewed this product. You can edit your existing review.',
      });
    }

    res.json({
      canReview: true,
      isVerifiedPurchase: true,
      orderId: eligibleOrder._id,
      existingReview: null,
      reason: null,
    });
  } catch (err) {
    console.error('Error in checkReviewEligibility:', err);
    res.status(500).json({ message: 'Failed to verify review eligibility' });
  }
};

// POST /api/reviews/product/:productId
// Protected - Submits a new customer review with verified purchase validation
exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const rating = Number.parseInt(req.body.rating, 10);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }
    if (title.length < 2 || title.length > 120) {
      return res.status(400).json({ message: 'Review headline must be between 2 and 120 characters' });
    }
    if (comment.length < 5 || comment.length > 2000) {
      return res.status(400).json({ message: 'Review comment must be between 5 and 2000 characters' });
    }

    const product = await Product.findById(productId).populate('seller', 'user');
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found or is no longer active' });
    }

    // Prevent sellers from reviewing their own store merchandise
    if (product.seller && String(product.seller.user) === String(req.user._id)) {
      return res.status(403).json({ message: 'Sellers are not permitted to review their own products.' });
    }

    // Check for existing review (enforces one review per product per customer)
    const existing = await Review.findOne({ product: productId, user: req.user._id });
    if (existing) {
      return res.status(409).json({ message: 'You have already reviewed this product. Please edit your existing review.' });
    }

    // Backend Verified Purchase check: Customer must have a Delivered order containing the product
    const eligibleOrder = await Order.findOne({
      user: req.user._id,
      status: 'Delivered',
      'items.product': productId,
    }).sort({ createdAt: -1 });

    if (!eligibleOrder) {
      return res.status(403).json({
        message: 'Verified purchase required. You can only review products that have been delivered to your address.',
      });
    }

    // Process images either from multipart upload or parsed image array
    let images = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      images = req.files.map((f) => ({
        url: `/uploads/reviews/${f.filename}`,
        filename: f.filename,
      }));
    } else if (Array.isArray(req.body.images)) {
      images = req.body.images
        .filter((img) => img && typeof img.url === 'string' && img.url.trim().length > 0)
        .slice(0, 5)
        .map((img) => ({
          url: String(img.url).trim(),
          filename: String(img.filename || '').trim(),
        }));
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: eligibleOrder._id,
      rating,
      title,
      comment,
      images,
      isVerifiedPurchase: true,
      status: 'Published',
    });

    // Recalculate product average rating and distribution
    await Review.calculateAverageRating(productId);

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name')
      .lean();

    res.status(201).json({
      message: 'Thank you! Your verified review has been published.',
      review: {
        ...populatedReview,
        hasHelpfulVoted: false,
        helpfulVotes: undefined,
      },
    });
  } catch (err) {
    console.error('Error in createReview:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this product.' });
    }
    res.status(500).json({ message: err.message || 'Failed to submit review' });
  }
};

// PUT /api/reviews/:id
// Protected - Updates customer's own review
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Enforce review ownership
    if (String(review.user) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not authorized to edit this review' });
    }

    const rating = req.body.rating != null ? Number.parseInt(req.body.rating, 10) : review.rating;
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : review.title;
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : review.comment;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }
    if (title.length < 2 || title.length > 120) {
      return res.status(400).json({ message: 'Review headline must be between 2 and 120 characters' });
    }
    if (comment.length < 5 || comment.length > 2000) {
      return res.status(400).json({ message: 'Review comment must be between 5 and 2000 characters' });
    }

    // Process new uploaded files or updated image list
    let updatedImages = review.images;
    if (Array.isArray(req.files) && req.files.length > 0) {
      const newImages = req.files.map((f) => ({
        url: `/uploads/reviews/${f.filename}`,
        filename: f.filename,
      }));
      updatedImages = [...updatedImages, ...newImages].slice(0, 5);
    } else if (Array.isArray(req.body.images)) {
      // Find removed images and clean them up from disk
      const keptUrls = new Set(req.body.images.map((i) => i.url));
      const removedImages = review.images.filter((img) => !keptUrls.has(img.url));
      deleteReviewImages(removedImages);

      updatedImages = req.body.images
        .filter((img) => img && typeof img.url === 'string' && img.url.trim().length > 0)
        .slice(0, 5)
        .map((img) => ({
          url: String(img.url).trim(),
          filename: String(img.filename || '').trim(),
        }));
    }

    review.rating = rating;
    review.title = title;
    review.comment = comment;
    review.images = updatedImages;
    await review.save();

    await Review.calculateAverageRating(review.product);

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name')
      .lean();

    res.json({
      message: 'Review updated successfully',
      review: {
        ...populatedReview,
        hasHelpfulVoted: (populatedReview.helpfulVotes || []).some((v) => String(v) === String(req.user._id)),
        helpfulVotes: undefined,
      },
    });
  } catch (err) {
    console.error('Error in updateReview:', err);
    res.status(500).json({ message: 'Failed to update review' });
  }
};

// DELETE /api/reviews/:id
// Protected - Deletes customer's own review, or admin deletion
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Customer can delete their own review; Admin can moderate/delete any review
    const isOwner = String(review.user) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to delete this review' });
    }

    const productId = review.product;

    // Remove review images from disk
    if (Array.isArray(review.images) && review.images.length > 0) {
      deleteReviewImages(review.images);
    }

    await review.deleteOne();

    // Recalculate product rating
    await Review.calculateAverageRating(productId);

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error in deleteReview:', err);
    res.status(500).json({ message: 'Failed to delete review' });
  }
};

// POST /api/reviews/:id/helpful
// Protected - Toggles helpful vote for a customer review
exports.toggleHelpfulVote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review || review.status !== 'Published') {
      return res.status(404).json({ message: 'Review not found or is no longer available' });
    }

    // Disallow voting on one's own review
    if (String(review.user) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot vote on your own review' });
    }

    const userIdStr = String(req.user._id);
    const existingIndex = (review.helpfulVotes || []).findIndex((v) => String(v) === userIdStr);

    let hasVoted = false;
    if (existingIndex > -1) {
      // Undo helpful vote
      review.helpfulVotes.splice(existingIndex, 1);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
      hasVoted = false;
    } else {
      // Cast helpful vote
      review.helpfulVotes.push(req.user._id);
      review.helpfulCount = (review.helpfulCount || 0) + 1;
      hasVoted = true;
    }

    await review.save();

    res.json({
      helpfulCount: review.helpfulCount,
      hasHelpfulVoted: hasVoted,
    });
  } catch (err) {
    console.error('Error in toggleHelpfulVote:', err);
    res.status(500).json({ message: 'Failed to update helpful vote' });
  }
};

// POST /api/reviews/upload
// Protected - Standalone endpoint to upload review photos and return validated URLs
exports.uploadReviewPhotos = async (req, res) => {
  try {
    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'Please select at least one image file' });
    }

    const uploaded = req.files.map((file) => ({
      url: `/uploads/reviews/${file.filename}`,
      filename: file.filename,
    }));

    res.json({ images: uploaded });
  } catch (err) {
    console.error('Error in uploadReviewPhotos:', err);
    res.status(500).json({ message: 'Photo upload failed' });
  }
};

// GET /api/reviews/admin
// Admin Only - List all platform reviews with moderation filters and search
exports.adminGetReviews = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && ['Published', 'Hidden', 'Reported'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.rating) {
      const r = Number.parseInt(req.query.rating, 10);
      if (r >= 1 && r <= 5) filter.rating = r;
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { comment: regex }];
    }

    const [reviews, totalCount] = await Promise.all([
      Review.find(filter)
        .populate('product', 'name image price category')
        .populate('user', 'name email')
        .populate('moderatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      reviews,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      totalCount,
    });
  } catch (err) {
    console.error('Error in adminGetReviews:', err);
    res.status(500).json({ message: 'Failed to retrieve admin reviews' });
  }
};

// PATCH /api/reviews/admin/:id/moderate
// Admin Only - Moderates review status (Publish, Hide, Report) with audit record
exports.adminModerateReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const { status, moderationReason = '' } = req.body;
    if (!status || !['Published', 'Hidden', 'Reported'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required: Published, Hidden, or Reported' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.status = status;
    review.moderationReason = String(moderationReason).trim().slice(0, 500);
    review.moderatedBy = req.user._id;
    review.moderatedAt = new Date();
    await review.save();

    // Recalculate average rating since publishing or hiding directly affects the product stats
    await Review.calculateAverageRating(review.product);

    const updated = await Review.findById(id)
      .populate('product', 'name image')
      .populate('user', 'name email')
      .populate('moderatedBy', 'name email')
      .lean();

    res.json({
      message: `Review marked as ${status}`,
      review: updated,
    });
  } catch (err) {
    console.error('Error in adminModerateReview:', err);
    res.status(500).json({ message: 'Failed to moderate review' });
  }
};
