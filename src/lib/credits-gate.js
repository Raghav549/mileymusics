export const showCreditsGate = async (options = {}) => {
  // Dispatch custom event for credits gate modal
  window.dispatchEvent(
    new CustomEvent('showCreditsGate', { detail: options })
  );
};
