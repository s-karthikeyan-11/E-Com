import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import Orders from './pages/Orders';

import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminOrders from './pages/admin/Orders';
import AdminUsers from './pages/admin/Users';
import AdminPayments from './pages/admin/Payments';
import AdminReports from './pages/admin/Reports';
import AdminSellers from './pages/admin/Sellers';
import AdminDeliveryPartners from './pages/admin/DeliveryPartners';

import DeliveryRoute from './components/DeliveryRoute';
import DeliveryLayout from './pages/delivery/DeliveryLayout';
import DeliveryLogin from './pages/delivery/DeliveryLogin';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import DeliveryOrders from './pages/delivery/DeliveryOrders';
import DeliveryHistory from './pages/delivery/DeliveryHistory';

import SellerRoute from './components/SellerRoute';
import SellerLayout from './pages/seller/SellerLayout';
import SellerRegister from './pages/seller/SellerRegister';
import SellerLogin from './pages/seller/SellerLogin';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';
import SellerEarnings from './pages/seller/SellerEarnings';
import SellerProfile from './pages/seller/SellerProfile';
import SellerReports from './pages/seller/SellerReports';
import SellerStore from './pages/seller/SellerStore';

import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Wishlist from './pages/Wishlist';
import ProductDetails from './pages/ProductDetails';
import OrderDetails from './pages/OrderDetails';
import PaymentResult from './pages/PaymentResult';
import Addresses from './pages/Addresses';

// Category pages reuse the catalogue's category filter instead of duplicating it.
const CategoryRedirect = () => {
  const { name } = useParams();
  return <Navigate to={`/products?category=${encodeURIComponent(name)}#shop`} replace />;
};

const App = () => (
  <AuthProvider>
    <CartProvider>

      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >

        <div className="min-h-screen bg-slate-50 text-slate-900">

          <Navbar />

          <main className="app-content min-h-[70vh]">

            <Routes>

              {/* Customer Pages */}
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/products" element={<Home />} />
              <Route path="/categories" element={<Home />} />
              <Route path="/category/:name" element={<CategoryRedirect />} />
              <Route path="/search" element={<Home />} />

              <Route
                path="/product/:id"
                element={<ProductDetails />}
              />

              <Route
                path="/wishlist"
                element={<Wishlist />}
              />

              {/* Authentication */}
              <Route
                path="/login"
                element={<Login />}
              />

              <Route
                path="/register"
                element={<Register />}
              />

              {/* Seller Authentication & Public Storefront */}
              <Route path="/seller/register" element={<SellerRegister />} />
              <Route path="/seller/login" element={<SellerLogin />} />
              <Route path="/store/:sellerId" element={<SellerStore />} />

              {/* Protected Seller Portal */}
              <Route
                path="/seller"
                element={
                  <SellerRoute>
                    <SellerLayout />
                  </SellerRoute>
                }
              >
                <Route index element={<Navigate to="/seller/dashboard" replace />} />
                <Route path="dashboard" element={<SellerDashboard />} />
                <Route path="products" element={<SellerProducts />} />
                <Route path="orders" element={<SellerOrders />} />
                <Route path="earnings" element={<SellerEarnings />} />
                <Route path="reports" element={<SellerReports />} />
                <Route path="profile" element={<SellerProfile />} />
              </Route>

              {/* Delivery Partner Portal */}
              <Route path="/delivery/login" element={<DeliveryLogin />} />
              <Route
                path="/delivery"
                element={
                  <DeliveryRoute>
                    <DeliveryLayout />
                  </DeliveryRoute>
                }
              >
                <Route index element={<Navigate to="/delivery/dashboard" replace />} />
                <Route path="dashboard" element={<DeliveryDashboard />} />
                <Route path="orders" element={<DeliveryOrders />} />
                <Route path="history" element={<DeliveryHistory />} />
              </Route>

              {/* Customer Protected Pages */}
              <Route
                path="/cart"
                element={
                  <PrivateRoute customerOnly>
                    <Cart />
                  </PrivateRoute>
                }
              />

              <Route
                path="/checkout"
                element={
                  <PrivateRoute customerOnly>
                    <Checkout />
                  </PrivateRoute>
                }
              />

              <Route
                path="/orders"
                element={
                  <PrivateRoute customerOnly>
                    <Orders />
                  </PrivateRoute>
                }
              />

              <Route
                path="/order/:id"
                element={
                  <PrivateRoute>
                    <OrderDetails />
                  </PrivateRoute>
                }
              />

              <Route
                path="/payment-result/:id"
                element={
                  <PrivateRoute customerOnly>
                    <PaymentResult />
                  </PrivateRoute>
                }
              />

              <Route
                path="/addresses"
                element={
                  <PrivateRoute customerOnly>
                    <Addresses />
                  </PrivateRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />

              <Route
                path="/wallet"
                element={
                  <PrivateRoute customerOnly>
                    <Wallet />
                  </PrivateRoute>
                }
              />

              {/* Admin */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route
                  index
                  element={<Dashboard />}
                />

                <Route
                  path="sellers"
                  element={<AdminSellers />}
                />

                <Route
                  path="products"
                  element={<AdminProducts />}
                />

                <Route
                  path="orders"
                  element={<AdminOrders />}
                />

                <Route
                  path="delivery-partners"
                  element={<AdminDeliveryPartners />}
                />

                <Route
                  path="payments"
                  element={<AdminPayments />}
                />

                <Route
                  path="reports"
                  element={<AdminReports />}
                />

                <Route
                  path="users"
                  element={<AdminUsers />}
                />
              </Route>

              {/* 404 */}
              <Route
                path="*"
                element={
                  <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">

                      <h1 className="text-3xl text-slate-900">
                        Page not found
                      </h1>

                      <p className="mt-2 text-slate-600">
                        The page you are looking for does not exist.
                      </p>

                    </div>
                  </div>
                }
              />

            </Routes>

          </main>

          <Footer />

        </div>

      </BrowserRouter>

    </CartProvider>
  </AuthProvider>
);

export default App;
