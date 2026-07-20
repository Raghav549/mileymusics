import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseIcon, SearchIcon, ProfileIcon, ChannelIcon } from './icons'

// Shared Followers / Following list sheet — searchable, tap any row to visit
// that profile or channel directly.
export default function FollowListModal({ title, loader, onClose }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.resolve(loader()).then((r) => { if (alive) { setRows(r); setLoading(false) } })
    return () => { alive = false }
  }, [loader])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    return rows.filter((r) => (r.name || '').toLowerCase().includes(q.toLowerCase()))
  }, [rows, q])

  const go = (r) => {
    onClose()
    if (r.kind === 'channel') navigate(`/channel/${r.username || ''}`)
    else navigate(`/artist/${r.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>
        <div className="flex items-center gap-2 card-surface rounded-2xl px-3 py-2 mb-4">
          <SearchIcon size={15} className="text-white/40 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
        </div>
        {loading ? (
          <p className="text-sm text-white/30 text-center py-6">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-6">Nobody here yet.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((r) => (
              <button key={r.id} onClick={() => go(r)} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 text-left">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center shrink-0 border border-white/10">
                  {r.avatarUrl ? <img src={r.avatarUrl} className="w-full h-full object-cover" /> : (r.kind === 'channel' ? <ChannelIcon size={16} className="text-white/60" /> : <ProfileIcon size={16} className="text-white/60" />)}
                </div>
                <span className="text-sm text-white truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
