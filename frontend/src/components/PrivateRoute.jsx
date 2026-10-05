import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Requires any logged-in user
const PrivateRoute = ({ children, customerOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-12 text-center text-ink-soft">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (customerOnly && isAdmin) return <Navigate to="/admin/orders" replace />;
  return children;
};

export default PrivateRoute;
