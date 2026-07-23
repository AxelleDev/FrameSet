/**
 * Re-authentication modal shown before critical account actions (email change,
 * account deletion): a session alone must not be enough. Accounts with a
 * password confirm with it; Google-only accounts confirm with a fresh Google
 * sign-in. onConfirm receives { currentPassword } or { googleCredential } and
 * may return { success: false, message } to surface an inline error.
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppModal from './AppModal';
import FormField from './FormField';
import PasswordInput from './PasswordInput';
import Button from './Button';
import RateLimitAlert from './RateLimitAlert';
import GoogleSignInButton from './GoogleSignInButton';

export default function ReauthModal({
  isOpen,
  onClose,
  title = 'Confirm your identity',
  subtitle,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
}) {
  const { user } = useAuth();
  const usesPassword = user?.hasPassword !== false;
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(undefined);
  const [busy, setBusy] = useState(false);

  // Fresh form every time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setRetryAfterSeconds(undefined);
    }
  }, [isOpen]);

  const submitCredentials = async (credentials) => {
    setBusy(true);
    setError('');
    setRetryAfterSeconds(undefined);
    try {
      const result = await onConfirm(credentials);
      if (result?.success === false) {
        setError(result.message || 'Verification failed. Please try again.');
        setRetryAfterSeconds(result.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError('Enter your current password.');
      return;
    }
    submitCredentials({ currentPassword: password });
  };

  const handleClose = () => {
    // Block closing while the action is in flight.
    if (busy) return;
    onClose();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      showClose={false}
      panelClassName="max-w-lg"
    >
      {usesPassword ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <FormField label="Current password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormField>

          {error && <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} />}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={handleClose}
              variant="ghost"
              className="text-sm"
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={danger ? 'danger' : 'primary'}
              className="text-sm"
              disabled={busy}
              loading={busy}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-primary/60">
            You sign in with Google — confirm with your Google account to continue.
          </p>

          <GoogleSignInButton
            onCredential={(credential) => submitCredentials({ googleCredential: credential })}
            disabled={busy}
          />

          {error && <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} />}

          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              onClick={handleClose}
              variant="ghost"
              className="text-sm"
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </AppModal>
  );
}
