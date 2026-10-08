require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Seller = require('../models/Seller');
const Product = require('../models/Product');
const Order = require('../models/Order');
const SellerTransaction = require('../models/SellerTransaction');

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('--- STARTING COMPLETE SELLER MODULE INTEGRATION TEST ---');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Prepare Admin User & Token
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
  console.log('✓ Admin authenticated:', admin.email);

  // 2. Seller Registration
  const rand = Date.now();
  const sellerEmail = `flipkart_seller_${rand}@example.com`;
  const storeName = `Apex Retailers ${rand}`;
  const sellerPassword = 'SellerSecret123!';

  const regRes = await fetch(`${BASE_URL}/seller/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      email: sellerEmail,
      password: sellerPassword,
      phone: '9876543210',
      storeName,
      storeDescription: 'Premier electronics and smart accessories store.',
      storeAddress: {
        line1: '12 Electronic City Phase 1',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560100',
      },
    }),
  });

  const regData = await regRes.json();
  if (regRes.status !== 201) {
    throw new Error(`Seller registration failed: ${JSON.stringify(regData)}`);
  }
  console.log('✓ Step 1: Seller Registered with status:', regData.seller.status);
  const sellerId = regData.seller._id;

  // 3. Test Seller Login Before Approval (Must be rejected with 403 Pending)
  const preLoginRes = await fetch(`${BASE_URL}/seller/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
  });
  const preLoginData = await preLoginRes.json();
  if (preLoginRes.status === 403 && preLoginData.sellerStatus === 'Pending') {
    console.log('✓ Step 2: Unapproved seller login correctly blocked with Pending notice:', preLoginData.message);
  } else {
    throw new Error(`Expected 403 Pending but got: ${preLoginRes.status} ${JSON.stringify(preLoginData)}`);
  }

  // 4. Admin Approves Seller
  const approveRes = await fetch(`${BASE_URL}/admin/sellers/${sellerId}/status`, {
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
  console.log('✓ Step 3: Admin Approved Seller with commission rate:', approveData.commissionRate + '%');

  // 5. Seller Login After Approval
  const loginRes = await fetch(`${BASE_URL}/seller/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error(`Approved seller login failed: ${JSON.stringify(loginData)}`);
  }
  const sellerToken = loginData.token;
  console.log('✓ Step 4: Seller Logged in successfully. Token received.');

  // 6. Seller Adds a Product
  const addProdRes = await fetch(`${BASE_URL}/seller/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      name: 'Noise Cancelling Studio Headphones',
      description: 'Studio-grade Bluetooth 5.3 headphones with 40h battery life.',
      category: 'Electronics',
      price: 2500,
      discountPercent: 20,
      gstPercent: 18,
      stock: 50,
      deliveryDays: 3,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    }),
  });
  const prodData = await addProdRes.json();
  if (addProdRes.status !== 201 || !prodData._id) {
    throw new Error(`Add product failed: ${JSON.stringify(prodData)}`);
  }
  const productId = prodData._id;
  console.log('✓ Step 5: Seller Product Created: "' + prodData.name + '", Price: ₹' + prodData.price + ', Seller Ref:', prodData.seller);

  // 7. Test Public Seller Storefront
  const storeRes = await fetch(`${BASE_URL}/seller/store/${sellerId}`);
  const storeData = await storeRes.json();
  if (storeRes.status !== 200 || !storeData.seller || storeData.products.length === 0) {
    throw new Error(`Public store fetch failed: ${JSON.stringify(storeData)}`);
  }
  console.log('✓ Step 6: Public Storefront Verified: "' + storeData.seller.storeName + '", Total Listed:', storeData.totalProducts);

  // 8. Customer Registration & Purchase
  const customerEmail = `customer_${rand}@example.com`;
  const custRegRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Karthik Customer',
      email: customerEmail,
      password: 'CustomerPass123!',
    }),
  });
  const custRegData = await custRegRes.json();
  const customerUser = await User.findOne({ email: customerEmail });
  const customerToken = jwt.sign({ id: customerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  console.log('✓ Step 7: Customer registered:', customerEmail);

  // Customer adds product to cart
  const addCartRes = await fetch(`${BASE_URL}/cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  const cartData = await addCartRes.json();
  if (addCartRes.status !== 200 && addCartRes.status !== 201) {
    throw new Error(`Add to cart failed: ${JSON.stringify(cartData)}`);
  }
  console.log('✓ Step 8: Product added to customer cart. Cart total: ₹' + cartData.total);

  // Customer creates order with Cash on Delivery / Pay on Delivery
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shippingAddress: {
        line1: '77 Residency Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560025',
        phone: '9123456789',
      },
      paymentMethod: 'Cash on Delivery',
    }),
  });
  const orderData = await orderRes.json();
  if (orderRes.status !== 201 || !orderData._id) {
    throw new Error(`Order placement failed: ${JSON.stringify(orderData)}`);
  }
  const orderId = orderData._id;
  console.log('✓ Step 8: Customer Order Placed. Order ID:', orderId, 'Total: ₹' + orderData.totalAmount);

  // Verify item seller association
  const dbOrder = await Order.findById(orderId);
  const sellerItem = dbOrder.items.find((i) => i.seller && i.seller.toString() === sellerId.toString());
  if (!sellerItem) {
    throw new Error('Order item seller association missing!');
  }
  console.log('✓ Step 9: Multi-Seller item verified. Seller ID snapshot:', sellerItem.seller, 'Status:', sellerItem.sellerStatus);

  // 9. Seller Views Orders
  const sellerOrdersRes = await fetch(`${BASE_URL}/seller/orders`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const sellerOrdersData = await sellerOrdersRes.json();
  const ordersList = Array.isArray(sellerOrdersData) ? sellerOrdersData : sellerOrdersData.orders || [];
  if (sellerOrdersRes.status !== 200 || ordersList.length === 0) {
    throw new Error(`Seller order retrieval failed: ${JSON.stringify(sellerOrdersData)}`);
  }
  console.log('✓ Step 10: Seller received order in order management portal. Count:', ordersList.length);

  // 10. Seller Updates Order Status Through Pipeline
  const statuses = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];
  for (const status of statuses) {
    const updateRes = await fetch(`${BASE_URL}/seller/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ status }),
    });
    const updateData = await updateRes.json();
    if (updateRes.status !== 200) {
      throw new Error(`Seller update order to ${status} failed: ${JSON.stringify(updateData)}`);
    }
  }
  console.log('✓ Step 11: Seller updated order pipeline: Pending → Confirmed → Packed → Shipped → Delivered');

  // 11. Seller Earnings & Ledger
  const earningsRes = await fetch(`${BASE_URL}/seller/earnings`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const earningsData = await earningsRes.json();
  if (earningsRes.status !== 200 || !earningsData.summary) {
    throw new Error(`Seller earnings retrieval failed: ${JSON.stringify(earningsData)}`);
  }
  console.log('✓ Step 12: Seller Earnings Ledger verified:');
  console.log('    - Gross Sales: ₹' + earningsData.summary.totalSales);
  console.log('    - Commission (' + earningsData.summary.commissionRate + '%): ₹' + earningsData.summary.totalCommission);
  console.log('    - Net Earnings: ₹' + earningsData.summary.netEarnings);
  console.log('    - Transactions count:', earningsData.summary.transactionCount);

  // 12. Security Test: Another Seller Cannot Access This Order
  const otherSellerEmail = `intruder_seller_${rand}@example.com`;
  const otherUser = await User.create({
    name: 'Intruder',
    email: otherSellerEmail,
    password: 'IntruderPass123!',
    role: 'seller',
  });
  const otherSeller = await Seller.create({
    user: otherUser._id,
    name: 'Intruder',
    email: otherSellerEmail,
    phone: '9000000000',
    storeName: `Intruder Store ${rand}`,
    storeAddress: { line1: 'No street', city: 'City', state: 'State', pincode: '123456' },
    status: 'Approved',
  });
  const otherToken = jwt.sign({ id: otherUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Try updating original seller's order with other seller token
  const illegalUpdateRes = await fetch(`${BASE_URL}/seller/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${otherToken}`,
    },
    body: JSON.stringify({ status: 'Delivered' }),
  });
  if (illegalUpdateRes.status === 404) {
    console.log('✓ Step 13: Strict Seller Ownership Security Verified. Unauthorized seller received 404 when trying to update another seller’s order.');
  } else {
    throw new Error(`Security breach! Other seller received status: ${illegalUpdateRes.status}`);
  }

  // Cleanup test documents
  await Promise.all([
    Product.findByIdAndDelete(productId),
    Order.findByIdAndDelete(orderId),
    SellerTransaction.deleteMany({ seller: sellerId }),
    Seller.findByIdAndDelete(sellerId),
    Seller.findByIdAndDelete(otherSeller._id),
    User.findByIdAndDelete(customerUser._id),
    User.findByIdAndDelete(otherUser._id),
  ]);
  console.log('✓ Cleanup completed.');

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
