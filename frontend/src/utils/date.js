// Date/time formatting helpers, shared across pages so the app has a single place
// for these (and they can be unit-tested).

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a project's `lastEdited` for the "Edited " prefix: the API sends
// "DD/MM HH:MM" or a sentinel; renders an unambiguous "on 2 Jul at 14:30" (not
// "02/07", which reads as a US date) or "just now".
export function formatModified(value) {
  if (!value) return '';
  const match = /^(\d{2})\/(\d{2})\s+(\d{2}:\d{2})$/.exec(value);
  if (!match) return 'just now';
  const [, day, month, time] = match;
  const monthName = MONTH_ABBREVIATIONS[Number(month) - 1] || month;
  return `on ${Number(day)} ${monthName} at ${time}`;
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
