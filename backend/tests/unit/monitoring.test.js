jest.mock('@sentry/node');

const Sentry = require('@sentry/node');

// Loads a fresh copy of the module so each test controls SENTRY_DSN and the
// module's internal "initialized" state from scratch.
const loadMonitoring = () => {
  let monitoring;
  jest.isolateModules(() => {
    monitoring = require('../../src/utils/monitoring');
  });
  return monitoring;
};

describe('monitoring (optional Sentry integration)', () => {
  const ORIGINAL_DSN = process.env.SENTRY_DSN;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.SENTRY_DSN;
  });

  afterAll(() => {
    if (ORIGINAL_DSN === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = ORIGINAL_DSN;
    }
  });

  it('stays a complete no-op without SENTRY_DSN', async () => {
    const monitoring = loadMonitoring();

    expect(monitoring.initMonitoring()).toBe(false);
    monitoring.captureException(new Error('boom'));
    await monitoring.flushMonitoring();

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.flush).not.toHaveBeenCalled();
  });

  it('initializes Sentry with an errors-only, no-PII configuration when a DSN is set', () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    const monitoring = loadMonitoring();

    expect(monitoring.initMonitoring()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.example/1',
        tracesSampleRate: 0,
        sendDefaultPii: false,
      }),
    );
  });

  it('forwards captured exceptions with their context once initialized', () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    const monitoring = loadMonitoring();
    monitoring.initMonitoring();

    const error = new Error('boom');
    monitoring.captureException(error, { requestId: 'req-1' });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { requestId: 'req-1' },
    });
  });

  it('never lets the SDK throw into app code', async () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    const monitoring = loadMonitoring();
    monitoring.initMonitoring();
    Sentry.captureException.mockImplementation(() => {
      throw new Error('sdk exploded');
    });
    Sentry.flush.mockRejectedValue(new Error('flush failed'));

    expect(() => monitoring.captureException(new Error('boom'))).not.toThrow();
    await expect(monitoring.flushMonitoring()).resolves.toBeUndefined();
  });

  it('reports init failure without crashing the app', () => {
    process.env.SENTRY_DSN = 'https://key@sentry.example/1';
    const monitoring = loadMonitoring();
    Sentry.init.mockImplementation(() => {
      throw new Error('bad dsn');
    });

    expect(monitoring.initMonitoring()).toBe(false);
  });
});
