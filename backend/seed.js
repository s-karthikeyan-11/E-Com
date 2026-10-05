// One-time script: creates an admin account and a few sample products.
// Run with: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Product = require('./models/Product');

const run = async () => {
  await connectDB();

  const isProduction = process.env.NODE_ENV === 'production';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || (isProduction ? '' : 'admin@example.com');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (isProduction ? '' : 'admin123');
  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required in production');
  }
  if (isProduction && adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters in production');
  }

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });
    console.log(`Created admin account: ${adminEmail}`);
  } else {
    console.log('Admin already exists');
  }

  const count = await Product.countDocuments();
  if (count === 0) {
    await Product.insertMany([
      { name: 'Wireless Mouse', category: 'Electronics', price: 799, discountPercent: 10, gstPercent: 18, stock: 40, lowStockThreshold: 10 },
      { name: 'Mechanical Keyboard', category: 'Electronics', price: 2999, discountPercent: 15, gstPercent: 18, stock: 20, lowStockThreshold: 5 },
      { name: 'Cotton T-Shirt', category: 'Apparel', price: 499, discountPercent: 5, gstPercent: 5, stock: 100, lowStockThreshold: 15 },
      { name: 'Running Shoes', category: 'Footwear', price: 2499, discountPercent: 20, gstPercent: 12, stock: 4, lowStockThreshold: 5 },
      { name: 'Coffee Mug', category: 'Home', price: 299, discountPercent: 0, gstPercent: 12, stock: 60, lowStockThreshold: 10 },
    ]);
    console.log('Seeded sample products');
  } else {
    console.log('Products already exist, skipping');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
