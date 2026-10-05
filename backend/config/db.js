const mongoose = require('mongoose');

const connectDB = async () => {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
};

module.exports = connectDB;
