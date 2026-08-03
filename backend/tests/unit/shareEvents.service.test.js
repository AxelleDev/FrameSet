/**
 * The live-share event hub: subscription registry, SSE frame format, the
 * per-project cap, and the keep-alive heartbeat.
 */
const shareEvents = require('../../src/services/shareEvents.service');

const makeRes = () => ({ write: jest.fn() });

describe('shareEvents service', () => {
  afterEach(() => {
    shareEvents.resetForTests();
    jest.useRealTimers();
  });

  it('notifies every subscriber of the changed project with a proper SSE frame', () => {
    const resA = makeRes();
    const resB = makeRes();
    const other = makeRes();
    shareEvents.subscribe(7, resA);
    shareEvents.subscribe(7, resB);
    shareEvents.subscribe(8, other);

    shareEvents.notifyProjectChanged(7);

    expect(resA.write).toHaveBeenCalledWith('event: changed\ndata: {}\n\n');
    expect(resB.write).toHaveBeenCalledWith('event: changed\ndata: {}\n\n');
    expect(other.write).not.toHaveBeenCalled();
  });

  it('notifying a project with no subscribers is a no-op', () => {
    expect(() => shareEvents.notifyProjectChanged(999)).not.toThrow();
  });

  it('stops notifying after unsubscribe', () => {
    const res = makeRes();
    shareEvents.subscribe(7, res);
    shareEvents.unsubscribe(7, res);

    shareEvents.notifyProjectChanged(7);

    expect(res.write).not.toHaveBeenCalled();
  });

  it('a broken subscriber never breaks the broadcast to the others', () => {
    const broken = {
      write: jest.fn(() => {
        throw new Error('EPIPE');
      }),
    };
    const healthy = makeRes();
    shareEvents.subscribe(7, broken);
    shareEvents.subscribe(7, healthy);

    expect(() => shareEvents.notifyProjectChanged(7)).not.toThrow();
    expect(healthy.write).toHaveBeenCalledWith('event: changed\ndata: {}\n\n');
  });

  it('refuses subscribers beyond the per-project cap', () => {
    for (let i = 0; i < shareEvents.MAX_SUBSCRIBERS_PER_PROJECT; i += 1) {
      expect(shareEvents.subscribe(7, makeRes())).toBe(true);
    }
    expect(shareEvents.subscribe(7, makeRes())).toBe(false);
    // Another project is unaffected by the full one.
    expect(shareEvents.subscribe(8, makeRes())).toBe(true);
  });

  it('sends a heartbeat comment to keep proxies from reaping idle streams', () => {
    jest.useFakeTimers();
    const res = makeRes();
    shareEvents.subscribe(7, res);

    jest.advanceTimersByTime(shareEvents.HEARTBEAT_MS);

    expect(res.write).toHaveBeenCalledWith(': ping\n\n');
  });
});
