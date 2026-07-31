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
// Download URLs for one family's font files (TTFs on fonts.gstatic.com),
// fetched on demand so the catalog response can stay trimmed to what the
// picker needs. Used by the PDF export to embed a typography norm's actual
// face in its AaBbCc specimen. Cached per family; returns null for an
// unknown/invalid family or when no key is configured.
const filesCache = new Map();

const getGoogleFontFiles = async (rawFamily) => {
  const family = typeof rawFamily === 'string' ? rawFamily.trim() : '';
  if (!family || family.length > 100) {
    return null;
  }
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    return null;
  }

  const now = Date.now();
  const cached = filesCache.get(family);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.files;
  }

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&family=${encodeURIComponent(
    family,
  )}&fields=items(family,files)`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Google Fonts API responded with ${response.status}`);
  }

  const data = await response.json();
  const files = data.items?.[0]?.files || null;
  filesCache.set(family, { files, fetchedAt: now });
  return files;
};

const resetCatalogCache = () => {
  catalogCache = { items: null, fetchedAt: 0 };
  filesCache.clear();
};

module.exports = { getGoogleFontsCatalog, getGoogleFontFiles, resetCatalogCache };
