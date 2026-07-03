/**
 * Récupère le catalogue Google Fonts côté serveur (clé en variable
 * d'environnement) pour ne jamais exposer la clé dans le bundle client. Le
 * catalogue étant stable, il est mis en cache en mémoire afin de ne pas
 * ré-appeler l'API Google à chaque requête.
 */

// 24 h : le catalogue Google Fonts évolue très lentement.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let catalogCache = { items: null, fetchedAt: 0 };

const getGoogleFontsCatalog = async () => {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  // Sans clé configurée, le sélecteur reste vide plutôt que d'échouer.
  if (!apiKey) {
    return [];
  }

  const now = Date.now();
  if (catalogCache.items && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.items;
  }

  // `fields` limite la réponse à ce que le sélecteur utilise réellement.
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&fields=items(family,variants)`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Fonts API responded with ${response.status}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  catalogCache = { items, fetchedAt: now };
  return items;
};

// Réinitialise le cache mémoire (utilisé par les tests).
const resetCatalogCache = () => {
  catalogCache = { items: null, fetchedAt: 0 };
};

module.exports = { getGoogleFontsCatalog, resetCatalogCache };
