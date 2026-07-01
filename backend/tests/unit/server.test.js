const mockCloseServer = jest.fn((callback) => callback && callback());

jest.mock('../../src/app', () => ({
  listen: jest.fn((port, cb) => {
    cb && cb();
    return {
      close: mockCloseServer
    };
  })
}));

jest.mock('../../src/database', () => ({
  closePool: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/token.service', () => ({
  cleanupExpiredRevokedTokens: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('server', () => {
  let processOnSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockCloseServer.mockClear();
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
  });

  afterEach(() => {
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('starts the server and enables the cleanup scheduler', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => ({
      unref: jest.fn()
    }));
    const app = require('../../src/app');
    const { logger } = require('../../src/utils/logger');

    require('../../src/server');

    expect(app.listen).toHaveBeenCalled();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000);

    expect(logger.info).toHaveBeenCalledWith(
      'token.cleanup.scheduler.started',
      expect.objectContaining({
        intervalMs: 24 * 60 * 60 * 1000,
        frequency: '24h',
        retentionDays: 30
      })
    );

    setIntervalSpy.mockRestore();
  });

  it('registers a SIGTERM handler for the graceful shutdown', () => {
    require('../../src/server');

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('runs cleanupExpiredRevokedTokens via the scheduler callback', async () => {
    let scheduledCleanup;
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((callback) => {
      scheduledCleanup = callback;
      return { unref: jest.fn() };
    });
    const tokenService = require('../../src/services/token.service');
    require('../../src/server');

    await scheduledCleanup();

    expect(tokenService.cleanupExpiredRevokedTokens).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });

  it('closes the HTTP server and the DB pool during the graceful shutdown', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => ({
      unref: jest.fn()
    }));
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    const { logger } = require('../../src/utils/logger');
    const db = require('../../src/database');
    const serverModule = require('../../src/server');

    await serverModule.shutdownGracefully('SIGTERM');

    expect(mockCloseServer).toHaveBeenCalledTimes(1);
    expect(db.closePool).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Graceful shutdown started', { signal: 'SIGTERM' });
    expect(logger.info).toHaveBeenCalledWith('Graceful shutdown completed', { signal: 'SIGTERM' });
    expect(processExitSpy).toHaveBeenCalledWith(0);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });
});
