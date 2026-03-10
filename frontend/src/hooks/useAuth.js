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
      return { success: false, message: err.data?.error || err.message };
    }
  }, [setGlobalError]);

  const register = useCallback(async (userData) => {
    try {
      const newUser = await api.post('/auth/register', userData, { onGlobalError: setGlobalError });
      if (newUser?.token) setToken(newUser.token);
      setAuthenticatedUser(newUser);
      return { success: true, data: newUser };
    } catch (err) {
      return { success: false, message: err.data?.error || err.message };
    }
  }, [setGlobalError]);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  return { login, register, logout };
};

export default useAuthApi;
