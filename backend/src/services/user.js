import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const userService = {
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        throw new AppError('User not found', 404);
      }

      return data;
    } catch (error) {
      logger.error(`Get user profile error: ${error.message}`);
      throw error;
    }
  },

  async updateUserProfile(userId, updates) {
    try {
      const allowedUpdates = [
        'full_name',
        'bio',
        'avatar_url',
        'cover_url',
        'birth_date',
        'country',
        'city',
        'website',
        'phone',
        'social_links',
        'preferences',
      ];

      const updateData = {};
      allowedUpdates.forEach((field) => {
        if (field in updates) {
          updateData[field] = updates[field];
        }
      });

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, 400);
      }

      logger.info(`User profile updated: ${userId}`);
      return data;
    } catch (error) {
      logger.error(`Update user profile error: ${error.message}`);
      throw error;
    }
  },

  async searchUsers(query, limit = 20) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url, followers_count')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .is('deleted_at', null)
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Search users error: ${error.message}`);
      throw error;
    }
  },

  async followUser(followerUserId, followingUserId) {
    try {
      if (followerUserId === followingUserId) {
        throw new AppError('Cannot follow yourself', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('followers')
        .insert([
          {
            follower_id: followerUserId,
            following_id: followingUserId,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already following this user', 400);
        }
        throw error;
      }

      logger.info(`${followerUserId} followed ${followingUserId}`);
      return data;
    } catch (error) {
      logger.error(`Follow user error: ${error.message}`);
      throw error;
    }
  },

  async unfollowUser(followerUserId, followingUserId) {
    try {
      const { error } = await supabaseAdmin
        .from('followers')
        .delete()
        .eq('follower_id', followerUserId)
        .eq('following_id', followingUserId);

      if (error) {
        throw error;
      }

      logger.info(`${followerUserId} unfollowed ${followingUserId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Unfollow user error: ${error.message}`);
      throw error;
    }
  },

  async getFollowers(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('followers')
        .select('follower_id')
        .eq('following_id', userId)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const followerIds = data.map((f) => f.follower_id);

      const { data: followers, error: followersError } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url, followers_count')
        .in('id', followerIds);

      if (followersError) throw followersError;

      return followers;
    } catch (error) {
      logger.error(`Get followers error: ${error.message}`);
      throw error;
    }
  },

  async getFollowing(userId, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('followers')
        .select('following_id')
        .eq('follower_id', userId)
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const followingIds = data.map((f) => f.following_id);

      const { data: following, error: followingError } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url, followers_count')
        .in('id', followingIds);

      if (followingError) throw followingError;

      return following;
    } catch (error) {
      logger.error(`Get following error: ${error.message}`);
      throw error;
    }
  },

  async isFollowing(followerUserId, followingUserId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('followers')
        .select('id')
        .eq('follower_id', followerUserId)
        .eq('following_id', followingUserId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;
    } catch (error) {
      logger.error(`Is following error: ${error.message}`);
      return false;
    }
  },

  async getUserStats(userId) {
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('followers_count, following_count, total_plays')
        .eq('id', userId)
        .single();

      const { count: songsCount } = await supabaseAdmin
        .from('songs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null);

      const { count: playlistsCount } = await supabaseAdmin
        .from('playlists')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null);

      return {
        followers_count: user.followers_count,
        following_count: user.following_count,
        total_plays: user.total_plays,
        songs_count: songsCount,
        playlists_count: playlistsCount,
      };
    } catch (error) {
      logger.error(`Get user stats error: ${error.message}`);
      throw error;
    }
  },

  async deleteUser(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ deleted_at: new Date() })
        .eq('id', userId);

      if (error) throw error;

      logger.info(`User deleted: ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Delete user error: ${error.message}`);
      throw error;
    }
  },

  async getUserByUsername(username) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('username', username)
        .is('deleted_at', null)
        .single();

      if (error) {
        throw new AppError('User not found', 404);
      }

      return data;
    } catch (error) {
      logger.error(`Get user by username error: ${error.message}`);
      throw error;
    }
  },
};

export default userService;
