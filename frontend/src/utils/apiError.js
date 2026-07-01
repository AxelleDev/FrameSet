/**
 * Normalizes API errors into a global vs. local handling decision.
 *
 * "Business" errors (4xx) are expected, user-correctable failures (e.g. bad
 * credentials) and are returned to the caller so they can be shown inline next
 * to the relevant form. Unexpected errors (5xx, network) are pushed to the
 * global error banner via `setGlobalError`.
 *
 * @param {object} error Enriched error from the api service (has .status/.data).
 * @param {(msg: string) => void} setGlobalError Setter for the global error banner.
 * @param {string} [fallbackGlobalMessage] Message used when the error has none.
 * @returns {{ isBusinessError: boolean, message: (string|undefined) }}
 *   `message` is defined only for business errors (for inline display).
 */
export const handleApiError = (error, setGlobalError, fallbackGlobalMessage = 'Something went wrong.') => {
  const isBusinessError = Boolean(error?.status) && error.status < 500;

  // Only surface unexpected (non-business) errors in the global banner.
  if (!isBusinessError && typeof setGlobalError === 'function') {
    setGlobalError(error?.message || fallbackGlobalMessage);
  }

  return {
    isBusinessError,
    message: isBusinessError ? (error?.data?.error || error?.message) : undefined
  };
};

export default handleApiError;
