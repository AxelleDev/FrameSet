// Service centralise pour les appels reseau vers l'API backend.
// Fournit des fonctions utilitaires pour les methodes HTTP et gere le token d'authentification.
const API_URL = import.meta.env.VITE_API_URL || '/api';
const RETRY_WINDOW_MS = 5000;
const RETRY_INTERVAL_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Récupère le token stocké localement (si présent)
const getStoredToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem('frameset_user'));
    return u?.token || null;
  } catch (e) {
    return null;
  }
};

// Récupère le refresh token stocké localement
const getStoredRefreshToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem('frameset_user'));
    return u?.refreshToken || null;
  } catch (e) {
    return null;
  }
};

// Met à jour le token dans localStorage
const updateStoredToken = (newToken) => {
  try {
    const u = JSON.parse(localStorage.getItem('frameset_user'));
    if (u) {
      u.token = newToken;
      localStorage.setItem('frameset_user', JSON.stringify(u));
    }
  } catch (e) {
    // ignore
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

// Tente de rafraîchir le token et retourner true si succès
const attemptTokenRefresh = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    if (data.success && data.token) {
      updateStoredToken(data.token);
      clearToken(); // Reset explicit token so next request uses updated one
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
};

// Requete generique utilisee par les fonctions utilitaires ci-dessous.
// Lance une erreur enrichie si le status HTTP n'est pas ok.
const request = async (path, { method = 'GET', body, headers, signal, onGlobalError } = {}) => {
  const requestStartedAt = Date.now();
  let opts = { method, headers: buildHeaders(body != null, headers) };
  if (body != null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  
  let hasAttemptedTokenRefresh = false;
  
  while (true) {
    const elapsedBeforeAttempt = Date.now() - requestStartedAt;
    const remainingBeforeAttempt = RETRY_WINDOW_MS - elapsedBeforeAttempt;

    if (remainingBeforeAttempt <= 0) {
      const timeoutErr = new Error('Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.');
      timeoutErr.code = 'REQUEST_RETRY_TIMEOUT';
      if (typeof onGlobalError === 'function') {
        onGlobalError(timeoutErr.message);
      }
      throw timeoutErr;
    }

    const attemptController = new AbortController();
    const timeoutId = setTimeout(() => {
      attemptController.abort();
    }, remainingBeforeAttempt);
    const onAbort = () => attemptController.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const res = await fetch(`${API_URL}${path}`, { ...opts, signal: attemptController.signal });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      let data = null;
      try {
        data = isJson ? await res.json() : null;
      } catch (jsonErr) {
        data = null;
      }
      if (!res.ok) {
        const errorMsg = data?.error || res.statusText || 'Erreur inconnue';
        const err = new Error(errorMsg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      const parentAborted = signal?.aborted;
      if (e?.name === 'AbortError' && parentAborted) {
        throw e;
      }

      // Gestion spéciale des tokens expirés (403)
      if (e?.status === 403 && !hasAttemptedTokenRefresh && path !== '/auth/refresh') {
        hasAttemptedTokenRefresh = true;
        const refreshSuccess = await attemptTokenRefresh();
        if (refreshSuccess) {
          // Recréer les headers avec le nouveau token
          opts = { method, headers: buildHeaders(body != null, headers) };
          if (body != null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
          await sleep(100);
          continue;
        }
      }

      const isNetworkError = e instanceof TypeError || e.message === 'Failed to fetch';
      const isServerError = typeof e?.status === 'number' && e.status >= 500;
      const isTimeoutAbort = e?.name === 'AbortError' && !parentAborted;
      const shouldRetry = isNetworkError || isServerError || isTimeoutAbort;

      if (!shouldRetry) {
        throw e;
      }

      const elapsed = Date.now() - requestStartedAt;
      const remaining = RETRY_WINDOW_MS - elapsed;

      if (remaining <= 0) {
        if (typeof onGlobalError === 'function') {
          if (isNetworkError || isTimeoutAbort) {
            onGlobalError('Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.');
          } else {
            onGlobalError(e?.data?.error || e?.message || 'Erreur serveur');
          }
        }
        throw e;
      }

      await sleep(Math.min(RETRY_INTERVAL_MS, remaining));
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
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
