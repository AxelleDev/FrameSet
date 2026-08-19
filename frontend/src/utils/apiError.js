export const handleApiError = (
  error,
  setGlobalError,
  fallbackGlobalMessage = 'Something went wrong.',
) => {
  const isBusinessError = Boolean(error?.status) && error.status < 500;

  // Only surface unexpected (non-business) errors in the global banner.
  if (!isBusinessError && typeof setGlobalError === 'function') {
    setGlobalError(error?.message || fallbackGlobalMessage);
  }

  return {
    isBusinessError,
    message: isBusinessError ? error?.data?.error || error?.message : undefined,
    retryAfterSeconds: error?.retryAfterSeconds,
  };
};

export default handleApiError;
