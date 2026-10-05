const User = require('../models/User');
const Product = require('../models/Product');

// Keep API responses safe while preserving enough server-side diagnostics to
// identify a cart/database integration failure.
const logCartError = (operation, err) => {
  console.error(`Cart ${operation} failed`, {
    name: err?.name,
    code: err?.code,
    message: err?.message,
  });
};

const populateCart = (user) => user.populate('cart.product');

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
};

const hasValidProductId = (productId) => Product.db.base.Types.ObjectId.isValid(productId);

const buildCartResponse = (user) => {
  const items = user.cart
    .filter((item) => item.product) // drop items whose product was deleted
    .map((item) => {
      const p = item.product;
      return {
        product: p,
        quantity: item.quantity,
        lineTotal: +(p.finalPrice * item.quantity).toFixed(2),
      };
    });
  const total = +items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
  return { items, total };
};

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const user = await populateCart(req.user);
    const validItems = user.cart.filter((item) => item.product && item.product.isActive);
    if (validItems.length !== user.cart.length) {
      user.cart = validItems;
      await user.save();
    }
    res.json(buildCartResponse(user));
  } catch (err) {
    logCartError('read', err);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
};

// POST /api/cart  { productId, quantity }
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity: requestedQuantity = 1 } = req.body;
    const quantity = parseQuantity(requestedQuantity);
    if (!hasValidProductId(productId)) return res.status(400).json({ message: 'Invalid product ID' });
    if (!quantity) return res.status(400).json({ message: 'Quantity must be a whole number of at least 1' });

    const product = await Product.findById(productId);
    if (!product || !product.isActive) return res.status(404).json({ message: 'Product not found' });

    const user = req.user;
    const existing = user.cart.find((i) => i.product.toString() === productId);
    const nextQuantity = (existing ? existing.quantity : 0) + quantity;
    if (product.stock < nextQuantity) return res.status(400).json({ message: 'Not enough stock' });

    if (existing) {
      existing.quantity = nextQuantity;
    } else {
      user.cart.push({ product: productId, quantity });
    }
    await user.save();
    const populated = await populateCart(user);
    res.status(existing ? 200 : 201).json(buildCartResponse(populated));
  } catch (err) {
    logCartError('add', err);
    res.status(500).json({ message: 'Failed to add to cart' });
  }
};

// PUT /api/cart/:productId  { quantity }
exports.updateCartItem = async (req, res) => {
  try {
    const quantity = parseQuantity(req.body.quantity);
    if (!hasValidProductId(req.params.productId)) return res.status(400).json({ message: 'Invalid product ID' });
    if (!quantity) return res.status(400).json({ message: 'Quantity must be a whole number of at least 1' });

    const user = req.user;
    const item = user.cart.find((i) => i.product.toString() === req.params.productId);
    if (!item) return res.status(404).json({ message: 'Item not in cart' });

    const product = await Product.findById(req.params.productId);
    if (!product || !product.isActive) return res.status(404).json({ message: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ message: 'Not enough stock' });

    item.quantity = quantity;
    await user.save();
    const populated = await populateCart(user);
    res.json(buildCartResponse(populated));
  } catch (err) {
    logCartError('update', err);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
};

// DELETE /api/cart/:productId
exports.removeCartItem = async (req, res) => {
  try {
    const user = req.user;
    user.cart = user.cart.filter((i) => i.product.toString() !== req.params.productId);
    await user.save();
    const populated = await populateCart(user);
    res.json(buildCartResponse(populated));
  } catch (err) {
    logCartError('remove', err);
    res.status(500).json({ message: 'Failed to remove cart item' });
  }
};
