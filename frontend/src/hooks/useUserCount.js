// Fetches the total registered-user count (social proof on login/register).
// Returns the count, or null while loading / on failure.
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
