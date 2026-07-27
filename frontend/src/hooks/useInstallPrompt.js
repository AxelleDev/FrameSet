// Surfaces the browser's PWA install flow to the UI. Chromium fires a
// `beforeinstallprompt` event that must be stashed so a button can re-trigger
// it later; Safari on iOS has no install API at all, so callers get a flag to
// show "Add to Home Screen" instructions instead. Everything reports hidden
// once the app already runs installed (standalone window).
import { useEffect, useState } from 'react';

const runsStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// iPadOS Safari reports itself as macOS, but is the only "Mac" with touch.
// Chrome/Firefox/Edge on iOS are excluded: they can't add to the home screen.
const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(runsStandalone);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      // Without this Chrome on Android also shows its own mini-infobar.
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // The stashed event is one-shot: once prompted, the browser must fire a new
  // `beforeinstallprompt` before the button can work again, so drop it here.
  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice?.outcome === 'accepted';
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    showIosInstallGuide: !isInstalled && !deferredPrompt && isIosSafari(),
    isInstalled,
    promptInstall,
  };
}
