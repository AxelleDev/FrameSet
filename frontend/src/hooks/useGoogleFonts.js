import { useEffect, useState } from 'react';

export default function useGoogleFonts(apiKey) {
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
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
