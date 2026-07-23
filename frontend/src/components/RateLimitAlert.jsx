import React from 'react';
import PropTypes from 'prop-types';
import Alert from './Alert';
import useCountdown from '../hooks/useCountdown';
import { formatCountdown } from '../utils/date';

// Backend rate-limit messages end with a static "..., try again in <duration>."
// clause (see the various rate limiters in backend/src). Strip it so it can be
// replaced by a live countdown built from the actual Retry-After header.
const RETRY_CLAUSE = /,?\s*(please\s+)?try again in [^.]*\.?\s*$/i;

/**
 * Drop-in replacement for <Alert variant="danger"> on a 429: shows the same
 * message, but with a ticking "try again in Xs" instead of a static duration
 * (which is only ever a worst-case, since Retry-After reflects the real
 * remaining time in the current rate-limit window).
 */
export default function RateLimitAlert({ message, retryAfterSeconds, className = '' }) {
  const remaining = useCountdown(retryAfterSeconds);

  if (!message) return null;

  if (!Number.isFinite(retryAfterSeconds)) {
    return (
      <Alert variant="danger" className={className}>
        {message}
      </Alert>
    );
  }

  const base = message.replace(RETRY_CLAUSE, '').trim();
  const suffix =
    remaining > 0 ? `Try again in ${formatCountdown(remaining)}.` : 'You can try again now.';

  return (
    <Alert variant="danger" className={className}>
      {base}. {suffix}
    </Alert>
  );
}

RateLimitAlert.propTypes = {
  message: PropTypes.string,
  retryAfterSeconds: PropTypes.number,
  className: PropTypes.string,
};
