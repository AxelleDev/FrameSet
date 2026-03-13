export const handleApiError = (error, setGlobalError, fallbackGlobalMessage = 'Une erreur est survenue.') => {
  const isBusinessError = Boolean(error?.status) && error.status < 500;

  if (!isBusinessError && typeof setGlobalError === 'function') {
    setGlobalError(error?.message || fallbackGlobalMessage);
  }

  return {
    isBusinessError,
    message: isBusinessError ? (error?.data?.error || error?.message) : undefined
  };
};

export default handleApiError;
