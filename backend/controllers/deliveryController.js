const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const DeliveryPartner = require('../models/DeliveryPartner');
const Shipment = require('../models/Shipment');
const { getCookieSameSite } = require('../config/env');

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const cookieOptions = (remember = true) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: getCookieSameSite(),
  path: '/api',
  ...(remember ? { maxAge: Number.parseInt(process.env.JWT_COOKIE_MAX_AGE_MS || '604800000', 10) } : {}),
});

const signToken = (id) =>
  jwt.sign({ id, role: 'delivery' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Allowed delivery status transitions
const DELIVERY_STATUS_TRANSITIONS = {
  Assigned: ['Picked Up', 'Cancelled'],
  'Picked Up': ['In Transit', 'Out for Delivery', 'Failed Delivery', 'Cancelled'],
  'In Transit': ['Out for Delivery', 'Delivered', 'Failed Delivery', 'RTO Initiated', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Failed Delivery', 'RTO Initiated'],
  'Failed Delivery': ['Out for Delivery', 'RTO Initiated'],
  'RTO Initiated': ['RTO Delivered'],
  'RTO Delivered': [],
  Delivered: [],
  Cancelled: [],
};

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const isValidPassword = (value) =>
  typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 8 && Buffer.byteLength(value, 'utf8') <= 72;

// POST /api/delivery/register
// Allows an individual/rider to register for a delivery partner account.
// Always assigns status: 'Pending' on the backend, requiring admin approval.
exports.registerDeliveryPartner = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      serviceType = 'Standard',
      vehicleType = 'Bike',
      vehicleNumber = '',
      serviceablePincodes = [],
      address = {},
    } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!normalizedName || normalizedName.length > 100) {
      return res.status(400).json({ message: 'Please provide a valid full name (max 100 characters)' });
    }
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (!normalizedPhone || normalizedPhone.length < 8 || normalizedPhone.length > 20) {
      return res.status(400).json({ message: 'Please provide a valid contact phone number' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be between 8 and 72 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        return res.status(400).json({ message: 'Admin accounts cannot apply as delivery partners' });
      }

      // Check existing delivery partner profile
      const existingPartner = await DeliveryPartner.findOne({
        $or: [{ user: existingUser._id }, { email: normalizedEmail }],
      });

      if (existingPartner) {
        if (existingPartner.status === 'Pending') {
          return res.status(400).json({
            message: 'You have already submitted an application. It is currently pending admin approval.',
            partnerStatus: 'Pending',
          });
        }
        if (existingPartner.status === 'Active') {
          return res.status(400).json({
            message: 'This account is already registered as an active delivery partner. Please sign in.',
            partnerStatus: 'Active',
          });
        }
        if (existingPartner.status === 'Rejected') {
          return res.status(400).json({
            message: existingPartner.rejectionReason
              ? `Your previous application was rejected: ${existingPartner.rejectionReason}. Please contact support.`
              : 'Your previous application was rejected. Please contact support.',
            partnerStatus: 'Rejected',
          });
        }
      }

      // Verify existing password to authenticate customer upgrade
      const isMatch = await existingUser.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          message: 'An account with this email already exists. Please enter your existing password to verify ownership.',
        });
      }

      // Upgrade role to delivery securely on backend
      existingUser.role = 'delivery';
      if (normalizedName) existingUser.name = normalizedName;
      await existingUser.save();

      // Parse pincodes
      const pincodesArray = Array.isArray(serviceablePincodes)
        ? serviceablePincodes.map((p) => String(p).trim()).filter(Boolean)
        : typeof serviceablePincodes === 'string'
          ? serviceablePincodes.split(',').map((p) => p.trim()).filter(Boolean)
          : [];

      const partner = await DeliveryPartner.create({
        user: existingUser._id,
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        serviceType: ['Express', 'Standard', 'Hyperlocal', 'Surface'].includes(serviceType) ? serviceType : 'Standard',
        vehicleType: ['Bike', 'Scooter', 'Van', 'Truck', 'Other'].includes(vehicleType) ? vehicleType : 'Bike',
        vehicleNumber: typeof vehicleNumber === 'string' ? vehicleNumber.trim() : '',
        serviceablePincodes: pincodesArray,
        status: 'Pending',
        address: {
          line1: address.line1?.trim() || '',
          city: address.city?.trim() || '',
          state: address.state?.trim() || '',
          pincode: address.pincode?.trim() || '',
        },
      });

      return res.status(201).json({
        message: 'Delivery partner registration submitted successfully! Your application is pending admin review and approval.',
        partner,
        user: existingUser.toSafeObject(),
      });
    }

    // New user registration (role is securely assigned by backend as 'delivery')
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      role: 'delivery',
    });

    const pincodesArray = Array.isArray(serviceablePincodes)
      ? serviceablePincodes.map((p) => String(p).trim()).filter(Boolean)
      : typeof serviceablePincodes === 'string'
        ? serviceablePincodes.split(',').map((p) => p.trim()).filter(Boolean)
        : [];

    const partner = await DeliveryPartner.create({
      user: user._id,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      serviceType: ['Express', 'Standard', 'Hyperlocal', 'Surface'].includes(serviceType) ? serviceType : 'Standard',
      vehicleType: ['Bike', 'Scooter', 'Van', 'Truck', 'Other'].includes(vehicleType) ? vehicleType : 'Bike',
      vehicleNumber: typeof vehicleNumber === 'string' ? vehicleNumber.trim() : '',
      serviceablePincodes: pincodesArray,
      status: 'Pending',
      address: {
        line1: address.line1?.trim() || '',
        city: address.city?.trim() || '',
        state: address.state?.trim() || '',
        pincode: address.pincode?.trim() || '',
      },
    });

    res.status(201).json({
      message: 'Delivery partner registration submitted successfully! Your application is pending admin review and approval.',
      partner,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('registerDeliveryPartner error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    res.status(500).json({ message: 'Registration failed due to a server error' });
  }
};

// POST /api/delivery/login
exports.loginDeliveryPartner = async (req, res) => {
  try {
    const { email, password, remember = true } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role !== 'delivery' && user.role !== 'admin') {
      return res.status(403).json({ message: 'This account is not registered as a delivery partner' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked by admin' });
    }

    const partner = await DeliveryPartner.findOne({ user: user._id });
    if (!partner && user.role !== 'admin') {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    if (partner) {
      if (partner.status === 'Pending') {
        return res.status(403).json({
          message: 'Your application is currently pending admin approval. You will be able to log in once approved by an administrator.',
          partnerStatus: 'Pending',
        });
      }
      if (partner.status === 'Rejected') {
        return res.status(403).json({
          message: partner.rejectionReason
            ? `Your delivery partner application was rejected: ${partner.rejectionReason}`
            : 'Your delivery partner application was rejected by the administrator.',
          partnerStatus: 'Rejected',
        });
      }
      if (partner.status === 'Inactive') {
        return res.status(403).json({
          message: 'Your delivery partner account is currently inactive. Please contact administrator.',
          partnerStatus: 'Inactive',
        });
      }
      if (partner.status === 'Suspended') {
        return res.status(403).json({
          message: 'Your delivery partner account has been suspended by admin.',
          partnerStatus: 'Suspended',
        });
      }
    }

    const token = signToken(user._id);
    res.cookie('token', token, cookieOptions(remember !== false)).json({
      user: user.toSafeObject(),
      deliveryPartner: partner,
      token,
    });
  } catch (err) {
    console.error('Delivery login error:', err);
    res.status(500).json({ message: 'Login failed due to a server error' });
  }
};

// GET /api/delivery/profile
exports.getDeliveryProfile = async (req, res) => {
  try {
    let partner = req.deliveryPartner;
    if (!partner && req.user.role === 'admin') {
      partner = await DeliveryPartner.findOne();
    }
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }
    res.json({
      deliveryPartner: partner,
      user: req.user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch delivery profile' });
  }
};

// PUT /api/delivery/profile
exports.updateDeliveryProfile = async (req, res) => {
  try {
    const partner = req.deliveryPartner;
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    const { phone, vehicleType, vehicleNumber, address } = req.body;
    if (phone) partner.phone = phone.trim();
    if (vehicleType) partner.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) partner.vehicleNumber = vehicleNumber.trim();
    if (address) {
      partner.address = {
        line1: address.line1?.trim() || partner.address.line1,
        city: address.city?.trim() || partner.address.city,
        state: address.state?.trim() || partner.address.state,
        pincode: address.pincode?.trim() || partner.address.pincode,
      };
    }

    await partner.save();
    res.json(partner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update delivery profile' });
  }
};

// GET /api/delivery/dashboard
exports.getDeliveryDashboard = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner ? req.deliveryPartner._id : null;
    const filter = partnerId ? { deliveryPartner: partnerId } : {};

    const shipments = await Shipment.find(filter)
      .populate({
        path: 'order',
        select: 'totalAmount paymentMethod paymentStatus shippingAddress items createdAt',
      })
      .sort({ createdAt: -1 });

    let assignedCount = 0;
    let pickedUpCount = 0;
    let inTransitCount = 0;
    let outForDeliveryCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let rtoCount = 0;

    for (const s of shipments) {
      if (s.status === 'Assigned') assignedCount++;
      else if (s.status === 'Picked Up') pickedUpCount++;
      else if (s.status === 'In Transit') inTransitCount++;
      else if (s.status === 'Out for Delivery') outForDeliveryCount++;
      else if (s.status === 'Delivered') deliveredCount++;
      else if (s.status === 'Failed Delivery') failedCount++;
      else if (['RTO Initiated', 'RTO Delivered'].includes(s.status)) rtoCount++;
    }

    const recentShipments = shipments.slice(0, 8);

    res.json({
      stats: {
        totalAssigned: shipments.length,
        pendingPickup: assignedCount,
        pickedUp: pickedUpCount,
        inTransit: inTransitCount,
        outForDelivery: outForDeliveryCount,
        delivered: deliveredCount,
        failedDelivery: failedCount,
        rto: rtoCount,
      },
      partner: req.deliveryPartner,
      recentShipments,
    });
  } catch (err) {
    console.error('Delivery dashboard error:', err);
    res.status(500).json({ message: 'Failed to load delivery dashboard' });
  }
};

// GET /api/delivery/orders?status=...
exports.getAssignedOrders = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner ? req.deliveryPartner._id : null;
    const filter = partnerId ? { deliveryPartner: partnerId } : {};

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    const shipments = await Shipment.find(filter)
      .populate({
        path: 'order',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'items.product', select: 'name images price category' },
        ],
      })
      .populate('deliveryPartner', 'name phone serviceType vehicleType rating')
      .sort({ updatedAt: -1 });

    res.json(shipments);
  } catch (err) {
    console.error('getAssignedOrders error:', err);
    res.status(500).json({ message: 'Failed to fetch assigned orders' });
  }
};

// GET /api/delivery/orders/:id
exports.getOrderShipmentDetails = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner ? req.deliveryPartner._id : null;
    const shipment = await Shipment.findOne({
      _id: req.params.id,
      ...(partnerId && req.user.role !== 'admin' ? { deliveryPartner: partnerId } : {}),
    })
      .populate({
        path: 'order',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'items.product', select: 'name images price category' },
        ],
      })
      .populate('deliveryPartner');

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment assignment not found or unauthorized' });
    }

    res.json(shipment);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load shipment details' });
  }
};

// PUT /api/delivery/orders/:id/status
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner ? req.deliveryPartner._id : null;
    const { status, location, notes, receiverName, failedReason, failureNotes, rtoReason } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Delivery status is required' });
    }

    const shipment = await Shipment.findOne({
      _id: req.params.id,
      ...(partnerId && req.user.role !== 'admin' ? { deliveryPartner: partnerId } : {}),
    }).populate('order');

    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found or unauthorized' });
    }

    const currentStatus = shipment.status;
    const order = shipment.order;

    // Terminal state protection
    if (currentStatus === 'Delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be moved back to other states' });
    }
    if (['Cancelled', 'RTO Delivered'].includes(currentStatus)) {
      return res.status(400).json({ message: `Cannot change order in ${currentStatus} state` });
    }
    if (order && order.status === 'Cancelled') {
      return res.status(400).json({ message: 'This order was cancelled by customer/admin' });
    }

    // Validate transition
    const allowed = DELIVERY_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status) && status !== currentStatus) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${status}. Allowed: ${allowed.join(', ') || 'None'}`,
      });
    }

    // Update shipment details according to status
    const now = new Date();
    shipment.status = status;
    if (location) shipment.currentLocation = location.trim();
    if (notes) shipment.deliveryNotes = notes.trim();

    if (status === 'Picked Up') {
      shipment.pickedUpAt = shipment.pickedUpAt || now;
    } else if (status === 'Out for Delivery') {
      shipment.outForDeliveryAt = shipment.outForDeliveryAt || now;
    } else if (status === 'Delivered') {
      shipment.deliveredAt = now;
      if (receiverName) shipment.receiverName = receiverName.trim();

      // If COD order was pending, delivery marks it as collected and paid
      if (order && order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'Paid') {
        order.paymentStatus = 'Paid';
        order.paidAt = now;
      }

      // Update delivery partner statistics
      await DeliveryPartner.findByIdAndUpdate(shipment.deliveryPartner, {
        $inc: { activeShipmentsCount: -1, totalDeliveredCount: 1 },
      });
    } else if (status === 'Failed Delivery') {
      shipment.ndrAttempts = (shipment.ndrAttempts || 0) + 1;
      if (failedReason) shipment.failedReason = failedReason.trim();
      if (failureNotes) shipment.failureNotes = failureNotes.trim();
    } else if (status === 'RTO Initiated') {
      shipment.rtoInitiatedAt = now;
      if (rtoReason) shipment.rtoReason = rtoReason.trim();
    } else if (status === 'RTO Delivered') {
      shipment.rtoDeliveredAt = now;
      await DeliveryPartner.findByIdAndUpdate(shipment.deliveryPartner, {
        $inc: { activeShipmentsCount: -1 },
      });
    }

    // Record checkpoint history
    shipment.statusHistory.push({
      status,
      location: location || shipment.currentLocation || 'Hub',
      notes: notes || failureNotes || rtoReason || `Status marked as ${status}`,
      updatedBy: req.user.role === 'admin' ? 'admin' : 'delivery_partner',
      at: now,
    });

    await shipment.save();

    // Synchronize Order status
    if (order) {
      order.deliveryStatus = status;
      // Sync order.status if standard status
      if (['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed Delivery', 'RTO Initiated', 'RTO Delivered'].includes(status)) {
        order.status = status;
        order.statusHistory.push({ status, at: now });
      }
      await order.save();
    }

    res.json({
      message: `Shipment status updated to ${status}`,
      shipment,
      order,
    });
  } catch (err) {
    console.error('Update delivery status error:', err);
    res.status(500).json({ message: 'Failed to update delivery status' });
  }
};

// GET /api/delivery/history
exports.getDeliveryHistory = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner ? req.deliveryPartner._id : null;
    const filter = {
      ...(partnerId ? { deliveryPartner: partnerId } : {}),
      status: mongoose.trusted({ $in: ['Delivered', 'RTO Delivered', 'Failed Delivery'] }),
    };

    const history = await Shipment.find(filter)
      .populate({
        path: 'order',
        select: 'totalAmount paymentMethod paymentStatus shippingAddress items createdAt',
      })
      .sort({ updatedAt: -1 })
      .limit(100);

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch delivery history' });
  }
};
