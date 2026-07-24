import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Sets expectations up front for anyone browsing the shared read-only demo
 * account (see migration 019 + the write-block in authenticateToken.js), so
 * a blocked edit reads as intentional rather than a broken button.
 */
export default function DemoAccountBanner() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user?.isDemo) return null;

  // Signs out of the shared demo account first, so a new registration never
  // ends up tangled with the demo session's cookies.
  const handleCreateAccount = async () => {
    await logout();
    navigate('/register');
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue/10 px-4 py-3 mb-4 text-sm text-primary"
    >
      <span>You&apos;re exploring a read-only demo — changes won&apos;t be saved.</span>
      <button
        type="button"
        onClick={handleCreateAccount}
        className="font-medium text-blue hover:text-primary transition-colors rounded focus-ring"
      >
        Create a free account
      </button>
    </div>
  );
}
