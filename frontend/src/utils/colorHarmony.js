import { hexToRgb } from './paletteExport';
import { rgbToHsl } from './colorFormats';
import { hslToRgb, rgbToHex } from './colorParse';

// Rotates a hex color's hue by `degrees`, preserving saturation and lightness.
const rotateHue = (hex, degrees) => {
  // rgbToHsl gives h/s/l in [0, 1]; hslToRgb wants h in degrees and s/l in %.
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const hueDegrees = (((h * 360 + degrees) % 360) + 360) % 360;
  return rgbToHex(hslToRgb(hueDegrees, s * 100, l * 100));
};

/**
 * Harmony groups for a base hex, ready to render: each group has a label and
 * one or more { name, hex } colors. A gray base (no hue) yields grays — that's
 * expected, harmonies live in the hue channel.
 */
export function generateHarmonies(hex) {
  return [
    {
      id: 'complementary',
      label: 'Complementary',
      colors: [{ name: 'Complementary', hex: rotateHue(hex, 180) }],
    },
    {
      id: 'analogous',
      label: 'Analogous',
      colors: [
        { name: 'Analogous 1', hex: rotateHue(hex, -30) },
        { name: 'Analogous 2', hex: rotateHue(hex, 30) },
      ],
    },
    {
      id: 'triad',
      label: 'Triad',
      colors: [
        { name: 'Triad 1', hex: rotateHue(hex, 120) },
        { name: 'Triad 2', hex: rotateHue(hex, 240) },
      ],
    },
  ];
}
