import React, { createContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Attempt silent login on app load using the refresh token cookie
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.post('/auth/refresh');
        const { access_token, user } = response.data;
        setAccessToken(access_token);
        setUser(user);
      } catch (err) {
        // Safe to ignore on initial load (not logged in or cookie expired)
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();

    // Listen for logout events dispatched by the API interceptor on refresh failure
    const handleInterceptorLogout = () => {
      setAccessToken(null);
      setUser(null);
    };

    window.addEventListener('auth-logout', handleInterceptorLogout);
    return () => {
      window.removeEventListener('auth-logout', handleInterceptorLogout);
    };
  }, []);

  const login = async (login_id, password) => {
    try {
      const response = await api.post('/auth/login', { login_id, password });
      const { access_token, user: userData } = response.data;
      setAccessToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login failed';
      return { success: false, error: errorMsg };
    }
  };

  const register = async (username, email, password) => {
    try {
      await api.post('/auth/register', { username, email, password });
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed';
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Continue cleanup even if server logout fails
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setUser(response.data);
    } catch (err) {
      // Ignore profile refresh errors
    }
  };

  const updateProfile = async (formData) => {
    try {
      const response = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUser(response.data.user);
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update profile';
      return { success: false, error: errorMsg };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
