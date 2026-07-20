export const clearGateToken = () => {
  // Gate functionality not needed for standalone app
};

export const gateSeedIsOpen = () => false;

export const setGateSeed = () => {
  // No-op
};

export const handleGatedResponse = (response) => {
  return response;
};

export const popMagicKey = () => {
  return null;
};

export const fetchGateStatus = async () => {
  return { status: 'open' };
};

export const submitGateCode = async (code) => {
  // Always return success for standalone app
  return { success: true };
};
