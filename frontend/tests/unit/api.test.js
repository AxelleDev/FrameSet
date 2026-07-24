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
});
