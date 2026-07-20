import { useCallback } from 'react'
import { db } from './lib/db'
import { push } from './lib/push'
import { auth } from './lib/auth'
import { useLiveShared } from './lib/useLive'

// ── Official MiLey messages ──
// Platform events (welcome, channel approval, verification, moderation,
// announcements) are delivered as beautifully-formatted "Direct Messages" from
// the official verified MiLey account. Because the messaging library always
// sends as the current signed-in user, an official message can't be a normal
// DM — instead each one is a shared row visible only to its recipient, rendered
// in a dedicated MiLey conversation that appears at the top of the inbox.

export const MILEY_NAME = 'MiLey'
export const MILEY_CHANNEL_ID = 'official-miley' // synthetic conversation id

// Fire an official DM to one user: writes the recipient-scoped row + a real OS
// push. Always call from a genuine action (an approval, a signup, a mod action).
export async function sendOfficial(recipientId, { title, body, reason = '', banner = '', actionLabel = '', actionUrl = '' }) {
  if (!recipientId || !title) return
  try {
    await db.insertShared('official_messages', {
      recipientId, title, body: body || '', reason, banner, actionLabel, actionUrl, read: false,
    }, undefined, { visibleTo: `user:${recipientId}`, writableBy: `user:${recipientId}` })
  } catch (e) { /* best-effort */ }
  try { await push.send(recipientId, { title: `${MILEY_NAME}: ${title}`, body: body || reason || '', url: '/official' }) } catch (e) { /* push best-effort */ }
}

// Send the same official DM to many recipients (announcements / platform updates).
export async function broadcastOfficial(recipientIds, payload) {
  const ids = [...new Set((recipientIds || []).filter(Boolean))]
  await Promise.all(ids.map((id) => sendOfficial(id, payload).catch(() => {})))
  return ids.length
}

// Send the one-time welcome message to a new user. Idempotent — uses a fixed
// docId per user so opening the app repeatedly never duplicates it.
export async function sendWelcomeOnce(user) {
  if (!user?.id) return
  const docId = `welcome-${user.id}`
  try {
    const existing = await db.getShared('official_messages', docId)
    if (existing) return
  } catch (e) { /* not found — continue */ }
  try {
    await db.upsertShared('official_messages', {
      recipientId: user.id,
      title: `Welcome to MiLey, ${user.displayName || 'friend'} 🎧`,
      body: 'This is your official MiLey channel — approvals, milestones, and platform announcements will arrive here. Explore music from channels worldwide, create playlists, join Listening Parties, and when you\u2019re ready, start your own Channel to upload tracks.',
      reason: '', banner: '', actionLabel: 'Explore MiLey', actionUrl: '/', read: false,
    }, docId, { visibleTo: `user:${user.id}`, writableBy: `user:${user.id}` })
  } catch (e) { /* best-effort */ }
}

// Live official-messages thread for the current user, newest last (chat order).
export function useOfficialThread() {
  const user = auth.getCurrentUser()
  const { data, loading, refetch } = useLiveShared('official_messages', { order: '-createdAt', limit: 100 })
  const mine = (data || []).filter((m) => m.recipientId === user?.id)
  const ordered = [...mine].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const unreadCount = mine.filter((m) => !m.read).length
  const latest = ordered[ordered.length - 1] || null

  const markAllRead = useCallback(async () => {
    await Promise.all(mine.filter((m) => !m.read).map((m) => db.updateShared('official_messages', m.id, { read: true }).catch(() => {})))
  }, [mine])

  return { messages: ordered, latest, unreadCount, loading, markAllRead, refetch }
}
