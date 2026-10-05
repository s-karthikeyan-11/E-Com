// One-time, repeatable data migration for databases created by an older
// version that stored customer accounts with the unsupported `seller` role.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const run = async () => {
  await connectDB();

  const result = await User.updateMany(
    { role: 'seller' },
    { $set: { role: 'user' } },
    { runValidators: true }
  );

  console.log(`Normalized ${result.modifiedCount} legacy seller role(s) to user.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Role migration failed:', err.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
