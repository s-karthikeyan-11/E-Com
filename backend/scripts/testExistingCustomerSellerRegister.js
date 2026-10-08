require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');

const BASE_URL = 'http://localhost:5000/api';

async function testExistingCustomerSellerRegistration() {
  console.log('--- TESTING EXISTING CUSTOMER SELLER REGISTRATION ---');
  await mongoose.connect(process.env.MONGO_URI);

  const rand = Date.now();
  const customerEmail = `existing_customer_${rand}@example.com`;
  const customerPassword = 'CustomerSecurePassword123!';
  const customerName = 'Priya Customer';

  // 1. Create an existing customer account
  const customerUser = await User.create({
    name: customerName,
    email: customerEmail,
    password: customerPassword,
    role: 'user',
  });
  console.log('✓ Step 1: Existing customer created with role:', customerUser.role, customerEmail);

  // 2. Try registering as seller with WRONG password
  const storeName = `Priya Fashions ${rand}`;
  const wrongPassRes = await fetch(`${BASE_URL}/seller/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: customerName,
      email: customerEmail,
      password: 'WrongPassword999!',
      phone: '9811223344',
      storeName,
      storeDescription: 'Authentic handcrafted fashion & apparel.',
      storeAddress: {
        line1: '88 Commercial Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    }),
  });

  const wrongPassData = await wrongPassRes.json();
  if (wrongPassRes.status === 401) {
    console.log('✓ Step 2: Wrong password correctly rejected with 401 and ownership notice:');
    console.log('   Message:', wrongPassData.message);
  } else {
    throw new Error(`Expected 401 for wrong password, but got: ${wrongPassRes.status} ${JSON.stringify(wrongPassData)}`);
  }

  // 3. Register as seller with CORRECT password
  const correctPassRes = await fetch(`${BASE_URL}/seller/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: customerName,
      email: customerEmail,
      password: customerPassword,
      phone: '9811223344',
      storeName,
      storeDescription: 'Authentic handcrafted fashion & apparel.',
      storeAddress: {
        line1: '88 Commercial Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    }),
  });

  const correctPassData = await correctPassRes.json();
  if (correctPassRes.status === 201 && correctPassData.seller?.status === 'Pending') {
    console.log('✓ Step 3: Existing customer successfully upgraded to seller!');
    console.log('   Seller status:', correctPassData.seller.status);
    console.log('   User role:', correctPassData.user.role);
    console.log('   Message:', correctPassData.message);
  } else {
    throw new Error(`Expected 201 for correct password, but got: ${correctPassRes.status} ${JSON.stringify(correctPassData)}`);
  }

  // Verify DB state
  const updatedUser = await User.findById(customerUser._id);
  const createdSeller = await Seller.findOne({ user: customerUser._id });
  if (updatedUser.role !== 'seller' || !createdSeller) {
    throw new Error('Database verification failed! User role or seller document not linked properly.');
  }
  console.log('✓ Step 4: DB verified. User role:', updatedUser.role, 'Linked seller ID:', createdSeller._id);

  // 4. Try re-registering while Pending
  const duplicateRes = await fetch(`${BASE_URL}/seller/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: customerName,
      email: customerEmail,
      password: customerPassword,
      phone: '9811223344',
      storeName: `Another Store ${rand}`,
      storeAddress: {
        line1: '88 Commercial Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    }),
  });

  const duplicateData = await duplicateRes.json();
  if (duplicateRes.status === 409 && duplicateData.sellerStatus === 'Pending') {
    console.log('✓ Step 5: Duplicate registration while Pending prevented with 409 notice:');
    console.log('   Message:', duplicateData.message);
  } else {
    throw new Error(`Expected 409 for duplicate registration, got: ${duplicateRes.status} ${JSON.stringify(duplicateData)}`);
  }

  // 5. Admin Approves the Seller
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: `admin_${Date.now()}@example.com`,
      password: 'AdminPassword123!',
      role: 'admin',
    });
  }
  const adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const approveRes = await fetch(`${BASE_URL}/admin/sellers/${createdSeller._id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'Approved', commissionRate: 10 }),
  });
  const approveData = await approveRes.json();
  if (approveRes.status !== 200 || approveData.status !== 'Approved') {
    throw new Error(`Admin approval failed: ${JSON.stringify(approveData)}`);
  }
  console.log('✓ Step 6: Admin approved seller:', approveData.storeName);

  // 6. Seller logs into Seller Hub
  const loginRes = await fetch(`${BASE_URL}/seller/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: customerEmail, password: customerPassword }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error(`Seller login failed: ${JSON.stringify(loginData)}`);
  }
  console.log('✓ Step 7: Upgraded seller successfully logged into Seller Hub!');

  // Cleanup test documents
  await Promise.all([
    Seller.findByIdAndDelete(createdSeller._id),
    User.findByIdAndDelete(customerUser._id),
  ]);
  console.log('✓ Cleanup completed.');

  console.log('\n======================================================');
  console.log('🎉 EXISTING CUSTOMER SELLER REGISTRATION TEST PASSED!');
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

testExistingCustomerSellerRegistration().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
