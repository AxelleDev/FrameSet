import React from 'react';
import PropTypes from 'prop-types';

// Map raw/technical error messages to friendly, user-facing English text.
function getFriendlyMessage(message) {
  if (!message) return null;
  if (typeof message === 'string') {
    if (message.match(/not found|404/i)) {
      return "The requested service is unavailable or doesn't exist. Please check the URL or try again later.";
    }
    if (message.match(/internal server error|500/i)) {
      return "An internal server error occurred. Please try again later, or contact support if the problem persists.";
    }
    if (message.match(/network|failed to fetch|fetch/i)) {
      return "Couldn't reach the server. Check your connection or try again later.";
    }
    if (message.match(/unauthorized|401/i)) {
      return "You're not authorized to perform this action. Please sign in again.";
    }
    if (message.match(/forbidden|403/i)) {
      return "Access denied. You don't have the required permissions.";
    }
    if (message.match(/timeout|timed out/i)) {
      return "The server is taking too long to respond. Please try again later.";
    }
    if (message.trim() === 'Not Found') {
      return "The requested service is unavailable or doesn't exist. Please check the URL or try again later.";
    }
    // Fallback for technical messages that are too short to be meaningful.
    if (message.trim().length < 5) {
      return "Something went wrong. Please try again.";
    }
    return message;
  }
  return 'Something went wrong.';
}

/**
 * Fixed top-of-screen alert banner for global/application-level errors.
 * Normalizes the raw message into a friendly string and renders nothing when
 * there is no message to show. Styled with theme tokens (the `danger` color and
 * the `z-toast` stacking tier) so it stays consistent across light/dark mode.
 *
 * @param {object} props
 * @param {string} props.message - Raw error message to display (translated to a friendly variant).
 * @param {Function} [props.onClose] - Optional handler; when provided a dismiss button is shown.
 */
export default function GlobalErrorAlert({ message, onClose }) {
  const friendly = getFriendlyMessage(message);
  // Render nothing when there is no message to surface.
  if (!friendly) return null;
  return (
    <div
      role="alert"
      className="fixed top-0 left-0 z-toast flex min-h-[3rem] w-full items-center justify-center px-12 py-3 text-center font-bold text-white bg-danger"
    >
      <span>{friendly}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-1 text-white/90 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

GlobalErrorAlert.propTypes = {
  message: PropTypes.string,
  onClose: PropTypes.func,
};
