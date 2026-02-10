// Hook pour recuperer le nombre d'utilisateurs.
import { useEffect, useState } from 'react';

export default function useUserCount() {
  const [userCount, setUserCount] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    let isMounted = true;

    fetch(`${API_URL}/users/count`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setUserCount(data.count);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUserCount(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [API_URL]);

  return userCount;
}
