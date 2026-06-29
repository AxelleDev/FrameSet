/**
 * Hook that fetches the total registered-user count, shown as social proof on
 * the login and register pages.
 *
 * @returns {number|null} The user count, or null while loading / on failure.
 */
import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useUserCount() {
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    // isMounted guards against setting state after the component unmounts.
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
