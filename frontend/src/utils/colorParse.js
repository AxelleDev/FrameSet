/**
 * Parses a user-typed color in any supported format (HEX / RGB / HSL / HSB)
 * into a canonical `#RRGGBB` hex — the single form the app stores. The mirror of
 * colorFormats.js (which formats a hex OUT); this reads a value IN.
 *
 * Deliberately tolerant: it accepts the wrapped CSS form ("rgb(255, 85, 0)"),
 * bare numbers ("255, 85, 0" / "255 85 0"), and stray units ("20°, 100%, 90%").
 * Anything it can't turn into a valid, in-range color yields null, so callers
 * can show an error and block saving.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const rgbToHex = ({ r, g, b }) => {
  const channel = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
};

// Shared HSL/HSV → RGB core: given a chroma `c`, second component `x` and
// match-lightness `m`, place them by hue sextant. Returns channels in 0-255.
const placeByHue = (hue, c, x, m) => {
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};

// HSL (h 0-360, s/l 0-100) → RGB 0-255.
export const hslToRgb = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  return placeByHue(hue, c, x, lig - c / 2);
};

// HSB/HSV (h 0-360, s/b 0-100) → RGB 0-255.
const hsbToRgb = (h, s, b) => {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(b, 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  return placeByHue(hue, c, x, val - c);
};

// Pulls the numeric groups out of a string ("20°, 100%, 90%" -> [20, 100, 90]).
const extractNumbers = (text) => (String(text).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// #RGB / RRGGBB (with or without '#') -> normalized "#RRGGBB", or null.
const parseHex = (text) => {
  const trimmed = String(text).trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  let value = trimmed.replace(/^#/, '');
  if (value.length === 3) value = value.replace(/./g, (char) => char + char);
  return `#${value.toUpperCase()}`;
};

// Reads exactly three numbers within [0..max] per position, then converts to hex.
const parseTriplet = (text, maxima, toRgb) => {
  const numbers = extractNumbers(text);
  if (numbers.length !== 3) return null;
  const inRange = numbers.every((n, i) => n >= 0 && n <= maxima[i]);
  if (!inRange) return null;
  return rgbToHex(toRgb(numbers[0], numbers[1], numbers[2]));
};

/**
 * Parses `text` in the given format ('hex' | 'rgb' | 'hsl' | 'hsb') to a
 * canonical `#RRGGBB`, or null when it isn't a valid color of that format.
 */
export function parseColorInput(text, format = 'hex') {
  if (text == null) return null;
  switch (format) {
    case 'rgb':
      return parseTriplet(text, [255, 255, 255], (r, g, b) => ({ r, g, b }));
    case 'hsl':
      return parseTriplet(text, [360, 100, 100], (h, s, l) => hslToRgb(h, s, l));
    case 'hsb':
      return parseTriplet(text, [360, 100, 100], (h, s, b) => hsbToRgb(h, s, b));
    case 'hex':
    default:
      return parseHex(text);
  }
}
