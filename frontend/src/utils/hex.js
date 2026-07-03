// Pure helpers for the hex-color inputs (used by the palette editor). Kept out of
// the view so they can be unit-tested and reused.

// Normalize a hex input: force a leading '#', strip non-hex chars, uppercase.
export function normalizeHexInput(val) {
  if (val == null) return '#';
  let v = String(val).trim();
  if (!v.startsWith('#')) v = '#' + v;
  v = '#' + v.slice(1).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return v;
}

// Whether the given string is a valid 3- or 6-digit hex color (with or without '#').
export function isValidHexValue(value) {
  const hex = (value || '').trim();
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex.startsWith('#') ? hex : '#' + hex);
}

// keydown guard: prevent deleting the mandatory leading '#' via Backspace/Delete.
export function handleHexKeyDown(e) {
  const el = e.target;
  const selStart = el.selectionStart || 0;
  const selEnd = el.selectionEnd || 0;
  if ((e.key === 'Backspace' && selStart <= 1 && selEnd <= 1) || (e.key === 'Delete' && selStart === 0)) {
    e.preventDefault();
  }
}
