import { canonicalHex, findDuplicateColor, findDuplicateByName } from '../../src/utils/duplicates';

describe('canonicalHex', () => {
  it('normalizes case, whitespace and shorthand', () => {
    expect(canonicalHex('#aabbcc')).toBe('#AABBCC');
    expect(canonicalHex('  AABBCC ')).toBe('#AABBCC');
    expect(canonicalHex('#abc')).toBe('#AABBCC');
  });

  it('returns null for partial or invalid input', () => {
    expect(canonicalHex('#AB')).toBeNull();
    expect(canonicalHex('#GGHHII')).toBeNull();
    expect(canonicalHex('')).toBeNull();
    expect(canonicalHex(null)).toBeNull();
  });
});

describe('findDuplicateColor', () => {
  const palette = [
    { id: 1, name: 'Skin base', hex: '#FFEDE8' },
    { id: 2, name: 'Blush', hex: '#FCBFC4' },
  ];

  it('finds the same color across formats', () => {
    expect(findDuplicateColor(palette, '#ffede8')).toEqual(palette[0]);
  });

  it('ignores the color being edited', () => {
    expect(findDuplicateColor(palette, '#FFEDE8', { excludeId: 1 })).toBeNull();
  });

  it('returns null for a new color or incomplete input', () => {
    expect(findDuplicateColor(palette, '#123456')).toBeNull();
    expect(findDuplicateColor(palette, '#FFE')).toBeNull();
    expect(findDuplicateColor(palette, '')).toBeNull();
  });
});

describe('findDuplicateByName', () => {
  const items = [
    { id: 1, name: 'Hair outline' },
    { id: 2, name: 'Skin shading' },
  ];
  const getValue = (item) => item.name;

  it('matches ignoring case and surrounding spaces', () => {
    expect(findDuplicateByName(items, '  hair OUTLINE ', { getValue })).toEqual(items[0]);
  });

  it('ignores the item being edited and empty values', () => {
    expect(findDuplicateByName(items, 'Hair outline', { getValue, excludeId: 1 })).toBeNull();
    expect(findDuplicateByName(items, '   ', { getValue })).toBeNull();
  });

  it('handles items whose value is missing', () => {
    expect(findDuplicateByName([{ id: 3, name: null }], 'anything', { getValue })).toBeNull();
  });
});
