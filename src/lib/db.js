import { supabase } from './auth.js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Get auth token from session
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
  };
};

export const db = {
  // Songs API
  songs: {
    async getAll(filters = {}, limit = 20, offset = 0) {
      try {
        const params = new URLSearchParams({
          limit,
          offset,
          ...filters,
        });
        
        const response = await fetch(`${BACKEND_URL}/api/songs?${params}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to fetch songs');
        return response.json();
      } catch (error) {
        console.error('Get songs error:', error);
        throw error;
      }
    },

    async getById(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Song not found');
        return response.json();
      } catch (error) {
        console.error('Get song error:', error);
        throw error;
      }
    },

    async create(songData) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs`, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify(songData),
        });
        
        if (!response.ok) throw new Error('Failed to create song');
        return response.json();
      } catch (error) {
        console.error('Create song error:', error);
        throw error;
      }
    },

    async update(id, updates) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}`, {
          method: 'PUT',
          headers: await getAuthHeaders(),
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update song');
        return response.json();
      } catch (error) {
        console.error('Update song error:', error);
        throw error;
      }
    },

    async delete(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to delete song');
        return response.json();
      } catch (error) {
        console.error('Delete song error:', error);
        throw error;
      }
    },

    async like(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}/like`, {
          method: 'POST',
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to like song');
        return response.json();
      } catch (error) {
        console.error('Like song error:', error);
        throw error;
      }
    },

    async unlike(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}/like`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to unlike song');
        return response.json();
      } catch (error) {
        console.error('Unlike song error:', error);
        throw error;
      }
    },

    async play(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/songs/${id}/play`, {
          method: 'POST',
          headers: await getAuthHeaders(),
        });
        
        return response.ok ? response.json() : null;
      } catch (error) {
        console.error('Record play error:', error);
      }
    },
  },

  // Playlists API
  playlists: {
    async getAll(limit = 50, offset = 0) {
      try {
        const params = new URLSearchParams({ limit, offset });
        const response = await fetch(`${BACKEND_URL}/api/playlists?${params}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to fetch playlists');
        return response.json();
      } catch (error) {
        console.error('Get playlists error:', error);
        throw error;
      }
    },

    async getById(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Playlist not found');
        return response.json();
      } catch (error) {
        console.error('Get playlist error:', error);
        throw error;
      }
    },

    async create(title, description = '', isPublic = false) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/playlists`, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ title, description, is_public: isPublic }),
        });
        
        if (!response.ok) throw new Error('Failed to create playlist');
        return response.json();
      } catch (error) {
        console.error('Create playlist error:', error);
        throw error;
      }
    },

    async update(id, updates) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
          method: 'PUT',
          headers: await getAuthHeaders(),
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update playlist');
        return response.json();
      } catch (error) {
        console.error('Update playlist error:', error);
        throw error;
      }
    },

    async delete(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/playlists/${id}`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Failed to delete playlist');
        return response.json();
      } catch (error) {
        console.error('Delete playlist error:', error);
        throw error;
      }
    },

    async addSong(playlistId, songId) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/playlists/${playlistId}/songs`, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ song_id: songId }),
        });
        
        if (!response.ok) throw new Error('Failed to add song');
        return response.json();
      } catch (error) {
        console.error('Add song to playlist error:', error);
        throw error;
      }
    },

    async removeSong(playlistId, songId) {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/playlists/${playlistId}/songs/${songId}`,
          {
            method: 'DELETE',
            headers: await getAuthHeaders(),
          }
        );
        
        if (!response.ok) throw new Error('Failed to remove song');
        return response.json();
      } catch (error) {
        console.error('Remove song from playlist error:', error);
        throw error;
      }
    },
  },

  // Users API
  users: {
    async getById(id) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/${id}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('User not found');
        return response.json();
      } catch (error) {
        console.error('Get user error:', error);
        throw error;
      }
    },

    async updateProfile(id, updates) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/users/${id}`, {
          method: 'PUT',
          headers: await getAuthHeaders(),
          body: JSON.stringify(updates),
        });
        
        if (!response.ok) throw new Error('Failed to update profile');
        return response.json();
      } catch (error) {
        console.error('Update profile error:', error);
        throw error;
      }
    },

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
  },

  // Search API
  search: {
    async query(q, type = 'all', limit = 20) {
      try {
        const params = new URLSearchParams({ q, type, limit });
        const response = await fetch(`${BACKEND_URL}/api/search?${params}`, {
          headers: await getAuthHeaders(),
        });
        
        if (!response.ok) throw new Error('Search failed');
        return response.json();
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    },
  },
};

export default db;
