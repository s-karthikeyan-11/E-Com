import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setTotal(0);
      return;
    }
    try {
      const { data } = await api.get('/cart');
      setItems(data.items);
      setTotal(data.total);
    } catch {
      // ignore - user may not be logged in yet
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (productId, quantity = 1) => {
    const { data } = await api.post('/cart', { productId, quantity });
    setItems(data.items);
    setTotal(data.total);
  };

  const updateQuantity = async (productId, quantity) => {
    const { data } = await api.put(`/cart/${productId}`, { quantity });
    setItems(data.items);
    setTotal(data.total);
  };

  const removeFromCart = async (productId) => {
    const { data } = await api.delete(`/cart/${productId}`);
    setItems(data.items);
    setTotal(data.total);
  };

  const clearCartLocal = () => {
    setItems([]);
    setTotal(0);
  };

  return (
    <CartContext.Provider
      value={{ items, total, refreshCart, addToCart, updateQuantity, removeFromCart, clearCartLocal }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
