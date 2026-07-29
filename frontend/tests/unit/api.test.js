import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The api module manages CSRF, silent refresh and a transient-retry budget over a
// single fetch. These tests exercise the risky branches: CSRF header injection, the
// terminal-401 logout, and the safe-method-only retry gate (no duplicate mutations).
describe('api service', () => {
  let api;
  let setSessionExpiredHandler;
  let setSessionRefreshedHandler;

  const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });

  beforeEach(async () => {
    vi.resetModules(); // fresh module = empty CSRF cache + null session handler
    global.fetch = vi.fn();
    const mod = await import('../../src/services/api');
    api = mod.default;
    setSessionExpiredHandler = mod.setSessionExpiredHandler;
    setSessionRefreshedHandler = mod.setSessionRefreshedHandler;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON for a successful GET (no CSRF fetch)', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { count: 3 }));
    await expect(api.get('/users/count')).resolves.toEqual({ count: 3 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws an enriched error (status + data) on a non-ok response', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(400, { error: 'Bad input' }));
    await expect(api.get('/users/count')).rejects.toMatchObject({
      status: 400,
      data: { error: 'Bad input' },
    });
  });

  it('fetches a CSRF token then sends it as a header on a POST', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok-123' })) // GET /auth/csrf-token
      .mockResolvedValueOnce(jsonResponse(200, { success: true })); // POST

    await expect(api.post('/projects', { name: 'X' })).resolves.toEqual({ success: true });

    const [csrfUrl] = global.fetch.mock.calls[0];
    const [postUrl, postOptions] = global.fetch.mock.calls[1];
    expect(csrfUrl).toContain('/auth/csrf-token');
    expect(postUrl).toContain('/projects');
    expect(postOptions.method).toBe('POST');
    expect(postOptions.headers['x-csrf-token']).toBe('tok-123');
  });

  it('treats a 401 on a protected route as terminal (logout) without retrying', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    global.fetch.mockResolvedValue(jsonResponse(401, { error: 'No session' }));

    await expect(api.get('/users/profile')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1); // no retry
  });

  it('calls the session-refreshed handler after a successful silent refresh', async () => {
    const onRefreshed = vi.fn();
    setSessionRefreshedHandler(onRefreshed);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Access token expired' })) // GET /users/profile
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok' })) // GET /auth/csrf-token
      .mockResolvedValueOnce(jsonResponse(200, { success: true })) // POST /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 })); // retried GET /users/profile

    await expect(api.get('/users/profile')).resolves.toEqual({ id: 1 });
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it('does not retry a POST on a network error (avoids duplicate mutations)', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok' })) // CSRF
      .mockRejectedValue(new TypeError('Failed to fetch')); // POST network error

    await expect(api.post('/projects', { name: 'X' })).rejects.toBeInstanceOf(TypeError);
    // CSRF fetch + exactly one POST attempt — the transient retry is GET/HEAD only.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries a GET after a transient network error and returns the eventual success', async () => {
    global.fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // attempt 1: network blip
      .mockResolvedValueOnce(jsonResponse(200, { id: 7 })); // attempt 2: recovered

    await expect(api.get('/users/profile')).resolves.toEqual({ id: 7 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up with REQUEST_RETRY_TIMEOUT once the retry budget is exhausted', async () => {
    const onGlobalError = vi.fn();
    // Fast-forward the budget clock instead of really waiting 5s: the request
    // reads Date.now() at start, after the failure, and at the next loop top.
    const t0 = 1_000_000;
    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(t0) // requestStartedAt
      .mockReturnValueOnce(t0) // elapsedBeforeAttempt (attempt 1)
      .mockReturnValueOnce(t0 + 4800) // elapsed after the failure (200ms budget left)
      .mockReturnValue(t0 + 5100); // next loop top: budget exhausted
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.get('/users/profile', { onGlobalError })).rejects.toMatchObject({
      code: 'REQUEST_RETRY_TIMEOUT',
    });
    expect(onGlobalError).toHaveBeenCalledWith(
      "Couldn't reach the server. Check your connection or try again later.",
    );
    nowSpy.mockRestore();
  });

  it('force-refreshes a stale CSRF token and replays the mutation once', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'stale' })) // initial CSRF fetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Invalid CSRF request.' })) // POST rejected
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'fresh' })) // forced CSRF refetch
      .mockResolvedValueOnce(jsonResponse(200, { success: true })); // replayed POST

    await expect(api.post('/projects', { name: 'X' })).resolves.toEqual({ success: true });

    const replayedOptions = global.fetch.mock.calls[3][1];
    expect(replayedOptions.headers['x-csrf-token']).toBe('fresh');
  });

  it('retries the silent refresh once with a fresh CSRF token when it is rejected', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Access token expired' })) // GET
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'stale' })) // CSRF for refresh
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Invalid CSRF request.' })) // refresh rejected
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'fresh' })) // forced CSRF refetch
      .mockResolvedValueOnce(jsonResponse(200, { success: true })) // refresh succeeds
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 })); // replayed GET

    await expect(api.get('/users/profile')).resolves.toEqual({ id: 1 });
  });

  it('declares the session expired when the silent refresh definitively fails', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Access token expired' })) // GET
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok' })) // CSRF for refresh
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Invalid CSRF request.' })) // refresh rejected
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'tok2' })) // forced CSRF refetch
      .mockResolvedValueOnce(jsonResponse(403, { error: 'Nope' })); // refresh still rejected

    await expect(api.get('/users/profile')).rejects.toMatchObject({ status: 403 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('exposes the Retry-After delay on a 429', async () => {
    const headers = { 'content-type': 'application/json', 'retry-after': '42' };
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
      json: async () => ({ error: 'Too many requests.' }),
    });

    await expect(api.get('/users/count')).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 42,
    });
  });

  it('fails a mutation when the CSRF endpoint itself is down', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' })); // CSRF fetch

    await expect(api.post('/projects', { name: 'X' })).rejects.toThrow(
      'Failed to retrieve the CSRF token.',
    );
  });

  it('fails a mutation when the CSRF endpoint returns an invalid payload', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { nope: true })); // CSRF fetch

    await expect(api.post('/projects', { name: 'X' })).rejects.toThrow('Invalid CSRF token.');
  });
});
