// The copy-with-feedback hook: async Clipboard API path, the execCommand
// fallback for non-secure contexts, failure reporting, and the auto-clearing
// "copied" feedback window.
import { renderHook, act } from '@testing-library/react';
import useClipboard from '../../src/hooks/useClipboard';

describe('useClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('copies via the async Clipboard API and exposes the copied value', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderHook(() => useClipboard());

    let ok;
    await act(async () => {
      ok = await result.current.copy('#112233');
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('#112233');
    expect(result.current.copiedValue).toBe('#112233');
  });

  it('clears the copied feedback after the timeout', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderHook(() => useClipboard({ timeout: 500 }));

    await act(async () => {
      await result.current.copy('#112233');
    });
    expect(result.current.copiedValue).toBe('#112233');

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.copiedValue).toBeNull();
  });

  it('falls back to the hidden-textarea execCommand path without the API', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useClipboard());

    let ok;
    await act(async () => {
      ok = await result.current.copy('fallback');
    });

    expect(ok).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result.current.copiedValue).toBe('fallback');
  });

  it('reports failure (and keeps no feedback) when the clipboard write throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderHook(() => useClipboard());

    let ok;
    await act(async () => {
      ok = await result.current.copy('nope');
    });

    expect(ok).toBe(false);
    expect(result.current.copiedValue).toBeNull();
  });
});
