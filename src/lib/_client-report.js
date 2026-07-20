export const installClientErrorReporting = (options = {}) => {
  // Set up error reporting
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    // Could send to Sentry or other error tracking service
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
  });
};
