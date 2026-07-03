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

  it('returns a generic message for an unmapped (technical) error, never the raw text', () => {
    expect(getFriendlyMessage('ER_DUP_ENTRY: duplicate key at users.email line 42')).toMatch(/something went wrong/i);
  });
});
