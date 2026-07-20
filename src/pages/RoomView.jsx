import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { useLiveShared } from '../lib/useLive'
import { realtime } from '../lib/realtime'
import { share } from '../lib/share'
import { useTyping } from '../hooks/usePresence'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { notify } from '../hooks/useNotifications'
import { Cover } from '../components/TrackViews'
import {
  BackIcon, PlayIcon, PauseIcon, NextIcon, PrevIcon, UsersIcon, SkipVoteIcon, InviteIcon,
  SendIcon, CloseIcon, PlusIcon, CheckIcon, CrownIcon, ShieldIcon, VolumeIcon,
  MicOffIcon, MicIcon, SignalIcon, SmileIcon, SeatIcon, LockIcon, TrashIcon,
  SearchIcon, QRIcon, TimerIcon, PinIcon,
} from '../components/icons'
import QRCard from '../components/QRCard'
import { shareBase } from '../shareBase'
import LyricsView from '../components/LyricsView'
import { timeAgo, formatDuration, roomBackgroundStyle } from '../musicHelpers'

// Premium reaction set — float up from the sender's seat avatar.
const REACTIONS = ['❤️', '🔥', '👏', '😂', '😍', '😮', '🎉', '🤝', '👑', '🎵', '💯', '⭐']
const SEAT_COUNT = 9

// Song Battle: when a song stops being the current track, freeze its 👍/👎 tally
// into the session battle log (deduped by track id, keeping the latest tally).
function finalizeBattle(fresh) {
  const t = fresh.currentTrack
  const bv = fresh.battleVotes || { up: [], down: [] }
  const up = (bv.up || []).length
  const down = (bv.down || []).length
  if (!t || up + down === 0) return { battleLog: fresh.battleLog || [] }
  const entry = { id: t.id, title: t.title, artistName: t.artistName, coverUrl: t.coverUrl, up, down, score: up - down }
  const log = [...(fresh.battleLog || []).filter((e) => e.id !== t.id), entry]
  return { battleLog: log }
}
const EMPTY_BATTLE = { up: [], down: [] }

export default function RoomView() {
  const { id: roomId } = useParams()
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const { data: rooms, refetch: refetchRooms } = useLiveShared('voice_rooms', { order: '-createdAt', limit: 100 })
  const room = useMemo(() => (rooms || []).find((r) => r.id === roomId), [rooms, roomId])
  const { data: roomMsgs, refetch: refetchMsgs } = useLiveShared('room_messages', { filters: { roomId }, order: '-createdAt', limit: 80 })
  const { data: reactionRows } = useLiveShared('room_reactions', { filters: { roomId }, order: '-createdAt', limit: 40 })
  const { typingUsers, setTyping } = useTyping(roomId)

  const [onlineCount, setOnlineCount] = useState(1)
  const [text, setText] = useState('')
  const [localMsgs, setLocalMsgs] = useState([])
  const [musicOpen, setMusicOpen] = useState(false)
  const [reactOpen, setReactOpen] = useState(false)
  const [seatMenu, setSeatMenu] = useState(null)
  const [floating, setFloating] = useState([])
  const [toasts, setToasts] = useState([])
  const [localVolume, setLocalVolume] = useState(1)
  const [micOn, setMicOn] = useState(false)
  const [bars, setBars] = useState(3)
  const [identity, setIdentity] = useState({ name: user?.displayName || 'MiLey user', avatarUrl: user?.avatarUrl || '' })
  const [showRules, setShowRules] = useState(() => { try { return !localStorage.getItem('miley_room_rules_ack') } catch { return true } })
  const [showQR, setShowQR] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [unlocked, setUnlocked] = useState(() => { try { return !!sessionStorage.getItem(`miley_room_unlock_${roomId}`) } catch { return false } })
  const [sleepMin, setSleepMin] = useState(0) // 0 = off
  const sleepAtRef = useRef(null)

  const audioRef = useRef(null)
  const seenReactionIds = useRef(new Set())
  const roomPresenceRef = useRef(null)
  const bottomRef = useRef(null)
  const toastId = useRef(0)

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.crossOrigin = 'anonymous'
  }

  const pushToast = (text) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  // Prefer the user's chosen profile name + photo over the raw account (email-derived) name.
  useEffect(() => {
    if (!user) return
    db.getShared('profiles', user.id).then((p) => { if (p) setIdentity({ name: p.displayName || user.displayName || 'MiLey user', avatarUrl: p.avatarUrl || user.avatarUrl || '' }) }).catch(() => {})
  }, [user?.id])

  const isHost = !!(room && user && room.hostId === user.id)
  const isAdmin = !!(room && user && (room.admins || []).includes(user.id))
  const canControl = isHost || isAdmin
  const seats = room?.seats || Array(SEAT_COUNT).fill(null)
  const mySeatIndex = seats.findIndex((s) => s && s.userId === user?.id)
  const isSeated = mySeatIndex >= 0
  const mySeatMuted = mySeatIndex >= 0 ? !!seats[mySeatIndex]?.muted : false

  // ── Real peer-to-peer voice (native WebRTC mesh) ──
  const { speakingIds, error: voiceError } = useVoiceChat({
    roomId, selfId: user?.id, enabled: isSeated, micOn: micOn && !mySeatMuted, volume: localVolume,
  })
  useEffect(() => { if (voiceError) pushToast(voiceError) }, [voiceError])

  // ── Presence: who's actually in the room right now + join/leave banners ──
  useEffect(() => {
    let disposed = false
    const join = () => {
      if (disposed) return
      roomPresenceRef.current?.leave?.()
      const p = realtime.presence(`voiceroom-${roomId}`, { name: identity.name, userId: user?.id, avatarUrl: identity.avatarUrl })
      roomPresenceRef.current = p
      p.onSync((users) => setOnlineCount(users.length || 1))
      p.onJoin((u) => { if (u.userId && u.userId !== user?.id) pushToast(`${u.name || 'Someone'} entered the room`) })
      p.onLeave((u) => { if (u.userId && u.userId !== user?.id) pushToast(`${u.name || 'Someone'} left the room`) })
    }
    join()
    const resync = () => {
      if (document.visibilityState === 'hidden') return
      join(); refetchRooms(); refetchMsgs()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
      roomPresenceRef.current?.leave?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, identity.name])

  // ── Sleep timer cleanup on unmount ──
  useEffect(() => () => { if (sleepAtRef.current?.timeout) clearTimeout(sleepAtRef.current.timeout) }, [])

  // ── Connection quality (real navigator.connection when available) ──
  useEffect(() => {
    const conn = navigator.connection || navigator.webkitConnection
    const update = () => {
      const t = conn?.effectiveType
      setBars(t === '4g' ? 3 : t === '3g' ? 2 : t ? 1 : 3)
    }
    update()
    conn?.addEventListener?.('change', update)
    return () => conn?.removeEventListener?.('change', update)
  }, [])

  // ── Local audio element follows the room's shared playback state (one song, synced) ──
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (!room?.currentTrack) { el.pause(); el.removeAttribute('src'); return }
    if (el.src !== room.currentTrack.audioUrl) el.src = room.currentTrack.audioUrl
    const expected = room.isPlaying && room.startedAt
      ? room.position + (Date.now() - new Date(room.startedAt).getTime()) / 1000
      : room.position
    if (Math.abs((el.currentTime || 0) - expected) > 3) el.currentTime = Math.max(0, expected)
    if (room.isPlaying) el.play().catch(() => {})
    else el.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentTrack?.id, room?.currentTrack?.audioUrl, room?.isPlaying, room?.startedAt])

  useEffect(() => {
    const el = audioRef.current
    if (el) el.volume = localVolume
  }, [localVolume])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onEnd = () => { if (isHost || room?.tempDJUserId === user?.id) advanceQueue() }
    el.addEventListener('ended', onEnd)
    return () => el.removeEventListener('ended', onEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, room?.tempDJUserId, room?.queue])

  // ── Floating reactions ──
  useEffect(() => {
    for (const r of reactionRows || []) {
      if (seenReactionIds.current.has(r.id)) continue
      const age = Date.now() - new Date(r.createdAt).getTime()
      if (age > 4000) { seenReactionIds.current.add(r.id); continue }
      seenReactionIds.current.add(r.id)
      setFloating((f) => [...f, r])
      setTimeout(() => setFloating((f) => f.filter((x) => x.id !== r.id)), 2400)
    }
  }, [reactionRows])

  const mergedMsgs = useMemo(() => {
    return [...(roomMsgs || []), ...localMsgs.filter((lm) => !(roomMsgs || []).some((rm) => rm.userId === lm.userId && rm.text === lm.text))]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-40)
  }, [roomMsgs, localMsgs])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mergedMsgs.length])

  if (!room) return <div className="h-full flex items-center justify-center text-white/40 text-sm">Loading room…</div>

  const setRoom = (patch) => db.updateShared('voice_rooms', roomId, patch)

  // ── Race-safe room mutation ──
  // Every seat/queue/admin action here used to compute its patch off the
  // possibly-stale snapshot from the live-list hook and overwrite the whole
  // array — so two near-simultaneous actions (two people tapping different
  // empty seats, a host skipping while a listener requests) could silently
  // clobber each other (the "seat sometimes doesn't show" bug). Instead:
  // fetch the freshest row right before mutating, compute the patch against
  // THAT, write it, then (for seat claims) verify our own change actually
  // landed and retry against newer data if a concurrent write raced us.
  const mutateRoom = async (compute, verify) => {
    let fresh = (await db.getShared('voice_rooms', roomId).catch(() => null)) || room
    const attempts = verify ? 3 : 1
    for (let i = 0; i < attempts; i++) {
      const result = compute(fresh)
      if (result === null || result === undefined) return false
      await db.updateShared('voice_rooms', roomId, result)
      if (!verify) return true
      const after = await db.getShared('voice_rooms', roomId).catch(() => null)
      if (after && verify(after)) return true
      fresh = after || fresh
    }
    return false
  }

  // ── Seat management ──
  const tapSeat = (index) => {
    const seat = seats[index]
    if (seat) {
      if (seat.userId === user?.id || canControl) { setSeatMenu(index); return }
      pushToast('This seat is already occupied.')
      return
    }
    if (room.seatLocks?.[index]) { pushToast('This seat is locked.'); return }
    if (isSeated) { pushToast('Leave your current seat first.'); return }
    joinSeat(index)
  }
  const joinSeat = async (index) => {
    if (isSeated) return
    const ok = await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      if (s[index] || fresh.seatLocks?.[index]) return null
      if (s.some((x) => x && x.userId === user.id)) return null
      const next = [...s]
      next[index] = { userId: user.id, userName: identity.name, avatarUrl: identity.avatarUrl, muted: false }
      return { seats: next, seatRequests: (fresh.seatRequests || []).filter((r) => r.userId !== user.id) }
    }, (after) => (after.seats || [])[index]?.userId === user.id)
    if (!ok) pushToast('This seat is already occupied.')
  }
  const leaveSeat = async () => {
    await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      const idx = s.findIndex((x) => x && x.userId === user.id)
      if (idx < 0) return null
      const next = [...s]; next[idx] = null
      return { seats: next }
    })
  }
  const requestSeat = async () => {
    if ((room.seatRequests || []).some((r) => r.userId === user.id)) { pushToast('Seat already requested.'); return }
    await mutateRoom((fresh) => {
      if ((fresh.seatRequests || []).some((r) => r.userId === user.id)) return null
      return { seatRequests: [...(fresh.seatRequests || []), { userId: user.id, userName: identity.name, avatarUrl: identity.avatarUrl }] }
    })
    notify(room.hostId, { type: 'room', title: 'Seat request', body: `${identity.name} wants a seat in ${room.name}`, url: `/rooms/${roomId}` })
    pushToast('Seat requested — waiting for host.')
  }
  const approveRequest = async (req) => {
    const ok = await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      const emptyIdx = s.findIndex((x, i) => !x && !fresh.seatLocks?.[i])
      if (emptyIdx < 0) return null
      const next = [...s]
      next[emptyIdx] = { userId: req.userId, userName: req.userName, avatarUrl: req.avatarUrl, muted: false }
      return { seats: next, seatRequests: (fresh.seatRequests || []).filter((r) => r.userId !== req.userId) }
    }, (after) => (after.seats || []).some((x) => x && x.userId === req.userId))
    if (!ok) { pushToast('No empty seats available.'); return }
    notify(req.userId, { type: 'room', title: 'Seat approved', body: `You're on stage in ${room.name}`, url: `/rooms/${roomId}` })
  }
  const declineRequest = async (req) => {
    await mutateRoom((fresh) => ({ seatRequests: (fresh.seatRequests || []).filter((r) => r.userId !== req.userId) }))
  }
  const toggleMute = async (index) => {
    await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      if (!s[index]) return null
      const next = [...s]
      next[index] = { ...next[index], muted: !next[index].muted }
      return { seats: next }
    })
  }
  const toggleLock = async (index) => {
    await mutateRoom((fresh) => {
      const locks = [...(fresh.seatLocks || Array(SEAT_COUNT).fill(false))]
      locks[index] = !locks[index]
      return { seatLocks: locks }
    })
  }
  const kick = async (index) => {
    await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      if (!s[index]) return null
      const next = [...s]; next[index] = null
      return { seats: next }
    })
  }
  const transferOwnership = async (index) => {
    const target = seats[index]
    if (!target) return
    await mutateRoom((fresh) => {
      const s = fresh.seats || Array(SEAT_COUNT).fill(null)
      const t = s[index]
      if (!t) return null
      return { hostId: t.userId, hostName: t.userName }
    })
  }
  const makeAdmin = async (userId) => {
    await mutateRoom((fresh) => {
      const admins = new Set(fresh.admins || []); admins.add(userId)
      return { admins: [...admins] }
    })
  }
  const removeAdmin = async (userId) => {
    await mutateRoom((fresh) => ({ admins: (fresh.admins || []).filter((a) => a !== userId) }))
  }

  // ── Playback (owner/admin controlled) — one song at a time, history-aware ──
  const advanceQueue = async () => {
    await mutateRoom((fresh) => {
      const q = [...(fresh.queue || [])]
      const hist = fresh.currentTrack ? [...(fresh.history || []), fresh.currentTrack].slice(-20) : (fresh.history || [])
      // A pinned song always plays next, then clears its pin.
      const fin = finalizeBattle(fresh)
      if (fresh.pinnedTrack) {
        return { currentTrack: fresh.pinnedTrack, pinnedTrack: null, queue: q, isPlaying: true, position: 0, startedAt: new Date().toISOString(), skipVotes: [], battleVotes: EMPTY_BATTLE, tempDJUserId: null, history: hist, ...fin }
      }
      if (q.length === 0) return { currentTrack: null, isPlaying: false, tempDJUserId: null, history: hist, battleVotes: EMPTY_BATTLE, ...fin }
      const track = q.shift()
      return { currentTrack: track, queue: q, isPlaying: true, position: 0, startedAt: new Date().toISOString(), skipVotes: [], battleVotes: EMPTY_BATTLE, tempDJUserId: null, history: hist, ...fin }
    })
  }
  const playFromQueue = async (index) => {
    if (!canControl) return
    await mutateRoom((fresh) => {
      const q = [...(fresh.queue || [])]
      const [track] = q.splice(index, 1)
      if (!track) return null
      const hist = fresh.currentTrack ? [...(fresh.history || []), fresh.currentTrack].slice(-20) : (fresh.history || [])
      return { currentTrack: track, queue: q, isPlaying: true, position: 0, startedAt: new Date().toISOString(), skipVotes: [], battleVotes: EMPTY_BATTLE, tempDJUserId: null, history: hist, ...finalizeBattle(fresh) }
    })
  }
  const prevTrack = async () => {
    if (!canControl) return
    await mutateRoom((fresh) => {
      const hist = [...(fresh.history || [])]
      if (hist.length === 0) return { position: 0, startedAt: new Date().toISOString(), isPlaying: true }
      const track = hist.pop()
      const q = fresh.currentTrack ? [fresh.currentTrack, ...(fresh.queue || [])] : (fresh.queue || [])
      return { currentTrack: track, queue: q, history: hist, isPlaying: true, position: 0, startedAt: new Date().toISOString(), skipVotes: [], battleVotes: EMPTY_BATTLE, tempDJUserId: null, ...finalizeBattle(fresh) }
    })
  }
  const togglePlayHost = async () => {
    if (!canControl || !room.currentTrack) return
    const el = audioRef.current
    await mutateRoom((fresh) => ({ isPlaying: !fresh.isPlaying, startedAt: new Date().toISOString(), position: el ? el.currentTime : fresh.position }))
  }
  const setSleepTimer = (min) => {
    if (sleepAtRef.current?.timeout) clearTimeout(sleepAtRef.current.timeout)
    if (!min) { sleepAtRef.current = null; setSleepMin(0); return }
    setSleepMin(min)
    const timeout = setTimeout(async () => {
      if (canControl) await mutateRoom(() => ({ isPlaying: false }))
      sleepAtRef.current = null
      setSleepMin(0)
      pushToast('Sleep timer ended — playback paused.')
    }, min * 60000)
    sleepAtRef.current = { at: Date.now() + min * 60000, timeout }
  }

  const voteSkip = async () => {
    let shouldAdvance = false
    await mutateRoom((fresh) => {
      const votes = new Set(fresh.skipVotes || []); votes.add(user.id)
      const arr = [...votes]
      const seatedCount = Math.max(1, (fresh.seats || []).filter(Boolean).length)
      shouldAdvance = arr.length >= Math.ceil(seatedCount / 2)
      return { skipVotes: arr }
    })
    if (shouldAdvance) advanceQueue()
  }

  // ── Song Battle: every listener rates the playing song 👍 / 👎 ──
  const castBattleVote = async (dir) => {
    if (!room.currentTrack || !user) return
    await mutateRoom((fresh) => {
      if (!fresh.currentTrack) return null
      const up = ((fresh.battleVotes?.up) || []).filter((u) => u !== user.id)
      const down = ((fresh.battleVotes?.down) || []).filter((u) => u !== user.id)
      const already = ((fresh.battleVotes?.[dir]) || []).includes(user.id)
      if (!already) { (dir === 'up' ? up : down).push(user.id) } // tap same vote again = retract
      return { battleVotes: { up, down } }
    })
  }
  const addToQueue = async (track) => {
    // Host / admin: goes straight into the queue.
    await mutateRoom((fresh) => ({ queue: [...(fresh.queue || []), { ...track, requestedBy: user.id, requestedByName: identity.name }] }))
    pushToast('Added to queue.')
  }
  const requestTrack = async (track) => {
    // Member: creates a pending request the host must approve.
    const already = (room.songRequests || []).some((r) => r.id === track.id && r.requestedBy === user.id)
    if (already) { pushToast('You already requested this song.'); return }
    await mutateRoom((fresh) => {
      if ((fresh.songRequests || []).some((r) => r.id === track.id && r.requestedBy === user.id)) return null
      return { songRequests: [...(fresh.songRequests || []), { ...track, requestedBy: user.id, requestedByName: identity.name, requestedAt: new Date().toISOString() }] }
    })
    notify(room.hostId, { type: 'room', title: 'Song request', body: `${identity.name} requested "${track.title}" in ${room.name}`, url: `/rooms/${roomId}` })
    pushToast('Requested — waiting for host approval.')
  }
  const approveSongRequest = async (req) => {
    await mutateRoom((fresh) => ({
      queue: [...(fresh.queue || []), { ...req }],
      songRequests: (fresh.songRequests || []).filter((r) => !(r.id === req.id && r.requestedBy === req.requestedBy)),
    }))
    notify(req.requestedBy, { type: 'room', title: 'Request approved', body: `"${req.title}" was added to the queue in ${room.name}`, url: `/rooms/${roomId}` })
  }
  const rejectSongRequest = async (req) => {
    await mutateRoom((fresh) => ({ songRequests: (fresh.songRequests || []).filter((r) => !(r.id === req.id && r.requestedBy === req.requestedBy)) }))
  }
  const togglePin = async (track) => {
    if (!canControl) return
    await mutateRoom((fresh) => {
      const pinned = fresh.pinnedTrack && fresh.pinnedTrack.id === track.id ? null : { ...track }
      return { pinnedTrack: pinned }
    })
  }
  const removeFromQueue = async (index) => {
    if (!canControl) return
    await mutateRoom((fresh) => {
      const q = [...(fresh.queue || [])]; q.splice(index, 1)
      return { queue: q }
    })
  }
  const reorderQueue = async (index, dir) => {
    if (!canControl) return
    await mutateRoom((fresh) => {
      const q = [...(fresh.queue || [])]
      const to = index + dir
      if (to < 0 || to >= q.length) return null
      ;[q[index], q[to]] = [q[to], q[index]]
      return { queue: q }
    })
  }

  // ── Chat ──
  const sendChat = async () => {
    const val = text.trim()
    if (!val) return
    setText(''); setTyping(false)
    const tempId = `temp-${Date.now()}`
    setLocalMsgs((prev) => [...prev, { id: tempId, roomId, userId: user.id, userName: identity.name, text: val, createdAt: new Date().toISOString() }])
    try {
      await db.insertShared('room_messages', { roomId, userId: user.id, userName: identity.name, text: val }, undefined, { visibleTo: 'public', writableBy: 'anyone' })
    } finally {
      setLocalMsgs((prev) => prev.filter((m) => m.id !== tempId))
    }
  }

  const sendReaction = async (emoji) => {
    setReactOpen(false)
    await db.insertShared('room_reactions', { roomId, seatIndex: isSeated ? mySeatIndex : null, userId: user.id, emoji }, undefined, { visibleTo: 'public', writableBy: 'anyone' })
  }

  const inviteRoom = () => {
    const url = `${shareBase()}/#/rooms/${roomId}`
    share.link({ title: room.name, text: `Join my listening party "${room.name}" on MiLey!`, url })
  }

  const endRoom = async () => {
    if (!window.confirm('End this room for everyone? This cannot be undone.')) return
    await setRoom({ ended: true })
    navigate('/rooms')
  }

  const bgStyle = room.backgroundUrl
    ? { backgroundImage: `linear-gradient(rgba(11,11,11,0.55), rgba(11,11,11,0.85)), url(${room.backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : roomBackgroundStyle(room.backgroundKey)

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex flex-col text-white overflow-hidden" style={{ ...bgStyle, height: 'var(--visual-height, 100dvh)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3">
        <button onClick={() => navigate('/rooms')} className="text-white/80 shrink-0"><BackIcon size={22} /></button>
        <div className="w-9 h-9 shrink-0"><Cover track={{ title: room.name, coverUrl: room.coverUrl }} size="fill" rounded="rounded-xl" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{room.name}</p>
          <p className="text-[11px] text-white/50 flex items-center gap-1"><UsersIcon size={11} /> {onlineCount} in room · {room.purpose === 'Custom' ? room.customPurpose : room.purpose}</p>
        </div>
        <SignalIcon size={16} bars={bars} className="text-white/60 shrink-0" />
        <button onClick={() => setShowQR(true)} className="p-1.5 text-white/70 shrink-0"><QRIcon size={18} /></button>
        <button onClick={inviteRoom} className="p-1.5 text-white/70 shrink-0"><InviteIcon size={18} /></button>
        {canControl && <button onClick={endRoom} className="text-[11px] text-red-400 font-medium px-1.5 shrink-0">End</button>}
        {/* Floating spinning disc — opens the Music Panel */}
        <button onClick={() => setMusicOpen(true)} className="relative w-11 h-11 rounded-full shrink-0 border border-white/20 overflow-hidden shadow-lg" style={{ animation: room.isPlaying ? 'spinDisc 4s linear infinite' : 'none' }}>
          <Cover track={{ title: room.name, coverUrl: room.coverUrl }} size="fill" rounded="rounded-full" />
          <span className="absolute inset-0 flex items-center justify-center"><span className="w-3 h-3 rounded-full bg-black/70 border border-white/30" /></span>
          {(room.queue || []).length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{room.queue.length}</span>}
        </button>
      </div>

      {/* Seat requests bar (host/admin) */}
      {canControl && (room.seatRequests || []).length > 0 && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
          {room.seatRequests.map((req) => (
            <div key={req.userId} className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-2 py-1 shrink-0">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">{req.avatarUrl ? <img src={req.avatarUrl} className="w-full h-full object-cover" /> : <SeatIcon size={12} />}</div>
              <span className="text-xs">{req.userName} wants a seat</span>
              <button onClick={() => approveRequest(req)} className="text-emerald-400"><CheckIcon size={14} /></button>
              <button onClick={() => declineRequest(req)} className="text-white/40"><CloseIcon size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Seat grid */}
      <div className="shrink-0 px-6 pt-1 pb-3">
        <div className="grid grid-cols-3 gap-x-4 gap-y-5 w-full max-w-sm mx-auto">
          {Array.from({ length: SEAT_COUNT }).map((_, i) => {
            const seat = seats[i]
            const locked = room.seatLocks?.[i]
            const seatIsHost = seat && seat.userId === room.hostId
            const seatIsAdmin = seat && (room.admins || []).includes(seat.userId)
            const seatReactions = floating.filter((f) => f.seatIndex === i)
            const speaking = seat && (seat.userId === user?.id ? speakingIds.has('self') : speakingIds.has(seat.userId))
            const seatMicOff = seat && (seat.userId === user?.id ? (!micOn || seat.muted) : seat.muted)
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 relative">
                {seatReactions.map((r) => (
                  <span key={r.id} className="absolute -top-3 text-xl pointer-events-none z-10" style={{ animation: 'floatUpFade 2.4s ease-out forwards' }}>{r.emoji}</span>
                ))}
                <button
                  onClick={() => tapSeat(i)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center relative transition-all ${seat ? (speaking ? 'ring-2 ring-emerald-400' : 'ring-1 ring-white/15') : 'border-2 border-dashed border-white/15 bg-white/5'} ${locked && !seat ? 'opacity-40' : ''}`}
                  style={speaking ? { animation: 'speakPulse 1.4s ease-in-out infinite' } : undefined}
                >
                  {seat ? (
                    <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
                      {seat.avatarUrl ? <img src={seat.avatarUrl} className="w-full h-full object-cover" /> : <span className="font-display font-bold">{(seat.userName || '?')[0]}</span>}
                    </div>
                  ) : locked ? <LockIcon size={16} className="text-white/30" /> : <PlusIcon size={18} className="text-white/30" />}
                  {seat && (
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
                      {seatMicOff ? <MicOffIcon size={11} className="text-red-400" /> : <MicIcon size={11} className="text-emerald-400" />}
                    </span>
                  )}
                  {seatIsHost && <span className="absolute -top-1.5 -right-1"><CrownIcon size={15} filled className="text-yellow-400" /></span>}
                  {!seatIsHost && seatIsAdmin && <span className="absolute -top-1.5 -right-1"><ShieldIcon size={13} filled className="text-emerald-400" /></span>}
                </button>
                <span className="text-[11px] text-white/60 truncate max-w-[4.2rem] text-center">{seat ? seat.userName : (locked ? 'Locked' : 'Empty')}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Now-playing slim strip (tap to open music panel) */}
      <button onClick={() => setMusicOpen(true)} className="shrink-0 mx-4 mb-2 rounded-xl bg-black/40 backdrop-blur border border-white/10 px-3 py-2 flex items-center gap-2 text-left">
        {room.currentTrack ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-xs text-white/80 truncate flex-1"><span className="font-semibold">{room.currentTrack.title}</span> · {room.currentTrack.artistName}</p>
            {room.isPlaying ? <PauseIcon size={13} className="text-white/50 shrink-0" /> : <PlayIcon size={13} className="text-white/50 shrink-0" />}
          </>
        ) : (
          <p className="text-xs text-white/40 truncate flex-1">Tap to open music — {canControl ? 'pick a track' : 'request a song'}</p>
        )}
      </button>

      {/* Chat: messages stack above the permanent input, newest nearest the input */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 flex flex-col justify-end">
        <div className="space-y-2 pb-1">
          {mergedMsgs.map((m) => {
            const mine = m.userId === user?.id
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 ${mine ? 'grad-brand text-black' : 'bg-white/10 text-white'}`}>
                  {!mine && <p className="text-[11px] font-semibold opacity-70 leading-none mb-1">{m.userName}</p>}
                  <p className="text-sm leading-snug break-words whitespace-pre-line">{m.text}</p>
                </div>
                <span className="text-[9px] text-white/25 mt-0.5 px-1">{m.createdAt ? timeAgo(m.createdAt) : ''}</span>
              </div>
            )
          })}
          {typingUsers.length > 0 && <p className="text-[11px] text-white/40 italic">{typingUsers.length === 1 ? 'Someone is typing…' : 'Several people are typing…'}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reaction picker (opens above the input) */}
      {reactOpen && (
        <div className="shrink-0 mx-4 mb-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 grid grid-cols-6 gap-2 animate-sheet-up">
          {REACTIONS.map((e) => <button key={e} onClick={() => sendReaction(e)} className="text-2xl active:scale-90 transition-transform">{e}</button>)}
        </div>
      )}

      {/* Permanent chat input + reaction button */}
      <div className="shrink-0 flex items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] pt-1">
        {isSeated ? (
          <>
            <button onClick={() => setMicOn((v) => !v)} disabled={mySeatMuted} title={mySeatMuted ? 'Muted by host' : (micOn ? 'Mute mic' : 'Unmute mic')} className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${mySeatMuted ? 'bg-white/5 text-white/25' : micOn ? 'grad-brand text-black' : 'bg-white/10 text-white/70'}`}>
              {micOn && !mySeatMuted ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
            </button>
            <button onClick={leaveSeat} className="shrink-0 text-[10px] font-semibold px-2 py-2 rounded-full bg-white/10 text-white/70">Leave</button>
          </>
        ) : (
          <button onClick={() => { const empty = seats.findIndex((s, i) => !s && !room.seatLocks?.[i]); empty >= 0 ? joinSeat(empty) : requestSeat() }} className="shrink-0 text-[10px] font-semibold px-2.5 py-2 rounded-full grad-brand text-black"><SeatIcon size={13} /></button>
        )}
        <button onClick={() => setReactOpen((v) => !v)} className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${reactOpen ? 'grad-brand text-black' : 'bg-white/10 text-white/70'}`}><SmileIcon size={19} /></button>
        <input value={text} onChange={(e) => { setText(e.target.value); setTyping(!!e.target.value) }} onBlur={() => setTyping(false)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} placeholder="Say something…" className="flex-1 min-w-0 bg-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        <button onClick={sendChat} className="shrink-0 w-10 h-10 rounded-full btn-brand flex items-center justify-center"><SendIcon size={16} color="#0B0B0B" /></button>
      </div>

      {/* Join/leave toasts — slide in from the right */}
      <div className="fixed top-[calc(env(safe-area-inset-top,0px)+4.5rem)] right-3 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 text-xs text-white shadow-lg" style={{ animation: 'slideInRight 0.35s ease-out' }}>{t.text}</div>
        ))}
      </div>

      {/* Music panel */}
      {musicOpen && (
        <MusicPanel
          room={room} canControl={canControl} onClose={() => setMusicOpen(false)}
          onAdd={addToQueue} onRequest={requestTrack} onRemove={removeFromQueue} onReorder={reorderQueue}
          onApproveRequest={approveSongRequest} onRejectRequest={rejectSongRequest} onTogglePin={togglePin}
          onPlayFromQueue={playFromQueue} onTogglePlay={togglePlayHost} onNext={advanceQueue} onPrev={prevTrack} onVoteSkip={voteSkip}
          onBattleVote={castBattleVote} myId={user?.id}
          localVolume={localVolume} setLocalVolume={setLocalVolume}
          sleepMin={sleepMin} onSleep={setSleepTimer}
        />
      )}

      {/* Seat action sheet */}
      {seatMenu != null && (
        <SeatActionSheet
          index={seatMenu} seat={seats[seatMenu]} room={room} me={user} isHost={isHost} isAdmin={isAdmin}
          onClose={() => setSeatMenu(null)}
          onMute={() => toggleMute(seatMenu)}
          onLock={() => toggleLock(seatMenu)}
          onKick={() => kick(seatMenu)}
          onTransfer={() => transferOwnership(seatMenu)}
          onMakeAdmin={() => makeAdmin(seats[seatMenu].userId)}
          onRemoveAdmin={() => removeAdmin(seats[seatMenu].userId)}
          onLeave={leaveSeat}
        />
      )}

      {showQR && <QRCard url={`${shareBase()}/#/rooms/${roomId}`} name={room.name} onClose={() => setShowQR(false)} />}

      {room.visibility === 'password' && !isHost && !isAdmin && !unlocked && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }}>
          <div className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] animate-sheet-up">
            <div className="w-12 h-12 rounded-2xl grad-brand flex items-center justify-center mb-4"><LockIcon size={22} color="#0B0B0B" /></div>
            <h3 className="font-display font-bold text-white text-lg mb-1">Password protected</h3>
            <p className="text-sm text-white/50 mb-4">Enter the party password to join “{room.name}”.</p>
            <input
              type="password" value={pwInput} autoFocus
              onChange={(e) => { setPwInput(e.target.value); setPwError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { if (pwInput === room.password) { try { sessionStorage.setItem(`miley_room_unlock_${roomId}`, '1') } catch {} setUnlocked(true) } else setPwError('Incorrect password.') } }}
              placeholder="Room password"
              className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none mb-2"
            />
            {pwError && <p className="text-xs text-red-400 mb-2">{pwError}</p>}
            <button onClick={() => { if (pwInput === room.password) { try { sessionStorage.setItem(`miley_room_unlock_${roomId}`, '1') } catch {} setUnlocked(true) } else setPwError('Incorrect password.') }} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm mb-2">Join Party</button>
            <button onClick={() => navigate('/rooms')} className="w-full py-2.5 text-sm text-white/40">Cancel</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }}>
          <div className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] animate-sheet-up">
            <div className="w-12 h-12 rounded-2xl grad-brand flex items-center justify-center mb-4"><ShieldIcon size={22} color="#0B0B0B" /></div>
            <h3 className="font-display font-bold text-white text-lg mb-3">Listening Party Guidelines</h3>
            <ul className="space-y-2.5 mb-5 text-sm text-white/60">
              <li className="flex gap-2"><CheckIcon size={16} className="grad-brand-text shrink-0 mt-0.5" /> Be respectful — no harassment, hate speech or spam.</li>
              <li className="flex gap-2"><CheckIcon size={16} className="grad-brand-text shrink-0 mt-0.5" /> Only the host & admins control music. Request tracks via the queue.</li>
              <li className="flex gap-2"><CheckIcon size={16} className="grad-brand-text shrink-0 mt-0.5" /> Tap any empty seat to join, then tap the mic to talk — allow microphone access when asked.</li>
              <li className="flex gap-2"><CheckIcon size={16} className="grad-brand-text shrink-0 mt-0.5" /> Hosts may mute, remove or ban anyone who breaks the rules.</li>
            </ul>
            <button onClick={() => { try { localStorage.setItem('miley_room_rules_ack', '1') } catch {} setShowRules(false) }} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm">I Understand — Enter Room</button>
            <button onClick={() => navigate('/rooms')} className="w-full mt-2 py-2.5 text-sm text-white/40">Leave</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUpFade { 0% { opacity:0; transform: translateY(0) scale(0.6); } 20% { opacity:1; transform: translateY(-10px) scale(1.1); } 100% { opacity:0; transform: translateY(-52px) scale(1); } }
        @keyframes slideInRight { 0% { opacity:0; transform: translateX(60px); } 100% { opacity:1; transform: translateX(0); } }
        @keyframes spinDisc { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); } 50% { box-shadow: 0 0 0 6px rgba(52,211,153,0); } }
      `}</style>
    </div>
  )
}

function SeatActionSheet({ index, seat, room, me, isHost, isAdmin, onClose, onMute, onLock, onKick, onTransfer, onMakeAdmin, onRemoveAdmin, onLeave }) {
  const isMe = seat && seat.userId === me?.id
  const seatIsAdmin = seat && (room.admins || []).includes(seat.userId)
  const canManage = (isHost || isAdmin) && seat && !isMe

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <p className="text-sm font-semibold text-center mb-4">{seat ? seat.userName : `Seat ${index + 1}`}</p>
        <div className="space-y-1">
          {isMe && <ActionBtn icon={<SeatIcon size={17} />} label="Leave Seat" onClick={() => { onLeave(); onClose() }} />}
          {canManage && (
            <>
              <ActionBtn icon={seat.muted ? <MicIcon size={17} /> : <MicOffIcon size={17} />} label={seat.muted ? 'Unmute' : 'Mute'} onClick={() => { onMute(); onClose() }} />
              <ActionBtn icon={<TrashIcon size={17} />} label="Remove from seat" onClick={() => { onKick(); onClose() }} danger />
              {isHost && <ActionBtn icon={<CrownIcon size={17} />} label="Transfer Ownership" onClick={() => { onTransfer(); onClose() }} />}
              {isHost && (seatIsAdmin ? (
                <ActionBtn icon={<ShieldIcon size={17} />} label="Remove Admin" onClick={() => { onRemoveAdmin(); onClose() }} />
              ) : (
                <ActionBtn icon={<ShieldIcon size={17} />} label="Make Admin" onClick={() => { onMakeAdmin(); onClose() }} />
              ))}
            </>
          )}
          {(isHost || isAdmin) && <ActionBtn icon={<LockIcon size={17} />} label={room.seatLocks?.[index] ? 'Unlock Seat' : 'Lock Seat'} onClick={() => { onLock(); onClose() }} />}
          {!isMe && !canManage && !(isHost || isAdmin) && <p className="text-xs text-white/30 text-center py-2">Only the host or an admin can manage this seat.</p>}
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 ${danger ? 'text-red-400' : 'text-white'}`}>
      {icon}<span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function MusicPanel({ room, canControl, onClose, onAdd, onRequest, onRemove, onReorder, onApproveRequest, onRejectRequest, onTogglePin, onPlayFromQueue, onTogglePlay, onNext, onPrev, onVoteSkip, onBattleVote, myId, localVolume, setLocalVolume, sleepMin, onSleep }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState('queue') // 'queue' | 'search' | 'lyrics' | 'battle'
  const [lyricTime, setLyricTime] = useState(0)
  const requests = room.songRequests || []

  // ── Song Battle live tallies ──
  const bUp = (room.battleVotes?.up || []).length
  const bDown = (room.battleVotes?.down || []).length
  const bTotal = bUp + bDown
  const myVote = (room.battleVotes?.up || []).includes(myId) ? 'up' : (room.battleVotes?.down || []).includes(myId) ? 'down' : null
  const upPct = bTotal ? Math.round((bUp / bTotal) * 100) : 0
  const downPct = bTotal ? 100 - upPct : 0
  // Session leaderboard: finalized songs + the one playing right now (live).
  const leaderboard = useMemo(() => {
    const rows = [...(room.battleLog || [])]
    const cur = room.currentTrack
    if (cur && bTotal > 0 && !rows.some((r) => r.id === cur.id)) {
      rows.push({ id: cur.id, title: cur.title, artistName: cur.artistName, coverUrl: cur.coverUrl, up: bUp, down: bDown, score: bUp - bDown, live: true })
    } else if (cur) {
      const i = rows.findIndex((r) => r.id === cur.id)
      if (i >= 0 && bTotal > 0) rows[i] = { ...rows[i], up: bUp, down: bDown, score: bUp - bDown, live: true }
    }
    return rows.sort((a, b) => b.score - a.score || b.up - a.up)
  }, [room.battleLog, room.currentTrack, bUp, bDown, bTotal])

  // Live playback clock for synced lyrics — derived from the shared room state,
  // so every participant highlights the same line at the same moment.
  useEffect(() => {
    const tick = () => {
      if (room.isPlaying && room.startedAt) {
        setLyricTime((room.position || 0) + (Date.now() - new Date(room.startedAt).getTime()) / 1000)
      } else {
        setLyricTime(room.position || 0)
      }
    }
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [room.isPlaying, room.startedAt, room.position, room.currentTrack?.id])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await db.searchShared('tracks', q, { fields: ['title', 'artistName'], limit: 25 })) } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose} style={{ height: 'var(--visual-height, 100dvh)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl flex flex-col animate-sheet-up" style={{ height: 'min(86vh, var(--visual-height, 100dvh))' }}>
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-display font-bold">Music</h3>
          <button onClick={onClose}><CloseIcon size={18} className="text-white/50" /></button>
        </div>

        {/* Now playing + controls */}
        <div className="shrink-0 px-5 pb-3">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
            {room.currentTrack ? (
              <div className="flex items-center gap-3">
                <Cover track={room.currentTrack} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{room.currentTrack.title}</p>
                  <p className="text-xs text-white/40 truncate">{room.currentTrack.artistName}{room.tempDJUserId ? ' · guest pick' : ''}</p>
                </div>
                {canControl ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={onPrev} className="p-2 text-white/70"><PrevIcon size={17} /></button>
                    <button onClick={onTogglePlay} className="w-10 h-10 rounded-full btn-brand flex items-center justify-center">{room.isPlaying ? <PauseIcon size={16} color="#0B0B0B" /> : <PlayIcon size={16} color="#0B0B0B" />}</button>
                    <button onClick={onNext} className="p-2 text-white/70"><NextIcon size={18} /></button>
                  </div>
                ) : (
                  <button onClick={onVoteSkip} className="p-2 text-white/60 shrink-0 flex flex-col items-center"><SkipVoteIcon size={16} /><span className="text-[9px]">{(room.skipVotes || []).length}</span></button>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 text-center py-2">Nothing playing. {canControl ? 'Pick a track from the queue below.' : 'Search to request a song.'}</p>
            )}
          </div>

          {/* Song Battle — everyone rates the playing song, live */}
          {room.currentTrack && (
            <div className="mt-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-pink-500/10 border border-white/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-white/60 flex items-center gap-1">⚔️ Song Battle</span>
                <span className="text-[10px] text-white/35">{bTotal} vote{bTotal === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onBattleVote('up')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${myVote === 'up' ? 'bg-emerald-500 text-black scale-[1.03]' : 'bg-white/8 text-white/70'}`}
                >
                  <span className="text-lg">👍</span> {bUp}
                </button>
                <button
                  onClick={() => onBattleVote('down')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${myVote === 'down' ? 'bg-pink-500 text-black scale-[1.03]' : 'bg-white/8 text-white/70'}`}
                >
                  <span className="text-lg">👎</span> {bDown}
                </button>
              </div>
              {bTotal > 0 && (
                <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/10 flex">
                  <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${upPct}%` }} />
                  <div className="h-full bg-pink-400 transition-all duration-500" style={{ width: `${downPct}%` }} />
                </div>
              )}
              {bTotal > 0 && (
                <div className="flex justify-between mt-1 text-[10px] text-white/40">
                  <span>{upPct}% good</span><span>{downPct}% bad</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <VolumeIcon size={15} className="text-white/40 shrink-0" />
            <input type="range" min="0" max="1" step="0.01" value={localVolume} onChange={(e) => setLocalVolume(Number(e.target.value))} className="flex-1 accent-emerald-400" />
            <span className="text-[10px] text-white/30 w-8 text-right">{Math.round(localVolume * 100)}%</span>
          </div>
          {canControl && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <TimerIcon size={15} className="text-white/40 shrink-0" />
              <span className="text-[11px] text-white/40 mr-1">Sleep timer</span>
              {[{ v: 0, l: 'Off' }, { v: 15, l: '15m' }, { v: 30, l: '30m' }, { v: 60, l: '60m' }].map(({ v, l }) => (
                <button key={v} onClick={() => onSleep(v)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${sleepMin === v ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-2 px-5 pb-3">
          <button onClick={() => setTab('queue')} className={`relative flex-1 text-xs font-semibold py-2 rounded-xl ${tab === 'queue' ? 'btn-brand text-black' : 'card-surface text-white/50'}`}>
            Queue ({(room.queue || []).length})
            {canControl && requests.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{requests.length}</span>}
          </button>
          <button onClick={() => setTab('search')} className={`flex-1 text-xs font-semibold py-2 rounded-xl ${tab === 'search' ? 'btn-brand text-black' : 'card-surface text-white/50'}`}>Request</button>
          <button onClick={() => setTab('lyrics')} className={`flex-1 text-xs font-semibold py-2 rounded-xl ${tab === 'lyrics' ? 'btn-brand text-black' : 'card-surface text-white/50'}`}>Lyrics</button>
          <button onClick={() => setTab('battle')} className={`flex-1 text-xs font-semibold py-2 rounded-xl ${tab === 'battle' ? 'btn-brand text-black' : 'card-surface text-white/50'}`}>Battle</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5">
          {tab === 'search' ? (
            <div className="pb-4">
              <div className="flex items-center gap-2 card-surface rounded-2xl px-3 py-2 mb-2 sticky top-0">
                <SearchIcon size={15} className="text-white/40 shrink-0" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs to request…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
              </div>
              <div className="space-y-1">
                {searching && <p className="text-xs text-white/30 py-2">Searching…</p>}
                {!searching && q.trim() && results.length === 0 && <p className="text-xs text-white/30 py-2">No matches.</p>}
                {!q.trim() && <p className="text-xs text-white/30 py-4 text-center">Type a song name to request it to the queue.</p>}
                {results.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5">
                    <Cover track={t} size={38} />
                    <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{t.title}</p><p className="text-[11px] text-white/40 truncate">{t.artistName}</p></div>
                    <button onClick={() => (canControl ? onAdd(t) : onRequest(t))} className="text-[11px] font-medium px-3 py-1.5 rounded-full btn-brand text-black shrink-0">{canControl ? 'Queue' : 'Request'}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : tab === 'lyrics' ? (
            <div className="pb-4">
              {room.currentTrack ? (
                <LyricsView lyrics={room.currentTrack.lyrics} currentTime={lyricTime} />
              ) : (
                <p className="text-xs text-white/30 py-6 text-center">Nothing playing — lyrics appear here when a song starts.</p>
              )}
            </div>
          ) : tab === 'battle' ? (
            <div className="pb-4">
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1">🏆 Session leaderboard</p>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-white/30 py-6 text-center">No votes yet. Rate the playing song 👍 / 👎 to start the battle.</p>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.map((r, i) => {
                    const isWinner = i === 0 && r.score > 0
                    const isLoser = i === leaderboard.length - 1 && leaderboard.length > 1 && r.score < 0
                    return (
                      <div key={r.id} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${isWinner ? 'bg-emerald-500/15 border border-emerald-400/30' : isLoser ? 'bg-pink-500/10 border border-pink-400/20' : 'bg-white/5'}`}>
                        <span className="w-5 text-center text-sm font-bold text-white/40">{isWinner ? '👑' : i + 1}</span>
                        <Cover track={r} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate flex items-center gap-1.5">{r.title}{r.live && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">LIVE</span>}</p>
                          <p className="text-[11px] text-white/40 truncate">{r.artistName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${r.score > 0 ? 'text-emerald-400' : r.score < 0 ? 'text-pink-400' : 'text-white/50'}`}>{r.score > 0 ? '+' : ''}{r.score}</p>
                          <p className="text-[10px] text-white/35">👍{r.up} 👎{r.down}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {leaderboard.length > 1 && leaderboard[0].score > 0 && (
                <p className="text-[11px] text-center text-white/40 mt-3">Winning so far: <span className="text-emerald-400 font-semibold">{leaderboard[0].title}</span></p>
              )}
            </div>
          ) : (
            <div className="space-y-1 pb-4">
              {/* Pending song requests (host/admin approval) */}
              {canControl && requests.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-white/40 mb-1.5">Pending requests</p>
                  <div className="space-y-1">
                    {requests.map((r) => (
                      <div key={r.id + r.requestedBy} className="flex items-center gap-2 py-1.5 rounded-xl bg-white/5 px-2">
                        <Cover track={r} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{r.title}</p>
                          <p className="text-[11px] text-white/40 truncate">from {r.requestedByName || 'someone'}</p>
                        </div>
                        <button onClick={() => onApproveRequest(r)} className="w-8 h-8 rounded-full grad-brand text-black flex items-center justify-center shrink-0"><CheckIcon size={15} /></button>
                        <button onClick={() => onRejectRequest(r)} className="w-8 h-8 rounded-full bg-white/10 text-white/50 flex items-center justify-center shrink-0"><CloseIcon size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Pinned song — always plays next */}
              {room.pinnedTrack && (
                <div className="mb-3">
                  <p className="text-xs grad-brand-text mb-1.5 flex items-center gap-1"><PinIcon size={12} /> Pinned · plays next</p>
                  <div className="flex items-center gap-2 py-1.5 rounded-xl bg-white/5 px-2">
                    <Cover track={room.pinnedTrack} size={34} />
                    <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{room.pinnedTrack.title}</p><p className="text-[11px] text-white/40 truncate">{room.pinnedTrack.artistName}</p></div>
                    {canControl && <button onClick={() => onTogglePin(room.pinnedTrack)} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/60 shrink-0">Unpin</button>}
                  </div>
                </div>
              )}
              <p className="text-xs text-white/40 mb-1">Up next</p>
              {(room.queue || []).length === 0 && <p className="text-xs text-white/30 py-4 text-center">Queue is empty — use Request to add a song.</p>}
              {(room.queue || []).map((t, i) => (
                <div key={t.id + i} className="flex items-center gap-2 py-1.5">
                  <span className="text-xs text-white/30 w-4 shrink-0">{i + 1}</span>
                  <Cover track={t} size={38} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.title}</p>
                    <p className="text-[11px] text-white/40 truncate">requested by {t.requestedByName || 'someone'}</p>
                  </div>
                  <span className="text-[10px] text-white/30 shrink-0">{formatDuration(t.duration)}</span>
                  {canControl && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onReorder(i, -1)} className="text-white/40 px-1">▲</button>
                      <button onClick={() => onReorder(i, 1)} className="text-white/40 px-1">▼</button>
                      <button onClick={() => onTogglePin(t)} title="Pin — play next" className={`px-1 ${room.pinnedTrack?.id === t.id ? 'grad-brand-text' : 'text-white/40'}`}><PinIcon size={14} /></button>
                      <button onClick={() => onPlayFromQueue(i)} className="text-[11px] font-medium px-2 py-1 rounded-full btn-brand text-black">Play</button>
                      <button onClick={() => onRemove(i)} className="text-white/30"><TrashIcon size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
