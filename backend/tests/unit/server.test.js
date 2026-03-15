jest.mock('../../src/app', () => ({
  listen: jest.fn((port, cb) => cb && cb())
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

describe('serveur', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('devrait démarrer le serveur et activer le scheduler de nettoyage', () => {
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

  it('devrait lancer cleanupExpiredRevokedTokens via le callback du scheduler', async () => {
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
});
