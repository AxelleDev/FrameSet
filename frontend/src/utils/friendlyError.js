/**
 * Maps a raw/technical error message to friendly, user-facing English text.
 * Used to surface global (server/session/network) errors as a toast rather than
 * exposing internal wording. Returns null when there is no message.
 *
 * @param {string} message - Raw error message.
 * @returns {string|null} A friendly message, or null when there is nothing to show.
 */
export function getFriendlyMessage(message) {
  if (!message) return null;
  if (typeof message !== 'string') return 'Something went wrong.';

  if (message.match(/csrf/i)) {
    return "Couldn't reach the server. Check your connection or try again later.";
  }
  if (message.match(/not found|404/i)) {
    return "The requested service is unavailable or doesn't exist. Please try again later.";
  }
  if (message.match(/internal server error|500/i)) {
    return 'An internal server error occurred. Please try again later.';
  }
  if (message.match(/network|failed to fetch|fetch/i)) {
    return "Couldn't reach the server. Check your connection or try again later.";
  }
  if (message.match(/unauthorized|401/i)) {
    return "You're not authorized. Please sign in again.";
  }
  if (message.match(/forbidden|403/i)) {
    return "Access denied. You don't have the required permissions.";
  }
  if (message.match(/timeout|timed out/i)) {
    return 'The server is taking too long to respond. Please try again later.';
  }
  if (message.trim() === 'Not Found') {
    return "The requested service is unavailable or doesn't exist. Please try again later.";
  }
  // Fallback for technical messages that are too short to be meaningful.
  if (message.trim().length < 5) {
    return 'Something went wrong. Please try again.';
  }
  return message;
}
