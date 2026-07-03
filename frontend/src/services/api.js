/**
 * Network layer: per-verb helpers over a single `request`. The session rides in
 * HttpOnly cookies (credentials: 'include'), so this module never stores the
 * access token — it only manages the CSRF token and transparently handles:
 *   1. CSRF protection for mutating requests (token caching + retry).
 *   2. Silent access-token refresh on 403, then a single replay.
 *   3. Retrying transient failures (network, 5xx, timeouts) within a time budget.
 */
const API_URL = import.meta.env.VITE_API_URL || '/api';
const RETRY_WINDOW_MS = 5000;      // total budget for retrying a single request
const RETRY_INTERVAL_MS = 500;     // delay between transient-failure retries
const COOKIE_PROPAGATION_DELAY_MS = 100; // brief pause after a token refresh so the new auth cookie is applied before the replay
const CSRF_HEADER_NAME = 'x-csrf-token';
const METHODS_REQUIRING_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Module-level CSRF token cache shared across all requests.
// csrfTokenCache holds the last known good token; csrfTokenPromise de-dupes
// concurrent fetches so simultaneous mutations only trigger one token request.
let csrfTokenCache = null;
let csrfTokenPromise = null;

// Handler invoked when the session is terminally invalid (a 403 that a token
// refresh could not recover — e.g. logged out elsewhere, refresh token expired,
// or password changed on another device). The app registers it to clear the
// user and bounce to the login page.
let sessionExpiredHandler = null;
export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = handler;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Needs a CSRF token: mutating methods only, and never the CSRF endpoint itself
// (which would otherwise be a chicken-and-egg).
const isCsrfProtectedRequest = (method, path) => (
  METHODS_REQUIRING_CSRF.has(String(method || '').toUpperCase())
  && path !== '/auth/csrf-token'
);

// Detects a 403 caused by an invalid/expired CSRF token (vs. an expired access
// token), so we refresh the CSRF token and replay instead of a full auth refresh.
const isInvalidCsrfError = (error) => (
  error?.status === 403
  && String(error?.data?.error || '').toLowerCase().includes('csrf')
);

// Returns a valid CSRF token, fetching from the backend if needed. Cached and
// reused across requests; a shared in-flight promise de-dupes concurrent callers.
// forceRefresh bypasses both (used after the server rejects the cached token).
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
      throw new Error('Failed to retrieve the CSRF token.');
    }

    const data = await res.json().catch(() => null);
    if (!data?.csrfToken || typeof data.csrfToken !== 'string') {
      throw new Error('Invalid CSRF token.');
    }

    csrfTokenCache = data.csrfToken;
    return csrfTokenCache;
  })();

  try {
    return await csrfTokenPromise;
  } finally {
    // Always clear the in-flight promise so the next call can refetch if needed.
    csrfTokenPromise = null;
  }
};

// Merges headers, adding the JSON content-type when a body is sent.
const buildHeaders = (isJson = true, extra = {}) => {
  const headers = { ...extra };
  if (isJson) headers['Content-Type'] = 'application/json';
  return headers;
};

// Refreshes the access token via the refresh cookie. The refresh endpoint is
// itself CSRF-protected, so we get a CSRF token first and, on a 403, force-refresh
// it once and retry. Returns true if a new access token was issued.
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

    // A 403 here likely means the cached CSRF token is stale; refresh and retry once.
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

/**
 * Generic request driver behind the per-verb helpers. Responsibilities, in order:
 *  - Attach a CSRF token to mutating requests.
 *  - Enforce a total RETRY_WINDOW_MS budget; each attempt aborts when the
 *    remaining budget elapses (acts as a timeout).
 *  - Invalid-CSRF 403: force-refresh the token and replay once.
 *  - Generic 403 (expired access token): silent token refresh, then replay once.
 *  - Retry transient failures (network, 5xx, timeout aborts) until the budget
 *    runs out; surface a user-facing message via onGlobalError.
 *
 * Throws an enriched Error (.status/.data) on non-ok HTTP, or a
 * REQUEST_RETRY_TIMEOUT error when the budget is exhausted. Notable options:
 * signal (caller abort, e.g. unmount) and skipTokenRefresh (used during hydration).
 */
const request = async (path, {
  method = 'GET',
  body,
  headers,
  signal,
  onGlobalError,
  skipTokenRefresh = false
} = {}) => {
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
  // Each recovery path (token refresh / CSRF refresh) is attempted at most once
  // per request to avoid infinite replay loops.
  let hasAttemptedTokenRefresh = false;
  let hasAttemptedCsrfRefresh = false;

  while (true) {
    // Compute the time left in the retry budget before starting this attempt.
    const elapsedBeforeAttempt = Date.now() - requestStartedAt;
    const remainingBeforeAttempt = RETRY_WINDOW_MS - elapsedBeforeAttempt;

    if (remainingBeforeAttempt <= 0) {
      const timeoutErr = new Error("Couldn't reach the server. Check your connection or try again later.");
      timeoutErr.code = 'REQUEST_RETRY_TIMEOUT';
      if (typeof onGlobalError === 'function') {
        onGlobalError(timeoutErr.message);
      }
      throw timeoutErr;
    }

    // Per-attempt abort controller: fires when the remaining budget elapses
    // (timeout) and is also chained to the caller's signal so unmounts cancel it.
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
        // Enrich the error with status/data so callers and the recovery logic
        // below can branch on them (CSRF vs auth vs server errors).
        const errorMsg = data?.error || res.statusText || 'Unknown error.';
        const err = new Error(errorMsg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      // Caller-initiated abort: propagate without retrying.
      const parentAborted = signal?.aborted;
      if (e?.name === 'AbortError' && parentAborted) {
        throw e;
      }

      // Stale CSRF token: refresh it once and replay the same request.
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

      // Expired access token (generic 403): attempt a silent refresh, then
      // replay once. Skipped for the refresh endpoint itself to avoid recursion.
      if (e?.status === 403 && !skipTokenRefresh && !hasAttemptedTokenRefresh && path !== '/auth/refresh') {
        hasAttemptedTokenRefresh = true;
        const refreshSuccess = await attemptTokenRefresh();
        if (refreshSuccess) {
          opts = await buildRequestOptions();
          await sleep(COOKIE_PROPAGATION_DELAY_MS);
          continue;
        }
        // Refresh failed: the session is terminally invalid. Notify the app so
        // it can clear the user and redirect to login, then surface the error.
        if (typeof sessionExpiredHandler === 'function') {
          sessionExpiredHandler();
        }
      }

      // An unexpected 401 on a protected (non-auth) route means there is no valid
      // session at all. Treat it as terminal — clear the session rather than leave
      // a phantom logged-in UI. Auth endpoints (login/forgot/...) legitimately
      // return 401 for bad credentials and must not trigger a logout.
      if (e?.status === 401 && !path.startsWith('/auth/')) {
        if (typeof sessionExpiredHandler === 'function') {
          sessionExpiredHandler();
        }
        throw e;
      }

      // Classify the failure to decide whether a retry is worthwhile.
      const isNetworkError = e instanceof TypeError || e.message === 'Failed to fetch';
      const isServerError = typeof e?.status === 'number' && e.status >= 500;
      // Abort that was NOT caused by the caller means our own timeout fired.
      const isTimeoutAbort = e?.name === 'AbortError' && !parentAborted;
      // Only replay a transient failure for safe methods. A network error / 5xx /
      // timeout can hide a request the server actually processed, so retrying a
      // POST/PUT/PATCH/DELETE risks a duplicate side effect (e.g. two projects) or
      // a spurious 404 on a re-deleted resource. CSRF/token-refresh replays above
      // are unaffected: those only re-run a request the server definitively rejected.
      const isSafeMethod = normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
      const shouldRetry = (isNetworkError || isServerError || isTimeoutAbort) && isSafeMethod;

      if (!shouldRetry) {
        throw e;
      }

      const elapsed = Date.now() - requestStartedAt;
      const remaining = RETRY_WINDOW_MS - elapsed;

      // Budget exhausted: surface a friendly message globally and rethrow.
      if (remaining <= 0) {
        if (typeof onGlobalError === 'function') {
          if (isNetworkError || isTimeoutAbort) {
            onGlobalError("Couldn't reach the server. Check your connection or try again later.");
          } else {
            onGlobalError(e?.data?.error || e?.message || 'Server error.');
          }
        }
        throw e;
      }

      // Wait before the next attempt, but never longer than the budget left.
      await sleep(Math.min(RETRY_INTERVAL_MS, remaining));
    } finally {
      // Tear down this attempt's timeout and signal listener before looping.
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }
};

// Public API: thin convenience wrappers around `request`, one per HTTP verb.
export default {
  get: (p, opts) => request(p, { method: 'GET', ...opts }),
  post: (p, b, opts) => request(p, { method: 'POST', body: b, ...opts }),
  put: (p, b, opts) => request(p, { method: 'PUT', body: b, ...opts }),
  patch: (p, b, opts) => request(p, { method: 'PATCH', body: b, ...opts }),
  delete: (p, b, opts) => request(p, { method: 'DELETE', body: b, ...opts })
};
