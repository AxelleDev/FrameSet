/**
 * Fetches the Google Fonts catalog server-side (key held in an environment
 * variable) so the key is never exposed in the client bundle. The catalog is
 * stable, so it is cached in memory to avoid re-calling the Google API on every
 * request.
 */

// 24 h: the Google Fonts catalog changes very slowly.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Bound the upstream call so a hung Google API can't stall requests indefinitely.
const FETCH_TIMEOUT_MS = 10 * 1000;

let catalogCache = { items: null, fetchedAt: 0 };

const getGoogleFontsCatalog = async () => {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  // With no key configured, the picker stays empty rather than failing.
  if (!apiKey) {
    return [];
  }

  const now = Date.now();
  if (catalogCache.items && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.items;
  }

  // `fields` limits the response to what the picker actually uses.
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&fields=items(family,variants)`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Google Fonts API responded with ${response.status}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  catalogCache = { items, fetchedAt: now };
  return items;
};

// Resets the in-memory cache (used by tests).
const resetCatalogCache = () => {
  catalogCache = { items: null, fetchedAt: 0 };
};

module.exports = { getGoogleFontsCatalog, resetCatalogCache };
