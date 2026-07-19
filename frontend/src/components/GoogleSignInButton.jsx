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

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  // Keep the latest callback without re-initializing GIS on each render.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;
    loadGisScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onCredentialRef.current?.(response.credential);
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
        });
      })
      .catch((error) => {
        logger.error('auth.google.script_failed', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId || failed) return null;

  return (
    <div
      ref={containerRef}
      data-testid="google-signin"
      className={`flex justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    />
  );
}
