/**
 * handleApiError splits failures into inline (business, 4xx) vs global (5xx,
 * network) handling — the contract every AuthContext action relies on.
 */
import { describe, it, expect, vi } from 'vitest';
import { handleApiError } from '../../src/utils/apiError';

const buildError = (status, { data, message = 'HTTP error', retryAfterSeconds } = {}) => {
  const error = new Error(message);
  if (status) error.status = status;
  if (data) error.data = data;
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
  return error;
};

describe('handleApiError', () => {
  it('returns a 4xx business error inline and never touches the global banner', () => {
    const setGlobalError = vi.fn();
    const result = handleApiError(
      buildError(400, { data: { error: 'Invalid email.' } }),
      setGlobalError,
    );

    expect(result).toEqual({
      isBusinessError: true,
      message: 'Invalid email.',
      retryAfterSeconds: undefined,
    });
    expect(setGlobalError).not.toHaveBeenCalled();
  });

  it('falls back to the error message when a business error has no server payload', () => {
    const result = handleApiError(buildError(401, { message: 'Unauthorized' }), vi.fn());
    expect(result.message).toBe('Unauthorized');
  });

  it('passes retryAfterSeconds through for a 429 so callers can show a countdown', () => {
    const result = handleApiError(
      buildError(429, { data: { error: 'Too many attempts.' }, retryAfterSeconds: 42 }),
      vi.fn(),
    );
    expect(result).toEqual({
      isBusinessError: true,
      message: 'Too many attempts.',
      retryAfterSeconds: 42,
    });
  });

  it('routes a 5xx to the global banner with no inline message', () => {
    const setGlobalError = vi.fn();
    const result = handleApiError(buildError(500, { message: 'Server exploded' }), setGlobalError);

    expect(result.isBusinessError).toBe(false);
    expect(result.message).toBeUndefined();
    expect(setGlobalError).toHaveBeenCalledWith('Server exploded');
  });

  it('routes a status-less failure (network error) to the global banner', () => {
    const setGlobalError = vi.fn();
    handleApiError(buildError(undefined, { message: 'Failed to fetch' }), setGlobalError);
    expect(setGlobalError).toHaveBeenCalledWith('Failed to fetch');
  });

  it('uses the fallback message when the error carries no message at all', () => {
    const setGlobalError = vi.fn();
    handleApiError({}, setGlobalError, 'Something broke.');
    expect(setGlobalError).toHaveBeenCalledWith('Something broke.');
  });

  it('never crashes when setGlobalError is not provided', () => {
    expect(() => handleApiError(buildError(500), undefined)).not.toThrow();
  });
});
