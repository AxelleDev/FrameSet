// Service centralise pour les appels reseau vers l'API backend.
// Fournit des fonctions utilitaires pour les methodes HTTP et gere la session via cookies HttpOnly.
const API_URL = import.meta.env.VITE_API_URL || '/api';
const RETRY_WINDOW_MS = 5000;
const RETRY_INTERVAL_MS = 500;
const CSRF_HEADER_NAME = 'x-csrf-token';
const METHODS_REQUIRING_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfTokenCache = null;
let csrfTokenPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isCsrfProtectedRequest = (method, path) => (
  METHODS_REQUIRING_CSRF.has(String(method || '').toUpperCase())
  && path !== '/auth/csrf-token'
);

const isInvalidCsrfError = (error) => (
  error?.status === 403
  && String(error?.data?.error || '').toLowerCase().includes('csrf')
);

const fetchCsrfToken = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!forceRefresh && csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = (async () => {
    const res = await fetch(`${API_URL}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error('Impossible de recuperer le token CSRF.');
    }

    const data = await res.json().catch(() => null);
    if (!data?.csrfToken || typeof data.csrfToken !== 'string') {
      throw new Error('Token CSRF invalide.');
    }

    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
  })();

  try {
    return await csrfTokenPromise;
  } finally {
    csrfTokenPromise = null;
  }
};

// Construit les headers pour la requête (JSON + Authorization si présent)
const buildHeaders = (isJson = true, extra = {}) => {
  const headers = { ...extra };
  if (isJson) headers['Content-Type'] = 'application/json';
  return headers;
};

// Tente de rafraîchir le token et retourner true si succès
const attemptTokenRefresh = async () => {
  let csrfToken;

  try {
    csrfToken = await fetchCsrfToken();
  } catch (error) {
    return false;
  }

  const sendRefreshRequest = async (csrfHeaderValue) => fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER_NAME]: csrfHeaderValue
    },
    credentials: 'include'
  });

  try {
    let res = await sendRefreshRequest(csrfToken);

    if (res.status === 403) {
      const refreshedCsrfToken = await fetchCsrfToken({ forceRefresh: true });
      res = await sendRefreshRequest(refreshedCsrfToken);
    }

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    if (data.success) {
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
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const requiresCsrf = isCsrfProtectedRequest(normalizedMethod, path);

  const buildRequestOptions = async () => {
    const nextHeaders = { ...(headers || {}) };

    if (requiresCsrf) {
      const csrfToken = await fetchCsrfToken();
      nextHeaders[CSRF_HEADER_NAME] = csrfToken;
    }

    const nextOptions = {
      method: normalizedMethod,
      headers: buildHeaders(body != null, nextHeaders)
    };

    if (body != null) {
      nextOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return nextOptions;
  };

  const requestStartedAt = Date.now();

  let opts = await buildRequestOptions();
  let hasAttemptedTokenRefresh = false;
  let hasAttemptedCsrfRefresh = false;
  
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
      const res = await fetch(`${API_URL}${path}`, {
        ...opts,
        credentials: 'include',
        signal: attemptController.signal
      });
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

      if (isInvalidCsrfError(e) && requiresCsrf && !hasAttemptedCsrfRefresh) {
        hasAttemptedCsrfRefresh = true;

        try {
          await fetchCsrfToken({ forceRefresh: true });
          opts = await buildRequestOptions();
          continue;
        } catch (csrfError) {
          throw e;
        }
      }

      // Gestion spéciale des tokens expirés (403)
      if (e?.status === 403 && !hasAttemptedTokenRefresh && path !== '/auth/refresh') {
        hasAttemptedTokenRefresh = true;
        const refreshSuccess = await attemptTokenRefresh();
        if (refreshSuccess) {
          opts = await buildRequestOptions();
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
  delete: (p, b, opts) => request(p, { method: 'DELETE', body: b, ...opts })
};
