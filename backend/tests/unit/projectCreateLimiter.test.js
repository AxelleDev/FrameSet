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
  healthCheckLimiter,
  PROJECT_CREATE_LIMIT,
  PROJECT_CREATE_WINDOW_MS,
  PROJECT_CREATE_LIMIT_MESSAGE,
} = require('../../src/middleware/projectCreateLimiter');

// The module builds more than one limiter, so select each one's options by its
// distinctive window rather than relying on call order.
const optionsFor = (windowMs) =>
  rateLimit.mock.calls.map((call) => call[0]).find((opts) => opts.windowMs === windowMs);

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

  it('builds a stricter per-minute limiter for the health probe', () => {
    const opts = optionsFor(60 * 1000);
    expect(opts.max).toBe(60);
    expect(opts.standardHeaders).toBe(true);

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    opts.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
