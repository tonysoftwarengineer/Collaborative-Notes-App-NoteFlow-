/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['x-auth-token'] = token;
    } else {
      delete axios.defaults.headers.common['x-auth-token'];
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post('http://localhost:5050/api/auth/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.data.user));
        setToken(res.data.data.token);
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Login failed. Please check your connection.' 
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await axios.post('http://localhost:5050/api/auth/register', { name, email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.data.user));
        setToken(res.data.data.token);
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Registration failed. Please check your connection.' 
      };
    }
  };

  const loginAsGuest = async () => {
    try {
      const res = await axios.post('http://localhost:5050/api/auth/guest');
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.data.user));
        setToken(res.data.data.token);
        setUser(res.data.data.user);
        return { success: true, user: res.data.data.user };
      }
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Guest login failed.' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
