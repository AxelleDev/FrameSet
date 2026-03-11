// Service centralisé pour les appels réseau vers l'API backend.
// Fournit des helpers `get/post/put/patch/delete` et gère le token auth.
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
const request = async (path, { method = 'GET', body, headers, signal, onGlobalError } = {}) => {
  const requestStartedAt = Date.now();
  const opts = { method, headers: buildHeaders(body != null, headers) };
  if (body != null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
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
