// Hook pour recuperer le nombre d'utilisateurs.
import { useEffect, useState } from 'react';
import api from '../services/api';
import { useData } from '../context/DataContext';

export default function useUserCount() {
  const [userCount, setUserCount] = useState(null);
  const { setGlobalError } = useData();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await api.get('/users/count', { onGlobalError: setGlobalError });
        if (isMounted) setUserCount(data.count);
      } catch (e) {
        if (isMounted) setUserCount(null);
      }
    })();

    return () => { isMounted = false; };
  }, [setGlobalError]);

  return userCount;
}
