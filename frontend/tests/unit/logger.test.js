// The frontend logger's whole contract: forwards to the matching console
// method in development, and every level exists so call sites never crash.
import logger from '../../src/utils/logger';

describe('frontend logger', () => {
  it('exposes the four standard levels as functions', () => {
    for (const level of ['debug', 'info', 'warn', 'error']) {
      expect(typeof logger[level]).toBe('function');
    }
  });

  it('forwards to the matching console method (vitest runs in dev mode)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('event.name', { detail: 1 });
    expect(spy).toHaveBeenCalledWith('event.name', { detail: 1 });
    spy.mockRestore();
  });

  it('falls back to console.log for levels the console lacks', () => {
    const original = console.debug;
    // eslint-disable-next-line no-console
    console.debug = undefined;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('fallback.event');
    expect(logSpy).toHaveBeenCalledWith('fallback.event');
    logSpy.mockRestore();
    // eslint-disable-next-line no-console
    console.debug = original;
  });
});
