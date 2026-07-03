/**
 * Splits API errors into global vs. inline handling. Business errors (4xx) are
 * user-correctable (e.g. bad credentials) and returned for inline display next
 * to the form; unexpected errors (5xx, network) go to the global banner.
 * Returns { isBusinessError, message }; message is set only for business errors.
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
