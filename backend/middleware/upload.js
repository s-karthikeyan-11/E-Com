const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Secure upload directory in backend/uploads/reviews
const uploadDir = path.join(__dirname, '..', 'uploads', 'reviews');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage engine with sanitized, collision-resistant filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `review-${uniqueSuffix}${ext}`);
  },
});

// Strict MIME and extension validation
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type. Only JPG, JPEG, PNG, and WebP images are permitted.');
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // max 5 files
  },
  fileFilter,
});

// Wrapper middleware to intercept and normalize multer errors
const handleReviewUpload = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Each photo must be under 5MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ message: 'Maximum 5 photos allowed per review.' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(err.status || 400).json({ message: err.message || 'File upload failed.' });
    }
    next();
  });
};

// Safe image deletion helper to prevent orphaned files
const deleteReviewImages = (images = []) => {
  if (!Array.isArray(images)) return;
  for (const img of images) {
    const filename = typeof img === 'string' ? path.basename(img) : img?.filename;
    if (filename && /^[a-zA-Z0-9_\-.]+$/.test(filename)) {
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to unlink review image:', filePath, e);
        }
      }
    }
  }
};

module.exports = {
  handleReviewUpload,
  deleteReviewImages,
  uploadDir,
};
