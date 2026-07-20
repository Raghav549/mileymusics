const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const { supabase } = await import('./auth.js');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const download = {
  async recordDownload(songId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/songs/${songId}/download`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to record download');
      return response.json();
    } catch (error) {
      console.error('Record download error:', error);
      throw error;
    }
  },

  async getDownloads(limit = 50) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/downloads?limit=${limit}`,
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch downloads');
      return response.json();
    } catch (error) {
      console.error('Get downloads error:', error);
      throw error;
    }
  },
};
