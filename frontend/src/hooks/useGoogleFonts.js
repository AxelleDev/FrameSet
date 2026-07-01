/**
 * Hook that fetches the catalog of available fonts from the Google Fonts
 * Developer API, used to populate the typography-norm font picker.
 *
 * Exposes { fonts, loading, error }. Refetches whenever the API key changes;
 * does nothing until a key is provided.
 *
 * @param {string} apiKey Google Fonts API key (from VITE_GOOGLE_FONTS_API_KEY).
 */
import { useEffect, useState } from 'react';

// The catalog (~1,900 families) is large and immutable within a session, so we
// cache it and only request the fields the picker actually needs.
const CACHE_KEY = 'gfonts:catalog';

export default function useGoogleFonts(apiKey) {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // No key means the picker stays empty rather than hitting the API.
    if (!apiKey) return undefined;

    // Serve from the per-session cache when available to avoid refetching the
    // whole catalog every time the norms page mounts.
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
    // `fields` trims the response to what the picker renders, shrinking the
    // payload from hundreds of KB to a fraction of that.
    fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&fields=items(family,variants)`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const items = data.items || [];
        setFonts(items);
        setLoading(false);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
        } catch {
          // Storage full/unavailable — the catalog still works, just uncached.
        }
      })
      .catch(err => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { fonts, loading, error };
}
