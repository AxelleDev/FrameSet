import React, { useEffect, useState } from 'react';

/**
 * Shown while the browser reports no network. The PWA shell loads fine
 * offline (precached by the service worker), so without this banner the
 * failing API calls would be the only clue that nothing can be saved.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 mb-4 text-sm text-primary"
    >
      <svg
        className="w-4 h-4 shrink-0 text-primary/60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M8.5 8.6A9 9 0 003.5 12m3.4 3.4a4.5 4.5 0 015.6-.6m3-2.8a9 9 0 00-2.6-1.7M12 19.5h.01"
        />
      </svg>
      <span>You&apos;re offline — your projects are view-only until the connection is back.</span>
    </div>
  );
}
