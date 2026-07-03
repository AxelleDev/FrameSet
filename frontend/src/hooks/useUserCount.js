// Fetches the total registered-user count (social proof on login/register).
// Returns the count, or null while loading / on failure.
import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useUserCount() {
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    // Abort the in-flight request (and its retry budget) if we unmount, instead of
    // letting it run to completion; isMounted still guards the state update.
    const controller = new AbortController();
    let isMounted = true;
    (async () => {
      try {
        const data = await api.get('/users/count', { signal: controller.signal });
        if (isMounted) setUserCount(data.count);
      } catch (e) {
        if (isMounted) setUserCount(null);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return userCount;
}
