/**
 * Fetches the Google Fonts catalog for the typography-norm font picker, via the
 * backend proxy (`GET /api/fonts`) so the Google API key stays server-side and
 * never ships in the client bundle. Exposes { fonts, loading, error }.
 */
import { useEffect, useState } from 'react';
import api from '../services/api';

// The catalog (~1,900 families) is large and immutable within a session, so we
// cache it to avoid refetching on every visit to the norms page.
const CACHE_KEY = 'gfonts:catalog';

export default function useGoogleFonts() {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Serve from the per-session cache when available.
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        setFonts(JSON.parse(cached));
        return undefined;
      }
    } catch {
      // Ignore storage/parse errors and fall through to a network fetch.
    }

    let cancelled = false;
    setLoading(true);
    api
      .get('/fonts')
      .then((data) => {
        if (cancelled) return;
        const items = data?.items || [];
        setFonts(items);
        setLoading(false);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
        } catch {
          // Storage full/unavailable — the catalog still works, just uncached.
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { fonts, loading, error };
}
