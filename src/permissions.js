import { auth } from './lib/auth'
import { db } from './lib/db'
import { useLiveShared } from './lib/useLive'

// ── Fixed identities ──
// Prachi Yadav — an approved co-moderator whose only admin power is approving or
// rejecting Channel creation requests. Identified by her account id or email so
// the recognition survives display-name changes.
export const PRACHI_USER_ID = 'c311c732-d50f-4d5b-989a-a08c60258ca5'
export const PRACHI_EMAIL = 'prachiy1778@gmail.com'

// Every sub-admin permission the Main Admin can grant individually.
export const PERMISSION_KEYS = [
  { key: 'userManagement', label: 'User Management' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'channelApproval', label: 'Channel Approval' },
  { key: 'verificationApproval', label: 'Verification Approval' },
  { key: 'songApproval', label: 'Song Approval' },
  { key: 'analytics', label: 'Analytics Access' },
  { key: 'reports', label: 'Reports' },
  { key: 'ban', label: 'Ban Permissions' },
  { key: 'voiceRoomModeration', label: 'Listening Party Moderation' },
  { key: 'contentManagement', label: 'Content Management' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'dashboard', label: 'Dashboard Access' },
]

// The Main Admin is the app owner/builder — server-enforced super admin.
export function isMainAdmin() {
  return auth.isAppOwner()
}

export function isPrachi(user = auth.getCurrentUser()) {
  if (!user) return false
  return user.id === PRACHI_USER_ID || (user.email || '').toLowerCase() === PRACHI_EMAIL
}

// Prachi's fixed permission set — channel approval only.
const PRACHI_PERMS = { channelApproval: true }

function allPerms() {
  const o = {}
  for (const p of PERMISSION_KEYS) o[p.key] = true
  return o
}

// Reactive hook: the current user's effective admin role + permission map.
// Reads the shared `staff` roster live so promotions/demotions apply instantly.
export function useMyPermissions() {
  const user = auth.getCurrentUser()
  const { data: staff } = useLiveShared('staff', { limit: 200 })
  if (isMainAdmin()) return { role: 'main', perms: allPerms(), isAdminish: true, staff: staff || [] }
  if (isPrachi(user)) return { role: 'prachi', perms: PRACHI_PERMS, isAdminish: true, staff: staff || [] }
  const rec = (staff || []).find((s) => s.userId === user?.id)
  if (rec) return { role: 'sub', perms: rec.permissions || {}, isAdminish: true, staffId: rec.id, staff: staff || [] }
  return { role: 'user', perms: {}, isAdminish: false, staff: staff || [] }
}

// Only the Main Admin and Prachi may upload music directly. Everyone else must
// create a Channel and have it approved first.
export function canUploadDirect(user = auth.getCurrentUser()) {
  return isMainAdmin() || isPrachi(user)
}

// Reactive hook: does the current user own at least one APPROVED channel?
// Used to decide whether they may make playlists/albums Public. Without an
// approved channel, everything they create stays Private (only they can see it).
export function useHasApprovedChannel() {
  const user = auth.getCurrentUser()
  const { data: channels } = useLiveShared('channels', { limit: 300 })
  if (!user) return false
  return (channels || []).some((c) => c.ownerId === user.id && c.status === 'approved')
}

// Non-hook variant for one-off checks inside async handlers.
export async function hasApprovedChannel(user = auth.getCurrentUser()) {
  if (!user) return false
  try {
    const rows = await db.selectShared('channels', { ownerId: user.id }, { limit: 5 })
    return rows.some((c) => c.status === 'approved')
  } catch (e) { return false }
}

// May this user publish public playlists/albums? Admins always can.
export function canPublish(hasChannel) {
  return isMainAdmin() || isPrachi() || !!hasChannel
}

// Append an entry to the tamper-visible admin activity log.
export async function logAdmin(action, detail = {}) {
  const me = auth.getCurrentUser()
  try {
    await db.insertShared('admin_log', {
      actorId: me?.id, actorName: me?.displayName || 'Admin', action, detail,
    }, undefined, { visibleTo: 'public' })
  } catch (e) { /* best-effort */ }
}

// A user's moderation record (ban / mute / suspensions). One shared row per
// user, docId = userId, so admins can upsert it and everyone can read status.
export async function setModeration(userId, patch) {
  try {
    return await db.upsertShared('user_moderation', { userId, ...patch }, userId, { visibleTo: 'public' })
  } catch (e) { return null }
}

// Is a moderation record an active ban right now (permanent or not-yet-expired)?
export function isActiveBan(mod) {
  if (!mod || !mod.banned) return false
  if (!mod.banUntil) return true // permanent
  return new Date(mod.banUntil).getTime() > Date.now()
}
