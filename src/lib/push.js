export const push = {
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Request notification permission error:', error);
      return false;
    }
  },

  async registerServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        return registration;
      }
    } catch (error) {
      console.error('Register service worker error:', error);
    }
  },

  async subscribeToTopic(topic) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_FCM_PUBLIC_KEY,
      });
      return subscription;
    } catch (error) {
      console.error('Subscribe to topic error:', error);
      throw error;
    }
  },

  async showNotification(title, options = {}) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } catch (error) {
      console.error('Show notification error:', error);
    }
  },
};
