import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatModified, formatRelativeTime } from '../../src/utils/date';

describe('date utils', () => {
  describe('formatModified', () => {
    it('renders an unambiguous "on D Mon at HH:MM"', () => {
      expect(formatModified('02/07 14:30')).toBe('on 2 Jul at 14:30');
      expect(formatModified('15/03 10:00')).toBe('on 15 Mar at 10:00');
    });

    it('returns "" for empty and "just now" for a sentinel', () => {
      expect(formatModified('')).toBe('');
      expect(formatModified('Just now')).toBe('just now');
    });
  });

  describe('formatRelativeTime', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "Never changed" for missing/invalid dates', () => {
      expect(formatRelativeTime(null)).toBe('Never changed');
      expect(formatRelativeTime('not-a-date')).toBe('Never changed');
    });

    it('bucketises into minutes/hours/days ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
      expect(formatRelativeTime(new Date('2026-07-03T11:58:00Z'))).toBe('2 minutes ago');
      expect(formatRelativeTime(new Date('2026-07-03T09:00:00Z'))).toBe('3 hours ago');
      expect(formatRelativeTime(new Date('2026-07-01T12:00:00Z'))).toBe('2 days ago');
      expect(formatRelativeTime(new Date('2026-07-03T11:59:40Z'))).toBe('Just now');
    });
  });
});
