import { db } from './lib/db'
import { auth } from './lib/auth'

// ── Blocking ──
export async function blockUser(targetId) {
  const me = auth.getCurrentUser()
  await db.insertShared('blocks', { blockerId: me.id, blockedId: targetId }, `${me.id}_${targetId}`, { visibleTo: `user:${me.id}` })
}
export async function unblockUser(targetId) {
  const me = auth.getCurrentUser()
  await db.deleteShared('blocks', `${me.id}_${targetId}`).catch(() => {})
}
export async function getBlockedIds() {
  const me = auth.getCurrentUser()
  if (!me) return new Set()
  const rows = await db.selectShared('blocks', { blockerId: me.id }, { limit: 300 }).catch(() => [])
  return new Set(rows.map((r) => r.blockedId))
}
export async function isBlockedBy(targetId) {
  const me = auth.getCurrentUser()
  if (!me) return false
  const rows = await db.selectShared('blocks', { blockerId: targetId, blockedId: me.id }, { limit: 1 }).catch(() => [])
  return rows.length > 0
}

// ── Mute / Archive per channel ──
export async function setChatPrefs(channelId, patch) {
  const me = auth.getCurrentUser()
  const id = `${channelId}_${me.id}`
  await db.upsertShared('chat_prefs', { channelId, userId: me.id, ...patch }, id, { visibleTo: `user:${me.id}` })
}
export async function getChatPrefsMap() {
  const me = auth.getCurrentUser()
  if (!me) return {}
  const rows = await db.selectShared('chat_prefs', { userId: me.id }, { limit: 300 }).catch(() => [])
  const map = {}
  for (const r of rows) map[r.channelId] = r
  return map
}

// ── Read receipts / unread ──
export async function markChannelRead(channelId) {
  const me = auth.getCurrentUser()
  const id = `${channelId}_${me.id}`
  await db.upsertShared('message_reads', { channelId, userId: me.id, lastReadAt: new Date().toISOString() }, id, { visibleTo: 'public' })
}
export async function getReadsForChannel(channelId) {
  return db.selectShared('message_reads', { channelId }, { limit: 50 }).catch(() => [])
}

// ── Message state: edit / delete (sender-only writable) ──
export async function setMessageState(message, patch) {
  const me = auth.getCurrentUser()
  await db.upsertShared('message_state', {
    messageId: message.id, channelId: message.channelId, senderId: message.senderId, ...patch,
  }, message.id, { visibleTo: 'public', writableBy: `user:${message.senderId || me.id}` })
}
export async function getMessageStates(channelId) {
  const rows = await db.selectShared('message_state', { channelId }, { limit: 500 }).catch(() => [])
  const map = {}
  for (const r of rows) map[r.messageId] = r
  return map
}

// ── Reactions (any member may react/un-react) ──
export async function toggleReaction(message, emoji) {
  const me = auth.getCurrentUser()
  const id = `${message.id}_${me.id}_${emoji}`
  const existing = await db.getShared('message_reactions', id).catch(() => null)
  if (existing) await db.deleteShared('message_reactions', id).catch(() => {})
  else await db.insertShared('message_reactions', { messageId: message.id, channelId: message.channelId, userId: me.id, emoji }, id, { visibleTo: 'public', writableBy: 'anyone' })
}
export async function getReactions(channelId) {
  const rows = await db.selectShared('message_reactions', { channelId }, { limit: 800 }).catch(() => [])
  const map = {}
  for (const r of rows) {
    if (!map[r.messageId]) map[r.messageId] = []
    map[r.messageId].push(r)
  }
  return map
}

// ── Pins (any member may pin/unpin) ──
export async function togglePin(message, pinned) {
  const id = `${message.channelId}_${message.id}`
  if (pinned) await db.deleteShared('message_pins', id).catch(() => {})
  else await db.insertShared('message_pins', { messageId: message.id, channelId: message.channelId }, id, { visibleTo: 'public', writableBy: 'anyone' })
}
export async function getPins(channelId) {
  return db.selectShared('message_pins', { channelId }, { limit: 100 }).catch(() => [])
}
