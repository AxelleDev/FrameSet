// Soft duplicate detection for the creation/edit dialogs: these helpers only
// FIND the clash — the dialogs show it as an info notice and never block the
// submit, because a duplicate can be deliberate (two "shadow" colors for two
// characters, a second "Sketch" project…). Warn, don't forbid.

/**
 * Canonical form of a hex color for equality checks: '#abc' and '#AABBCC'
 * are the same color. Returns null for anything that isn't a full color.
 */
export function canonicalHex(hex) {
  if (typeof hex !== 'string') return null;
  const cleaned = hex.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`;
  }
  if (/^[0-9A-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`;
  }
  return null;
}

/**
 * The palette entry already using `hex` (ignoring the one being edited via
 * `excludeId`), or null. Compares canonical forms, so format differences
 * never hide a real duplicate.
 */
export function findDuplicateColor(palette, hex, { excludeId } = {}) {
  const candidate = canonicalHex(hex);
  if (!candidate) return null;
  return (
    (palette || []).find(
      (color) => String(color.id) !== String(excludeId) && canonicalHex(color.hex) === candidate,
    ) || null
  );
}

/**
 * The item whose name matches `value` (trimmed, case-insensitive), ignoring
 * the one being edited via `excludeId`, or null. An empty value never
 * matches anything. Used for project names, brush usages and typography
 * usages alike — pass `getValue` to point at the right field.
 */
export function findDuplicateByName(items, value, { getValue, excludeId } = {}) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return (
    (items || []).find(
      (item) =>
        String(item.id) !== String(excludeId) &&
        String(getValue(item) || '')
          .trim()
          .toLowerCase() === normalized,
    ) || null
  );
}
