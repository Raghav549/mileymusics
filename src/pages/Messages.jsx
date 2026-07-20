import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { messaging } from '../lib/messaging'
import { social } from '../lib/social'
import { auth } from '../lib/auth'
import { useOnlinePresence } from '../hooks/usePresence'
import { useNotifications } from '../hooks/useNotifications'
import { useOfficialThread, MILEY_NAME } from '../officialDM'
import { getChatPrefsMap, getReadsForChannel } from '../chatHelpers'
import { decryptText } from '../chatCrypto'
import { timeAgo } from '../musicHelpers'
import EmptyState from '../components/EmptyState'
import { BackIcon, MessageIcon, SearchIcon, PlusIcon, MuteIcon, ArchiveIcon, UsersIcon, VerifiedIcon } from '../components/icons'

export default function Messages() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState({})
  const [previews, setPreviews] = useState({})
  const [unread, setUnread] = useState({}) // channelId -> bool, from live message notifications
  const [tab, setTab] = useState('chats') // chats | archived
  const [showNew, setShowNew] = useState(false)
  const online = useOnlinePresence()
  const subsRef = useRef({}) // channelId -> unsubscribe
  const { latest: officialLatest, unreadCount: officialUnread } = useOfficialThread()

  // Live message notifications (instant — no refresh) drive both "a new channel
  // appeared" (reload the inbox once) and the per-row unread badge.
  const { notifications } = useNotifications()
  const messageNotifIds = useMemo(
    () => JSON.stringify((notifications || []).filter((n) => n.type === 'message').map((n) => `${n.id}:${n.read}`)),
    [notifications],
  )

  const load = async () => {
    setLoading(true)
    try {
      const [chs, p] = await Promise.all([messaging.getChannels(), getChatPrefsMap()])
      setChannels(chs || [])
      setPrefs(p)
      const decrypted = {}
      await Promise.all((chs || []).map(async (c) => {
        if (c.lastMessage?.content) decrypted[c.id] = await decryptText(c.id, c.lastMessage.content)
      }))
      setPreviews(decrypted)
    } catch (e) { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Whenever a NEW unread message notification lands for a channel we don't
  // yet know about (someone just started a DM/group with us), pull the inbox
  // once to pick it up — event-driven, not polling.
  const knownIds = useMemo(() => new Set(channels.map((c) => c.id)), [channels])
  useEffect(() => {
    const unreadMsgNotifs = (notifications || []).filter((n) => n.type === 'message' && !n.read)
    const nextUnread = {}
    for (const n of unreadMsgNotifs) {
      const cid = n.meta?.channelId
      if (cid) nextUnread[cid] = true
    }
    setUnread(nextUnread)
    const missing = unreadMsgNotifs.some((n) => n.meta?.channelId && !knownIds.has(n.meta.channelId))
    if (missing) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageNotifIds])

  // Keep every visible conversation's preview + ordering instantly live —
  // subscribe to real-time inserts on each channel so a new message updates
  // the inbox without leaving/re-entering the screen.
  useEffect(() => {
    const ids = channels.map((c) => c.id)
    // subscribe to any new channel
    for (const id of ids) {
      if (subsRef.current[id]) continue
      subsRef.current[id] = messaging.onMessage(id, async (msg) => {
        const content = await decryptText(id, msg.content)
        setPreviews((prev) => ({ ...prev, [id]: content }))
        setChannels((prev) => {
          const idx = prev.findIndex((c) => c.id === id)
          if (idx === -1) return prev
          const updated = { ...prev[idx], lastMessage: { content: msg.content, createdAt: msg.createdAt, senderId: msg.senderId } }
          const rest = prev.filter((c) => c.id !== id)
          return [updated, ...rest]
        })
        if (msg.senderId !== user?.id) setUnread((prev) => ({ ...prev, [id]: true }))
      })
    }
    // unsubscribe channels no longer in the list
    for (const id of Object.keys(subsRef.current)) {
      if (!ids.includes(id)) { subsRef.current[id]?.unsubscribe?.(); delete subsRef.current[id] }
    }
    return () => {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.map((c) => c.id).join(',')])

  useEffect(() => () => { Object.values(subsRef.current).forEach((s) => s?.unsubscribe?.()) }, [])

  // If the realtime socket was asleep (tab backgrounded, phone locked, brief
  // network drop) it can miss a message/channel event entirely. Reconcile the
  // whole inbox the instant the app becomes visible/online again — instant
  // catch-up with zero manual refresh, and not a polling timer.
  useEffect(() => {
    const resync = () => { if (document.visibilityState !== 'hidden') load() }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => channels.filter((c) => {
    const archived = !!prefs[c.id]?.archived
    return tab === 'archived' ? archived : !archived
  }), [channels, prefs, tab])

  return (
    <div className="max-w-2xl mx-auto w-full h-full flex flex-col">
      <div className="px-4 md:px-0 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageIcon size={22} className="grad-brand-text" />
            <h1 className="font-display font-bold text-xl text-white">Messages</h1>
          </div>
          <button onClick={() => setShowNew(true)} className="w-10 h-10 rounded-full btn-brand flex items-center justify-center"><PlusIcon size={18} color="#0B0B0B" /></button>
        </div>
        <div className="flex gap-2">
          {['chats', 'archived'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 md:px-0 pb-8">
        {loading ? (
          <p className="text-sm text-white/30 text-center py-10">Loading conversations…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={<MessageIcon size={24} className="grad-brand-text" />} title="No conversations yet" subtitle="Start chatting with an artist or a friend." action={<button onClick={() => setShowNew(true)} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">New Message</button>} />
        ) : (
          <div className="space-y-1">
            {tab === 'chats' && (
              <button
                onClick={() => navigate('/official')}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/5 text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-[52px] h-[52px] rounded-full grad-brand flex items-center justify-center">
                    <span className="font-display font-black text-black text-xl">M</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm truncate ${officialUnread ? 'font-bold text-white' : 'font-medium text-white'}`}>{MILEY_NAME}</p>
                    <VerifiedIcon size={13} className="grad-brand-text shrink-0" />
                  </div>
                  <p className={`text-xs truncate ${officialUnread ? 'text-white/80' : 'text-white/40'}`}>{officialLatest ? (officialLatest.title || 'Official update') : 'Official updates & announcements'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {officialLatest?.createdAt && <span className="text-[11px] text-white/25">{timeAgo(officialLatest.createdAt)}</span>}
                  {officialUnread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full btn-brand text-black text-[11px] font-bold flex items-center justify-center">{officialUnread}</span>}
                </div>
              </button>
            )}
            {visible.map((c) => {
              const isDM = c.type === 'direct'
              const name = isDM ? (c.otherUser?.displayName || 'MiLey user') : (c.name || 'Group')
              const avatar = isDM ? c.otherUser?.avatarUrl : null
              const isOnline = isDM && c.otherUser?.id && online.has(c.otherUser.id)
              const muted = !!prefs[c.id]?.muted
              const hasUnread = !!unread[c.id]
              return (
                <button
                  key={c.id}
                  onClick={() => { navigate(`/chat/${c.id}`); setUnread((prev) => ({ ...prev, [c.id]: false })) }}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/5 text-left"
                >
                  <div className="relative shrink-0">
                    <div className="w-13 h-13 w-[52px] h-[52px] rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                      {isDM ? (avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <span className="font-display font-bold text-white/70">{name[0]}</span>) : <UsersIcon size={20} className="text-white/60" />}
                    </div>
                    {isOnline && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[rgb(var(--color-primary))] border-2 border-[#0B0B0B]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm truncate ${hasUnread ? 'font-bold text-white' : 'font-medium text-white'}`}>{name}</p>
                      {muted && <MuteIcon size={12} className="text-white/30 shrink-0" />}
                    </div>
                    <p className={`text-xs truncate ${hasUnread ? 'text-white/80' : 'text-white/40'}`}>{previews[c.id] || c.lastMessage?.content || 'Say hello 👋'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {c.lastMessage?.createdAt && <span className="text-[11px] text-white/25">{timeAgo(c.lastMessage.createdAt)}</span>}
                    {hasUnread && <span className="w-2.5 h-2.5 rounded-full btn-brand" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showNew && <NewChatSheet onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); navigate(`/chat/${id}`) }} />}
    </div>
  )
}

function NewChatSheet({ onClose, onCreated }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState([])
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await social.searchUsers(q.trim())) } catch (e) { setResults([]) }
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const toggleSelect = (u) => {
    setSelected((prev) => prev.find((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u])
  }

  const startChat = async () => {
    if (selected.length === 0) return
    setBusy(true)
    try {
      if (selected.length === 1) {
        const ch = await messaging.createDM(selected[0].id)
        onCreated(ch.id)
      } else {
        const ch = await messaging.createGroup({ name: groupName.trim() || selected.map((s) => s.displayName).join(', '), members: selected.map((s) => s.id) })
        onCreated(ch.id)
      }
    } catch (e) { /* ignore */ }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">New Message</h3>
          <button onClick={onClose} className="text-white/50"><BackIcon size={18} /></button>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 mb-3">
          <SearchIcon size={15} className="text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
        </div>

        {selected.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {selected.map((s) => (
              <span key={s.id} onClick={() => toggleSelect(s)} className="text-xs px-3 py-1.5 rounded-full btn-brand text-black font-medium cursor-pointer">{s.displayName} ✕</span>
            ))}
          </div>
        )}
        {selected.length > 1 && (
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        )}

        <div className="max-h-64 overflow-y-auto no-scrollbar space-y-1 mb-4">
          {searching && <p className="text-xs text-white/30 text-center py-3">Searching…</p>}
          {results.map((u) => (
            <button key={u.id} onClick={() => toggleSelect(u)} className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left ${selected.find((s) => s.id === u.id) ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center shrink-0">
                {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/70">{(u.displayName || '?')[0]}</span>}
              </div>
              <span className="text-sm text-white truncate">{u.displayName}</span>
            </button>
          ))}
          {!searching && q.trim() && results.length === 0 && <p className="text-xs text-white/30 text-center py-3">No users found.</p>}
        </div>

        <button onClick={startChat} disabled={selected.length === 0 || busy} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">
          {busy ? 'Starting…' : selected.length > 1 ? 'Create Group' : 'Start Chat'}
        </button>
      </div>
    </div>
  )
}
