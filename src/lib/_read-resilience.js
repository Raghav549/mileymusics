export const createReadLayer = (readFn) => {
  // Simple read layer with retry logic
  return async (...args) => {
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await readFn(...args);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  };
};
