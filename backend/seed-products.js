// Adds 50+ catalogue products WITHOUT touching existing data.
// Safe to re-run: products are matched by name and skipped if they already exist.
// Run with: npm run seed:products
//
// Images use loremflickr.com, which returns a real photo matching the keyword.
// `lock` pins each product to one stable photo. If you want fixed brand photography,
// replace the `img` keyword with your own image URL in the table below.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./models/Product');

const photo = (keywords, lock) => `https://loremflickr.com/800/800/${keywords}?lock=${lock}`;

// [name, category, price, discount%, gst%, stock, keywords, description, deliveryDays]
const rows = [
  // Electronics (GST 18)
  ['Wireless Bluetooth Headphones', 'Electronics', 4999, 25, 18, 35, 'headphones', 'Over-ear wireless headphones with soft cushions and up to 30 hours of playback.', 3],
  ['True Wireless Earbuds', 'Electronics', 2999, 30, 18, 60, 'earbuds', 'Compact earbuds with a charging case, touch controls and clear calls.', 3],
  ['Portable Bluetooth Speaker', 'Electronics', 3499, 20, 18, 40, 'bluetooth,speaker', 'Splash-resistant speaker with deep bass and 12 hours of battery.', 4],
  ['Smart Fitness Watch', 'Electronics', 5999, 35, 18, 28, 'smartwatch', 'Tracks steps, heart rate and sleep, with a bright always-on display.', 4],
  ['10000mAh Power Bank', 'Electronics', 1499, 15, 18, 80, 'powerbank', 'Slim fast-charging power bank with two USB ports.', 3],
  ['Full HD Webcam', 'Electronics', 2499, 10, 18, 25, 'webcam', '1080p webcam with a built-in microphone for calls and streaming.', 4],
  ['Laptop Backpack 25L', 'Electronics', 1799, 20, 18, 55, 'laptop,backpack', 'Water-resistant backpack with a padded 15.6 inch laptop sleeve.', 3],
  ['RGB Gaming Mouse', 'Electronics', 1299, 12, 18, 45, 'gaming,mouse', 'Lightweight wired mouse with adjustable DPI and RGB lighting.', 3],
  ['Wireless Keyboard and Mouse Combo', 'Electronics', 1999, 18, 18, 38, 'wireless,keyboard', 'Quiet full-size keyboard with a matching wireless mouse.', 4],
  ['USB-C Fast Charger 65W', 'Electronics', 1899, 22, 18, 70, 'charger,usb', 'Compact wall charger that powers laptops, tablets and phones.', 3],
  ['27 Inch Full HD Monitor', 'Electronics', 11999, 15, 18, 15, 'computer,monitor', 'IPS monitor with thin bezels and 75Hz refresh rate.', 5],
  ['Smart LED Desk Lamp', 'Electronics', 1599, 10, 18, 42, 'desk,lamp', 'Touch-dimming desk lamp with three colour temperatures.', 3],

  // Apparel (GST 5/12)
  ['Men\'s Cotton Crew T-Shirt', 'Apparel', 599, 15, 5, 120, 'tshirt,men', 'Soft combed-cotton tee with a relaxed everyday fit.', 3],
  ['Women\'s Floral Summer Dress', 'Apparel', 1799, 30, 12, 40, 'summer,dress', 'Lightweight knee-length dress in a breathable floral print.', 4],
  ['Men\'s Slim Fit Denim Jeans', 'Apparel', 2299, 25, 12, 60, 'denim,jeans', 'Stretch denim jeans cut for a clean, slim fit.', 4],
  ['Hooded Cotton Sweatshirt', 'Apparel', 1999, 28, 12, 50, 'hoodie', 'Fleece-lined hoodie with a kangaroo pocket.', 4],
  ['Formal Cotton Shirt', 'Apparel', 1499, 20, 12, 45, 'formal,shirt', 'Wrinkle-resistant full-sleeve shirt for work and events.', 3],
  ['Women\'s Cotton Kurti', 'Apparel', 1199, 22, 5, 65, 'kurti,indian,clothing', 'Straight-cut cotton kurti with fine embroidery at the neckline.', 4],
  ['Men\'s Leather Belt', 'Apparel', 899, 10, 12, 75, 'leather,belt', 'Genuine leather belt with a brushed metal buckle.', 3],
  ['Winter Wool Scarf', 'Apparel', 799, 15, 12, 50, 'wool,scarf', 'Warm woven scarf in a soft wool blend.', 3],
  ['Unisex Baseball Cap', 'Apparel', 449, 10, 12, 90, 'baseball,cap', 'Adjustable cotton cap with a curved brim.', 3],
  ['Quick-Dry Sports Shorts', 'Apparel', 699, 18, 12, 80, 'sports,shorts', 'Light stretch shorts with a zip pocket for workouts.', 3],

  // Footwear (GST 12)
  ['Men\'s Running Shoes', 'Footwear', 3299, 30, 12, 35, 'running,shoes', 'Cushioned running shoes with a breathable mesh upper.', 4],
  ['White Leather Sneakers', 'Footwear', 2799, 20, 12, 40, 'white,sneakers', 'Clean low-top sneakers that go with almost everything.', 4],
  ['Women\'s Block Heel Sandals', 'Footwear', 1899, 25, 12, 30, 'heel,sandals', 'Comfortable block heels with an adjustable ankle strap.', 4],
  ['Casual Canvas Shoes', 'Footwear', 1399, 15, 12, 55, 'canvas,shoes', 'Lightweight lace-up canvas shoes for daily wear.', 3],
  ['Leather Formal Oxford Shoes', 'Footwear', 3999, 22, 12, 22, 'oxford,shoes', 'Polished leather oxfords with a cushioned insole.', 5],
  ['Flip-Flop Slides', 'Footwear', 499, 10, 12, 150, 'flipflops', 'Soft EVA slides that are quick to dry.', 3],
  ['Trekking Boots', 'Footwear', 4499, 28, 12, 18, 'hiking,boots', 'Ankle-support boots with a grippy rubber outsole.', 5],

  // Home & Kitchen (GST 12/18)
  ['Stainless Steel Water Bottle 1L', 'Home', 699, 15, 18, 100, 'steel,water,bottle', 'Double-wall insulated bottle that keeps drinks cold for 24 hours.', 3],
  ['Ceramic Coffee Mug Set of 4', 'Home', 899, 20, 12, 70, 'coffee,mugs', 'Four glazed ceramic mugs in neutral colours.', 3],
  ['Non-Stick Cookware Set', 'Home', 3499, 35, 18, 25, 'cookware,pans', 'Three-piece non-stick set with cool-touch handles.', 5],
  ['Cotton Bed Sheet Set (Queen)', 'Home', 1799, 30, 12, 45, 'bedsheet,bedroom', 'Queen bedsheet with two pillow covers in soft 180-thread cotton.', 4],
  ['Memory Foam Pillow', 'Home', 1299, 20, 12, 60, 'pillow,bed', 'Contour pillow that supports your neck and shoulders.', 4],
  ['Aroma Scented Candle Set', 'Home', 799, 12, 12, 85, 'scented,candles', 'Set of three soy-wax candles in calming scents.', 3],
  ['Wall Clock Minimal', 'Home', 999, 10, 12, 40, 'wall,clock', 'Silent-sweep wall clock with a clean dial.', 3],
  ['Bamboo Kitchen Organizer', 'Home', 1099, 18, 12, 35, 'kitchen,organizer', 'Stackable bamboo racks for spices and tools.', 4],
  ['Electric Kettle 1.5L', 'Home', 1399, 25, 18, 50, 'electric,kettle', 'Fast-boil stainless steel kettle with auto shut-off.', 4],
  ['Indoor Plant Pot Set', 'Home', 999, 15, 12, 65, 'plant,pot', 'Set of three ceramic planters with drainage trays.', 3],

  // Beauty & Care (GST 18)
  ['Vitamin C Face Serum 30ml', 'Beauty', 799, 20, 18, 90, 'face,serum', 'Brightening serum for a more even-looking skin tone.', 3],
  ['Daily Moisturizing Lotion 400ml', 'Beauty', 549, 10, 18, 110, 'body,lotion', 'Light, non-greasy lotion for 24-hour hydration.', 3],
  ['Matte Lipstick Collection', 'Beauty', 1299, 25, 18, 55, 'lipstick', 'Four long-wear matte lipstick shades.', 4],
  ['Men\'s Grooming Kit', 'Beauty', 1699, 22, 18, 40, 'beard,grooming', 'Trimmer, comb and beard oil in a gift box.', 4],
  ['Herbal Shampoo 500ml', 'Beauty', 449, 8, 18, 130, 'shampoo,bottle', 'Gentle sulphate-free shampoo with herbal extracts.', 3],
  ['SPF 50 Sunscreen 100g', 'Beauty', 599, 15, 18, 95, 'sunscreen', 'Lightweight broad-spectrum sunscreen with no white cast.', 3],

  // Sports & Fitness (GST 12/18)
  ['Anti-Slip Yoga Mat 6mm', 'Sports', 999, 25, 12, 70, 'yoga,mat', 'Cushioned, non-slip mat with a carry strap.', 3],
  ['Adjustable Dumbbell Pair 10kg', 'Sports', 2499, 20, 18, 30, 'dumbbells', 'Pair of adjustable dumbbells with secure locking collars.', 5],
  ['Resistance Band Set', 'Sports', 699, 18, 12, 85, 'resistance,bands', 'Five bands of different strengths with a carry bag.', 3],
  ['Cricket Bat English Willow', 'Sports', 5499, 20, 12, 12, 'cricket,bat', 'Full-size willow bat with a comfortable cane handle.', 6],
  ['Football Size 5', 'Sports', 899, 12, 12, 60, 'football,soccer', 'Machine-stitched match football with a durable cover.', 4],
  ['Badminton Racquet Pair', 'Sports', 1599, 25, 12, 45, 'badminton,racket', 'Two lightweight racquets with shuttles and a cover.', 4],

  // Books & Stationery (GST 12/0)
  ['Hardcover Ruled Notebook A5', 'Stationery', 349, 10, 12, 200, 'notebook', 'Dotted-page hardcover notebook with an elastic closure.', 3],
  ['Gel Pen Set of 12', 'Stationery', 249, 5, 12, 220, 'colored,pens', 'Twelve smooth-writing gel pens in assorted colours.', 3],
  ['Wooden Desk Organizer', 'Stationery', 799, 15, 12, 50, 'desk,organizer', 'Multi-compartment organizer for pens, phone and notes.', 4],
  ['Acrylic Paint Set 24 Colours', 'Stationery', 899, 20, 12, 40, 'acrylic,paint', 'Vibrant paints with three brushes for beginners and hobbyists.', 4],
];

const run = async () => {
  await connectDB();
  const names = rows.map((r) => r[0]);
  const existing = new Set((await Product.find({ name: { $in: names } }).select('name')).map((p) => p.name));

  const fresh = rows
    .filter((r) => !existing.has(r[0]))
    .map(([name, category, price, discountPercent, gstPercent, stock, keywords, description, deliveryDays], i) => ({
      name, category, price, discountPercent, gstPercent, stock, description, deliveryDays,
      image: photo(keywords, i + 1),
      lowStockThreshold: Math.max(5, Math.round(stock * 0.15)),
      isActive: true,
    }));

  if (fresh.length) await Product.insertMany(fresh);
  console.log(`Added ${fresh.length} products, skipped ${existing.size} that already existed (${rows.length} in catalogue).`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => { console.error(err); process.exit(1); });
