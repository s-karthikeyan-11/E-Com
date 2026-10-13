const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Eligible delivered order reference is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer from 1 to 5',
      },
    },
    title: {
      type: String,
      required: [true, 'Review headline is required'],
      trim: true,
      minlength: [2, 'Headline must be at least 2 characters'],
      maxlength: [120, 'Headline cannot exceed 120 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [5, 'Review comment must be at least 5 characters'],
      maxlength: [2000, 'Review comment cannot exceed 2000 characters'],
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          filename: { type: String, default: '' },
        },
      ],
      validate: {
        validator: (val) => Array.isArray(val) && val.length <= 5,
        message: 'A maximum of 5 photos can be uploaded per review',
      },
      default: [],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    helpfulVotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Published', 'Hidden', 'Reported'],
      default: 'Published',
      index: true,
    },
    moderationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Moderation reason cannot exceed 500 characters'],
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Enforce one review per customer per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
// Optimize filtered and sorted queries on product review feeds
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ product: 1, status: 1, helpfulCount: -1 });
reviewSchema.index({ product: 1, status: 1, rating: -1 });

// Static method to recalculate product rating aggregate and distribution
reviewSchema.statics.calculateAverageRating = async function (productId) {
  const Product = mongoose.model('Product');
  const targetId = typeof productId === 'string' ? new mongoose.Types.ObjectId(productId) : productId;

  const stats = await this.aggregate([
    {
      $match: {
        product: targetId,
        status: 'Published',
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
        star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      },
    },
  ]);

  if (stats.length > 0) {
    const s = stats[0];
    const roundedAvg = Math.round(s.averageRating * 10) / 10;
    await Product.findByIdAndUpdate(targetId, {
      $set: {
        rating: roundedAvg,
        numReviews: s.numReviews,
        ratingDistribution: {
          5: s.star5 || 0,
          4: s.star4 || 0,
          3: s.star3 || 0,
          2: s.star2 || 0,
          1: s.star1 || 0,
        },
      },
    });
    return {
      rating: roundedAvg,
      numReviews: s.numReviews,
      ratingDistribution: {
        5: s.star5 || 0,
        4: s.star4 || 0,
        3: s.star3 || 0,
        2: s.star2 || 0,
        1: s.star1 || 0,
      },
    };
  } else {
    await Product.findByIdAndUpdate(targetId, {
      $set: {
        rating: 0,
        numReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    });
    return {
      rating: 0,
      numReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
};

module.exports = mongoose.model('Review', reviewSchema);
