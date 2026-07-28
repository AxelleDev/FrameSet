// Date/time formatting helpers, shared across pages so the app has a single place
// for these (and they can be unit-tested).

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Formats a project's `lastEdited` for the "Edited " prefix: the API sends an
// ISO timestamp (or the 'Just now' sentinel for a project just created/renamed
// locally). Rendered in the viewer's OWN timezone (not the server's) as an
// unambiguous "on 2 Jul at 14:30" (not "02/07", which reads as a US date).
export function formatModified(value) {
  if (!value) return '';
  if (String(value).trim().toLowerCase() === 'just now') return 'just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';

  const day = date.getDate();
  const monthName = MONTH_ABBREVIATIONS[date.getMonth()];
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `on ${day} ${monthName} at ${time}`;
}

// Coarse "time ago" label from a date/ISO string; "Never changed" for missing or
// invalid dates. Used for the password-updated timestamp on the profile.
export function formatRelativeTime(dateValue) {
  if (!dateValue) return 'Never changed';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Never changed';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

// Formats a rate-limit retry wait as "1h 05m", "2:30" or "45s" depending on
// magnitude, so a countdown reads naturally whether the window is an hour or
// a few seconds.
export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}
