import { getFriendlyMessage } from '../../src/utils/friendlyError';

describe('getFriendlyMessage', () => {
  it('maps a technical network error to a friendly message', () => {
    expect(getFriendlyMessage('Failed to fetch')).toMatch(/couldn't reach the server/i);
  });

  it('maps a CSRF error to the connectivity message', () => {
    expect(getFriendlyMessage('Failed to retrieve the CSRF token.')).toMatch(/couldn't reach the server/i);
  });

  it('maps a 500 to a friendly message', () => {
    expect(getFriendlyMessage('Internal server error')).toMatch(/internal server error occurred/i);
  });

  it('returns null when there is no message', () => {
    expect(getFriendlyMessage(null)).toBeNull();
    expect(getFriendlyMessage('')).toBeNull();
  });

  it('passes a meaningful business message through unchanged', () => {
    expect(getFriendlyMessage('This email is already in use.')).toBe('This email is already in use.');
  });
});
