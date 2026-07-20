export const handleRateLimit = (error) => {
  if (error.status === 429) {
    console.warn('Rate limit exceeded');
    return true;
  }
  return false;
};

export const fetchWithCreditRetry = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    if (response.status === 429) {
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
      return fetch(url, options);
    }
    return response;
  } catch (error) {
    console.error('Fetch with credit retry error:', error);
    throw error;
  }
};
