import { useEffect, useRef, useState } from 'react'
import { realtime } from '../lib/realtime'
import { auth } from '../lib/auth'
import { db } from '../lib/db'

// Presence sockets can go quiet after a phone locks / tab is backgrounded for a
// while (mobile Safari suspends websockets). Supabase's client reconnects the
// underlying socket automatically, but a channel that was tracked before the
// drop can end up in a stale state. To guarantee "online" status and typing
// always recover without the user leaving/re-entering a screen, every presence
// join here is wrapped so it rejoins itself whenever the tab becomes visible
// again or the network comes back — cheap (event-driven, not a timer) and
// keeps presence self-healing.
function useResilientPresence(channelName, infoRef, onUsers) {
  const roomRef = useRef(null)
  const userId = auth.getCurrentUser()?.id

  useEffect(() => {
    if (!userId || !channelName) return

    let disposed = false

    const join = () => {
      if (disposed) return
      roomRef.current?.leave?.()
      const room = realtime.presence(channelName, infoRef.current)
      roomRef.current = room
      room.onSync((users) => onUsers(users))
    }

    join()

    const onVisible = () => { if (document.visibilityState === 'visible') join() }
    const onOnline = () => join()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onVisible)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onVisible)
      roomRef.current?.leave?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, userId])

  return roomRef
}

// Global "who's online" presence for the whole app — used to show online/offline
// dots on profiles, chat headers and inbox rows.
export function useOnlinePresence() {
  const [onlineIds, setOnlineIds] = useState(new Set())
  const user = auth.getCurrentUser()
  const infoRef = useRef({ name: user?.displayName || 'MiLey user', avatar: user?.avatarUrl })
  infoRef.current = { name: user?.displayName || 'MiLey user', avatar: user?.avatarUrl }

  useResilientPresence(user ? 'miley-online' : null, infoRef, (users) =>
    setOnlineIds(new Set(users.map((u) => u.id || u.userId).filter(Boolean))))

  return onlineIds
}

// Last-seen heartbeat — mounted once at the app root. While the app is
// foregrounded it writes the current user's lastActive timestamp to a shared
// row keyed by their id, throttled to at most once every 45s (plus one write
// whenever the tab becomes visible again). This backs the "Active 5m ago"
// status in chat without any polling loop.
export function useLastSeenHeartbeat() {
  const user = auth.getCurrentUser()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let disposed = false
    let last = 0

    const beat = () => {
      if (disposed || document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 45000) return
      last = now
      db.upsertShared('user_presence', { userId, lastActive: new Date().toISOString() }, userId).catch(() => {})
    }

    beat()
    const iv = setInterval(beat, 45000)
    const onVisible = () => { if (document.visibilityState === 'visible') beat() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      disposed = true
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [userId])
}

// Read one user's last-active time (live). Returns an ISO string or null.
export function useLastSeen(userId) {
  const [lastActive, setLastActive] = useState(null)
  useEffect(() => {
    if (!userId) { setLastActive(null); return }
    let alive = true
    db.getShared('user_presence', userId)
      .then((row) => { if (alive && row?.lastActive) setLastActive(row.lastActive) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])
  return lastActive
}

// Typing indicator scoped to one chat channel — self-healing across
// reconnects so "typing…" never gets stuck stale or silently stops updating.
export function useTyping(channelId) {
  const user = auth.getCurrentUser()
  const typingRef = useRef(false)
  const infoRef = useRef({ name: user?.displayName || 'You', typing: false })
  const [typingUsers, setTypingUsers] = useState([])

  const roomRef = useResilientPresence(
    channelId ? `chat-typing-${channelId}` : null,
    infoRef,
    (users) => setTypingUsers(users.filter((u) => u.typing && u.id !== user?.id)),
  )

  const setTyping = (isTyping) => {
    typingRef.current = isTyping
    infoRef.current = { name: user?.displayName || 'You', typing: isTyping }
    roomRef.current?.updateInfo?.(infoRef.current)
  }

  return { typingUsers, setTyping }
}
