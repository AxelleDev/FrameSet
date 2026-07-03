import { describe, it, expect, vi } from 'vitest';
import { normalizeHexInput, isValidHexValue, handleHexKeyDown } from '../../src/utils/hex';

describe('hex utils', () => {
  describe('normalizeHexInput', () => {
    it('forces a leading #, strips non-hex chars and uppercases', () => {
      expect(normalizeHexInput('ff00aa')).toBe('#FF00AA');
      expect(normalizeHexInput('#ff00aa')).toBe('#FF00AA');
      expect(normalizeHexInput('  #ffZZ00xy  ')).toBe('#FF00');
    });

    it('returns just "#" for null/undefined', () => {
      expect(normalizeHexInput(null)).toBe('#');
      expect(normalizeHexInput(undefined)).toBe('#');
    });
  });

  describe('isValidHexValue', () => {
    it('accepts 3- and 6-digit hex, with or without #', () => {
      expect(isValidHexValue('#FFF')).toBe(true);
      expect(isValidHexValue('abc123')).toBe(true);
      expect(isValidHexValue('#Ab12Cd')).toBe(true);
    });

    it('rejects wrong lengths and non-hex chars', () => {
      expect(isValidHexValue('#FF')).toBe(false);
      expect(isValidHexValue('#GGGGGG')).toBe(false);
      expect(isValidHexValue('')).toBe(false);
      expect(isValidHexValue(null)).toBe(false);
    });
  });

  describe('handleHexKeyDown', () => {
    const makeEvent = (key, selectionStart, selectionEnd) => ({
      key,
      target: { selectionStart, selectionEnd },
      preventDefault: vi.fn(),
    });

    it('prevents Backspace that would delete the leading #', () => {
      const e = makeEvent('Backspace', 1, 1);
      handleHexKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('prevents Delete at the very start', () => {
      const e = makeEvent('Delete', 0, 0);
      handleHexKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('allows editing elsewhere', () => {
      const e = makeEvent('Backspace', 3, 3);
      handleHexKeyDown(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });
});
