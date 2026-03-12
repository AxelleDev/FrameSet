import { useAuth } from '../context/AuthContext';

export const useAuthApi = () => {
  const { login, register, logout } = useAuth();
  return { login, register, logout };
};

export default useAuthApi;
