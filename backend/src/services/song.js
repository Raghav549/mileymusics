import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const songService = {
  async createSong(userId, songData) {
    try {
      const {
        title,
        description,
        fileUrl,
        fileKey,
        thumbnailUrl,
        genre,
        mood,
        lyrics,
        isOriginal,
        albumId,
      } = songData;

      const { data, error } = await supabaseAdmin
        .from('songs')
        .insert([
          {
            user_id: userId,
            title,
            description,
            file_url: fileUrl,
            file_key: fileKey,
            thumbnail_url: thumbnailUrl,
            genre,
            mood,
            lyrics,
            is_original: isOriginal !== false,
            album_id: albumId,
            is_public: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Song created: ${data.id} by ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Create song error: ${error.message}`);
      throw error;
    }
  },

  async getSongById(songId, userId = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .eq('id', songId)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        throw new AppError('Song not found', 404);
      }

      // Check if user liked it
      if (userId) {
        const { data: like } = await supabaseAdmin
          .from('likes')
          .select('id')
          .eq('song_id', songId)
          .eq('user_id', userId)
          .single();

        data.liked = !!like;
      }

      return data;
    } catch (error) {
      logger.error(`Get song error: ${error.message}`);
      throw error;
    }
  },

  async getSongs(
    filters = {},
    limit = 20,
    offset = 0,
    userId = null
  ) {
    try {
      let query = supabaseAdmin
        .from('songs')
        .select('*')
        .is('deleted_at', null)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (filters.genre) {
        query = query.eq('genre', filters.genre);
      }

      if (filters.mood) {
        query = query.eq('mood', filters.mood);
      }

      if (filters.search) {
        query = query.textSearch('INDEX_SEARCH', filters.search);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Add user-specific data
      if (userId) {
        const songIds = data.map((s) => s.id);
        const { data: likes } = await supabaseAdmin
          .from('likes')
          .select('song_id')
          .in('song_id', songIds)
          .eq('user_id', userId);

        const likedIds = new Set(likes.map((l) => l.song_id));
        data.forEach((song) => {
          song.liked = likedIds.has(song.id);
        });
      }

      return { songs: data, total: count };
    } catch (error) {
      logger.error(`Get songs error: ${error.message}`);
      throw error;
    }
  },

  async updateSong(songId, userId, updates) {
    try {
      // Verify ownership
      const { data: song } = await supabaseAdmin
        .from('songs')
        .select('user_id')
        .eq('id', songId)
        .single();

      if (song.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const allowedUpdates = [
        'title',
        'description',
        'genre',
        'mood',
        'lyrics',
        'thumbnail_url',
      ];

      const updateData = {};
      allowedUpdates.forEach((field) => {
        if (field in updates) {
          updateData[field] = updates[field];
        }
      });

      const { data, error } = await supabaseAdmin
        .from('songs')
        .update(updateData)
        .eq('id', songId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Song updated: ${songId}`);
      return data;
    } catch (error) {
      logger.error(`Update song error: ${error.message}`);
      throw error;
    }
  },

  async deleteSong(songId, userId) {
    try {
      const { data: song } = await supabaseAdmin
        .from('songs')
        .select('user_id')
        .eq('id', songId)
        .single();

      if (song.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const { error } = await supabaseAdmin
        .from('songs')
        .update({ deleted_at: new Date() })
        .eq('id', songId);

      if (error) throw error;

      logger.info(`Song deleted: ${songId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Delete song error: ${error.message}`);
      throw error;
    }
  },

  async likeSong(songId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('likes')
        .insert([{ song_id: songId, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already liked', 400);
        }
        throw error;
      }

      logger.info(`Song liked: ${songId} by ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Like song error: ${error.message}`);
      throw error;
    }
  },

  async unlikeSong(songId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('likes')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`Song unliked: ${songId} by ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Unlike song error: ${error.message}`);
      throw error;
    }
  },

  async recordPlay(songId, userId = null) {
    try {
      const { data, error } = await supabaseAdmin
        .from('views')
        .insert([{ song_id: songId, user_id: userId }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Record play error: ${error.message}`);
      throw error;
    }
  },

  async getTrending(limit = 50, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .gt('created_at', startDate.toISOString())
        .is('deleted_at', null)
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Get trending error: ${error.message}`);
      throw error;
    }
  },

  async getUserSongs(userId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('songs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { songs: data, total: count };
    } catch (error) {
      logger.error(`Get user songs error: ${error.message}`);
      throw error;
    }
  },

  async searchSongs(query, limit = 20) {
    try {
      const { data, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .textSearch('INDEX_SEARCH', query)
        .is('deleted_at', null)
        .eq('is_public', true)
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Search songs error: ${error.message}`);
      throw error;
    }
  },

  async getRelatedSongs(songId, limit = 10) {
    try {
      const { data: song } = await this.getSongById(songId);

      const { data, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .neq('id', songId)
        .eq('genre', song.genre)
        .is('deleted_at', null)
        .eq('is_public', true)
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Get related songs error: ${error.message}`);
      throw error;
    }
  },

  async addToWatchLater(songId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('watch_later')
        .insert([{ song_id: songId, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already in watch later', 400);
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Add to watch later error: ${error.message}`);
      throw error;
    }
  },

  async removeFromWatchLater(songId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('watch_later')
        .delete()
        .eq('song_id', songId)
        .eq('user_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      logger.error(`Remove from watch later error: ${error.message}`);
      throw error;
    }
  },

  async getWatchLater(userId, limit = 50, offset = 0) {
    try {
      const { data: watchLaterIds, error: wlError } = await supabaseAdmin
        .from('watch_later')
        .select('song_id')
        .eq('user_id', userId)
        .range(offset, offset + limit - 1);

      if (wlError) throw wlError;

      const songIds = watchLaterIds.map((wl) => wl.song_id);

      const { data: songs, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .in('id', songIds);

      if (error) throw error;

      return songs;
    } catch (error) {
      logger.error(`Get watch later error: ${error.message}`);
      throw error;
    }
  },
};

export default songService;
