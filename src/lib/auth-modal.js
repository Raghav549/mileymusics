let authModalOpen = false;

export const showAuthModal = (options = {}) => {
  authModalOpen = true;
  // Dispatch custom event that the app can listen to
  window.dispatchEvent(
    new CustomEvent('showAuthModal', { detail: options })
  );
  return authModalOpen;
};
