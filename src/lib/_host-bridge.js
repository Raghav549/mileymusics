export const shouldUseHostBridge = () => false;

export const sendHostRequest = async () => {
  // No host bridge needed for standalone app
  return null;
};

export const installHostBridge = async () => {
  // No host bridge needed for standalone app
};
