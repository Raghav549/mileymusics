const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const { supabase } = await import('./auth.js');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const messaging = {
  async sendMessage(toUserId, content, mediaUrl = null) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messaging/messages`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ to_user_id: toUserId, content, media_url: mediaUrl }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  async getConversation(userId, limit = 50) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/messaging/conversations/${userId}?limit=${limit}`,
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    } catch (error) {
      console.error('Get conversation error:', error);
      throw error;
    }
  },

  async getConversations(limit = 50) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/messaging/conversations?limit=${limit}`,
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    } catch (error) {
      console.error('Get conversations error:', error);
      throw error;
    }
  },
};
