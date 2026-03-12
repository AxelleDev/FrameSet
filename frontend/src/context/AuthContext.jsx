import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setToken as setApiToken, clearToken as clearApiToken } from '../services/api';

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

    if (!storedUser?.token) {
      setAuthLoading(false);
      return;
    }

    setApiToken(storedUser.token);

    api.get('/users/profile')
      .then((profile) => {
        const hydratedUser = {
          ...storedUser,
          ...profile,
          token: storedUser.token,
          refreshToken: storedUser.refreshToken
        };
        setUser(hydratedUser);
        persistUser(hydratedUser);
      })
      .catch(() => {
        setUser(null);
        clearApiToken();
        localStorage.removeItem('frameset_user');
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const setAuthenticatedUser = useCallback((userData) => {
    if (!userData) {
      setUser(null);
      clearApiToken();
      localStorage.removeItem('frameset_user');
      return;
    }

    if (userData?.token) {
      setApiToken(userData.token);
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

      if (currentUser?.token && !nextUser.token) {
        nextUser.token = currentUser.token;
      }

      if (currentUser?.refreshToken && !nextUser.refreshToken) {
        nextUser.refreshToken = currentUser.refreshToken;
      }

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
      const newUser = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      if (newUser?.token) {
        setAuthenticatedUser(newUser);
      }
      return { success: true, data: newUser };
    } catch (err) {
      const isBusinessError = err.status && err.status < 500;
      if (!isBusinessError) {
        setGlobalError(err.message || 'Une erreur est survenue.');
      }
      return { success: false, message: isBusinessError ? (err.data?.error || err.message) : undefined };
    }
  }, [setAuthenticatedUser]);

  const logout = useCallback(() => {
    setUser(null);
    clearApiToken();
    localStorage.removeItem('frameset_user');
    setGlobalError(null);
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
      console.error(error);
    }
  }, [user]);

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
      console.error(error);
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
    setAuthenticatedUser,
    applyUserUpdate,
    updateUserProfile,
    changePassword
  }), [
    user,
    authLoading,
    globalError,
    login,
    register,
    logout,
    setAuthenticatedUser,
    applyUserUpdate,
    updateUserProfile,
    changePassword
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
