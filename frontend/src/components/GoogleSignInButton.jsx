/**
 * Official "Continue with Google" button (Google Identity Services).
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is not configured or the GIS
 * script cannot load, so the classic email/password flow is never blocked.
 * On success, the Google ID token is passed to onCredential; the backend
 * verifies it and issues the usual session cookies.
 */
import React, { useEffect, useRef, useState } from 'react';
import logger from '../utils/logger';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Loads the GIS script once for the whole app; concurrent callers share the promise.
let gisScriptPromise = null;
const loadGisScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisScriptPromise) {
    gisScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        // Allow a retry on the next mount (e.g. ad-blocker disabled since).
        gisScriptPromise = null;
        reject(new Error('Failed to load the Google sign-in script.'));
      };
      document.head.appendChild(script);
    });
  }
  return gisScriptPromise;
};

// GIS renders a fixed-width iframe; it accepts at most 400px.
const GIS_MAX_WIDTH = 400;
const GIS_MIN_WIDTH = 200;

/** Whether the app is currently in dark mode (the `dark` class on <html>). */
const isDarkTheme = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(isDarkTheme);
  // Keep the latest callback without re-initializing GIS on each render.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  // The GIS iframe can't be restyled with CSS, so watch the <html> class and
  // re-render the button in the matching Google theme when the user toggles.
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;
    loadGisScript()
      .then(() => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onCredentialRef.current?.(response.credential);
            }
          },
        });
        // Match the form fields' width (GIS caps at 400px). Clear first: this
        // effect re-runs on theme change and renderButton appends, not replaces.
        const width = Math.min(
          Math.max(Math.round(container.offsetWidth) || GIS_MAX_WIDTH, GIS_MIN_WIDTH),
          GIS_MAX_WIDTH,
        );
        container.innerHTML = '';
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          // The whole app is English; without this GIS falls back to the
          // browser locale and mixes languages on the page.
          locale: 'en',
          width,
        });
      })
      .catch((error) => {
        logger.error('auth.google.script_failed', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, dark]);

  if (!clientId || failed) return null;

  return (
    <div
      ref={containerRef}
      data-testid="google-signin"
      className={`flex w-full justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  );
}
