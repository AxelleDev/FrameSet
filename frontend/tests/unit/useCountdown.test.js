import { renderHook, act } from '@testing-library/react';
import useCountdown from '../../src/hooks/useCountdown';

describe('useCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks down by one every second and stops at 0', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toBe(0);
  });

  it('resets when the seconds prop changes (a fresh 429)', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ seconds }) => useCountdown(seconds), {
      initialProps: { seconds: 5 },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current).toBe(2);

    rerender({ seconds: 10 });
    expect(result.current).toBe(10);
  });
});
