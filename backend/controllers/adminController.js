const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

const errorStatus = (err) => (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);

// GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalOrders, salesSummary, lowStockProducts, statusCounts] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments(),
      Order.countDocuments({ status: mongoose.trusted({ $ne: 'Awaiting Payment' }) }),
      Order.aggregate([
        { $match: { status: 'Delivered' } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
      ]),
      Product.aggregate([
        { $match: { $expr: { $lte: ['$stock', '$lowStockThreshold'] } } },
        { $project: { name: 1, stock: 1, lowStockThreshold: 1 } },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const totalSales = salesSummary[0]?.totalSales || 0;

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalSales: +totalSales.toFixed(2),
      lowStockProducts,
      ordersByStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to load dashboard' });
  }
};

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password -cart').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch users' });
  }
};

// PUT /api/admin/users/:id/block  { isBlocked }
exports.setUserBlocked = async (req, res) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ message: 'isBlocked must be a boolean' });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'user' },
      { isBlocked },
      { new: true }
    ).select('-password -cart');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to update user' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (await Order.exists({ user: user._id })) {
      return res.status(409).json({ message: 'Users with order history cannot be deleted; block the account instead' });
    }
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to delete user' });
  }
};

// ---------- Analytics / Payments / Reports ----------

const REVENUE_MATCH = { status: { $nin: ['Awaiting Payment', 'Cancelled'] } };

// Report dates are store calendar dates, never the server machine's local time.
// This avoids a sale close to midnight being assigned to a different business day.
const REPORT_TIMEZONE = process.env.STORE_TIMEZONE || 'Asia/Kolkata';
const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const reportDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

const datePartsInStoreZone = (date) => Object.fromEntries(
  reportDateFormatter.formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value])
);

const todayInStoreZone = () => {
  const parts = datePartsInStoreZone(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const addCalendarDays = (day, days) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Converts a store-local calendar boundary to UTC using the configured timezone.
const storeBoundary = (day, endOfDay = false) => {
  if (!REPORT_DATE_PATTERN.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, date, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  const guessed = new Date(desired);
  const actual = datePartsInStoreZone(guessed);
  const observed = Date.UTC(
    Number(actual.year), Number(actual.month) - 1, Number(actual.day),
    Number(actual.hour || 0), Number(actual.minute || 0), Number(actual.second || 0)
  );
  const offsetAtGuess = observed - desired;
  const boundary = new Date(desired - offsetAtGuess);
  return Number.isNaN(boundary.getTime()) ? null : boundary;
};

const parseRange = (query) => {
  const toDay = typeof query.to === 'string' ? query.to : todayInStoreZone();
  const fromDay = typeof query.from === 'string' ? query.from : addCalendarDays(toDay, -29);
  if (!REPORT_DATE_PATTERN.test(fromDay) || !REPORT_DATE_PATTERN.test(toDay) || fromDay > toDay) return null;
  const from = storeBoundary(fromDay);
  const to = storeBoundary(toDay, true);
  if (!from || !to) return null;
  return { from, to, fromDay, toDay };
};

const round2 = (n) => +Number(n || 0).toFixed(2);

// GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD  (data for dashboard graphs)
exports.getAnalytics = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ message: 'Invalid date range' });
    const dateMatch = { createdAt: { $gte: range.from, $lte: range.to } };

    const [daily, byStatus, byMethod, topProducts] = await Promise.all([
      Order.aggregate([
        { $match: { ...dateMatch, ...REVENUE_MATCH } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([{ $match: dateMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...dateMatch, ...REVENUE_MATCH } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Order.aggregate([
        { $match: { ...dateMatch, ...REVENUE_MATCH } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.lineTotal' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Fill days with no orders so the line chart has a continuous x-axis.
    const dailyMap = new Map(daily.map((d) => [d._id, d]));
    const series = [];
    for (let d = new Date(range.from); d <= range.to; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      series.push({ date: key, revenue: round2(row?.revenue), orders: row?.orders || 0 });
    }

    res.json({
      from: range.from,
      to: range.to,
      salesByDay: series,
      ordersByStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      paymentMethods: byMethod.map((m) => ({ method: m._id, count: m.count, amount: round2(m.amount) })),
      topProducts: topProducts.map((p) => ({ name: p._id, quantity: p.quantity, revenue: round2(p.revenue) })),
    });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to load analytics' });
  }
};

// GET /api/admin/payments?status=&method=&from=&to=
exports.getPayments = async (req, res) => {
  try {
    const { status, method } = req.query;
    const filter = {};
    if (status) {
      if (!['Pending', 'Paid', 'Failed'].includes(status)) return res.status(400).json({ message: 'Invalid payment status' });
      filter.paymentStatus = status;
    }
    if (method) {
      if (typeof method !== 'string') return res.status(400).json({ message: 'Invalid payment method' });
      filter.paymentMethod = method;
    }
    if (req.query.from || req.query.to) {
      const range = parseRange(req.query);
      if (!range) return res.status(400).json({ message: 'Invalid date range' });
      filter.createdAt = mongoose.trusted({ $gte: range.from, $lte: range.to });
    }

    const [payments, summary] = await Promise.all([
      Order.find(filter)
        .select('user totalAmount paymentMethod paymentStatus razorpayOrderId razorpayPaymentId paidAt status createdAt')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(500),
      Order.aggregate([
        { $match: filter },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const pick = (s) => summary.find((x) => x._id === s) || { count: 0, amount: 0 };
    res.json({
      payments,
      summary: {
        paid: { count: pick('Paid').count, amount: round2(pick('Paid').amount) },
        pending: { count: pick('Pending').count, amount: round2(pick('Pending').amount) },
        failed: { count: pick('Failed').count, amount: round2(pick('Failed').amount) },
      },
    });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to fetch payments' });
  }
};

// GET /api/admin/report?from=&to=  (data used to build the downloadable PDF)
exports.getReport = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ message: 'Invalid date range' });

    const orders = await Order.find({
      createdAt: mongoose.trusted({ $gte: range.from, $lte: range.to }),
      status: mongoose.trusted({ $ne: 'Awaiting Payment' }),
    })
      .select('user items totalAmount totalGst deliveryFee paymentMethod paymentStatus status createdAt')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(2000);

    const revenueOrders = orders.filter((o) => o.status !== 'Cancelled');
    const sum = (arr, key) => round2(arr.reduce((t, o) => t + (o[key] || 0), 0));
    const byStatus = {};
    const byMethod = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });
    revenueOrders.forEach((o) => {
      byMethod[o.paymentMethod] = round2((byMethod[o.paymentMethod] || 0) + o.totalAmount);
    });

    res.json({
      from: range.from,
      to: range.to,
      generatedAt: new Date(),
      summary: {
        totalOrders: orders.length,
        revenue: sum(revenueOrders, 'totalAmount'),
        gst: sum(revenueOrders, 'totalGst'),
        paidOnline: round2(orders.filter((o) => o.paymentStatus === 'Paid').reduce((t, o) => t + o.totalAmount, 0)),
        cancelled: byStatus.Cancelled || 0,
        byStatus,
        byMethod,
      },
      orders: orders.map((o) => ({
        id: o._id,
        date: o.createdAt,
        customer: o.user?.name || 'Deleted user',
        email: o.user?.email || '',
        items: o.items.map((i) => `${i.name} x${i.quantity}`).join(', '),
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        status: o.status,
      })),
    });
  } catch (err) {
    res.status(errorStatus(err)).json({ message: 'Failed to build report' });
  }
};

// ---------- Complete reports workspace ----------

const REPORT_STATUSES = ['Awaiting Payment', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const REPORT_PAYMENT_METHODS = ['UPI', 'Credit/Debit Card', 'Net Banking', 'Razorpay', 'Cash on Delivery'];
const DEFAULT_PAGE_SIZE = 25;
const MAX_REPORT_PAGE_SIZE = 10000;

const reportNumber = (value) => round2(value || 0);
const objectIdString = (value) => (value ? String(value) : '');

const getStringFilter = (value, maxLength = 80) => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value.trim();
};

const getPage = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const sumItems = (field) => ({
  $sum: {
    $map: {
      input: '$__reportScopeItems',
      as: 'item',
      in: { $ifNull: [`$$item.${field}`, 0] },
    },
  },
});

const scopedOrdersPipeline = (match, category) => {
  const categoryExpression = category
    ? {
        $filter: {
          input: '$__reportItems',
          as: 'item',
          cond: { $eq: ['$$item.__reportCategory', category] },
        },
      }
    : '$__reportItems';

  return [
    { $match: match },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'items.product',
        foreignField: '_id',
        as: '__reportProducts',
      },
    },
    {
      $set: {
        __reportItems: {
          $map: {
            input: '$items',
            as: 'item',
            in: {
              $let: {
                vars: {
                  product: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$__reportProducts',
                          as: 'product',
                          cond: { $eq: ['$$product._id', '$$item.product'] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  $mergeObjects: [
                    '$$item',
                    {
                      __reportCategory: {
                        $ifNull: ['$$item.category', { $ifNull: ['$$product.category', 'Uncategorised'] }],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    { $set: { __reportScopeItems: categoryExpression } },
    { $match: { $expr: { $gt: [{ $size: '$__reportScopeItems' }, 0] } } },
    {
      $set: {
        __reportAllLineTotal: {
          $sum: {
            $map: {
              input: '$__reportItems', as: 'item', in: { $ifNull: ['$$item.lineTotal', 0] },
            },
          },
        },
        __reportScopeLineTotal: sumItems('lineTotal'),
        __reportScopeBase: {
          $sum: {
            $map: {
              input: '$__reportScopeItems',
              as: 'item',
              in: { $multiply: [{ $ifNull: ['$$item.price', 0] }, { $ifNull: ['$$item.quantity', 0] }] },
            },
          },
        },
        __reportScopeProductDiscount: {
          $sum: {
            $map: {
              input: '$__reportScopeItems',
              as: 'item',
              in: {
                $multiply: [
                  { $ifNull: ['$$item.price', 0] },
                  { $ifNull: ['$$item.quantity', 0] },
                  { $divide: [{ $ifNull: ['$$item.discountPercent', 0] }, 100] },
                ],
              },
            },
          },
        },
        __reportCostTracked: {
          $allElementsTrue: {
            $map: {
              input: '$__reportScopeItems',
              as: 'item',
              in: { $ne: [{ $ifNull: ['$$item.unitCost', null] }, null] },
            },
          },
        },
        __reportScopeCost: {
          $sum: {
            $map: {
              input: '$__reportScopeItems',
              as: 'item',
              in: {
                $multiply: [{ $ifNull: ['$$item.unitCost', 0] }, { $ifNull: ['$$item.quantity', 0] }],
              },
            },
          },
        },
      },
    },
    {
      $set: {
        __reportScopeGst: { $subtract: ['$__reportScopeLineTotal', { $subtract: ['$__reportScopeBase', '$__reportScopeProductDiscount'] }] },
        __reportScopeCouponDiscount: {
          $cond: [
            { $gt: ['$__reportAllLineTotal', 0] },
            { $multiply: [{ $ifNull: ['$couponDiscount', 0] }, { $divide: ['$__reportScopeLineTotal', '$__reportAllLineTotal'] }] },
            0,
          ],
        },
        __reportScopeDeliveryFee: {
          $cond: [
            { $gt: ['$__reportAllLineTotal', 0] },
            { $multiply: [{ $ifNull: ['$deliveryFee', 0] }, { $divide: ['$__reportScopeLineTotal', '$__reportAllLineTotal'] }] },
            0,
          ],
        },
        __reportGatewayFeeKnown: {
          $or: [
            { $eq: ['$paymentMethod', 'Cash on Delivery'] },
            { $ne: [{ $ifNull: ['$paymentGatewayFee', null] }, null] },
          ],
        },
      },
    },
    {
      $set: {
        __reportScopeAmount: {
          $add: [
            { $subtract: ['$__reportScopeLineTotal', '$__reportScopeCouponDiscount'] },
            '$__reportScopeDeliveryFee',
          ],
        },
        __reportScopeGatewayFee: {
          $cond: [
            { $gt: ['$__reportAllLineTotal', 0] },
            { $multiply: [{ $ifNull: ['$paymentGatewayFee', 0] }, { $divide: ['$__reportScopeLineTotal', '$__reportAllLineTotal'] }] },
            0,
          ],
        },
      },
    },
    {
      $set: {
        // COD is counted only once delivery has marked it Paid. Failed/pending
        // online checkouts and cancelled orders never become revenue.
        __reportIsSettledSale: {
          $and: [
            { $eq: ['$paymentStatus', 'Paid'] },
            { $ne: ['$status', 'Cancelled'] },
            { $ne: ['$status', 'Awaiting Payment'] },
          ],
        },
        __reportRefundAmount: {
          $cond: [
            { $and: [{ $ne: [{ $ifNull: ['$walletRefund.amount', null] }, null] }, { $gt: ['$totalAmount', 0] }] },
            { $multiply: ['$walletRefund.amount', { $divide: ['$__reportScopeAmount', '$totalAmount'] }] },
            0,
          ],
        },
      },
    },
  ];
};

const reportFacets = (page, limit) => ({
  overview: [
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        settledOrders: { $sum: { $cond: ['$__reportIsSettledSale', 1, 0] } },
        totalSales: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeLineTotal', 0] } },
        totalRevenue: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } },
        grossProductValue: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeBase', 0] } },
        productDiscount: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeProductDiscount', 0] } },
        couponDiscount: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeCouponDiscount', 0] } },
        gstCollected: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeGst', 0] } },
        deliveryCharges: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeDeliveryFee', 0] } },
        productCost: {
          $sum: {
            $cond: [{ $and: ['$__reportIsSettledSale', '$__reportCostTracked'] }, '$__reportScopeCost', 0],
          },
        },
        gatewayFees: {
          $sum: {
            $cond: [{ $and: ['$__reportIsSettledSale', '$__reportGatewayFeeKnown'] }, '$__reportScopeGatewayFee', 0],
          },
        },
        settledWithCost: { $sum: { $cond: [{ $and: ['$__reportIsSettledSale', '$__reportCostTracked'] }, 1, 0] } },
        settledWithGatewayFee: { $sum: { $cond: [{ $and: ['$__reportIsSettledSale', '$__reportGatewayFeeKnown'] }, 1, 0] } },
        refundAmount: { $sum: '$__reportRefundAmount' },
        refundedOrders: { $sum: { $cond: [{ $gt: ['$__reportRefundAmount', 0] }, 1, 0] } },
      },
    },
  ],
  statuses: [
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$__reportScopeAmount' } } },
  ],
  payments: [
    {
      $group: {
        _id: { method: '$paymentMethod', status: '$paymentStatus' },
        count: { $sum: 1 },
        amount: { $sum: '$__reportScopeAmount' },
        refunds: { $sum: '$__reportRefundAmount' },
      },
    },
  ],
  daily: [
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TIMEZONE } },
        sales: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } },
        orders: { $sum: { $cond: ['$__reportIsSettledSale', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ],
  monthly: [
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: REPORT_TIMEZONE } },
        sales: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } },
        orders: { $sum: { $cond: ['$__reportIsSettledSale', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ],
  categories: [
    { $match: { __reportIsSettledSale: true } },
    { $unwind: '$__reportScopeItems' },
    {
      $group: {
        _id: '$__reportScopeItems.__reportCategory',
        quantity: { $sum: '$__reportScopeItems.quantity' },
        revenue: {
          $sum: {
            $cond: [
              '$__reportIsSettledSale',
              {
                $cond: [
                  { $gt: ['$__reportScopeLineTotal', 0] },
                  { $multiply: ['$__reportScopeAmount', { $divide: ['$__reportScopeItems.lineTotal', '$__reportScopeLineTotal'] }] },
                  0,
                ],
              },
              0,
            ],
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
  ],
  products: [
    { $match: { __reportIsSettledSale: true } },
    { $unwind: '$__reportScopeItems' },
    {
      $group: {
        _id: { product: '$__reportScopeItems.product', name: '$__reportScopeItems.name' },
        quantity: { $sum: '$__reportScopeItems.quantity' },
        revenue: {
          $sum: {
            $cond: [
              '$__reportIsSettledSale',
              {
                $cond: [
                  { $gt: ['$__reportScopeLineTotal', 0] },
                  { $multiply: ['$__reportScopeAmount', { $divide: ['$__reportScopeItems.lineTotal', '$__reportScopeLineTotal'] }] },
                  0,
                ],
              },
              0,
            ],
          },
        },
      },
    },
    { $sort: { revenue: -1, quantity: -1 } },
    { $limit: 50 },
  ],
  customerStats: [
    {
      $group: {
        _id: '$user',
        orderCount: { $sum: 1 },
        settledOrderCount: { $sum: { $cond: ['$__reportIsSettledSale', 1, 0] } },
        spending: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: '__customer',
      },
    },
    { $unwind: { path: '$__customer', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        repeatCustomers: { $sum: { $cond: [{ $gte: ['$orderCount', 2] }, 1, 0] } },
        activeCustomers: { $sum: { $cond: [{ $gt: ['$settledOrderCount', 0] }, 1, 0] } },
      },
    },
  ],
  topCustomers: [
    {
      $group: {
        _id: '$user',
        orderCount: { $sum: 1 },
        spending: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } },
      },
    },
    { $sort: { spending: -1, orderCount: -1 } },
    { $limit: 10 },
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', as: '__customer' } },
    { $unwind: { path: '$__customer', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, customerId: '$_id', name: '$__customer.name', email: '$__customer.email', orderCount: 1, spending: 1 } },
  ],
  orders: [
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: '__customer' } },
    { $unwind: { path: '$__customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1, createdAt: 1, status: 1, paymentStatus: 1, paymentMethod: 1, paidAt: 1,
        razorpayOrderId: 1, razorpayPaymentId: 1, walletRefund: 1, totalAmount: 1,
        reportAmount: '$__reportScopeAmount', items: '$__reportScopeItems',
        customer: { name: '$__customer.name', email: '$__customer.email' },
      },
    },
  ],
  orderCount: [{ $count: 'count' }],
});

const buildDailySeries = (rows, range) => {
  const byDay = new Map(rows.map((row) => [row._id, row]));
  const days = [];
  for (let day = range.fromDay; day <= range.toDay; day = addCalendarDays(day, 1)) {
    const row = byDay.get(day);
    days.push({ date: day, sales: reportNumber(row?.sales), orders: row?.orders || 0 });
  }
  return days;
};

const salesForRange = async (match, category) => {
  const [result] = await Order.aggregate([
    ...scopedOrdersPipeline(match, category),
    { $group: { _id: null, revenue: { $sum: { $cond: ['$__reportIsSettledSale', '$__reportScopeAmount', 0] } } } },
  ]);
  return reportNumber(result?.revenue);
};

// GET /api/admin/reports?from=&to=&category=&paymentMethod=&orderStatus=&page=&limit=
// All financial figures use only successfully collected, non-cancelled orders.
exports.getReports = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ message: 'Use a valid date range (YYYY-MM-DD), with from on or before to.' });

    const category = getStringFilter(req.query.category, 60);
    const paymentMethod = getStringFilter(req.query.paymentMethod, 40);
    const orderStatus = getStringFilter(req.query.orderStatus, 40);
    if (category === null || paymentMethod === null || orderStatus === null) {
      return res.status(400).json({ message: 'One or more report filters are invalid.' });
    }
    if (paymentMethod && !REPORT_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method filter.' });
    }
    if (orderStatus && !REPORT_STATUSES.includes(orderStatus)) {
      return res.status(400).json({ message: 'Invalid order status filter.' });
    }

    const page = getPage(req.query.page, 1);
    const requestedLimit = getPage(req.query.limit, DEFAULT_PAGE_SIZE);
    const limit = Math.min(requestedLimit, MAX_REPORT_PAGE_SIZE);
    const match = { createdAt: mongoose.trusted({ $gte: range.from, $lte: range.to }) };
    if (paymentMethod) match.paymentMethod = paymentMethod;
    if (orderStatus) match.status = orderStatus;

    const previousEnd = addCalendarDays(range.fromDay, -1);
    const rangeDays = Math.round((new Date(`${range.toDay}T00:00:00.000Z`).getTime() - new Date(`${range.fromDay}T00:00:00.000Z`).getTime()) / 86400000) + 1;
    const previousStart = addCalendarDays(previousEnd, -(rangeDays - 1));
    const previousMatch = {
      ...match,
      createdAt: mongoose.trusted({ $gte: storeBoundary(previousStart), $lte: storeBoundary(previousEnd, true) }),
    };

    const [result, previousRevenue, categories, inventory, newCustomers] = await Promise.all([
      Order.aggregate([...scopedOrdersPipeline(match, category), { $facet: reportFacets(page, limit) }]),
      salesForRange(previousMatch, category),
      Product.distinct('category').then((items) => items.filter(Boolean).sort((a, b) => a.localeCompare(b))),
      Product.aggregate([
        ...(category ? [{ $match: { category } }] : []),
        {
          $facet: {
            lowStock: [
              { $match: { $expr: { $lte: ['$stock', '$lowStockThreshold'] } } },
              { $project: { name: 1, category: 1, stock: 1, lowStockThreshold: 1 } },
              { $sort: { stock: 1, name: 1 } }, { $limit: 10 },
            ],
            outOfStock: [
              { $match: { stock: 0 } }, { $project: { name: 1, category: 1, stock: 1 } },
              { $sort: { name: 1 } }, { $limit: 10 },
            ],
          },
        },
      ]),
      User.countDocuments({ role: 'user', createdAt: mongoose.trusted({ $gte: range.from, $lte: range.to }) }),
    ]);

    const data = result[0] || {};
    const overview = data.overview?.[0] || {};
    const statusRows = data.statuses || [];
    const statusCounts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    const paymentRows = data.payments || [];
    const paidRows = paymentRows.filter((row) => row._id.status === 'Paid');
    const paymentSummary = {
      successful: {
        count: paidRows.reduce((total, row) => total + row.count, 0),
        amount: reportNumber(paidRows.reduce((total, row) => total + row.amount, 0)),
      },
      failed: {
        count: paymentRows.filter((row) => row._id.status === 'Failed').reduce((total, row) => total + row.count, 0),
        amount: reportNumber(paymentRows.filter((row) => row._id.status === 'Failed').reduce((total, row) => total + row.amount, 0)),
      },
      pending: {
        count: paymentRows.filter((row) => row._id.status === 'Pending').reduce((total, row) => total + row.count, 0),
        amount: reportNumber(paymentRows.filter((row) => row._id.status === 'Pending').reduce((total, row) => total + row.amount, 0)),
      },
      codCollection: reportNumber(paidRows.filter((row) => row._id.method === 'Cash on Delivery').reduce((total, row) => total + row.amount, 0)),
      onlineCollection: reportNumber(paidRows.filter((row) => row._id.method !== 'Cash on Delivery').reduce((total, row) => total + row.amount, 0)),
    };

    const settledOrders = overview.settledOrders || 0;
    const costComplete = settledOrders === (overview.settledWithCost || 0);
    const feesComplete = settledOrders === (overview.settledWithGatewayFee || 0);
    const profitAvailable = settledOrders > 0 && costComplete && feesComplete;
    const totalRevenue = reportNumber(overview.totalRevenue);
    const gstCollected = reportNumber(overview.gstCollected);
    const productCost = reportNumber(overview.productCost);
    const gatewayFees = reportNumber(overview.gatewayFees);
    const estimatedNetProfit = profitAvailable ? reportNumber(totalRevenue - gstCollected - productCost - gatewayFees) : null;
    const growth = previousRevenue > 0
      ? reportNumber(((totalRevenue - previousRevenue) / previousRevenue) * 100)
      : null;
    const products = (data.products || []).map((row) => ({
      id: objectIdString(row._id.product), name: row._id.name || 'Unnamed product', quantity: row.quantity || 0, revenue: reportNumber(row.revenue),
    }));
    const customerStats = data.customerStats?.[0] || {};
    const orderItems = (data.orders || []).map((order) => ({
      ...order,
      reportAmount: reportNumber(order.reportAmount),
      refundStatus: order.walletRefund?.amount
        ? (Math.abs(Number(order.walletRefund.amount) - Number(order.totalAmount)) < 0.01 ? 'Refunded' : 'Partially Refunded')
        : 'Not refunded',
    }));

    res.json({
      generatedAt: new Date(),
      filters: { from: range.fromDay, to: range.toDay, category, paymentMethod, orderStatus },
      filterOptions: {
        categories,
        paymentMethods: REPORT_PAYMENT_METHODS,
        orderStatuses: REPORT_STATUSES,
        sellers: [],
      },
      availability: {
        sellers: false,
        returns: false,
        partialRefunds: false,
        profit: profitAvailable,
      },
      summary: {
        totalSales: reportNumber(overview.totalSales),
        totalRevenue,
        netProfit: estimatedNetProfit,
        totalOrders: overview.totalOrders || 0,
        averageOrderValue: settledOrders ? reportNumber(totalRevenue / settledOrders) : 0,
        totalCustomers: customerStats.totalCustomers || 0,
        totalSellers: null,
        totalRefunds: reportNumber(overview.refundAmount),
        salesGrowthPercentage: growth,
        previousPeriodRevenue: previousRevenue,
      },
      sales: {
        daily: buildDailySeries(data.daily || [], range),
        monthly: (data.monthly || []).map((row) => ({ month: row._id, sales: reportNumber(row.sales), orders: row.orders || 0 })),
        categories: (data.categories || []).map((row) => ({ category: row._id || 'Uncategorised', quantity: row.quantity || 0, revenue: reportNumber(row.revenue) })),
        topProducts: products.slice(0, 10),
      },
      orders: {
        statuses: Object.fromEntries(REPORT_STATUSES.map((status) => [status, statusCounts[status] || 0])),
        cancellation: {
          count: statusCounts.Cancelled || 0,
          refundAmount: reportNumber(overview.refundAmount),
          note: 'Cancellation reasons are not recorded by the current order schema.',
        },
        returns: { count: 0, amount: 0, available: false },
        refunded: overview.refundedOrders || 0,
      },
      payments: {
        ...paymentSummary,
        refundAmount: reportNumber(overview.refundAmount),
        gatewayFees: feesComplete ? gatewayFees : null,
        methods: paymentRows.map((row) => ({ method: row._id.method, status: row._id.status, count: row.count, amount: reportNumber(row.amount), refunds: reportNumber(row.refunds) })),
      },
      financials: {
        grossRevenue: totalRevenue,
        grossProductValue: reportNumber(overview.grossProductValue),
        productCost: costComplete ? productCost : null,
        productDiscount: reportNumber(overview.productDiscount),
        couponDiscount: reportNumber(overview.couponDiscount),
        gstCollected,
        deliveryCharges: reportNumber(overview.deliveryCharges),
        platformCommission: null,
        sellerEarnings: null,
        paymentGatewayFees: feesComplete ? gatewayFees : null,
        refundAmount: reportNumber(overview.refundAmount),
        netRevenue: totalRevenue,
        estimatedNetProfit,
        profitNote: profitAvailable
          ? 'Estimated before fulfilment, payroll, marketing, platform commission, and other operating costs.'
          : 'Not available until every settled order has a recorded unit cost and (for online payments) captured gateway fee.',
      },
      customers: {
        total: customerStats.totalCustomers || 0,
        // Registration is a user attribute rather than an order attribute, so it
        // follows the selected date range while the other customer metrics follow
        // the order/category/payment scope.
        new: newCustomers,
        repeat: customerStats.repeatCustomers || 0,
        active: customerStats.activeCustomers || 0,
        top: (data.topCustomers || []).map((row) => ({
          id: objectIdString(row.customerId), name: row.name || 'Deleted customer', email: row.email || '',
          orderCount: row.orderCount || 0, spending: reportNumber(row.spending),
        })),
      },
      products: {
        bestSelling: [...products].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10),
        leastSelling: [...products].sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue).slice(0, 10),
        topRevenue: products.slice(0, 10),
        lowStock: inventory[0]?.lowStock || [],
        outOfStock: inventory[0]?.outOfStock || [],
      },
      sellers: {
        available: false,
        note: 'This project has no seller role, product owner, seller application, commission, or payout records. Seller reporting will remain unavailable until those source records exist.',
      },
      orderHistory: {
        items: orderItems,
        page,
        limit,
        total: data.orderCount?.[0]?.count || 0,
        truncated: requestedLimit > MAX_REPORT_PAGE_SIZE,
      },
      formulas: {
        totalSales: 'Settled item line totals (after product discount and including GST).',
        totalRevenue: 'Settled item line totals − allocated coupon discount + allocated delivery charge.',
        netRevenue: 'Total revenue. Fully refunded cancelled orders are excluded from sales, so their refund is not subtracted twice.',
        estimatedNetProfit: 'Net revenue − GST collected − snapshot product cost − captured gateway fee. It is withheld when source costs or fees are missing.',
      },
    });
  } catch (err) {
    console.error('Failed to build reports:', err);
    res.status(errorStatus(err)).json({ message: 'Failed to load reports' });
  }
};
