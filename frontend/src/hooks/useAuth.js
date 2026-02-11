import api, { setToken, clearToken } from '../services/api';
import { useCallback } from 'react';

// Hook d'accès aux endpoints d'authentification.
// Fournit `login`, `register` et `logout` et gère le token via le service api.
export const useAuthApi = () => {
  const login = useCallback(async (email, password) => {
    try {
      const userData = await api.post('/auth/login', { email, password });
      if (userData?.token) setToken(userData.token);
      return { success: true, data: userData };
    } catch (err) {
      return { success: false, message: err.data?.error || err.message };
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      const newUser = await api.post('/auth/register', userData);
      if (newUser?.token) setToken(newUser.token);
      return { success: true, data: newUser };
    } catch (err) {
      return { success: false, message: err.data?.error || err.message };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  return { login, register, logout };
};

export default useAuthApi;
