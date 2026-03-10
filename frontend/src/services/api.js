// Service centralisé pour les appels réseau vers l'API backend.
// Fournit des helpers `get/post/put/patch/delete` et gère le token auth.
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Récupère le token stocké localement (si présent)
const getStoredToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem('frameset_user'));
    return u?.token || null;
  } catch (e) {
    return null;
  }
};

let explicitToken = null;

// Permet d'écraser temporairement le token (utile après login)
export const setToken = (t) => { explicitToken = t; };
// Supprime le token explicite
export const clearToken = () => { explicitToken = null; };

// Construit les headers pour la requête (JSON + Authorization si présent)
const buildHeaders = (isJson = true, extra = {}) => {
  const headers = { ...extra };
  if (isJson) headers['Content-Type'] = 'application/json';
  const token = explicitToken || getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Requête générique utilisée par les helpers ci-dessous.
// Lance une erreur enrichie si le status HTTP n'est pas ok.
const request = async (path, { method = 'GET', body, headers, signal } = {}) => {
  const opts = { method, headers: buildHeaders(body != null, headers), signal };
  if (body != null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  try {
    const res = await fetch(`${API_URL}${path}`, opts);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : null;
    if (!res.ok) {
      if (onGlobalError && (res.status >= 500 || res.status === 0)) {
        onGlobalError('Le serveur est inaccessible, veuillez réessayer plus tard.');
      }
      const err = new Error(data?.error || res.statusText || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (e) {
    if (onGlobalError) {
      onGlobalError('Le serveur est inaccessible, veuillez réessayer plus tard.');
    }
    throw e;
  }
};

export default {
  get: (p, opts) => request(p, { method: 'GET', ...opts }),
  post: (p, b, opts) => request(p, { method: 'POST', body: b, ...opts }),
  put: (p, b, opts) => request(p, { method: 'PUT', body: b, ...opts }),
  patch: (p, b, opts) => request(p, { method: 'PATCH', body: b, ...opts }),
  delete: (p, b, opts) => request(p, { method: 'DELETE', body: b, ...opts }),
  setToken,
  clearToken,
};
