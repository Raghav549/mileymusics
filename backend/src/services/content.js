import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const commentService = {
  async createComment(userId, content, songId = null, albumId = null, parentId = null) {
    try {
      if (!songId && !albumId) {
        throw new AppError('Either songId or albumId is required', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('comments')
        .insert([
          {
            user_id: userId,
            song_id: songId,
            album_id: albumId,
            parent_id: parentId,
            content,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Comment created: ${data.id}`);
      return data;
    } catch (error) {
      logger.error(`Create comment error: ${error.message}`);
      throw error;
    }
  },

  async getComments(songId = null, albumId = null, limit = 50, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('comments')
        .select('*')
        .is('deleted_at', null)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (songId) {
        query = query.eq('song_id', songId);
      }
      if (albumId) {
        query = query.eq('album_id', albumId);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return { comments: data, total: count };
    } catch (error) {
      logger.error(`Get comments error: ${error.message}`);
      throw error;
    }
  },

  async getReplies(commentId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('comments')
        .select('*')
        .eq('parent_id', commentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { replies: data, total: count };
    } catch (error) {
      logger.error(`Get replies error: ${error.message}`);
      throw error;
    }
  },

  async updateComment(commentId, userId, content) {
    try {
      // Verify ownership
      const { data: comment } = await supabaseAdmin
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (comment.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const { data, error } = await supabaseAdmin
        .from('comments')
        .update({ content, is_edited: true })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Comment updated: ${commentId}`);
      return data;
    } catch (error) {
      logger.error(`Update comment error: ${error.message}`);
      throw error;
    }
  },

  async deleteComment(commentId, userId) {
    try {
      // Verify ownership
      const { data: comment } = await supabaseAdmin
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (comment.user_id !== userId) {
        throw new AppError('Unauthorized', 403);
      }

      const { error } = await supabaseAdmin
        .from('comments')
        .update({ deleted_at: new Date() })
        .eq('id', commentId);

      if (error) throw error;

      logger.info(`Comment deleted: ${commentId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Delete comment error: ${error.message}`);
      throw error;
    }
  },

  async likeComment(commentId, userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('likes')
        .insert([{ comment_id: commentId, user_id: userId }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already liked', 400);
        }
        throw error;
      }

      logger.info(`Comment liked: ${commentId}`);
      return data;
    } catch (error) {
      logger.error(`Like comment error: ${error.message}`);
      throw error;
    }
  },

  async unlikeComment(commentId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`Comment unliked: ${commentId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Unlike comment error: ${error.message}`);
      throw error;
    }
  },
};

export const searchService = {
  async search(query, type = 'all', limit = 20) {
    try {
      const results = {};

      if (type === 'all' || type === 'songs') {
        const { data: songs } = await supabaseAdmin
          .from('songs')
          .select('*')
          .textSearch('INDEX_SEARCH', query)
          .is('deleted_at', null)
          .eq('is_public', true)
          .limit(limit);

        results.songs = songs || [];
      }

      if (type === 'all' || type === 'albums') {
        const { data: albums } = await supabaseAdmin
          .from('albums')
          .select('*')
          .ilike('title', `%${query}%`)
          .is('deleted_at', null)
          .eq('is_public', true)
          .limit(limit);

        results.albums = albums || [];
      }

      if (type === 'all' || type === 'artists') {
        const { data: artists } = await supabaseAdmin
          .from('users')
          .select('*')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .eq('is_artist', true)
          .is('deleted_at', null)
          .limit(limit);

        results.artists = artists || [];
      }

      if (type === 'all' || type === 'playlists') {
        const { data: playlists } = await supabaseAdmin
          .from('playlists')
          .select('*')
          .ilike('title', `%${query}%`)
          .eq('is_public', true)
          .is('deleted_at', null)
          .limit(limit);

        results.playlists = playlists || [];
      }

      if (type === 'all' || type === 'users') {
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('*')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .is('deleted_at', null)
          .limit(limit);

        results.users = users || [];
      }

      return results;
    } catch (error) {
      logger.error(`Search error: ${error.message}`);
      throw error;
    }
  },

  async getTrending(type = 'songs', limit = 50, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = {};

      if (type === 'all' || type === 'songs') {
        const { data: songs } = await supabaseAdmin
          .from('songs')
          .select('*')
          .gt('created_at', startDate.toISOString())
          .is('deleted_at', null)
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(limit);

        results.songs = songs || [];
      }

      if (type === 'all' || type === 'artists') {
        const { data: artists } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('is_artist', true)
          .is('deleted_at', null)
          .order('followers_count', { ascending: false })
          .limit(limit);

        results.artists = artists || [];
      }

      return results;
    } catch (error) {
      logger.error(`Get trending error: ${error.message}`);
      throw error;
    }
  },

  async getExplore(limit = 50, offset = 0) {
    try {
      // Get mix of songs, artists, and playlists
      const { data: songs } = await supabaseAdmin
        .from('songs')
        .select('*')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 3));

      const { data: artists } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('is_artist', true)
        .is('deleted_at', null)
        .order('followers_count', { ascending: false })
        .limit(Math.ceil(limit / 3));

      const { data: playlists } = await supabaseAdmin
        .from('playlists')
        .select('*')
        .eq('is_public', true)
        .is('deleted_at', null)
        .order('like_count', { ascending: false })
        .limit(Math.ceil(limit / 3));

      return {
        songs: songs || [],
        artists: artists || [],
        playlists: playlists || [],
      };
    } catch (error) {
      logger.error(`Get explore error: ${error.message}`);
      throw error;
    }
  },
};

export const downloadService = {
  async recordDownload(userId, songId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('downloads')
        .insert([
          {
            user_id: userId,
            song_id: songId,
            created_at: new Date(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Download recorded: ${songId} by ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Record download error: ${error.message}`);
      throw error;
    }
  },

  async getUserDownloads(userId, limit = 50, offset = 0) {
    try {
      const { data: downloadIds, error: dlError } = await supabaseAdmin
        .from('downloads')
        .select('song_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (dlError) throw dlError;

      const songIds = downloadIds.map((d) => d.song_id);

      const { data: songs, error } = await supabaseAdmin
        .from('songs')
        .select('*')
        .in('id', songIds);

      if (error) throw error;

      return songs;
    } catch (error) {
      logger.error(`Get user downloads error: ${error.message}`);
      throw error;
    }
  },

  async getDownloadHistory(userId, limit = 50, offset = 0) {
    try {
      const { data: history, error: hlError, count } = await supabaseAdmin
        .from('downloads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (hlError) throw hlError;

      return { history, total: count };
    } catch (error) {
      logger.error(`Get download history error: ${error.message}`);
      throw error;
    }
  },
};

export default {
  commentService,
  searchService,
  downloadService,
};
