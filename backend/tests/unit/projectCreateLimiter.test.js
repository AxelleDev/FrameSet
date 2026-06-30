// Mock express-rate-limit so we can capture the options the middleware is built
// with and exercise its keyGenerator/handler in isolation (no real timers/store).
jest.mock('express-rate-limit', () => {
  const rateLimit = jest.fn((options) => {
    rateLimit.lastOptions = options;
    return jest.fn();
  });
  rateLimit.ipKeyGenerator = (ip) => `ip:${ip}`;
  return rateLimit;
});

const rateLimit = require('express-rate-limit');
const {
  projectCreateLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE
} = require('../../src/middleware/projectCreateLimiter');

describe('middleware projectCreateLimiter', () => {
  it('exporte la configuration attendue', () => {
    expect(PROJECT_CREATE_LIMIT).toBe(30);
    expect(PROJECT_CREATE_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(PROJECT_CREATE_LIMIT_MESSAGE).toMatch(/Trop de creations/i);
    expect(typeof projectCreateLimiter).toBe('function');
  });

  it('construit le limiter avec les bonnes options', () => {
    const opts = rateLimit.lastOptions;
    expect(opts.max).toBe(PROJECT_CREATE_LIMIT);
    expect(opts.windowMs).toBe(PROJECT_CREATE_WINDOW_MS);
    expect(opts.standardHeaders).toBe(true);
    expect(opts.legacyHeaders).toBe(false);
  });

  it('génère une clé par utilisateur authentifié', () => {
    expect(rateLimit.lastOptions.keyGenerator({ user: { id: 7 } })).toBe('project-create:7');
  });

  it("génère une clé par IP pour un visiteur anonyme", () => {
    expect(rateLimit.lastOptions.keyGenerator({ ip: '203.0.113.5' }))
      .toBe('project-create:anonymous:ip:203.0.113.5');
  });

  it('répond 429 avec le message dédié via le handler', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    rateLimit.lastOptions.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: PROJECT_CREATE_LIMIT_MESSAGE });
  });
});
