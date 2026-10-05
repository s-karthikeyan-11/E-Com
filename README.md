# Shopnow — MERN E-commerce (User + Admin)

A full-stack e-commerce app built with MongoDB, Express, React, and Node.

## Features

**User**
- Browse products with price, discount %, GST %, computed final price, and stock
- Register / log in (JWT auth)
- Add products to cart, update quantity, remove items (login required)
- Place Cash on Delivery or Razorpay orders and view order history with live status

**Admin**
- Dashboard: total users, products, orders, sales, and low-stock products
- Add / edit / delete products, including price, discount %, GST %, and stock
- View orders with customer details
- Update delivery status: Pending → Processing → Shipped → Delivered, or Cancel (auto-restocks items)
- Manage users: block/unblock or delete accounts

## Price calculation

For each product: `discountedPrice = price - (price * discountPercent / 100)`,
then `finalPrice = discountedPrice + (discountedPrice * gstPercent / 100)`.
This is computed server-side (as a virtual on the Product model) so the frontend never
has to duplicate the math, and it's recorded per line item at the time an order is placed
so historical orders don't change if a product's price changes later.

## Project structure

```
backend/    Node + Express + MongoDB API (JWT auth, role-based middleware)
frontend/   React + Vite app, Tailwind CSS, React Router, Context API for auth/cart
```

Every component and handler is written as an arrow function (`const X = () => {}` /
`exports.x = async (req, res) => {}`), except the few spots on the Mongoose `User` and
`Product` models (password hashing, `comparePassword`, the price virtuals) that
deliberately use `function () {}` — those need Mongoose's own `this` binding, and
switching them to arrow functions would silently break password hashing and price
calculation, so that one exception is intentional, not an oversight.

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit MONGO_URI / JWT_SECRET if needed
npm run seed               # creates an admin account + sample products
npm run dev                 # starts on http://localhost:5000
```

Development-only seeded admin login: `admin@example.com` / `admin123`. In production, set
`SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` (12+ characters) before seeding.

MongoDB: point `MONGO_URI` at a local `mongod` instance or a MongoDB Atlas connection string.
No replica set is required — order placement uses sequential writes, not a multi-document
transaction, so it works against a standalone MongoDB too.

### 2. Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL, defaults to http://localhost:5000/api
npm run dev                 # starts on http://localhost:3000
```

`npm run build` produces a production bundle in `frontend/dist/`.

## API overview

| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Public |
| GET | /api/products, /api/products/:id | Public |
| GET/POST/PUT/DELETE | /api/cart | Logged-in user |
| POST /api/orders, POST /api/orders/razorpay, POST /api/orders/razorpay/verify, GET /api/orders | Logged-in user |
| GET | /api/admin/dashboard | Admin |
| POST/PUT/DELETE | /api/admin/products | Admin |
| GET | /api/admin/orders | Admin |
| PUT | /api/admin/orders/:id/status | Admin |
| GET | /api/admin/users | Admin |
| PUT/DELETE | /api/admin/users/:id | Admin |

## Notes / next steps

- Passwords are hashed with bcrypt and browser sessions use httpOnly JWT cookies. In production, serve both apps over HTTPS, set `NODE_ENV=production`, use a 32+ character random `JWT_SECRET`, and configure `CLIENT_URL` (multiple origins may be comma-separated).
- The API applies security headers, a 20 KB JSON body limit, and separate authentication/API rate limits. Set `TRUST_PROXY=1` only when deployed behind one trusted reverse proxy.
- Razorpay orders are created from server-calculated cart totals. The backend verifies the Checkout HMAC signature and Razorpay's captured payment status before marking an order paid. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`; use test keys until you complete Razorpay's go-live checks.
- No image upload — the product form takes an image URL. Add multer + cloud storage if you need file uploads.

## Added in the UI/UX pass

- `POST /api/orders/:id/reorder` — creates a **new** Cash on Delivery order from a cancelled order, only within 24 hours of cancellation and only once per cancelled order. It re-validates stock and re-prices from current product data; the cancelled order and the customer's cart are never touched. `Order.reorderedFrom` records the link.
- `GET/POST/PUT/DELETE /api/addresses` — up to 5 saved addresses per customer (`User.addresses`), validated with the same rules as checkout (`backend/utils/address.js`).
- `npm run seed:products` (in `backend/`) adds 55 products across 7 categories. It matches by name, so it never wipes or duplicates existing products.
- Loyalty coupons (`backend/utils/coupons.js`): WELCOME10 gives 10% off (max ₹300, min order ₹499) on a customer's first order. LOYAL15 gives 15% off (max ₹750, min order ₹999) on every 10th order (10th, 20th, 30th...). Cancelled orders do not count, so cancelling an order gives the coupon back. `GET /api/orders/coupon` reports eligibility; checkout sends `applyCoupon: true` and the server re-checks it. Delivery fee is still based on the price before the coupon.
- Frontend: `/addresses`, `/payment-result/:id` (reads the real order state), `/category/:name`, `/search`; shared `StatusBadge`, `ConfirmDialog`, `ReorderButton`.
