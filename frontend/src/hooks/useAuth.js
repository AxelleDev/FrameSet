import api, { setToken, clearToken } from '../services/api';
import { useCallback } from 'react';
import { useData } from '../context/DataContext';

// Hook d'accès aux endpoints d'authentification.
// Fournit `login`, `register` et `logout` et gère le token via le service api.
export const useAuthApi = () => {
  const { setAuthenticatedUser, setGlobalError } = useData();

  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password }, { onGlobalError: setGlobalError });
      if (userData?.token) setToken(userData.token);
      setAuthenticatedUser(userData);
      return { success: true, data: userData };
    } catch (err) {
      const isBusinessError = err.status && err.status < 500;
      if (!isBusinessError) setGlobalError(err.message || 'Une erreur est survenue.');
      return { success: false, message: isBusinessError ? (err.data?.error || err.message) : undefined };
    }
  }, [setGlobalError]);

  const register = useCallback(async (userData) => {
    try {
      const newUser = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      if (newUser?.token) setToken(newUser.token);
      setAuthenticatedUser(newUser);
      return { success: true, data: newUser };
    } catch (err) {
      const isBusinessError = err.status && err.status < 500;
      if (!isBusinessError) setGlobalError(err.message || 'Une erreur est survenue.');
      return { success: false, message: isBusinessError ? (err.data?.error || err.message) : undefined };
    }
  }, [setGlobalError]);

  const logout = useCallback(() => {
    clearToken();
    setAuthenticatedUser(null);
    localStorage.removeItem('frameset_user');
    setGlobalError(null);
  }, [setAuthenticatedUser, setGlobalError]);

  return { login, register, logout };
};

export default useAuthApi;
