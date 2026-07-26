/**
 * generateHarmonies: hue-rotation color suggestions from a base color.
 */
import { describe, it, expect } from 'vitest';
import { generateHarmonies } from '../../src/utils/colorHarmony';

const flat = (hex) =>
  generateHarmonies(hex).reduce((acc, group) => {
    acc[group.id] = group.colors.map((c) => c.hex);
    return acc;
  }, {});

describe('generateHarmonies', () => {
  it('returns the three groups with labels and named colors', () => {
    const groups = generateHarmonies('#FF0000');
    expect(groups.map((g) => g.id)).toEqual(['complementary', 'analogous', 'triad']);
    expect(groups.map((g) => g.label)).toEqual(['Complementary', 'Analogous', 'Triad']);
    expect(groups[0].colors[0]).toEqual({ name: 'Complementary', hex: '#00FFFF' });
    expect(groups[1].colors.map((c) => c.name)).toEqual(['Analogous 1', 'Analogous 2']);
    expect(groups[2].colors.map((c) => c.name)).toEqual(['Triad 1', 'Triad 2']);
  });

  it('computes the complement (opposite hue) of a primary', () => {
    expect(flat('#FF0000').complementary).toEqual(['#00FFFF']);
    expect(flat('#00FF00').complementary).toEqual(['#FF00FF']);
    expect(flat('#0000FF').complementary).toEqual(['#FFFF00']);
  });

  it('computes the triad as the two 120°-spaced hues', () => {
    // Red's triad is green and blue.
    expect(flat('#FF0000').triad).toEqual(['#00FF00', '#0000FF']);
  });

  it('computes analogous neighbours at ±30°', () => {
    // Red ±30° → magenta-ish (330°) and orange (30°).
    expect(flat('#FF0000').analogous).toEqual(['#FF0080', '#FF8000']);
  });

  it('keeps a gray base gray (harmonies live in the hue channel)', () => {
    const groups = flat('#808080');
    const everyColor = [...groups.complementary, ...groups.analogous, ...groups.triad];
    everyColor.forEach((hex) => expect(hex).toBe('#808080'));
  });
});
