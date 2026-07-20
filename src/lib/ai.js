const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const { supabase } = await import('./auth.js');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const ai = {
  async generateSong(prompt, genre = 'pop', mood = 'upbeat', duration = 30) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/generate-song`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ prompt, genre, mood, duration }),
      });
      if (!response.ok) throw new Error('Failed to generate song');
      return response.json();
    } catch (error) {
      console.error('Generate song error:', error);
      throw error;
    }
  },

  async getAISongStatus(jobId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/songs/${jobId}`, {
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch song status');
      return response.json();
    } catch (error) {
      console.error('Get song status error:', error);
      throw error;
    }
  },

  async getAISongs(limit = 20) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/songs?limit=${limit}`, {
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch AI songs');
      return response.json();
    } catch (error) {
      console.error('Get AI songs error:', error);
      throw error;
    }
  },
};
