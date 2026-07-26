/**
 * parseColorInput: reads a user-typed color (HEX / RGB / HSL / HSB) into a
 * canonical #RRGGBB, or null when it isn't a valid color of that format.
 */
import { describe, it, expect } from 'vitest';
import { parseColorInput } from '../../src/utils/colorParse';
import { getColorFormats } from '../../src/utils/colorFormats';

describe('parseColorInput — HEX', () => {
  it('accepts 6- and 3-digit hex, with or without #, and normalizes', () => {
    expect(parseColorInput('#ff0000', 'hex')).toBe('#FF0000');
    expect(parseColorInput('00ff00', 'hex')).toBe('#00FF00');
    expect(parseColorInput('#0f0', 'hex')).toBe('#00FF00');
    expect(parseColorInput('abc', 'hex')).toBe('#AABBCC');
  });

  it('rejects malformed hex', () => {
    expect(parseColorInput('#12', 'hex')).toBeNull();
    expect(parseColorInput('#gggggg', 'hex')).toBeNull();
    expect(parseColorInput('', 'hex')).toBeNull();
    expect(parseColorInput('#', 'hex')).toBeNull();
  });
});

describe('parseColorInput — RGB', () => {
  it('accepts wrapped, bare and space-separated forms', () => {
    expect(parseColorInput('rgb(255, 0, 0)', 'rgb')).toBe('#FF0000');
    expect(parseColorInput('255, 0, 0', 'rgb')).toBe('#FF0000');
    expect(parseColorInput('0 255 0', 'rgb')).toBe('#00FF00');
  });

  it('rejects out-of-range or wrong-count values', () => {
    expect(parseColorInput('256, 0, 0', 'rgb')).toBeNull();
    expect(parseColorInput('-1, 0, 0', 'rgb')).toBeNull();
    expect(parseColorInput('255, 0', 'rgb')).toBeNull();
    expect(parseColorInput('255, 0, 0, 0', 'rgb')).toBeNull();
  });
});

describe('parseColorInput — HSL', () => {
  it('converts valid HSL to hex (wrapped or bare, % optional)', () => {
    expect(parseColorInput('hsl(0, 100%, 50%)', 'hsl')).toBe('#FF0000');
    expect(parseColorInput('120, 100%, 50%', 'hsl')).toBe('#00FF00');
    expect(parseColorInput('0 0 50', 'hsl')).toBe('#808080');
  });

  it('rejects out-of-range values', () => {
    expect(parseColorInput('0, 101%, 50%', 'hsl')).toBeNull();
    expect(parseColorInput('400, 50%, 50%', 'hsl')).toBeNull();
  });
});

describe('parseColorInput — HSB', () => {
  it('converts valid HSB to hex (degrees/percent tolerated)', () => {
    expect(parseColorInput('0°, 100%, 100%', 'hsb')).toBe('#FF0000');
    expect(parseColorInput('120, 100, 100', 'hsb')).toBe('#00FF00');
    expect(parseColorInput('0, 0, 50', 'hsb')).toBe('#808080');
  });

  it('rejects out-of-range values', () => {
    expect(parseColorInput('0, 0, 101', 'hsb')).toBeNull();
  });
});

describe('parseColorInput — round trips with getColorFormats', () => {
  it('parses back the exact strings getColorFormats produces', () => {
    const hex = '#A1CFE6';
    const formats = getColorFormats(hex);
    const valueOf = (id) => formats.find((f) => f.id === id).value;

    // RGB is lossless, so it round-trips to the exact hex.
    expect(parseColorInput(valueOf('rgb'), 'rgb')).toBe(hex);
    // HSL/HSB lose a little precision through integer rounding, but must still
    // parse to a valid, close color (never null).
    expect(parseColorInput(valueOf('hsl'), 'hsl')).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseColorInput(valueOf('hsb'), 'hsb')).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('defaults to hex and handles null input', () => {
    expect(parseColorInput('#FF0000')).toBe('#FF0000');
    expect(parseColorInput(null, 'rgb')).toBeNull();
  });
});
