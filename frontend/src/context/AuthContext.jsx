import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import logger from '../utils/logger';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const storedUser = localStorage.getItem('frameset_user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    return null;
  }
};

const persistUser = (userData) => {
  localStorage.setItem('frameset_user', JSON.stringify(userData));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    const storedUser = readStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    api.get('/users/profile')
      .then((profile) => {
        const hydratedUser = {
          ...(storedUser || {}),
          ...profile
        };
        setUser(hydratedUser);
        persistUser(hydratedUser);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('frameset_user');
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const setAuthenticatedUser = useCallback((userData) => {
    if (!userData) {
      setUser(null);
      localStorage.removeItem('frameset_user');
      return;
    }

    setUser(userData);
    persistUser(userData);
  }, []);

  const applyUserUpdate = useCallback((userData) => {
    if (!userData) return;

    setUser((currentUser) => {
      const nextUser = {
        ...(currentUser || {}),
        ...userData
      };

      persistUser(nextUser);
      return nextUser;
    });
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const isBusinessError = err.status && err.status < 500;
      if (!isBusinessError) {
        setGlobalError(err.message || 'Une erreur est survenue.');
      }
      return { success: false, message: isBusinessError ? (err.data?.error || err.message) : undefined };
    }
  }, [setAuthenticatedUser]);

  const register = useCallback(async (userData) => {
    try {
      const registrationData = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      return { success: true, data: registrationData };
    } catch (err) {
      const isBusinessError = err.status && err.status < 500;
      if (!isBusinessError) {
        setGlobalError(err.message || 'Une erreur est survenue.');
      }
      return { success: false, message: isBusinessError ? (err.data?.error || err.message) : undefined };
    }
  }, [setGlobalError]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { onGlobalError: setGlobalError });
    } catch (err) {
      logger.error('auth.logout.revoke_failed', err);
    } finally {
      setUser(null);
      localStorage.removeItem('frameset_user');
      setGlobalError(null);
    }
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const data = await api.post('/auth/refresh', {}, { onGlobalError: setGlobalError });
      return Boolean(data?.success);
    } catch (error) {
      logger.error('auth.refreshAccessToken.error', error);
      return null;
    }
  }, []);

  const updateUserProfile = useCallback(async (updates) => {
    if (!user) return;

    try {
      const data = await api.put('/users', { id: user.id, ...updates }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        name: data.name ?? user.name,
        email: data.email ?? user.email,
        pendingEmail: data.pendingEmail ?? user.pendingEmail
      };
      setUser(updatedUser);
      persistUser(updatedUser);
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la mise a jour du profil.');
      logger.error('auth.updateUserProfile.error', error);
    }
  }, [user]);

  const deleteAccount = useCallback(async () => {
    try {
      await api.delete('/users/me', null, { onGlobalError: setGlobalError });
      setUser(null);
      localStorage.removeItem('frameset_user');
      setGlobalError(null);
      return { success: true };
    } catch (error) {
      const isBusinessError = error.status && error.status < 500;
      if (!isBusinessError) {
        setGlobalError(error.message || 'Erreur lors de la suppression du compte.');
      }
      return { success: false, message: isBusinessError ? (error.data?.error || error.message) : undefined };
    }
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    if (!user) {
      return { success: false, message: 'Utilisateur non connecte.' };
    }

    try {
      const data = await api.post('/users/password', { id: user.id, currentPassword, newPassword }, { onGlobalError: setGlobalError });
      const updatedUser = {
        ...user,
        passwordUpdatedAt: data.passwordUpdatedAt || new Date().toISOString()
      };
      setUser(updatedUser);
      persistUser(updatedUser);
      return { success: true };
    } catch (error) {
      logger.error('auth.changePassword.error', error);
      const isBusinessError = error.status && error.status < 500;
      return { success: false, message: isBusinessError ? (error.data?.error || error.message) : undefined };
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    authLoading,
    globalError,
    setGlobalError,
    login,
    register,
    logout,
    refreshAccessToken,
    applyUserUpdate,
    updateUserProfile,
    changePassword,
    deleteAccount
  }), [
    user,
    authLoading,
    globalError,
    login,
    register,
    logout,
    refreshAccessToken,
    applyUserUpdate,
    updateUserProfile,
    changePassword,
    deleteAccount
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit etre utilise dans un AuthProvider');
  }
  return context;
};
