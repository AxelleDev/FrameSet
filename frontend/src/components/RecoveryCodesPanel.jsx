import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';
import useClipboard from '../hooks/useClipboard';

// The one-time display of freshly minted 2FA recovery codes, shared by the
// enrollment modal and the profile's regenerate flow so the two can never
// drift apart: warning line, the codes as a real list (screen readers
// announce "list, 8 items"), a copy-all button, and the acknowledgement that
// closes the flow.
export default function RecoveryCodesPanel({ codes, onDone }) {
  const { copy, copiedValue } = useClipboard();

  return (
    <div className="space-y-4">
      <p className="text-sm text-primary">
        Store these somewhere safe. Each code works once, and gets you back in if you lose access to
        your authenticator app.
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl bg-primary/5 p-4 font-mono text-sm text-primary list-none">
        {codes.map((recoveryCode) => (
          <li key={recoveryCode}>{recoveryCode}</li>
        ))}
      </ul>

      <Button type="button" variant="outline" fullWidth onClick={() => copy(codes.join('\n'))}>
        {copiedValue ? 'Copied!' : 'Copy all codes'}
      </Button>

      <Button type="button" variant="primary" fullWidth onClick={onDone}>
        I&apos;ve saved my recovery codes
      </Button>
    </div>
  );
}

RecoveryCodesPanel.propTypes = {
  codes: PropTypes.arrayOf(PropTypes.string).isRequired,
  onDone: PropTypes.func.isRequired,
};
