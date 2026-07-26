/**
 * A palette color's copyable representations, derived from its hex value.
 * HEX/RGB/HSL use CSS syntax (pasteable straight into code); HSB is plain
 * readable values, matching the sliders drawing apps like Procreate expose.
 * Reuses the conversions the palette exporters already ship.
 */
import { hexToRgb, rgbToHsb } from './paletteExport';

// '#0f0' / 'ff8800' -> '#00FF00' / '#FF8800'. Input is assumed already
// validated by the palette editor (see hex.js): normalize, don't defend.
const normalizeHex = (hex) => {
  let value = String(hex || '')
    .trim()
    .replace(/^#/, '');
  if (value.length === 3) {
    value = value.replace(/./g, (char) => char + char);
  }
  return `#${value.toUpperCase()}`;
};

// RGB (0-255) -> HSL, hue in [0, 1] like rgbToHsb, s/l in [0, 1].
const rgbToHsl = ({ r, g, b }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue /= 6;
    if (hue < 0) hue += 1;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: hue, s: saturation, l: lightness };
};

const toDegrees = (hue) => Math.round(hue * 360) % 360;
const toPercent = (ratio) => Math.round(ratio * 100);

/**
 * Returns the color's formats as [{ id, label, value }], in menu order.
 */
export function getColorFormats(hex) {
  const normalized = normalizeHex(hex);
  const rgb = hexToRgb(normalized);
  const hsb = rgbToHsb(rgb);
  const hsl = rgbToHsl(rgb);

  return [
    { id: 'hex', label: 'HEX', value: normalized },
    { id: 'rgb', label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    {
      id: 'hsl',
      label: 'HSL',
      value: `hsl(${toDegrees(hsl.h)}, ${toPercent(hsl.s)}%, ${toPercent(hsl.l)}%)`,
    },
    {
      id: 'hsb',
      label: 'HSB',
      value: `${toDegrees(hsb.h)}°, ${toPercent(hsb.s)}%, ${toPercent(hsb.b)}%`,
    },
  ];
}

/**
 * The selectable display formats (id + short label), in display order — the
 * single source of truth for the palette's format toggle.
 */
export const COLOR_FORMATS = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
  { id: 'hsb', label: 'HSB' },
];

const COLOR_FORMAT_IDS = new Set(COLOR_FORMATS.map((format) => format.id));

/** Whether `id` is one of the supported display formats. */
export const isColorFormat = (id) => COLOR_FORMAT_IDS.has(id);

/**
 * A single color's value in the requested format id ('hex' | 'rgb' | 'hsl' |
 * 'hsb'), falling back to HEX for an unknown id.
 */
export function formatColor(hex, formatId = 'hex') {
  const formats = getColorFormats(hex);
  return (formats.find((format) => format.id === formatId) || formats[0]).value;
}
