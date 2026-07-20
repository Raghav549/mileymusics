import { supabaseAdmin } from './supabase.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const storageService = {
  async uploadFile(userId, bucket, file, fileKey) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(fileKey, file, {
          contentType: file.type,
          metadata: { userId },
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileKey);

      logger.info(`File uploaded: ${fileKey} by ${userId}`);

      return {
        fileKey,
        publicUrl,
        path: data.path,
      };
    } catch (error) {
      logger.error(`Upload file error: ${error.message}`);
      throw error;
    }
  },

  async deleteFile(bucket, fileKey) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove([fileKey]);

      if (error) throw error;

      logger.info(`File deleted: ${fileKey}`);
      return { success: true };
    } catch (error) {
      logger.error(`Delete file error: ${error.message}`);
      throw error;
    }
  },

  async getPublicUrl(bucket, fileKey) {
    try {
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileKey);

      return publicUrl;
    } catch (error) {
      logger.error(`Get public URL error: ${error.message}`);
      throw error;
    }
  },

  async listFiles(bucket, prefix = '') {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix);

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`List files error: ${error.message}`);
      throw error;
    }
  },
};

export const messagingService = {
  async sendMessage(fromUserId, toUserId, content, mediaUrl = null) {
    try {
      if (fromUserId === toUserId) {
        throw new AppError('Cannot message yourself', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([
          {
            from_user_id: fromUserId,
            to_user_id: toUserId,
            content,
            media_url: mediaUrl,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Message sent from ${fromUserId} to ${toUserId}`);
      return data;
    } catch (error) {
      logger.error(`Send message error: ${error.message}`);
      throw error;
    }
  },

  async getConversation(user1Id, user2Id, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('messages')
        .select('*')
        .or(
          `and(from_user_id.eq.${user1Id},to_user_id.eq.${user2Id}),and(from_user_id.eq.${user2Id},to_user_id.eq.${user1Id})`
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { messages: data, total: count };
    } catch (error) {
      logger.error(`Get conversation error: ${error.message}`);
      throw error;
    }
  },

  async getConversations(userId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { conversations: data, total: count };
    } catch (error) {
      logger.error(`Get conversations error: ${error.message}`);
      throw error;
    }
  },

  async markAsRead(messageId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .update({ is_read: true, read_at: new Date() })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Mark as read error: ${error.message}`);
      throw error;
    }
  },
};

export const notificationService = {
  async createNotification(
    userId,
    type,
    title,
    body,
    data = {},
    fromUserId = null
  ) {
    try {
      const { data: notification, error } = await supabaseAdmin
        .from('notifications')
        .insert([
          {
            user_id: userId,
            from_user_id: fromUserId,
            type,
            title,
            body,
            data,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Notification created for ${userId}: ${type}`);
      return notification;
    } catch (error) {
      logger.error(`Create notification error: ${error.message}`);
      throw error;
    }
  },

  async getNotifications(userId, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { notifications: data, total: count };
    } catch (error) {
      logger.error(`Get notifications error: ${error.message}`);
      throw error;
    }
  },

  async markAsRead(notificationId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true, read_at: new Date() })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error(`Mark notification as read error: ${error.message}`);
      throw error;
    }
  },

  async markAllAsRead(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true, read_at: new Date() })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      logger.info(`All notifications marked as read for ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Mark all as read error: ${error.message}`);
      throw error;
    }
  },

  async deleteNotification(notificationId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      logger.error(`Delete notification error: ${error.message}`);
      throw error;
    }
  },
};

export const roomService = {
  async createRoom(hostUserId, title, description, type = 'listening_party', isPublic = false, maxMembers = 50) {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .insert([
          {
            host_user_id: hostUserId,
            title,
            description,
            type,
            is_public: isPublic,
            max_members: maxMembers,
            is_active: true,
            started_at: new Date(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Add host as member
      await this.joinRoom(data.id, hostUserId, 'host');

      logger.info(`Room created: ${data.id} by ${hostUserId}`);
      return data;
    } catch (error) {
      logger.error(`Create room error: ${error.message}`);
      throw error;
    }
  },

  async getRoomById(roomId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) {
        throw new AppError('Room not found', 404);
      }

      // Get members
      const { data: members } = await supabaseAdmin
        .from('room_members')
        .select('user_id, role')
        .eq('room_id', roomId)
        .is('left_at', null);

      return { ...data, members };
    } catch (error) {
      logger.error(`Get room error: ${error.message}`);
      throw error;
    }
  },

  async getActiveRooms(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { rooms: data, total: count };
    } catch (error) {
      logger.error(`Get active rooms error: ${error.message}`);
      throw error;
    }
  },

  async joinRoom(roomId, userId, role = 'member') {
    try {
      // Check room capacity
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('member_count, max_members')
        .eq('id', roomId)
        .single();

      if (room.member_count >= room.max_members) {
        throw new AppError('Room is full', 400);
      }

      const { data, error } = await supabaseAdmin
        .from('room_members')
        .insert([
          {
            room_id: roomId,
            user_id: userId,
            role,
            joined_at: new Date(),
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new AppError('Already in room', 400);
        }
        throw error;
      }

      logger.info(`User joined room: ${roomId}`);
      return data;
    } catch (error) {
      logger.error(`Join room error: ${error.message}`);
      throw error;
    }
  },

  async leaveRoom(roomId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('room_members')
        .update({ left_at: new Date() })
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`User left room: ${roomId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Leave room error: ${error.message}`);
      throw error;
    }
  },

  async closeRoom(roomId, hostUserId) {
    try {
      const { data: room } = await supabaseAdmin
        .from('rooms')
        .select('host_user_id')
        .eq('id', roomId)
        .single();

      if (room.host_user_id !== hostUserId) {
        throw new AppError('Unauthorized', 403);
      }

      const { error } = await supabaseAdmin
        .from('rooms')
        .update({
          is_active: false,
          ended_at: new Date(),
        })
        .eq('id', roomId);

      if (error) throw error;

      logger.info(`Room closed: ${roomId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Close room error: ${error.message}`);
      throw error;
    }
  },
};

export default {
  storageService,
  messagingService,
  notificationService,
  roomService,
};
