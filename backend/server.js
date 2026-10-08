require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getClientOrigins, validateEnvironment } = require('./config/env');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const addressRoutes = require('./routes/addressRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');

const app = express();
const configuredClientOrigins = getClientOrigins();
const isProduction = process.env.NODE_ENV === 'production';

const createRateLimiter = ({ limit, message }) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { message },
});

const apiLimiter = createRateLimiter({
  limit: Number.parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10),
  message: 'Too many requests. Please try again later.',
});
const authLimiter = createRateLimiter({
  limit: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    const allowLocalDevelopment = !isProduction && isLocalDevelopmentOrigin;
    if (!origin || configuredClientOrigins.includes(origin) || allowLocalDevelopment) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('Origin is not allowed by CORS'), { status: 403, expose: true }));
  },
  credentials: true,
  maxAge: 86400,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/delivery', deliveryRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Central error handler (catches anything thrown outside try/catch)
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  const message = err.type === 'entity.parse.failed'
    ? 'Invalid JSON request body'
    : err.type === 'entity.too.large'
      ? 'Request body is too large'
      : status < 500 && err.expose
        ? err.message
        : 'Server error';
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ message });
});

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  validateEnvironment();
  await connectDB();

  // Wait for the listener explicitly so an occupied port is reported through
  // startServer's normal error path rather than as an unhandled EventEmitter error.
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(PORT);
    const onError = (err) => {
      instance.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      instance.off('error', onError);
      resolve(instance);
    };
    instance.once('error', onError);
    instance.once('listening', onListening);
  });
  console.log(`Server running on port ${PORT}`);
  const shutdown = (signal) => {
    console.log(`${signal} received; closing server`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };
