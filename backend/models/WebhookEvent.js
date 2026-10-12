const mongoose = require('mongoose');

// Stores only delivery metadata and a payload digest. Raw gateway payloads can
// contain customer information and are intentionally not persisted here.
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['Razorpay'], required: true },
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    payloadDigest: { type: String, required: true },
    paymentId: { type: String, default: '', index: true },
    providerOrderId: { type: String, default: '', index: true },
    status: { type: String, enum: ['Processing', 'Processed', 'Failed'], default: 'Processing', index: true },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
