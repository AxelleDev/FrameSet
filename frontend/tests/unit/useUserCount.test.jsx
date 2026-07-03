import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn() } }));
vi.mock('../../src/services/api', () => ({ default: apiMock }));

import useUserCount from '../../src/hooks/useUserCount';

describe('useUserCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the fetched count and passes an abort signal', async () => {
    apiMock.get.mockResolvedValueOnce({ count: 42 });
    const { result } = renderHook(() => useUserCount());

    await waitFor(() => expect(result.current).toBe(42));
    expect(apiMock.get).toHaveBeenCalledWith('/users/count', {
      signal: expect.any(AbortSignal),
    });
  });

  it('stays null when the request fails', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useUserCount());

    // Give the rejected promise a tick to settle; the hook keeps null.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('aborts the in-flight request on unmount', () => {
    apiMock.get.mockResolvedValueOnce({ count: 1 });
    const { unmount } = renderHook(() => useUserCount());
    const signal = apiMock.get.mock.calls[0][1].signal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
