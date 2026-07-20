import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { messaging } from '../lib/messaging'
import { storage } from '../lib/storage'
import { download } from '../lib/download'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { useTyping, useOnlinePresence, useLastSeen } from '../hooks/usePresence'
import { notify, markChannelNotificationsRead } from '../hooks/useNotifications'
import { encryptText, decryptText } from '../chatCrypto'
import {
  setMessageState, toggleReaction, togglePin, markChannelRead,
  blockUser, setChatPrefs,
} from '../chatHelpers'
import { Cover } from '../components/TrackViews'
import { timeAgo } from '../musicHelpers'
import { CHAT_THEMES, getChatTheme, setChatTheme, themeStyle } from '../chatThemes'
import {
  BackIcon, SendIcon, MicIcon, CoverIcon, MoreIcon, ReplyIcon, ForwardIcon, CopyIcon,
  PinIcon, TrashIcon, EditIcon, CloseIcon, CheckIcon, PlayIcon, PauseIcon, LockIcon, MuteIcon,
  ArchiveIcon, BlockIcon, FlagIcon, PlusIcon, ThemeIcon, DownloadIcon, CoverIcon as ImageGlyph,
} from '../components/icons'

const REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢']
const SHARE_MARK = 'MILEYSHARE::'
const SPEEDS = [1, 1.5, 2]
const DEFAULT_PEAKS = Array.from({ length: 32 }, (_, i) => 0.35 + 0.4 * Math.abs(Math.sin(i * 0.7)))

function fmtSecs(s) {
  const t = Math.max(0, Math.floor(s || 0))
  const m = Math.floor(t / 60)
  const ss = (t % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

// Build the reply metadata for a message being replied to. Voice notes carry
// their duration + a trimmed waveform so the reply card can render a real mini
// voice preview instead of the literal text "[Audio]".
function buildReplyMeta(replyTo) {
  if (!replyTo) return {}
  const base = {
    replyToId: replyTo.id,
    replyPreview: (replyTo.content || '').slice(0, 80),
    replyType: replyTo.type || 'text',
  }
  if (replyTo.type === 'audio') {
    base.replyDuration = replyTo.metadata?.duration || 0
    base.replyWaveform = (replyTo.metadata?.waveform || []).slice(0, 24)
  } else if (replyTo.type === 'image') {
    base.replyImage = replyTo.metadata?.imageUrl || ''
  }
  return base
}

// Compact preview of the message being replied to — a real voice card (waveform
// + duration) for voice notes, a thumbnail for images, otherwise the text.
function ReplyPreview({ meta, compact }) {
  const type = meta?.replyType
  if (type === 'audio') {
    const peaks = (meta.replyWaveform && meta.replyWaveform.length) ? meta.replyWaveform : DEFAULT_PEAKS.slice(0, 24)
    return (
      <div className="flex items-center gap-2 min-w-0">
        <MicIcon size={compact ? 12 : 13} className="text-[rgb(var(--color-primary))] shrink-0" />
        <div className="flex items-center gap-[2px] h-4 shrink-0">
          {peaks.slice(0, 18).map((lv, i) => (
            <span key={i} className="w-[2px] rounded-full bg-white/40" style={{ height: `${Math.max(20, Math.round(lv * 100))}%` }} />
          ))}
        </div>
        <span className="text-[11px] text-white/50 tabular-nums shrink-0">{fmtSecs(meta.replyDuration)}</span>
      </div>
    )
  }
  if (type === 'image') {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {meta.replyImage ? <img src={meta.replyImage} className="w-6 h-6 rounded object-cover shrink-0" /> : null}
        <span className="text-[11px] text-white/60 truncate">Photo</span>
      </div>
    )
  }
  return <p className={`${compact ? 'text-xs' : 'text-[11px]'} text-white/60 truncate max-w-[16rem]`}>{meta?.replyPreview || '…'}</p>
}

// Decode a recorded blob into ~40 normalized amplitude peaks for a real waveform.
// Best-effort: returns [] if decoding fails (player falls back to a default shape).
async function computeWaveform(blob, buckets = 40) {
  try {
    const arr = await blob.arrayBuffer()
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const buf = await ctx.decodeAudioData(arr)
    const data = buf.getChannelData(0)
    const block = Math.floor(data.length / buckets) || 1
    const peaks = []
    for (let i = 0; i < buckets; i++) {
      let sum = 0
      for (let j = 0; j < block; j++) { const v = data[i * block + j] || 0; sum += v * v }
      peaks.push(Math.sqrt(sum / block))
    }
    try { ctx.close() } catch (e) { /* ignore */ }
    const max = Math.max(...peaks, 0.0001)
    return peaks.map((p) => Math.max(0.08, Math.min(1, p / max)))
  } catch (e) { return [] }
}

export default function ChatRoom() {
  const { id: channelId } = useParams()
  const navigate = useNavigate()
  const me = auth.getCurrentUser()
  const [channel, setChannel] = useState(null)
  const [messagesList, setMessagesList] = useState([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [highlightId, setHighlightId] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)
  const [showShare, setShowShare] = useState(false)
  const [showForward, setShowForward] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recPaused, setRecPaused] = useState(false)
  const [recSecs, setRecSecs] = useState(0)
  const [recLevels, setRecLevels] = useState([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [theme, setThemeState] = useState(() => getChatTheme(channelId))
  const [newCount, setNewCount] = useState(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const atBottomRef = useRef(true)
  const prevLastRef = useRef(null)
  const fileRef = useRef(null)
  const mediaRecRef = useRef(null)
  const chunksRef = useRef([])
  const recStreamRef = useRef(null)
  const recTimerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const levelsRef = useRef([])
  const voiceRetryRef = useRef({})
  const lastSignalRef = useRef(null)
  const { typingUsers, setTyping } = useTyping(channelId)
  const online = useOnlinePresence()

  const { data: states } = useLiveShared('message_state', { filters: { channelId }, limit: 500 })
  const { data: reactions } = useLiveShared('message_reactions', { filters: { channelId }, limit: 800 })
  const { data: pins } = useLiveShared('message_pins', { filters: { channelId }, limit: 100 })
  const { data: reads } = useLiveShared('message_reads', { filters: { channelId }, limit: 50 })
  // Redundant delivery signal. Message BODIES are delivered by the messaging
  // library's own realtime channel (a separate table + INSERT-only socket) which
  // can miss an event when backgrounded — the classic "only shows after reopening"
  // bug. This tiny row is bumped on every send and rides the app's OWN db realtime
  // (event '*', the same reliable channel that powers seats/reactions here), so a
  // change always reaches every open thread and re-pulls the messages.
  const { data: signals } = useLiveShared('dm_signal', { filters: { channelId }, limit: 1 })

  const stateMap = useMemo(() => Object.fromEntries((states || []).map((s) => [s.messageId, s])), [states])
  const reactionMap = useMemo(() => {
    const m = {}
    for (const r of reactions || []) { (m[r.messageId] ||= []).push(r) }
    return m
  }, [reactions])
  const pinnedIds = useMemo(() => new Set((pins || []).map((p) => p.messageId)), [pins])
  const otherReads = useMemo(() => (reads || []).filter((r) => r.userId !== me?.id), [reads, me])

  const loadChannel = async () => {
    const chs = await messaging.getChannels().catch(() => [])
    setChannel(chs.find((c) => c.id === channelId) || null)
  }

  const loadMessages = async () => {
    const msgs = await messaging.getMessages(channelId, { limit: 40 }).catch(() => [])
    const decrypted = await Promise.all(msgs.map(async (m) => ({ ...m, content: await decryptText(channelId, m.content) })))
    setMessagesList(decrypted)
    setHasMore(msgs.length >= 40)
  }

  // Per-user "Delete for me" — hidden message ids live in a private (per-user) row
  // set, so they sync to this user across devices without affecting anyone else.
  const loadHidden = async () => {
    const rows = await db.select('dm_hidden', { channelId }, { limit: 500 }).catch(() => [])
    setHiddenIds(new Set((rows || []).map((r) => r.messageId)))
  }

  const deleteForMe = async (msg) => {
    setHiddenIds((prev) => new Set(prev).add(msg.id))
    try { await db.upsert('dm_hidden', { channelId, messageId: msg.id }, msg.id) } catch (e) { /* ignore */ }
  }

  // Merge-based refresh used by realtime reconciliation (signal + focus/online).
  // Unlike loadMessages it never replaces the list — it folds the latest 40 server
  // rows into whatever is already loaded (older lazy-loaded history AND in-flight
  // optimistic bubbles), de-duped by id and ordered by time. So an incoming
  // message appears instantly without wiping a scrolled-up reader's history or a
  // sender's pending row.
  const syncMessages = async () => {
    const msgs = await messaging.getMessages(channelId, { limit: 40 }).catch(() => null)
    if (!msgs) return
    const decrypted = await Promise.all(msgs.map(async (m) => ({ ...m, content: await decryptText(channelId, m.content) })))
    setMessagesList((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of decrypted) map.set(m.id, { ...(map.get(m.id) || {}), ...m })
      return [...map.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    })
  }

  // Lazy-load older history when the user scrolls to the top — keeps very long
  // threads (tens of thousands of messages) light by only holding a window in
  // memory, and preserves the exact scroll position after prepending.
  const loadOlder = async () => {
    if (loadingOlder || !hasMore || messagesList.length === 0) return
    setLoadingOlder(true)
    const el = scrollRef.current
    const prevHeight = el ? el.scrollHeight : 0
    try {
      const oldest = messagesList[0]
      const msgs = await messaging.getMessages(channelId, { limit: 40, before: oldest.createdAt }).catch(() => [])
      const decrypted = await Promise.all(msgs.map(async (m) => ({ ...m, content: await decryptText(channelId, m.content) })))
      if (decrypted.length === 0) setHasMore(false)
      else {
        setMessagesList((prev) => {
          const existing = new Set(prev.map((m) => m.id))
          return [...decrypted.filter((m) => !existing.has(m.id)), ...prev]
        })
        setHasMore(msgs.length >= 40)
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight })
      }
    } catch (e) { /* ignore */ }
    setLoadingOlder(false)
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = dist < 80
    if (atBottomRef.current && newCount) setNewCount(0)
    if (el.scrollTop < 60) loadOlder()
  }

  useEffect(() => {
    lastSignalRef.current = null
    loadChannel()
    loadMessages()
    loadHidden()
    markChannelRead(channelId)
    markChannelNotificationsRead(channelId)
    const sub = messaging.onMessage(channelId, async (msg) => {
      const decryptedContent = await decryptText(channelId, msg.content)
      setMessagesList((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, { ...msg, content: decryptedContent }]))
      markChannelRead(channelId)
      markChannelNotificationsRead(channelId)
    })

    // The realtime socket can go quiet (phone locked, tab backgrounded, brief
    // network drop) and miss an INSERT event entirely. Rather than leaving the
    // thread stuck until the user leaves and re-opens it, silently reconcile
    // with the server the moment the tab/network comes back — event-driven,
    // never a polling timer.
    const resync = () => { if (document.visibilityState !== 'hidden') syncMessages() }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      sub.unsubscribe()
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // Redundant realtime delivery: whenever the per-channel signal row changes
  // (bumped on every send, delivered over the app's reliable db realtime), re-pull
  // the thread. This is the safety net for a missed messaging-socket INSERT — it's
  // event-driven (no polling) and merge-based (no history/optimistic loss), and
  // duplicates from the messaging channel are de-duped by id.
  useEffect(() => {
    const sig = (signals || [])[0]
    if (!sig) return
    const stamp = sig.at || sig.updatedAt || sig.createdAt
    if (lastSignalRef.current === null) { lastSignalRef.current = stamp; return }
    if (stamp !== lastSignalRef.current) {
      lastSignalRef.current = stamp
      syncMessages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals])

  // Smart auto-scroll: only jump to the newest message when the user is already
  // at the bottom (or the new message is their own). Otherwise leave their
  // reading position and surface a "New Messages" pill. Fires on the last
  // message CHANGING (append), never on prepending older history.
  const lastMsgId = messagesList[messagesList.length - 1]?.id
  useEffect(() => {
    if (!lastMsgId || lastMsgId === prevLastRef.current) return
    const last = messagesList[messagesList.length - 1]
    const mine = last?.senderId === me?.id
    if (mine || atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevLastRef.current ? 'smooth' : 'auto' })
      setNewCount(0)
    } else {
      setNewCount((c) => c + 1)
    }
    prevLastRef.current = lastMsgId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsgId])

  const isDM = channel?.type === 'direct'
  const title = channel ? (isDM ? channel.otherUser?.displayName : channel.name) : '…'
  const otherOnline = isDM && channel?.otherUser?.id && online.has(channel.otherUser.id)
  const otherLastSeen = useLastSeen(isDM ? channel?.otherUser?.id : null)

  // Header presence line, Instagram-style: typing… → Active now → Active 5m ago.
  const presenceLine = (() => {
    if (typingUsers.length > 0) return 'typing…'
    if (!isDM) return 'Encrypted'
    if (otherOnline) return 'Active now'
    if (otherLastSeen) return `Active ${timeAgo(otherLastSeen)}`
    return 'Encrypted'
  })()

  // Per-message delivery state for the sender's own DMs: Sending → Sent →
  // Delivered (recipient online) → Seen (recipient's read receipt ≥ this msg).
  const statusFor = (m) => {
    if (!isDM || m.senderId !== me?.id) return null
    if (m.pending) return 'sending'
    if (m.failed) return 'failed'
    if (otherReads.some((r) => new Date(r.lastReadAt) >= new Date(m.createdAt))) return 'seen'
    if (otherOnline) return 'delivered'
    return 'sent'
  }

  // Tap a reply quote → scroll the original message into view and flash it.
  // If the original scrolled out of the in-memory window, keep loading older
  // pages until it appears (bounded), so the reply link never dead-ends.
  const jumpToMessage = async (id) => {
    for (let i = 0; i < 12; i++) {
      const el = scrollRef.current?.querySelector(`[data-mid="${id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightId(id)
        setTimeout(() => setHighlightId(null), 1600)
        return
      }
      if (!hasMore) break
      await loadOlder()
    }
  }

  const send = async (payload) => {
    const meta = buildReplyMeta(replyTo)
    // Optimistic bubble shown as "Sending…" immediately, then swapped for the
    // confirmed row (de-duped by id) once the write returns. On failure it is
    // flagged "Failed" instead of silently vanishing.
    const tempId = 'temp-' + Date.now()
    const optimistic = {
      id: tempId, channelId, senderId: me.id,
      content: payload.text || (payload.image ? '[Image]' : payload.audio ? '[Audio]' : ''),
      type: payload.image ? 'image' : payload.audio ? 'audio' : 'text',
      metadata: payload.image ? { imageUrl: payload.image } : payload.audio ? { audioUrl: payload.audio } : {},
      createdAt: new Date().toISOString(), pending: true,
    }
    setMessagesList((prev) => [...prev, optimistic])
    let toSend = { ...payload }
    if (toSend.text) toSend.text = await encryptText(channelId, toSend.text)
    let msg
    try {
      msg = await messaging.send(channelId, toSend)
    } catch (e) {
      setMessagesList((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
      return
    }
    setMessagesList((prev) => {
      const cleaned = prev.filter((m) => m.id !== tempId && m.id !== msg.id)
      return [...cleaned, { ...msg, content: payload.text || msg.content }]
    })
    // Bump the redundant delivery signal over the app's reliable realtime channel
    // so the recipient's thread re-pulls instantly even if the messaging socket
    // missed the INSERT. Fire-and-forget — never blocks the send.
    db.upsertShared('dm_signal', { channelId, at: Date.now(), by: me.id }, channelId).catch(() => {})
    if (Object.keys(meta).length) await setMessageState({ ...msg, senderId: me.id }, meta)
    if (isDM && channel?.otherUser?.id) {
      notify(channel.otherUser.id, { type: 'message', title: me.displayName || 'New message', body: payload.text ? payload.text.slice(0, 60) : 'Sent you a message', url: `/chat/${channelId}`, meta: { channelId } })
    } else if (!isDM && Array.isArray(channel?.members)) {
      channel.members.filter((mid) => mid !== me.id).forEach((mid) => {
        notify(mid, { type: 'message', title: `${me.displayName || 'Someone'} in ${channel.name || 'group'}`, body: payload.text ? payload.text.slice(0, 60) : 'Sent a message', url: `/chat/${channelId}`, meta: { channelId } })
      })
    }
    setReplyTo(null)
  }

  const handleSendText = async () => {
    const val = text.trim()
    if (!val) return
    setText('')
    setTyping(false)
    await send({ text: val })
  }

  const handleImage = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const { url } = await storage.upload(f, f.name)
    await send({ image: url })
  }

  // ── Voice notes ──────────────────────────────────────────────────────────
  // Real recorder with a live meter, running duration, and pause/resume/cancel.
  // On send: computes a waveform, uploads with an optimistic bubble, and keeps
  // the blob so a failed upload can be retried without re-recording.
  const startMeter = () => {
    const analyser = analyserRef.current
    if (!analyser) return
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > peak) peak = v }
      levelsRef.current = [...levelsRef.current, Math.max(0.12, Math.min(1, peak * 1.7))].slice(-32)
      setRecLevels(levelsRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const cleanupRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    try { analyserRef.current?.disconnect() } catch (e) { /* ignore */ }
    try { audioCtxRef.current?.close() } catch (e) { /* ignore */ }
    analyserRef.current = null; audioCtxRef.current = null
    recStreamRef.current?.getTracks().forEach((t) => t.stop())
    recStreamRef.current = null
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recStreamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      mediaRecRef.current = rec
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        const ctx = new Ctx()
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)
        audioCtxRef.current = ctx; analyserRef.current = analyser
        levelsRef.current = []
        startMeter()
      } catch (e) { /* meter optional */ }
      setRecSecs(0); setRecLevels([])
      recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000)
      rec.start()
      setRecording(true); setRecPaused(false)
    } catch (e) { /* mic denied */ }
  }

  const pauseRecording = () => {
    const rec = mediaRecRef.current
    if (!rec || rec.state !== 'recording') return
    try { rec.pause() } catch (e) { return }
    setRecPaused(true)
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }

  const resumeRecording = () => {
    const rec = mediaRecRef.current
    if (!rec || rec.state !== 'paused') return
    try { rec.resume() } catch (e) { return }
    setRecPaused(false)
    recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000)
    startMeter()
  }

  const cancelRecording = () => {
    const rec = mediaRecRef.current
    if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop() } catch (e) { /* ignore */ } }
    cleanupRecording()
    chunksRef.current = []
    setRecording(false); setRecPaused(false); setRecSecs(0); setRecLevels([])
  }

  const finishRecording = () => {
    const rec = mediaRecRef.current
    if (!rec || rec.state === 'inactive') { cancelRecording(); return }
    const secs = recSecs
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      cleanupRecording()
      setRecording(false); setRecPaused(false); setRecSecs(0); setRecLevels([])
      if (!blob.size) return
      const waveform = await computeWaveform(blob)
      await sendVoice(blob, Math.max(1, secs), waveform)
    }
    try { rec.stop() } catch (e) { cancelRecording() }
  }

  const sendVoice = async (blob, duration, waveform, existingTempId) => {
    const tempId = existingTempId || 'temp-' + Date.now()
    const localUrl = URL.createObjectURL(blob)
    const replyMeta = existingTempId ? {} : buildReplyMeta(replyTo)
    voiceRetryRef.current[tempId] = { blob, duration, waveform }
    if (existingTempId) {
      setMessagesList((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: true, failed: false } : m)))
    } else {
      setMessagesList((prev) => [...prev, {
        id: tempId, channelId, senderId: me.id, content: '[Audio]', type: 'audio',
        metadata: { audioUrl: localUrl, duration, waveform }, createdAt: new Date().toISOString(), pending: true,
      }])
    }
    let url
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
      const res = await storage.upload(file, file.name)
      url = res.url
    } catch (e) {
      setMessagesList((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
      return
    }
    let msg
    try {
      msg = await messaging.send(channelId, { audio: url, duration })
    } catch (e) {
      setMessagesList((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
      return
    }
    // messaging metadata only carries audioUrl + duration, so persist the waveform
    // peaks in message_state (public, sender-writable) for the recipient to read.
    const voiceMeta = { voiceWaveform: waveform, voiceDuration: duration, ...replyMeta }
    setMessageState({ ...msg, senderId: me.id }, voiceMeta).catch(() => {})
    if (Object.keys(replyMeta).length) setReplyTo(null)
    setMessagesList((prev) => {
      const cleaned = prev.filter((m) => m.id !== tempId && m.id !== msg.id)
      return [...cleaned, { ...msg, metadata: { ...(msg.metadata || {}), audioUrl: url, duration, waveform } }]
    })
    delete voiceRetryRef.current[tempId]
    try { URL.revokeObjectURL(localUrl) } catch (e) { /* ignore */ }
    db.upsertShared('dm_signal', { channelId, at: Date.now(), by: me.id }, channelId).catch(() => {})
    if (isDM && channel?.otherUser?.id) {
      notify(channel.otherUser.id, { type: 'message', title: me.displayName || 'New message', body: '🎤 Voice message', url: `/chat/${channelId}`, meta: { channelId } })
    } else if (!isDM && Array.isArray(channel?.members)) {
      channel.members.filter((mid) => mid !== me.id).forEach((mid) => {
        notify(mid, { type: 'message', title: `${me.displayName || 'Someone'} in ${channel.name || 'group'}`, body: '🎤 Voice message', url: `/chat/${channelId}`, meta: { channelId } })
      })
    }
  }

  const retryVoice = (tempId) => {
    const item = voiceRetryRef.current[tempId]
    if (item) sendVoice(item.blob, item.duration, item.waveform, tempId)
  }

  // Stop the mic and tear down audio nodes if the thread unmounts mid-recording.
  useEffect(() => () => cleanupRecording(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const shareItem = async (item, kind) => {
    const payload = SHARE_MARK + JSON.stringify({ kind, id: item.id, title: item.title, artistName: item.artistName, coverUrl: item.coverUrl, audioUrl: item.audioUrl })
    await send({ text: payload })
    setShowShare(false)
  }

  const forwardMessage = async (targetChannelId) => {
    const m = showForward
    if (m.type === 'text') {
      const enc = await encryptText(targetChannelId, m.content)
      await messaging.send(targetChannelId, { text: enc })
    } else if (m.type === 'image') await messaging.send(targetChannelId, { image: m.metadata?.imageUrl })
    else if (m.type === 'audio') await messaging.send(targetChannelId, { audio: m.metadata?.audioUrl, duration: m.metadata?.duration })
    setShowForward(null)
  }

  const filteredMessages = useMemo(() => {
    const base = messagesList.filter((m) => !hiddenIds.has(m.id))
    if (!search.trim()) return base
    return base.filter((m) => (m.content || '').toLowerCase().includes(search.toLowerCase()))
  }, [messagesList, search, hiddenIds])

  const pinnedMessages = useMemo(() => messagesList.filter((m) => pinnedIds.has(m.id)), [messagesList, pinnedIds])

  if (!channelId) return null

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full relative">
      <div className="shrink-0 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 border-b border-white/5">
        <button onClick={() => navigate('/messages')} className="text-white/70"><BackIcon size={22} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title || 'Chat'}</p>
          <p className={`text-[11px] flex items-center gap-1 ${presenceLine === 'Active now' ? 'text-emerald-400' : presenceLine === 'typing…' ? 'text-emerald-400' : 'text-white/40'}`}>
            {presenceLine === 'Active now' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {(presenceLine === 'Encrypted') && <LockIcon size={10} />}
            {presenceLine}
          </p>
        </div>
        <button onClick={() => setShowSearch((s) => !s)} className="p-2 text-white/50"><SearchGlyph /></button>
        <button onClick={() => setShowInfo(true)} className="p-2 text-white/50"><MoreIcon size={18} /></button>
      </div>

      {showSearch && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in conversation…" className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none" />
        </div>
      )}

      {pinnedMessages.length > 0 && !showSearch && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
          <PinIcon size={13} className="text-white/40 shrink-0" />
          {pinnedMessages.map((m) => <span key={m.id} className="text-xs text-white/50 truncate shrink-0 max-w-[10rem]">{m.content}</span>)}
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-4 space-y-2" style={themeStyle(theme)}>
        {loadingOlder && <p className="text-center text-[11px] text-white/30 py-1">Loading earlier messages…</p>}
        {filteredMessages.map((m) => (
          <MessageBubble
            key={m.id} msg={m} isMe={m.senderId === me?.id} state={stateMap[m.id]}
            reactions={reactionMap[m.id] || []} pinned={pinnedIds.has(m.id)}
            onOpenMenu={() => setActionMsg(m)}
            status={statusFor(m)}
            highlight={highlightId === m.id}
            onJumpTo={jumpToMessage}
            onRetryVoice={retryVoice}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {newCount > 0 && (
        <button
          onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setNewCount(0); atBottomRef.current = true }}
          className="absolute left-1/2 -translate-x-1/2 bottom-24 z-20 btn-brand text-black text-xs font-semibold px-4 py-2 rounded-full shadow-lg animate-sheet-up"
        >
          {newCount} New Message{newCount > 1 ? 's' : ''} ↓
        </button>
      )}

      {replyTo && (
        <div className="shrink-0 px-4 py-2 border-t border-white/5 flex items-center justify-between gap-3 bg-white/5">
          <div className="min-w-0 border-l-2 border-[rgb(var(--color-primary))] pl-2">
            <p className="text-[11px] text-white/40">Replying to</p>
            <ReplyPreview meta={buildReplyMeta(replyTo)} compact />
          </div>
          <button onClick={() => setReplyTo(null)} className="text-white/40 shrink-0"><CloseIcon size={14} /></button>
        </div>
      )}

      {recording ? (
        <div className="shrink-0 flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] pt-2 border-t border-white/5">
          <button onClick={cancelRecording} className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-red-400 active:scale-90 transition-transform"><TrashIcon size={18} /></button>
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-white/5 rounded-full px-4 py-2.5">
            <span className={`w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 ${recPaused ? 'opacity-40' : 'animate-pulse'}`} />
            <span className="text-xs font-mono text-white tabular-nums shrink-0">{fmtSecs(recSecs)}</span>
            <div className="flex-1 min-w-0 flex items-center justify-end gap-[2px] h-6 overflow-hidden">
              {recLevels.map((lv, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[rgb(var(--color-primary))] shrink-0" style={{ height: `${Math.max(10, Math.round(lv * 100))}%` }} />
              ))}
            </div>
          </div>
          <button onClick={recPaused ? resumeRecording : pauseRecording} className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white active:scale-90 transition-transform">
            {recPaused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
          </button>
          <button onClick={finishRecording} className="w-11 h-11 rounded-full btn-brand flex items-center justify-center shrink-0 active:scale-90 transition-transform"><SendIcon size={17} color="#0B0B0B" /></button>
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] pt-2 border-t border-white/5">
          <button onClick={() => fileRef.current?.click()} className="p-2.5 text-white/50 shrink-0"><CoverIcon size={19} /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button onClick={() => setShowShare(true)} className="p-2.5 text-white/50 shrink-0"><PlusIcon size={19} /></button>
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); setTyping(!!e.target.value) }}
            onBlur={() => setTyping(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendText() }}
            placeholder="Message…"
            className="flex-1 min-w-0 bg-white/5 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none"
          />
          {text.trim() ? (
            <button onClick={handleSendText} className="w-11 h-11 rounded-full btn-brand flex items-center justify-center shrink-0"><SendIcon size={17} color="#0B0B0B" /></button>
          ) : (
            <button onClick={startRecording} className="w-11 h-11 rounded-full btn-brand flex items-center justify-center shrink-0 active:scale-90 transition-transform">
              <MicIcon size={18} color="#0B0B0B" />
            </button>
          )}
        </div>
      )}

      {actionMsg && (
        <MessageActionSheet
          msg={actionMsg} isMe={actionMsg.senderId === me?.id} pinned={pinnedIds.has(actionMsg.id)}
          onClose={() => setActionMsg(null)}
          onReply={() => { setReplyTo(actionMsg); setActionMsg(null) }}
          onForward={() => { setShowForward(actionMsg); setActionMsg(null) }}
          onCopy={() => { navigator.clipboard?.writeText(actionMsg.content || ''); setActionMsg(null) }}
          onPin={() => { togglePin(actionMsg, pinnedIds.has(actionMsg.id)); setActionMsg(null) }}
          onEdit={async (newText) => { const enc = await encryptText(channelId, newText); await setMessageState(actionMsg, { edited: true, editedText: enc }); setActionMsg(null); loadMessages() }}
          onDeleteForMe={() => { deleteForMe(actionMsg); setActionMsg(null) }}
          onDeleteForEveryone={() => { setMessageState(actionMsg, { deleted: true }); setActionMsg(null); loadMessages() }}
          onReact={(emoji) => { toggleReaction(actionMsg, emoji); setActionMsg(null) }}
        />
      )}

      {showTheme && (
        <ChatThemeSheet
          current={theme}
          onClose={() => setShowTheme(false)}
          onPick={(t) => { setChatTheme(channelId, t); setThemeState(t) }}
        />
      )}
      {showShare && <ShareSheet onClose={() => setShowShare(false)} onShare={shareItem} />}
      {showForward && <ForwardSheet onClose={() => setShowForward(null)} onForward={forwardMessage} />}
      {showInfo && (
        <ChatInfoSheet
          channel={channel} onClose={() => setShowInfo(false)}
          onTheme={() => { setShowInfo(false); setShowTheme(true) }}
          onMute={() => setChatPrefs(channelId, { muted: true })}
          onArchive={() => setChatPrefs(channelId, { archived: true })}
          onBlock={() => { if (channel?.otherUser?.id) blockUser(channel.otherUser.id) }}
          onReport={async () => {
            await db.insertShared('reports', { type: 'chat', channelId, reporterId: me.id, targetUserId: channel?.otherUser?.id || null }, undefined, { visibleTo: 'creator-and-admin' })
          }}
        />
      )}
    </div>
  )
}

function ChatThemeSheet({ current, onClose, onPick }) {
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const uploadCustom = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const { url } = await storage.upload(f, f.name)
      onPick({ id: 'custom', name: 'Custom', imageUrl: url, dark: true })
    } catch (err) { /* ignore */ }
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">Chat Theme</h3>
          <button onClick={onClose}><CloseIcon size={18} className="text-white/50" /></button>
        </div>
        <p className="text-[11px] text-white/40 mb-3">Only you see this background.</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadCustom} />
        <div className="grid grid-cols-3 gap-2.5">
          <button onClick={() => fileRef.current?.click()} className={`aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-1 border-2 ${current?.id === 'custom' ? 'border-[rgb(var(--color-primary))]' : 'border-white/10'} bg-white/5`}>
            <ImageGlyph size={20} className="text-white/60" />
            <span className="text-[10px] text-white/60">{busy ? '…' : 'Custom'}</span>
          </button>
          {CHAT_THEMES.map((t) => (
            <button key={t.id} onClick={() => onPick(t)} className={`aspect-[3/4] rounded-2xl relative overflow-hidden border-2 ${current?.id === t.id ? 'border-[rgb(var(--color-primary))]' : 'border-white/10'}`} style={{ background: t.bg }}>
              <span className={`absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-medium ${t.dark ? 'text-white/80' : 'text-black/70'}`}>{t.name}</span>
              {current?.id === t.id && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full btn-brand flex items-center justify-center"><CheckIcon size={10} color="#0B0B0B" /></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SearchGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.3-4.3" />
    </svg>
  )
}

function MessageBubble({ msg, isMe, state, reactions, pinned, onOpenMenu, status, highlight, onJumpTo, onRetryVoice }) {
  const { playTrack } = usePlayer()
  const deleted = state?.deleted
  const content = deleted ? 'This message was deleted' : (state?.editedText ? null : msg.content)
  const [decryptedEdit, setDecryptedEdit] = useState(null)

  useEffect(() => {
    if (state?.editedText) decryptText(msg.channelId, state.editedText).then(setDecryptedEdit)
  }, [state?.editedText, msg.channelId])

  let shareData = null
  const raw = deleted ? null : (decryptedEdit || content)
  if (raw && raw.startsWith(SHARE_MARK)) {
    try { shareData = JSON.parse(raw.slice(SHARE_MARK.length)) } catch (e) { shareData = null }
  }

  const grouped = useMemo(() => {
    const m = {}
    for (const r of reactions) { (m[r.emoji] ||= 0); m[r.emoji]++ }
    return m
  }, [reactions])

  return (
    <div data-mid={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {state?.replyToId && !deleted && (
          <button
            onClick={(e) => { e.stopPropagation(); onJumpTo?.(state.replyToId) }}
            className={`mb-1 max-w-full text-left border-l-2 pl-2 pr-2 py-1 rounded ${isMe ? 'border-[rgb(var(--color-primary))] bg-white/5' : 'border-white/30 bg-white/5'} opacity-80 hover:opacity-100`}
          >
            <p className="text-[10px] text-white/40 leading-none mb-0.5">Replying to</p>
            <ReplyPreview meta={state} />
          </button>
        )}
        <button onClick={() => !deleted && onOpenMenu()} className={`rounded-2xl px-3.5 py-2.5 text-left transition-shadow ${isMe ? 'btn-brand text-black' : 'card-surface text-white'} ${deleted ? 'opacity-50 italic' : ''} ${msg.pending ? 'opacity-60' : ''} ${pinned ? 'ring-1 ring-white/30' : ''} ${highlight ? 'ring-2 ring-[rgb(var(--color-primary))]' : ''}`}>
          {msg.type === 'image' && !deleted ? (
            <img src={msg.metadata?.imageUrl} className="rounded-xl max-w-[14rem] max-h-56 object-cover" />
          ) : msg.type === 'audio' && !deleted ? (
            <VoiceMessage msg={msg} isMe={isMe} waveform={msg.metadata?.waveform || state?.voiceWaveform} onRetry={onRetryVoice} />
          ) : shareData ? (
            <div onClick={(e) => { e.stopPropagation(); if (shareData.audioUrl) playTrack(shareData, [shareData]) }} className={`flex items-center gap-2 ${isMe ? '' : 'card-surface'} rounded-xl p-1.5 -m-1.5 cursor-pointer`}>
              <Cover track={shareData} size={40} />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{shareData.kind === 'playlist' ? '🎵 Playlist' : '🎵 Track'}</p>
                <p className="text-xs truncate opacity-80">{shareData.title}</p>
              </div>
              {shareData.audioUrl && <PlayIcon size={16} />}
            </div>
          ) : (
            <p className="text-sm whitespace-pre-line break-words">{decryptedEdit || content}</p>
          )}
        </button>
        <div className="flex items-center gap-1.5 mt-1 px-1">
          {Object.entries(grouped).map(([e, n]) => <span key={e} className="text-[11px]">{e}{n > 1 ? n : ''}</span>)}
          <span className="text-[10px] text-white/25">{timeAgo(msg.createdAt)}</span>
          {state?.editedText && <span className="text-[10px] text-white/25">· edited</span>}
          {status && <span className={`text-[10px] ${status === 'failed' ? 'text-red-400' : 'text-white/25'}`}>{status === 'sending' ? '· Sending…' : status === 'failed' ? '· Failed' : status === 'seen' ? '· Seen' : status === 'delivered' ? '· Delivered' : '· Sent'}</span>}
        </div>
      </div>
    </div>
  )
}

function MessageActionSheet({ msg, isMe, pinned, onClose, onReply, onForward, onCopy, onPin, onEdit, onDeleteForMe, onDeleteForEveryone, onReact }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(msg.content || '')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        {editing ? (
          <div>
            <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none mb-3 resize-none" />
            <button onClick={() => onEdit(val)} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm">Save Edit</button>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-4">
              {REACTIONS.map((e) => <button key={e} onClick={() => onReact(e)} className="text-2xl active:scale-90 transition-transform">{e}</button>)}
            </div>
            <div className="space-y-1">
              <ActionBtn icon={<ReplyIcon size={17} />} label="Reply" onClick={onReply} />
              <ActionBtn icon={<ForwardIcon size={17} />} label="Forward" onClick={onForward} />
              {msg.type !== 'audio' && msg.type !== 'image' && <ActionBtn icon={<CopyIcon size={17} />} label="Copy" onClick={onCopy} />}
              <ActionBtn icon={<PinIcon size={17} />} label={pinned ? 'Unpin' : 'Pin'} onClick={onPin} />
              {isMe && msg.type !== 'audio' && msg.type !== 'image' && <ActionBtn icon={<EditIcon size={17} />} label="Edit" onClick={() => setEditing(true)} />}
              <ActionBtn icon={<TrashIcon size={17} />} label="Delete for me" onClick={onDeleteForMe} danger />
              {isMe && <ActionBtn icon={<TrashIcon size={17} />} label="Delete for everyone" onClick={onDeleteForEveryone} danger />}
            </div>
          </>
        )}
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

function ShareSheet({ onClose, onShare }) {
  const { data: tracks } = useLiveShared('tracks', { order: '-createdAt', limit: 60 })
  const { data: playlists } = useLiveShared('playlists', { order: '-createdAt', limit: 40 })
  const [tab, setTab] = useState('tracks')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-display font-bold text-white">Share</h3><button onClick={onClose}><CloseIcon size={18} className="text-white/50" /></button></div>
        <div className="flex gap-2 mb-3">
          {['tracks', 'playlists'].map((t) => <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>)}
        </div>
        <div className="space-y-1">
          {(tab === 'tracks' ? tracks : playlists)?.map((item) => (
            <button key={item.id} onClick={() => onShare(item, tab === 'tracks' ? 'track' : 'playlist')} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left">
              <Cover track={item} size={40} />
              <span className="text-sm text-white truncate">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ForwardSheet({ onClose, onForward }) {
  const [channels, setChannels] = useState([])
  useEffect(() => { messaging.getChannels().then(setChannels).catch(() => {}) }, [])
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <h3 className="font-display font-bold text-white mb-3">Forward to…</h3>
        <div className="space-y-1">
          {channels.map((c) => (
            <button key={c.id} onClick={() => onForward(c.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-left">
              <span className="text-sm text-white truncate">{c.type === 'direct' ? c.otherUser?.displayName : c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatInfoSheet({ channel, onClose, onTheme, onMute, onArchive, onBlock, onReport }) {
  const [done, setDone] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up">
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <p className="text-sm font-semibold text-white mb-3 text-center">{channel?.type === 'direct' ? channel.otherUser?.displayName : channel?.name}</p>
        <div className="space-y-1">
          <ActionBtn icon={<ThemeIcon size={17} />} label="Chat theme" onClick={onTheme} />
          <ActionBtn icon={<MuteIcon size={17} />} label="Mute" onClick={() => { onMute(); setDone('Muted') }} />
          <ActionBtn icon={<ArchiveIcon size={17} />} label="Archive" onClick={() => { onArchive(); setDone('Archived'); onClose() }} />
          {channel?.type === 'direct' && <ActionBtn icon={<BlockIcon size={17} />} label="Block user" onClick={() => { onBlock(); setDone('Blocked') }} danger />}
          <ActionBtn icon={<FlagIcon size={17} />} label="Report" onClick={() => { onReport(); setDone('Reported') }} danger />
        </div>
        {done && <p className="text-xs text-center text-white/40 mt-3">{done}</p>}
      </div>
    </div>
  )
}

// Premium voice-note player: play/pause, tappable waveform with progress, live
// clock, playback-speed cycle (1x/1.5x/2x) and download. Shows a spinner while
// the clip is still uploading and a Retry action if the upload failed.
function VoiceMessage({ msg, isMe, waveform, onRetry }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(msg.metadata?.duration || 0)
  const [speedIdx, setSpeedIdx] = useState(0)
  const url = msg.metadata?.audioUrl
  const peaks = (waveform && waveform.length) ? waveform : DEFAULT_PEAKS
  const pending = msg.pending
  const failed = msg.failed

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCur(a.currentTime)
    const onMeta = () => { if (isFinite(a.duration) && a.duration > 0) setDur(a.duration) }
    const onEnd = () => { setPlaying(false); setCur(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('ended', onEnd) }
  }, [url])

  const toggle = (e) => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.playbackRate = SPEEDS[speedIdx]; a.play().then(() => setPlaying(true)).catch(() => {}) }
  }
  const cycleSpeed = (e) => {
    e.stopPropagation()
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }
  const seek = (e) => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * dur
    setCur(ratio * dur)
  }
  const doDownload = (e) => { e.stopPropagation(); if (url) download.saveFile(url, 'voice-message.webm').catch(() => {}) }

  if (failed) {
    return (
      <div className="flex items-center gap-2 min-w-[9rem]" onClick={(e) => e.stopPropagation()}>
        <span className={`text-xs ${isMe ? 'text-black/80' : 'text-red-400'}`}>Voice failed to send</span>
        <button onClick={(e) => { e.stopPropagation(); onRetry?.(msg.id) }} className={`text-xs font-bold underline ${isMe ? 'text-black' : 'text-white'}`}>Retry</button>
      </div>
    )
  }

  const progress = dur ? cur / dur : 0
  const fg = isMe ? 'bg-black/70' : 'bg-[rgb(var(--color-primary))]'
  const bgc = isMe ? 'bg-black/20' : 'bg-white/15'

  return (
    <div className="flex items-center gap-2.5 min-w-[12rem]" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} disabled={pending} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-black/80 text-white' : 'btn-brand text-black'}`}>
        {pending ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
      </button>
      <div onClick={seek} className="flex-1 min-w-0 flex items-center gap-[2px] h-6 cursor-pointer">
        {peaks.map((p, i) => {
          const active = (i / peaks.length) <= progress
          return <span key={i} className={`flex-1 rounded-full ${active ? fg : bgc}`} style={{ height: `${Math.max(14, Math.round(p * 100))}%`, minWidth: '2px' }} />
        })}
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <button onClick={cycleSpeed} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isMe ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'}`}>{SPEEDS[speedIdx]}x</button>
        <span className={`text-[10px] tabular-nums ${isMe ? 'text-black/60' : 'text-white/40'}`}>{fmtSecs(cur > 0 ? cur : dur)}</span>
      </div>
      <button onClick={doDownload} className={`shrink-0 ${isMe ? 'text-black/50' : 'text-white/40'}`}><DownloadIcon size={14} /></button>
    </div>
  )
}
