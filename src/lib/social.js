import { db } from './db.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const getAuthHeaders = async () => {
  const { supabase } = await import('./auth.js');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const social = {
  async follow(userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to follow');
      return response.json();
    } catch (error) {
      console.error('Follow error:', error);
      throw error;
    }
  },

  async unfollow(userId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/follow`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to unfollow');
      return response.json();
    } catch (error) {
      console.error('Unfollow error:', error);
      throw error;
    }
  },

  async getFollowers(userId, limit = 50) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/users/${userId}/followers?limit=${limit}`,
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch followers');
      return response.json();
    } catch (error) {
      console.error('Get followers error:', error);
      throw error;
    }
  },

  async getFollowing(userId, limit = 50) {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/users/${userId}/following?limit=${limit}`,
        { headers: await getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch following');
      return response.json();
    } catch (error) {
      console.error('Get following error:', error);
      throw error;
    }
  },
};
