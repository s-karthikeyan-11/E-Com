const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const DeliveryPartner = require('../models/DeliveryPartner');
const Shipment = require('../models/Shipment');

const generateAwbNumber = () => {
  const prefix = 'SN-AWB';
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  const timePart = Date.now().toString().slice(-4);
  return `${prefix}-${randomPart}${timePart}`;
};

// GET /api/admin/delivery-partners
exports.getDeliveryPartners = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status && ['Active', 'Inactive', 'Suspended'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { email: new RegExp(search.trim(), 'i') },
        { phone: new RegExp(search.trim(), 'i') },
      ];
    }

    const partners = await DeliveryPartner.find(filter)
      .populate('user', 'isBlocked createdAt')
      .sort({ createdAt: -1 });

    const totalPartners = await DeliveryPartner.countDocuments();
    const activePartners = await DeliveryPartner.countDocuments({ status: 'Active' });
    const inTransitShipments = await Shipment.countDocuments({
      status: mongoose.trusted({ $in: ['Picked Up', 'In Transit', 'Out for Delivery'] }),
    });
    const deliveredCount = await Shipment.countDocuments({ status: 'Delivered' });

    res.json({
      partners,
      summary: {
        totalPartners,
        activePartners,
        inTransitShipments,
        totalDelivered: deliveredCount,
      },
    });
  } catch (err) {
    console.error('getDeliveryPartners error:', err);
    res.status(500).json({ message: 'Failed to fetch delivery partners' });
  }
};

// GET /api/admin/delivery-partners/:id
exports.getDeliveryPartnerById = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.id).populate('user', 'isBlocked createdAt');
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    const shipments = await Shipment.find({ deliveryPartner: partner._id })
      .populate({
        path: 'order',
        select: 'totalAmount paymentMethod paymentStatus shippingAddress status createdAt',
      })
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json({
      partner,
      shipments,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch partner details' });
  }
};

// POST /api/admin/delivery-partners
exports.createDeliveryPartner = async (req, res) => {
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

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Partner name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Partner email is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user or partner exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Create delivery user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'delivery',
    });

    // Create partner record
    const partner = await DeliveryPartner.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      user: user._id,
      serviceType,
      vehicleType,
      vehicleNumber: vehicleNumber.trim(),
      serviceablePincodes: Array.isArray(serviceablePincodes)
        ? serviceablePincodes.map((p) => String(p).trim()).filter(Boolean)
        : [],
      status: 'Active',
      address: {
        line1: address.line1?.trim() || '',
        city: address.city?.trim() || '',
        state: address.state?.trim() || '',
        pincode: address.pincode?.trim() || '',
      },
    });

    res.status(201).json(partner);
  } catch (err) {
    console.error('createDeliveryPartner error:', err);
    res.status(500).json({ message: err.message || 'Failed to create delivery partner' });
  }
};

// PUT /api/admin/delivery-partners/:id
exports.updateDeliveryPartner = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    const {
      name,
      phone,
      serviceType,
      vehicleType,
      vehicleNumber,
      serviceablePincodes,
      status,
      address,
    } = req.body;

    if (name) partner.name = name.trim();
    if (phone) partner.phone = phone.trim();
    if (serviceType) partner.serviceType = serviceType;
    if (vehicleType) partner.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) partner.vehicleNumber = vehicleNumber.trim();
    if (status && ['Active', 'Inactive', 'Suspended'].includes(status)) partner.status = status;

    if (serviceablePincodes !== undefined) {
      partner.serviceablePincodes = Array.isArray(serviceablePincodes)
        ? serviceablePincodes.map((p) => String(p).trim()).filter(Boolean)
        : [];
    }

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
    res.status(500).json({ message: 'Failed to update delivery partner' });
  }
};

// PUT /api/admin/delivery-partners/:id/status
exports.toggleDeliveryPartnerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    res.json(partner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to change status' });
  }
};

// POST /api/admin/orders/:id/assign-delivery
exports.assignOrderDelivery = async (req, res) => {
  try {
    const { partnerId, expectedDeliveryDate, notes } = req.body;
    const orderId = req.params.id;

    if (!partnerId) {
      return res.status(400).json({ message: 'Please select a delivery partner' });
    }

    const [order, partner] = await Promise.all([
      Order.findById(orderId),
      DeliveryPartner.findById(partnerId),
    ]);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }
    if (partner.status !== 'Active') {
      return res.status(400).json({ message: 'Cannot assign to an inactive or suspended delivery partner' });
    }
    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot assign delivery partner to a cancelled order' });
    }
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Order is already delivered' });
    }

    // Check if order already has an active assignment
    let existingShipment = await Shipment.findOne({ order: order._id });
    const trackingNumber = existingShipment?.trackingNumber || generateAwbNumber();
    const now = new Date();

    if (existingShipment) {
      // Re-assign partner or update
      const previousPartnerId = existingShipment.deliveryPartner;
      existingShipment.deliveryPartner = partner._id;
      existingShipment.expectedDeliveryDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : existingShipment.expectedDeliveryDate;
      existingShipment.status = 'Assigned';
      existingShipment.statusHistory.push({
        status: 'Assigned',
        location: 'Central Logistics Hub',
        notes: notes || `Reassigned to partner: ${partner.name}`,
        updatedBy: 'admin',
        at: now,
      });
      await existingShipment.save();

      if (previousPartnerId && previousPartnerId.toString() !== partner._id.toString()) {
        await DeliveryPartner.findByIdAndUpdate(previousPartnerId, { $inc: { activeShipmentsCount: -1 } });
        await DeliveryPartner.findByIdAndUpdate(partner._id, { $inc: { activeShipmentsCount: 1 } });
      }
    } else {
      // Create new shipment
      existingShipment = await Shipment.create({
        order: order._id,
        deliveryPartner: partner._id,
        trackingNumber,
        status: 'Assigned',
        currentLocation: 'Central Logistics Hub',
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : order.estimatedDelivery || new Date(Date.now() + 4 * 86400000),
        statusHistory: [
          {
            status: 'Assigned',
            location: 'Central Logistics Hub',
            notes: notes || `Assigned to courier: ${partner.name}`,
            updatedBy: 'admin',
            at: now,
          },
        ],
      });

      await DeliveryPartner.findByIdAndUpdate(partner._id, { $inc: { activeShipmentsCount: 1 } });
    }

    // Link back to order
    order.deliveryPartner = partner._id;
    order.shipment = existingShipment._id;
    order.trackingNumber = trackingNumber;
    order.deliveryStatus = 'Assigned';
    if (['Pending', 'Confirmed'].includes(order.status)) {
      order.status = 'Packed';
      order.statusHistory.push({ status: 'Packed', at: now });
    }
    if (expectedDeliveryDate) {
      order.estimatedDelivery = new Date(expectedDeliveryDate);
    }
    await order.save();

    res.json({
      message: `Delivery assigned to ${partner.name} with AWB #${trackingNumber}`,
      shipment: existingShipment,
      order,
    });
  } catch (err) {
    console.error('assignOrderDelivery error:', err);
    res.status(500).json({ message: 'Failed to assign delivery partner' });
  }
};

// GET /api/admin/shipments
exports.getAllShipments = async (req, res) => {
  try {
    const { status, partnerId, search } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (partnerId) {
      filter.deliveryPartner = partnerId;
    }
    if (search) {
      filter.trackingNumber = new RegExp(search.trim(), 'i');
    }

    const shipments = await Shipment.find(filter)
      .populate({
        path: 'order',
        populate: { path: 'user', select: 'name email' },
      })
      .populate('deliveryPartner', 'name phone serviceType vehicleType status')
      .sort({ updatedAt: -1 })
      .limit(200);

    res.json(shipments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shipments' });
  }
};
