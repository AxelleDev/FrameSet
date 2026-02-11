// Hook pour recuperer le nombre d'utilisateurs.
import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useUserCount() {
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await api.get('/users/count');
        if (isMounted) setUserCount(data.count);
      } catch (e) {
        if (isMounted) setUserCount(null);
      }
    })();

    return () => { isMounted = false; };
  }, []);

  return userCount;
}
