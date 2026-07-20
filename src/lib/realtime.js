import { supabase } from './auth.js';

export const realtime = {
  // Subscribe to a table for changes
  subscribe(table, callback, filter = null) {
    try {
      let channel = supabase
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            ...(filter && { filter }),
          },
          (payload) => callback(payload)
        )
        .subscribe();

      return channel;
    } catch (error) {
      console.error(`Subscribe to ${table} error:`, error);
      throw error;
    }
  },

  // Subscribe to specific song changes
  subscribeSong(songId, callback) {
    return this.subscribe('songs', callback, `id=eq.${songId}`);
  },

  // Subscribe to playlist changes
  subscribePlaylist(playlistId, callback) {
    return this.subscribe('playlist_songs', callback, `playlist_id=eq.${playlistId}`);
  },

  // Subscribe to user profile changes
  subscribeUserProfile(userId, callback) {
    return this.subscribe('users', callback, `id=eq.${userId}`);
  },

  // Subscribe to likes
  subscribeLikes(songId, callback) {
    return this.subscribe('likes', callback, `song_id=eq.${songId}`);
  },

  // Subscribe to comments
  subscribeComments(songId, callback) {
    return this.subscribe('comments', callback, `song_id=eq.${songId}`);
  },

  // Subscribe to followers
  subscribeFollowers(userId, callback) {
    return this.subscribe('followers', callback, `following_id=eq.${userId}`);
  },

  // Subscribe to notifications
  subscribeNotifications(userId, callback) {
    return this.subscribe('notifications', callback, `user_id=eq.${userId}`);
  },

  // Subscribe to messages
  subscribeMessages(userId, callback) {
    return this.subscribe('messages', callback, `or(from_user_id=eq.${userId},to_user_id=eq.${userId})`);
  },

  // Subscribe to room members
  subscribeRoomMembers(roomId, callback) {
    return this.subscribe('room_members', callback, `room_id=eq.${roomId}`);
  },

  // Subscribe to views/plays
  subscribeViews(songId, callback) {
    return this.subscribe('views', callback, `song_id=eq.${songId}`);
  },

  // Unsubscribe from a channel
  unsubscribe(channel) {
    try {
      if (channel) {
        supabase.removeChannel(channel);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  },

  // Listen for presence (user online status)
  subscribePresence(table, userId, callback) {
    try {
      const channel = supabase.channel(`presence:${table}`);

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          callback(state);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ userId, online_at: new Date() });
          }
        });

      return channel;
    } catch (error) {
      console.error('Subscribe presence error:', error);
      throw error;
    }
  },

  // Real-time message updates
  onMessageInserted(callback) {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        callback
      )
      .subscribe();

    return channel;
  },

  // Real-time notification updates
  onNotificationCreated(userId, callback) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();

    return channel;
  },
};

export default realtime;
