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
  paletteWriteLimiter,
  healthCheckLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE,
  PALETTE_WRITE_LIMIT,
  PALETTE_WRITE_WINDOW_MS,
  PALETTE_WRITE_LIMIT_MESSAGE,
} = require('../../src/middleware/projectCreateLimiter');

// The module builds more than one limiter, so select each one's options by its
// distinctive window rather than relying on call order. The creation and
// palette limiters share the same window, so `find` returns the creation one
// (built first); the palette limiter is selected by its distinctive max below.
const optionsFor = (windowMs) =>
  rateLimit.mock.calls.map((call) => call[0]).find((opts) => opts.windowMs === windowMs);

const optionsForMax = (max) =>
  rateLimit.mock.calls.map((call) => call[0]).find((opts) => opts.max === max);

describe('middleware projectCreateLimiter', () => {
  it('exports the expected configuration', () => {
    expect(PROJECT_CREATE_LIMIT).toBe(30);
    expect(PROJECT_CREATE_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(PROJECT_CREATE_LIMIT_MESSAGE).toMatch(/Too many project or standard creations/i);
    expect(typeof projectCreateLimiter).toBe('function');
    expect(typeof healthCheckLimiter).toBe('function');
  });

  it('builds the limiter with the right options', () => {
    const opts = optionsFor(PROJECT_CREATE_WINDOW_MS);
    expect(opts.max).toBe(PROJECT_CREATE_LIMIT);
    expect(opts.windowMs).toBe(PROJECT_CREATE_WINDOW_MS);
    expect(opts.standardHeaders).toBe(true);
    expect(opts.legacyHeaders).toBe(false);
  });

  it('generates a key per authenticated user', () => {
    expect(optionsFor(PROJECT_CREATE_WINDOW_MS).keyGenerator({ user: { id: 7 } })).toBe(
      'project-create:7',
    );
  });

  it('generates a key per IP for an anonymous visitor', () => {
    expect(optionsFor(PROJECT_CREATE_WINDOW_MS).keyGenerator({ ip: '203.0.113.5' })).toBe(
      'project-create:anonymous:ip:203.0.113.5',
    );
  });

  it('responds 429 with the dedicated message via the handler', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    optionsFor(PROJECT_CREATE_WINDOW_MS).handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: PROJECT_CREATE_LIMIT_MESSAGE });
  });

  it('builds a separate, more generous limiter for palette saves', () => {
    expect(PALETTE_WRITE_LIMIT).toBe(300);
    expect(PALETTE_WRITE_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(typeof paletteWriteLimiter).toBe('function');

    const opts = optionsForMax(PALETTE_WRITE_LIMIT);
    expect(opts.windowMs).toBe(PALETTE_WRITE_WINDOW_MS);
    expect(opts.standardHeaders).toBe(true);
    expect(opts.legacyHeaders).toBe(false);
  });

  it('keys palette saves separately from creations, per user then per IP', () => {
    const opts = optionsForMax(PALETTE_WRITE_LIMIT);
    expect(opts.keyGenerator({ user: { id: 7 } })).toBe('palette-write:7');
    expect(opts.keyGenerator({ ip: '203.0.113.5' })).toBe('palette-write:anonymous:ip:203.0.113.5');
  });

  it('responds 429 with the palette-specific message via the handler', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    optionsForMax(PALETTE_WRITE_LIMIT).handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: PALETTE_WRITE_LIMIT_MESSAGE });
  });

  it('builds a stricter per-minute limiter for the health probe', () => {
    const opts = optionsFor(60 * 1000);
    expect(opts.max).toBe(60);
    expect(opts.standardHeaders).toBe(true);

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    opts.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
