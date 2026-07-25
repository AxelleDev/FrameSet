/**
 * getColorFormats: the one source of a color's copyable representations.
 * HEX/RGB/HSL use CSS syntax (pasteable into code); HSB is plain readable
 * values, matching the sliders drawing apps like Procreate expose.
 */
import { describe, it, expect } from 'vitest';
import { getColorFormats } from '../../src/utils/colorFormats';

const byId = (formats, id) => formats.find((format) => format.id === id)?.value;

describe('getColorFormats', () => {
  it('returns the four formats for a saturated primary', () => {
    const formats = getColorFormats('#FF0000');
    expect(formats.map((f) => f.id)).toEqual(['hex', 'rgb', 'hsl', 'hsb']);
    expect(byId(formats, 'hex')).toBe('#FF0000');
    expect(byId(formats, 'rgb')).toBe('rgb(255, 0, 0)');
    expect(byId(formats, 'hsl')).toBe('hsl(0, 100%, 50%)');
    expect(byId(formats, 'hsb')).toBe('0°, 100%, 100%');
  });

  it('handles an achromatic gray (hue and saturation collapse to zero)', () => {
    const formats = getColorFormats('#808080');
    expect(byId(formats, 'rgb')).toBe('rgb(128, 128, 128)');
    expect(byId(formats, 'hsl')).toBe('hsl(0, 0%, 50%)');
    expect(byId(formats, 'hsb')).toBe('0°, 0%, 50%');
  });

  it('expands 3-digit hex and normalizes casing', () => {
    const formats = getColorFormats('#0f0');
    expect(byId(formats, 'hex')).toBe('#00FF00');
    expect(byId(formats, 'rgb')).toBe('rgb(0, 255, 0)');
    expect(byId(formats, 'hsl')).toBe('hsl(120, 100%, 50%)');
    expect(byId(formats, 'hsb')).toBe('120°, 100%, 100%');
  });

  it('rounds mixed colors to whole degrees and percents', () => {
    // #3C3D48: r60 g61 b72 — a desaturated dark blue (the brand primary).
    const formats = getColorFormats('#3C3D48');
    expect(byId(formats, 'rgb')).toBe('rgb(60, 61, 72)');
    expect(byId(formats, 'hsb')).toBe('235°, 17%, 28%');
    expect(byId(formats, 'hsl')).toBe('hsl(235, 9%, 26%)');
  });

  it('gives every format a short label for the copy menu', () => {
    const formats = getColorFormats('#123456');
    expect(formats.map((f) => f.label)).toEqual(['HEX', 'RGB', 'HSL', 'HSB']);
  });
});
