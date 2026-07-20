// MiLey+ — manual UPI subscription flow.
//
// No payment gateway SDK of any kind is used here (no Stripe, no Razorpay
// SDK/API). The buyer pays the app owner directly by UPI; the platform's
// memberships helper (src/lib/memberships.js) records the intent and lets
// the app owner (the sole configured admin) approve or reject it by hand.
// MiLey+ only ever unlocks after that manual approval — never automatically.
import { memberships } from './lib/memberships'
import { db } from './lib/db'
import { auth } from './lib/auth'
import { useMemo } from 'react'
import { useLiveShared } from './lib/useLive'
import { notify } from './hooks/useNotifications'

export const UPI_ID = 'raghavkashyap2229@oksbi'
export const MILEY_PLUS_PRICE = 499
export const MILEY_PLUS_TIER_ID = 'miley-plus'
const memId = (userId) => `mem_${userId}`

// Called (harmlessly, idempotently) whenever the app owner opens the MiLey+
// admin panel — makes sure the manual-approval system + the ₹499/month tier
// exist before anyone can subscribe. No-op for everyone else.
export async function ensureMileyPlusConfigured() {
  if (!auth.isAppOwner()) return
  try { await memberships.configureAdmin() } catch (e) { /* already configured */ }
  try {
    await memberships.defineTiers([{
      id: MILEY_PLUS_TIER_ID,
      name: 'MiLey+',
      price: MILEY_PLUS_PRICE,
      currency: 'INR',
      period: 'month',
      quotas: {},
      perks: ['AI Song Studio', 'AI Cover Art', 'Unlimited Creations', 'Multi-language Vocals'],
    }])
  } catch (e) { /* ignore */ }
}

// Build the native UPI deep link — opens whatever UPI app (PhonePe, Google
// Pay, Paytm, BHIM, etc.) the device has installed, pre-filled with the
// MiLey UPI id, the exact amount and a purpose note.
export function buildUpiIntent({ amount = MILEY_PLUS_PRICE, note = 'MiLey+ Subscription' } = {}) {
  const params = new URLSearchParams({ pa: UPI_ID, pn: 'MiLey', am: String(amount), cu: 'INR', tn: note })
  return `upi://pay?${params.toString()}`
}

// Submit a subscription request for the CURRENT signed-in user. Records a
// pending payment (visible only to the user + the admin), then notifies the
// admin so it shows up in the Moderation panel / as an admin notification.
// Throws a friendly error if the admin hasn't opened the MiLey+ panel yet
// (tier not defined) — surface it to the user rather than failing silently.
export async function submitSubscriptionRequest({ userName, username, email }) {
  let pending
  try {
    pending = await memberships.startPending({
      tierId: MILEY_PLUS_TIER_ID,
      method: 'other',
      amount: MILEY_PLUS_PRICE,
      note: JSON.stringify({ userName: userName || '', username: username || '', email: email || '', channel: 'upi' }).slice(0, 500),
    })
  } catch (e) {
    throw new Error(/tier/i.test(e?.message || '') ? 'MiLey+ isn\u2019t set up yet — ask the app owner to open the MiLey+ admin panel once.' : (e?.message || 'Could not submit your request.'))
  }
  try {
    const cfg = await memberships.getConfig()
    if (cfg?.adminUserId) {
      await notify(cfg.adminUserId, {
        type: 'system',
        title: 'New MiLey+ request',
        body: `${userName || 'A user'} requested MiLey+ (\u20b9${MILEY_PLUS_PRICE}/month) via UPI \u2014 awaiting your approval.`,
        url: '/admin/reports',
        meta: { kind: 'miley_plus_request', pendingId: pending.id },
      })
    }
  } catch (e) { /* best-effort */ }
  return pending
}

// Parse the contact snapshot stashed in a pending payment's `note` field.
export function parseRequestNote(note) {
  try { return JSON.parse(note) || {} } catch (e) { return {} }
}

// ── Reactive entitlement check — used to gate the AI Studio ──
// Reads the live `__memberships` record for the current user so approval by
// the admin unlocks the Studio INSTANTLY, with no refresh needed.
export function useMileyPlusStatus() {
  const user = auth.getCurrentUser()
  const isOwner = auth.isAppOwner()
  const { data, loading } = useLiveShared('__memberships', { filters: { userId: user?.id || '__none__' }, limit: 1 })

  return useMemo(() => {
    if (isOwner) return { isPlus: true, status: 'active', expiresAt: null, loading: false }
    if (!user) return { isPlus: false, status: 'none', expiresAt: null, loading: false }
    if (loading) return { isPlus: false, status: 'none', expiresAt: null, loading: true }
    const row = (data || [])[0] || null
    const expired = !!(row?.expiresAt && Date.parse(row.expiresAt) <= Date.now())
    const isPlus = !!row && row.status === 'active' && !expired
    return { isPlus, status: row?.status === 'pending' ? 'pending' : (isPlus ? 'active' : (row ? 'none' : 'none')), expiresAt: row?.expiresAt || null, loading: false }
  }, [user, isOwner, data, loading])
}

// ── Admin operations (all internally gated by memberships.js to the one
// configured admin — the app owner) ──

export async function fetchAllRequests() {
  return memberships.listPending({ status: 'all' })
}

export async function approveRequest(id) {
  return memberships.approvePending(id)
}

export async function rejectRequest(id, reason) {
  return memberships.rejectPending(id, reason)
}

// Every current membership record (for Active / Expired tabs + the full user roster).
export async function fetchAllMemberships() {
  return db.selectShared('__memberships', {}, { limit: 1000, order: '-updatedAt' })
}

// Manually grant MiLey+ to any user, with or without a payment request —
// reuses the same startPending → approvePending primitives as a real payment.
export async function grantMileyPlus(targetUserId, { userName, username, email } = {}) {
  const pending = await memberships.startPending({
    tierId: MILEY_PLUS_TIER_ID,
    method: 'other',
    amount: MILEY_PLUS_PRICE,
    userId: targetUserId,
    note: JSON.stringify({ userName: userName || '', username: username || '', email: email || '', channel: 'manual-grant' }).slice(0, 500),
  })
  return memberships.approvePending(pending.id)
}

// Revoke MiLey+ immediately.
export async function revokeMileyPlus(userId) {
  const cfg = await memberships.getConfig()
  return db.updateShared('__memberships', memId(userId), {
    status: 'none', tierId: null, expiresAt: null, updatedAt: new Date().toISOString(),
  }, cfg.adminGroupId)
}

// Extend an active (or lapsed) subscription by N days from whichever is later:
// its current expiry, or now.
export async function extendMileyPlus(userId, extraDays) {
  const cfg = await memberships.getConfig()
  const row = await db.getShared('__memberships', memId(userId))
  const base = row?.expiresAt && Date.parse(row.expiresAt) > Date.now() ? Date.parse(row.expiresAt) : Date.now()
  const expiresAt = new Date(base + extraDays * 86400000).toISOString()
  return db.updateShared('__memberships', memId(userId), {
    status: 'active', tierId: MILEY_PLUS_TIER_ID, expiresAt, updatedAt: new Date().toISOString(),
  }, cfg.adminGroupId)
}
