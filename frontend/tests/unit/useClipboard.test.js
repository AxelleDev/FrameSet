import { renderHook, act } from '@testing-library/react';
import useClipboard from '../../src/hooks/useClipboard';

describe('useClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('copies the text and exposes copiedValue, then clears it after the timeout', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useClipboard({ timeout: 1000 }));

    await act(async () => {
      await result.current.copy('#FF0000');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#FF0000');
    expect(result.current.copiedValue).toBe('#FF0000');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copiedValue).toBeNull();

    vi.useRealTimers();
  });
});
