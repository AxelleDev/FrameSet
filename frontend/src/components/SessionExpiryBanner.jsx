import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Proactive "you'll be signed out soon" banner (see SESSION_WARNING_BEFORE_MS
 * in AuthContext): only ever appears for a tab left open and idle for a long
 * time, since any normal request silently renews the session first. Offers a
 * one-click way to renew before losing unsaved work.
 */
export default function SessionExpiryBanner() {
  const { sessionExpiringSoon, refreshAccessToken } = useAuth();
  const { showToast } = useToast();
  const [renewing, setRenewing] = useState(false);

  if (!sessionExpiringSoon) return null;

  const handleStaySignedIn = async () => {
    if (renewing) return;
    setRenewing(true);
    try {
      const ok = await refreshAccessToken();
      showToast(
        ok ? "You're still signed in." : 'Failed to renew your session.',
        ok ? 'success' : 'danger',
      );
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue/10 px-4 py-3 mb-4 text-sm text-primary"
    >
      <span>Your session will expire soon due to inactivity.</span>
      <button
        type="button"
        onClick={handleStaySignedIn}
        disabled={renewing}
        className="font-medium text-blue hover:text-primary transition-colors rounded focus-ring disabled:opacity-60"
      >
        {renewing ? 'Renewing…' : 'Stay signed in'}
      </button>
    </div>
  );
}
