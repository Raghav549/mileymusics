import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { push } from '../lib/push'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { realtime } from '../lib/realtime'
import { notify } from '../hooks/useNotifications'
import { Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { CalendarIcon, PlusIcon, CloseIcon, UsersIcon, SendIcon, BackIcon, CheckIcon } from '../components/icons'

function useCountdown(target) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = Math.max(0, new Date(target).getTime() - now)
  const live = diff <= 0
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { live, d, h, m, s }
}

export default function Premieres() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [showCreate, setShowCreate] = useState(false)
  const { data: premieres, loading } = useLiveShared('premieres', { order: 'scheduledAt', limit: 60 })

  const upcoming = (premieres || []).filter((p) => new Date(p.scheduledAt).getTime() > Date.now() - 3600000)

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2"><CalendarIcon size={22} className="grad-brand-text" /><h1 className="font-display font-bold text-xl text-white">Music Premieres</h1></div>
        <button onClick={() => setShowCreate(true)} className="w-10 h-10 rounded-full btn-brand flex items-center justify-center"><PlusIcon size={18} color="#0B0B0B" /></button>
      </div>

      {!loading && upcoming.length === 0 && (
        <EmptyState icon={<CalendarIcon size={24} className="grad-brand-text" />} title="No premieres scheduled" subtitle="Schedule a countdown launch for your next release with a live waiting room." action={<button onClick={() => setShowCreate(true)} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Schedule a Premiere</button>} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {upcoming.map((p) => (
          <button key={p.id} onClick={() => navigate(`/premieres/${p.id}`)} className="card-surface rounded-2xl p-4 text-left flex items-center gap-3 hover:bg-white/5">
            <Cover track={{ title: p.title, coverUrl: p.coverUrl }} size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{p.title}</p>
              <p className="text-xs text-white/40 truncate">By {p.ownerName} · {new Date(p.scheduledAt).toLocaleString()}</p>
            </div>
          </button>
        ))}
      </div>

      {showCreate && <CreatePremiereModal user={user} onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/premieres/${id}`)} />}
    </div>
  )
}

function CreatePremiereModal({ user, onClose, onCreated }) {
  const { data: myTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 100 })
  const [trackId, setTrackId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notifyAll, setNotifyAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const mine = (myTracks || []).filter((t) => t.artistId === user?.id)

  const create = async () => {
    const track = mine.find((t) => t.id === trackId)
    if (!track || !scheduledAt) return
    setSaving(true)
    try {
      const iso = new Date(scheduledAt).toISOString()
      const premiere = await db.insertShared('premieres', {
        ownerId: user.id, ownerName: user.displayName || 'MiLey user', trackId: track.id,
        title: track.title, artistName: track.artistName, coverUrl: track.coverUrl, audioUrl: track.audioUrl,
        duration: track.duration, scheduledAt: iso,
      }, undefined, { visibleTo: 'public' })
      if (notifyAll) {
        await push.schedule({ at: new Date(scheduledAt), title: `🎬 Premiere: ${track.title}`, body: `${track.artistName} is live now on MiLey!`, url: `/premieres/${premiere.id}`, broadcast: true }).catch(() => {})
      }
      const followers = await db.selectShared('follows', { targetId: user.id }, { limit: 100 }).catch(() => [])
      for (const f of followers) notify(f.followerId, { type: 'premiere', title: 'New premiere scheduled', body: `${track.artistName} is premiering "${track.title}"`, url: `/premieres/${premiere.id}` })
      onCreated(premiere.id)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-display font-bold text-white text-lg">Schedule Premiere</h3><button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button></div>
        <p className="text-xs text-white/40 mb-2">Choose one of your tracks</p>
        <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1 mb-4">
          {mine.map((t) => (
            <button key={t.id} onClick={() => setTrackId(t.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left ${trackId === t.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <Cover track={t} size={34} /><span className="text-sm text-white truncate">{t.title}</span>
            </button>
          ))}
          {mine.length === 0 && <p className="text-xs text-white/30">Upload a track first.</p>}
        </div>
        <p className="text-xs text-white/40 mb-2">Launch date & time</p>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-4 outline-none [color-scheme:dark]" />
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <div onClick={() => setNotifyAll((v) => !v)} className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${notifyAll ? 'btn-brand' : 'bg-white/10'}`}>{notifyAll && <CheckIcon size={13} color="#0B0B0B" />}</div>
          <span className="text-xs text-white/50">Send a launch notification to all MiLey users</span>
        </label>
        <button onClick={create} disabled={!trackId || !scheduledAt || saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Scheduling…' : 'Schedule Premiere'}</button>
      </div>
    </div>
  )
}

export function PremiereRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const { data: premieres } = useLiveShared('premieres', { limit: 100 })
  const premiere = useMemo(() => (premieres || []).find((p) => p.id === id), [premieres, id])
  const { data: chat } = useLiveShared('premiere_chat', { filters: { premiereId: id }, order: '-createdAt', limit: 60 })
  const { playTrack } = usePlayer()
  const [text, setText] = useState('')
  const [count, setCount] = useState(1)

  useEffect(() => {
    const room = realtime.presence(`premiere-${id}`, { name: user?.displayName || 'Guest' })
    room.onSync((u) => setCount(u.length || 1))
    return () => room.leave()
  }, [id, user?.displayName])

  const cd = useCountdown(premiere?.scheduledAt || Date.now())

  const send = async () => {
    if (!text.trim()) return
    await db.insertShared('premiere_chat', { premiereId: id, userId: user.id, userName: user.displayName || 'Guest', text: text.trim() }, undefined, { visibleTo: 'public', writableBy: 'anyone' })
    setText('')
  }

  if (!premiere) return null

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <div className="shrink-0 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 border-b border-white/5">
        <button onClick={() => navigate('/premieres')} className="text-white/70"><BackIcon size={22} /></button>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{premiere.title} Premiere</p><p className="text-[11px] text-white/40 flex items-center gap-1"><UsersIcon size={11} /> {count} waiting</p></div>
      </div>

      <div className="shrink-0 flex flex-col items-center py-8 px-6">
        <Cover track={premiere} size={120} rounded="rounded-3xl" />
        <p className="font-display font-bold text-white text-lg mt-4">{premiere.title}</p>
        <p className="text-sm text-white/40">{premiere.artistName}</p>

        {cd.live ? (
          <button onClick={() => playTrack(premiere, [premiere])} className="mt-6 btn-brand text-black font-semibold px-8 py-3.5 rounded-2xl text-sm">▶ Play Premiere Now</button>
        ) : (
          <div className="flex gap-3 mt-6">
            {[[cd.d, 'D'], [cd.h, 'H'], [cd.m, 'M'], [cd.s, 'S']].map(([v, l]) => (
              <div key={l} className="card-surface rounded-2xl px-4 py-3 text-center min-w-[3.5rem]">
                <p className="font-display font-bold text-xl text-white">{String(v).padStart(2, '0')}</p>
                <p className="text-[10px] text-white/40">{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 space-y-2">
        {[...(chat || [])].reverse().map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <span className="text-xs font-semibold grad-brand-text shrink-0">{m.userName}</span>
            <span className="text-xs text-white/70">{m.text}</span>
          </div>
        ))}
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)] pt-2 border-t border-white/5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Chat while you wait…" className="flex-1 bg-white/5 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        <button onClick={send} className="w-11 h-11 rounded-full btn-brand flex items-center justify-center shrink-0"><SendIcon size={17} color="#0B0B0B" /></button>
      </div>
    </div>
  )
}
