/**
 * Two-factor enrollment: fetches a fresh secret on open, renders it as a QR
 * code (scannable by any TOTP authenticator app) plus a manual-entry
 * fallback, then a confirm step and — once the code checks out — the
 * one-time recovery codes, shown exactly once and never retrievable again.
 * A mid-setup close just abandons the attempt; nothing is enabled until the
 * recovery codes step is acknowledged.
 */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';
import AppModal from './AppModal';
import FormField from './FormField';
import TextInput from './TextInput';
import Button from './Button';
import RateLimitAlert from './RateLimitAlert';
import RecoveryCodesPanel from './RecoveryCodesPanel';

const STEP_TITLES = {
  loading: 'Set up two-factor authentication',
  scan: 'Set up two-factor authentication',
  error: 'Set up two-factor authentication',
  'recovery-codes': 'Save your recovery codes',
};

export default function TwoFactorSetupModal({ isOpen, onClose, onEnabled }) {
  const { setupTotp, confirmTotpSetup } = useAuth();
  const [step, setStep] = useState('loading');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(undefined);
  const [busy, setBusy] = useState(false);

  // Starts a fresh enrollment every time the modal opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setStep('loading');
    setCode('');
    setSecret('');
    setQrDataUrl('');
    setError('');
    setRetryAfterSeconds(undefined);
    setRecoveryCodes([]);

    (async () => {
      const result = await setupTotp();
      if (cancelled) return;

      if (!result.success) {
        setError(result.message || 'Could not start setup. Please try again.');
        setRetryAfterSeconds(result.retryAfterSeconds);
        setStep('error');
        return;
      }

      setSecret(result.secret);
      setStep('scan');

      // Loaded on demand (like jsPDF elsewhere in the app) so QR rendering
      // never lands in the initial bundle. A failed/blocked import still
      // leaves the manual-entry secret usable, so setup isn't blocked on it.
      try {
        const { toDataURL } = await import('qrcode');
        const dataUrl = await toDataURL(result.otpauthUrl, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        /* the manual-entry secret below still works */
      }
    })();

    return () => {
      cancelled = true;
    };
    // setupTotp is intentionally excluded: it gets a new identity whenever
    // confirmTotpSetup updates the user (enrollment just succeeded), which
    // would otherwise re-run this effect and re-fetch setup right after
    // success — immediately clobbering the recovery-codes step with an
    // "already enabled" error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!code.trim()) {
      setError('Enter the 6-digit code from your app.');
      return;
    }

    setBusy(true);
    setError('');
    setRetryAfterSeconds(undefined);
    const result = await confirmTotpSetup(code.trim());
    setBusy(false);

    if (result.success) {
      setRecoveryCodes(result.recoveryCodes || []);
      setStep('recovery-codes');
    } else if (result.message) {
      setError(result.message);
      setRetryAfterSeconds(result.retryAfterSeconds);
    }
  };

  // Abandons setup (nothing was enabled yet at any step before recovery codes).
  const handleAbandon = () => {
    if (busy) return;
    onClose();
  };

  // Only reachable from the recovery-codes step: setup genuinely finished.
  const handleDone = () => {
    onClose();
    onEnabled?.();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={step === 'recovery-codes' ? handleDone : handleAbandon}
      title={STEP_TITLES[step]}
      subtitle={
        step === 'scan'
          ? 'Scan this with an authenticator app (Google Authenticator, Authy, 1Password…), then enter the code it shows.'
          : step === 'recovery-codes'
            ? "You won't be able to see these again."
            : undefined
      }
      showClose={false}
      panelClassName="max-w-lg"
    >
      {step === 'loading' && (
        <p className="py-8 text-center text-sm text-primary/60">Generating your secret…</p>
      )}

      {step === 'error' && (
        <div className="space-y-4">
          <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} />
          <div className="flex justify-end">
            <Button type="button" onClick={handleAbandon} variant="ghost" className="text-sm">
              Close
            </Button>
          </div>
        </div>
      )}

      {step === 'scan' && (
        <form onSubmit={handleConfirm} className="space-y-4">
          {qrDataUrl && (
            <div className="flex justify-center">
              <img
                src={qrDataUrl}
                alt="QR code to scan with your authenticator app"
                width={220}
                height={220}
                className="rounded-2xl border border-primary/10"
              />
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-primary/60 mb-1">Or enter this code manually:</p>
            <p className="font-mono text-sm tracking-widest text-primary break-all">{secret}</p>
          </div>

          <FormField label="Verification code">
            <TextInput
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoComplete="one-time-code"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus belongs in the code field once the QR is shown
              autoFocus
            />
          </FormField>

          {error && <RateLimitAlert message={error} retryAfterSeconds={retryAfterSeconds} />}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={handleAbandon}
              variant="ghost"
              className="text-sm"
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="text-sm"
              disabled={busy}
              loading={busy}
            >
              Enable
            </Button>
          </div>
        </form>
      )}

      {step === 'recovery-codes' && (
        <RecoveryCodesPanel codes={recoveryCodes} onDone={handleDone} />
      )}
    </AppModal>
  );
}

TwoFactorSetupModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onEnabled: PropTypes.func,
};
