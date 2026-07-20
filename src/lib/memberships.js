const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const { supabase } = await import('./auth.js');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const memberships = {
  async getSubscription() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscriptions/current`, {
        headers: await getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.error('Get subscription error:', error);
      return null;
    }
  },

  async subscribe(tier = 'premium') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscriptions/subscribe`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) throw new Error('Failed to subscribe');
      return response.json();
    } catch (error) {
      console.error('Subscribe error:', error);
      throw error;
    }
  },

  async cancel() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/subscriptions/cancel`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to cancel');
      return response.json();
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  },
};
