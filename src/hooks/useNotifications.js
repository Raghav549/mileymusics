import { useCallback } from 'react'
import { db } from '../lib/db'
import { push } from '../lib/push'
import { useLiveShared } from '../lib/useLive'
import { auth } from '../lib/auth'

// In-app notification center — a shared row per notification, visible only to
// its recipient (visibleTo: user:<id>). Paired with a best-effort OS push so
// the recipient is reached even when they don't have MiLey open.
export function useNotifications() {
  const user = auth.getCurrentUser()
  const { data, loading, refetch } = useLiveShared('notifications', { order: '-createdAt', limit: 100 })
  const mine = (data || []).filter((n) => n.recipientId === user?.id)
  const unreadCount = mine.filter((n) => !n.read).length

  const markRead = useCallback(async (id) => {
    try { await db.updateShared('notifications', id, { read: true }) } catch (e) { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    await Promise.all(mine.filter((n) => !n.read).map((n) => db.updateShared('notifications', n.id, { read: true }).catch(() => {})))
  }, [mine])

  return { notifications: mine, unreadCount, loading, markRead, markAllRead, refetch }
}

// Live unread-message badge — reads the same real-time notifications feed, so
// it updates instantly (no refresh, no polling) the moment a message notif lands.
export function useUnreadMessageCount() {
  const { notifications } = useNotifications()
  return notifications.filter((n) => n.type === 'message' && !n.read).length
}

// Mark every unread "message" notification for one chat channel as read —
// call when a chat thread is opened so its badge clears instantly everywhere.
export async function markChannelNotificationsRead(channelId) {
  const user = auth.getCurrentUser()
  if (!user) return
  try {
    const rows = await db.selectShared('notifications', { recipientId: user.id, type: 'message' }, { limit: 200 })
    await Promise.all(
      rows.filter((n) => !n.read && n.meta?.channelId === channelId).map((n) => db.updateShared('notifications', n.id, { read: true }).catch(() => {})),
    )
  } catch (e) { /* ignore */ }
}

// Fan a notification out to every follower of an artist/channel — used when a
// new song/album is published so followers are alerted in real time. Best-effort
// and de-duped; never throws into the publish flow.
export async function notifyFollowers(targetId, payload) {
  if (!targetId) return
  try {
    const rows = await db.selectShared('follows', { targetId }, { limit: 500 })
    const ids = [...new Set(rows.map((r) => r.followerId).filter(Boolean))]
    await Promise.all(ids.map((rid) => notify(rid, payload)))
  } catch (e) { /* ignore */ }
}

// Fire a notification: writes the in-app row (recipient-only visibility) and
// sends a real OS push in parallel. Always called from a genuine user action
// (follow tap, upload publish, invite, comment, etc.) — never on a timer.
export async function notify(recipientId, { type, title, body, url, meta = {} }) {
  if (!recipientId) return
  const me = auth.getCurrentUser()
  if (me && me.id === recipientId) return // don't notify yourself
  try {
    await db.insertShared('notifications', {
      recipientId, type, title, body, url: url || '/', read: false, meta,
      fromId: me?.id, fromName: me?.displayName || 'MiLey user', fromAvatar: me?.avatarUrl || '',
    }, undefined, { visibleTo: `user:${recipientId}`, writableBy: `user:${recipientId}` })
  } catch (e) { /* ignore */ }
  try { await push.send(recipientId, { title, body, url: url || '/' }) } catch (e) { /* push best-effort */ }
}
