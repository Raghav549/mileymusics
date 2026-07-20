import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const playlistService = {
  async createPlaylist(userId, title, description, isPublic = false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('playlists')
        .insert([
          {
            user_id: userId,
            title,
            description,
            is_public: isPublic,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Playlist created: ${data.id} by ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Create playlist error: ${error.message}`);
      throw error;
    }
  },

  async getPlaylistById(playlistId, userId = null) {
    try {
      const { data: playlist, error } = await supabaseAdmin
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .is('deleted_at', null)
        .single();

      if (error || !playlist) {
        throw new AppError('Playlist not found', 404);
      }

      // Check permissions
      if (!playlist.is_public && playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      // Get songs in playlist
      const { data: playlistSongs, error: songsError } = await supabaseAdmin
        .from('playlist_songs')
        .select('song_id, added_at, position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (songsError) throw songsError;

      const songIds = playlistSongs.map((ps) => ps.song_id);
      let songs = [];

      if (songIds.length > 0) {
        const { data: songData, error: dataError } = await supabaseAdmin
          .from('songs')
          .select('*')
          .in('id', songIds);

        if (dataError) throw dataError;
        songs = songData;
      }

      // Check if user liked this playlist
      let liked = false;
      if (userId) {
        const { data: like } = await supabaseAdmin
          .from('likes')
          .select('id')
          .eq('playlist_id', playlistId)
          .eq('user_id', userId)
          .single();

        liked = !!like;
      }

      return {
        ...playlist,
        songs,
        liked,
        song_count: songs.length,
      };
    } catch (error) {
      logger.error(`Get playlist error: ${error.message}`);
      throw error;
    }
  },

  async getUserPlaylists(userId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('playlists')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { playlists: data, total: count };
    } catch (error) {
      logger.error(`Get user playlists error: ${error.message}`);
      throw error;
    }
  },

  async updatePlaylist(playlistId, userId, updates) {
    try {
      // Verify ownership
      const { data: playlist } = await supabaseAdmin
        .from('playlists')
        .select('user_id')
        .eq('id', playlistId)
        .single();

      if (playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const allowedUpdates = ['title', 'description', 'is_public', 'cover_url'];

      const updateData = {};
      allowedUpdates.forEach((field) => {
        if (field in updates) {
          updateData[field] = updates[field];
        }
      });

      const { data, error } = await supabaseAdmin
        .from('playlists')
        .update(updateData)
        .eq('id', playlistId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Playlist updated: ${playlistId}`);
      return data;
    } catch (error) {
      logger.error(`Update playlist error: ${error.message}`);
      throw error;
    }
  },

  async deletePlaylist(playlistId, userId) {
    try {
      const { data: playlist } = await supabaseAdmin
        .from('playlists')
        .select('user_id')
        .eq('id', playlistId)
        .single();

      if (playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const { error } = await supabaseAdmin
        .from('playlists')
        .update({ deleted_at: new Date() })
        .eq('id', playlistId);

      if (error) throw error;

      logger.info(`Playlist deleted: ${playlistId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Delete playlist error: ${error.message}`);
      throw error;
    }
  },

  async addSongToPlaylist(playlistId, songId, userId) {
    try {
      // Verify playlist ownership
      const { data: playlist } = await supabaseAdmin
        .from('playlists')
        .select('user_id, song_count')
        .eq('id', playlistId)
        .single();

      if (playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      // Get next position
      const position = (playlist.song_count || 0) + 1;

      const { data, error } = await supabaseAdmin
        .from('playlist_songs')
        .insert([
          {
            playlist_id: playlistId,
            song_id: songId,
            added_by: userId,
            position,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Song already in playlist', 400);
        }
        throw error;
      }

      logger.info(`Song added to playlist: ${playlistId}`);
      return data;
    } catch (error) {
      logger.error(`Add song to playlist error: ${error.message}`);
      throw error;
    }
  },

  async removeSongFromPlaylist(playlistId, songId, userId) {
    try {
      // Verify ownership
      const { data: playlist } = await supabaseAdmin
        .from('playlists')
        .select('user_id')
        .eq('id', playlistId)
        .single();

      if (playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const { error } = await supabaseAdmin
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);

      if (error) throw error;

      logger.info(`Song removed from playlist: ${playlistId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Remove song from playlist error: ${error.message}`);
      throw error;
    }
  },

  async likePlaylist(playlistId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('likes')
        .insert([{ playlist_id: playlistId, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already liked', 400);
        }
        throw error;
      }

      logger.info(`Playlist liked: ${playlistId} by ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Like playlist error: ${error.message}`);
      throw error;
    }
  },

  async unlikePlaylist(playlistId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('likes')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`Playlist unliked: ${playlistId} by ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Unlike playlist error: ${error.message}`);
      throw error;
    }
  },

  async getPublicPlaylists(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('playlists')
        .select('*')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { playlists: data, total: count };
    } catch (error) {
      logger.error(`Get public playlists error: ${error.message}`);
      throw error;
    }
  },

  async reorderPlaylistSongs(playlistId, userId, songs) {
    try {
      // Verify ownership
      const { data: playlist } = await supabaseAdmin
        .from('playlists')
        .select('user_id')
        .eq('id', playlistId)
        .single();

      if (playlist.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      // Update positions
      for (let i = 0; i < songs.length; i++) {
        await supabaseAdmin
          .from('playlist_songs')
          .update({ position: i + 1 })
          .eq('id', songs[i].id);
      }

      logger.info(`Playlist songs reordered: ${playlistId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Reorder playlist error: ${error.message}`);
      throw error;
    }
  },
};

export default playlistService;
