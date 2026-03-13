import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import logger from '../utils/logger';
import { handleApiError } from '../utils/apiError';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  useEffect(() => {
    api.get('/users/profile')
      .then((profile) => {
        setUser(profile || null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const setAuthenticatedUser = useCallback((userData) => {
    if (!userData) {
      setUser(null);
      return;
    }

    setUser(userData);
  }, []);

  const applyUserUpdate = useCallback((userData) => {
    if (!userData) return;

    setUser((currentUser) => {
      return {
        ...(currentUser || {}),
        ...userData
      };
    });
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Une erreur est survenue.');
      return { success: false, message };
    }
  }, [setAuthenticatedUser]);

  const register = useCallback(async (userData) => {
    try {
      const registrationData = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      return { success: true, data: registrationData };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Une erreur est survenue.');
      return { success: false, message };
    }
  }, [setGlobalError]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { onGlobalError: setGlobalError });
    } catch (err) {
      logger.error('auth.logout.revoke_failed', err);
    } finally {
      setUser(null);
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
    } catch (error) {
      setGlobalError(error?.message || 'Erreur lors de la mise a jour du profil.');
      logger.error('auth.updateUserProfile.error', error);
    }
  }, [user]);

  const deleteAccount = useCallback(async () => {
    try {
      await api.delete('/users/me', null, { onGlobalError: setGlobalError });
      setUser(null);
      setGlobalError(null);
      return { success: true };
    } catch (error) {
      const { message } = handleApiError(error, setGlobalError, 'Erreur lors de la suppression du compte.');
      return { success: false, message };
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
      return { success: true };
    } catch (error) {
      logger.error('auth.changePassword.error', error);
      const isBusinessError = error.status && error.status < 500;
      return { success: false, message: isBusinessError ? (error.data?.error || error.message) : undefined };
    }
  }, [user]);

  const verifyEmail = useCallback(async (email, code) => {
    try {
      const data = await api.post('/auth/verify', { email, code }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Code incorrect.');
      return { success: false, message };
    }
  }, [setGlobalError]);

  const resendVerificationCode = useCallback(async (email) => {
    try {
      const data = await api.post('/auth/resend-code', { email }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, "Erreur lors de l'envoi du code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

  const verifyPendingEmail = useCallback(async (email, code) => {
    try {
      const data = await api.post('/users/email/verify', { email, code }, { onGlobalError: setGlobalError });
      if (data?.success && data.user) {
        applyUserUpdate(data.user);
      }
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, 'Code incorrect.');
      return { success: false, message };
    }
  }, [applyUserUpdate, setGlobalError]);

  const resendPendingEmailCode = useCallback(async (email) => {
    try {
      const data = await api.post('/users/email/resend', { email }, { onGlobalError: setGlobalError });
      return { success: Boolean(data?.success) };
    } catch (err) {
      const { message } = handleApiError(err, setGlobalError, "Erreur lors de l'envoi du code.");
      return { success: false, message };
    }
  }, [setGlobalError]);

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
    deleteAccount,
    verifyEmail,
    resendVerificationCode,
    verifyPendingEmail,
    resendPendingEmailCode
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
    deleteAccount,
    verifyEmail,
    resendVerificationCode,
    verifyPendingEmail,
    resendPendingEmailCode
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
