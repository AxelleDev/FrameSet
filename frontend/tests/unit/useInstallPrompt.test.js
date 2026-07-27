import { renderHook, act } from '@testing-library/react';
import useInstallPrompt from '../../src/hooks/useInstallPrompt';

// Builds the event Chromium fires when the app becomes installable.
function fakeInstallPromptEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('useInstallPrompt', () => {
  it('starts with nothing to offer (no prompt event, not iOS)', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.showIosInstallGuide).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('exposes canInstall once the browser fires beforeinstallprompt', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(fakeInstallPromptEvent());
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('re-triggers the stashed prompt and reports acceptance, one-shot', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fakeInstallPromptEvent('accepted');

    act(() => {
      window.dispatchEvent(event);
    });

    let accepted;
    await act(async () => {
      accepted = await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(accepted).toBe(true);
    // The event is single-use: the button must disappear until a new one fires.
    expect(result.current.canInstall).toBe(false);
  });

  it('reports a dismissed prompt as not accepted', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(fakeInstallPromptEvent('dismissed'));
    });

    let accepted;
    await act(async () => {
      accepted = await result.current.promptInstall();
    });

    expect(accepted).toBe(false);
  });

  it('hides everything once the app gets installed', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(fakeInstallPromptEvent());
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
    expect(result.current.showIosInstallGuide).toBe(false);
  });

  it('offers the manual guide on iOS Safari, where there is no install API', () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    try {
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.showIosInstallGuide).toBe(true);
      expect(result.current.canInstall).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    }
  });

  it('keeps the guide hidden for Chrome on iOS, which cannot add to the home screen', () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    try {
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current.showIosInstallGuide).toBe(false);
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
    }
  });
});
