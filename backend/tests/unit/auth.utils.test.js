const { getInitials } = require('../../src/utils/auth.utils');

describe('getInitials', () => {
  it('returns the first letter of a single-word username', () => {
    expect(getInitials('Axelle')).toBe('A');
  });

  it('returns only the first letter even for a multi-word input', () => {
    expect(getInitials('Jane Doe')).toBe('J');
  });

  it('ignores surrounding whitespace', () => {
    expect(getInitials('  cthyllax  ')).toBe('C');
  });

  it('uppercases the result', () => {
    expect(getInitials('axelle')).toBe('A');
  });

  it('returns an empty string for empty/missing/whitespace-only input', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
    expect(getInitials(undefined)).toBe('');
    expect(getInitials(null)).toBe('');
  });

  it('handles a single-character username', () => {
    expect(getInitials('a')).toBe('A');
  });
});
