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

export default function useGoogleFonts(apiKey) {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // No key means the picker stays empty rather than hitting the API.
    if (!apiKey) return;
    setLoading(true);
    fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}`)
      .then(res => res.json())
      .then(data => {
        setFonts(data.items || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [apiKey]);

  return { fonts, loading, error };
}
