import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { RoomIcon, PlusIcon, CloseIcon, CoverIcon, UsersIcon, LockIcon, GlobeIcon, CheckIcon, ShieldIcon } from '../components/icons'
import { ROOM_PURPOSES, ROOM_BACKGROUNDS, roomBackgroundCss, makeEmptySeats } from '../musicHelpers'
import { requireAuth } from '../authGate'

export default function Rooms() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [showCreate, setShowCreate] = useState(false)
  const { data: rooms, loading } = useLiveShared('voice_rooms', { order: '-createdAt', limit: 60 })

  const active = (rooms || []).filter((r) => !r.ended && (r.visibility !== 'private' || r.hostId === user?.id))

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2"><RoomIcon size={22} className="grad-brand-text" /><h1 className="font-display font-bold text-xl text-white">Listening Parties</h1></div>
        <button onClick={async () => { if (await requireAuth('create-room')) setShowCreate(true) }} className="w-10 h-10 rounded-full btn-brand flex items-center justify-center"><PlusIcon size={18} color="#0B0B0B" /></button>
      </div>

      {!loading && active.length === 0 && (
        <EmptyState icon={<RoomIcon size={24} className="grad-brand-text" />} title="No live listening parties right now" subtitle="Start a room, invite friends onto the seats, chat live, and listen in perfect sync." action={<button onClick={() => setShowCreate(true)} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Start a Room</button>} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {active.map((r) => {
          const seated = (r.seats || []).filter(Boolean).length
          return (
            <button key={r.id} onClick={() => navigate(`/rooms/${r.id}`)} className="card-surface rounded-2xl p-4 text-left flex items-center gap-3 hover:bg-white/5 overflow-hidden relative">
              <div className="w-14 h-14 shrink-0"><Cover track={{ title: r.name, coverUrl: r.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[rgb(var(--color-secondary))] animate-pulse shrink-0" />
                  <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                </div>
                <p className="text-xs text-white/40 truncate">{r.description || (r.purpose === 'Custom' ? r.customPurpose : r.purpose)} · {r.hostName}</p>
                <p className="text-[11px] text-white/30 flex items-center gap-1 mt-0.5"><UsersIcon size={11} /> {seated}/9 on seats{r.capacity ? ` · cap ${r.capacity}` : ''}</p>
              </div>
              {r.visibility === 'password' && <LockIcon size={14} className="text-white/30 shrink-0" />}
              {r.visibility === 'private' && <ShieldIcon size={14} className="text-white/30 shrink-0" />}
            </button>
          )
        })}
      </div>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/rooms/${id}`)} />}
    </div>
  )
}

function CreateRoomModal({ onClose, onCreated }) {
  const user = auth.getCurrentUser()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [password, setPassword] = useState('')
  const [capacity, setCapacity] = useState(0) // 0 = unlimited
  const [purpose, setPurpose] = useState('Music')
  const [customPurpose, setCustomPurpose] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [bgMode, setBgMode] = useState('builtin') // builtin | custom
  const [bgKey, setBgKey] = useState(ROOM_BACKGROUNDS[0].key)
  const [bgFile, setBgFile] = useState(null)
  const [bgPreview, setBgPreview] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    if (visibility === 'password' && !password.trim()) return
    if (!(await requireAuth('create-room'))) return
    const me = auth.getCurrentUser()
    if (!me) return
    setSaving(true)
    try {
      let coverUrl = ''
      let backgroundUrl = ''
      if (coverFile) { const r = await storage.upload(coverFile, coverFile.name); coverUrl = r.url }
      if (bgMode === 'custom' && bgFile) { const r = await storage.upload(bgFile, bgFile.name); backgroundUrl = r.url }
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8)
      const room = await db.insertShared('voice_rooms', {
        name: name.trim(), description: description.trim(), tags: tagList,
        hostId: me.id, hostName: me.displayName || 'MiLey user', hostAvatarUrl: me.avatarUrl || '',
        purpose, customPurpose: purpose === 'Custom' ? customPurpose.trim() : '', coverUrl,
        backgroundKey: bgMode === 'builtin' ? bgKey : '', backgroundUrl,
        visibility, password: visibility === 'password' ? password.trim() : '', capacity: Number(capacity) || 0,
        seats: makeEmptySeats(), seatLocks: Array(9).fill(false), admins: [], seatRequests: [],
        currentTrack: null, isPlaying: false, position: 0, startedAt: null, queue: [], skipVotes: [],
        guestPlayAllowed: false, tempDJUserId: null, ended: false,
      }, undefined, { visibleTo: 'public', writableBy: 'anyone' })
      onCreated(room.id)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-display font-bold text-white text-lg">Start a Listening Party</h3><button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button></div>

        <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl card-surface mx-auto mb-4 overflow-hidden cursor-pointer">
          {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : <><CoverIcon size={22} className="text-white/30" /><span className="text-[10px] text-white/30 mt-1">Cover</span></>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) } }} />
        </label>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Party name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (what are you listening to?)" rows={2} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated (e.g. lofi, chill, study)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-4 outline-none" />

        <p className="text-xs text-white/40 mb-2">Room purpose</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {ROOM_PURPOSES.map((p) => (
            <button key={p} onClick={() => setPurpose(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${purpose === p ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>{p}</button>
          ))}
        </div>
        {purpose === 'Custom' && (
          <input value={customPurpose} onChange={(e) => setCustomPurpose(e.target.value)} placeholder="Describe the room purpose" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-4 outline-none" />
        )}

        <p className="text-xs text-white/40 mb-2">Background</p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setBgMode('builtin')} className={`flex-1 py-2 rounded-xl text-xs font-medium ${bgMode === 'builtin' ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>MiLey Presets</button>
          <button onClick={() => setBgMode('custom')} className={`flex-1 py-2 rounded-xl text-xs font-medium ${bgMode === 'custom' ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>Custom Image</button>
        </div>
        {bgMode === 'builtin' ? (
          <div className="grid grid-cols-5 gap-2 mb-4">
            {ROOM_BACKGROUNDS.map((b) => (
              <button key={b.key} onClick={() => setBgKey(b.key)} title={b.label} className={`aspect-square rounded-xl border-2 relative overflow-hidden ${bgKey === b.key ? 'border-white' : 'border-transparent'}`} style={{ background: roomBackgroundCss(b.key) }}>
                {bgKey === b.key && <CheckIcon size={14} className="absolute inset-0 m-auto text-white" />}
              </button>
            ))}
          </div>
        ) : (
          <label className="block w-full aspect-[3/1] rounded-2xl card-surface overflow-hidden mb-4 cursor-pointer">
            {bgPreview ? <img src={bgPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">Upload background image</div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBgFile(f); setBgPreview(URL.createObjectURL(f)) } }} />
          </label>
        )}

        <p className="text-xs text-white/40 mb-2">Access</p>
        <div className="flex gap-2 mb-3">
          {[{ k: 'public', l: 'Public', Icon: GlobeIcon }, { k: 'password', l: 'Password', Icon: LockIcon }, { k: 'private', l: 'Invite Only', Icon: ShieldIcon }].map(({ k, l, Icon }) => (
            <button key={k} onClick={() => setVisibility(k)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium ${visibility === k ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}><Icon size={16} /> {l}</button>
          ))}
        </div>
        {visibility === 'password' && (
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a room password" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        )}

        <p className="text-xs text-white/40 mb-2">Capacity</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {[{ v: 0, l: 'Unlimited' }, { v: 25, l: '25' }, { v: 50, l: '50' }, { v: 100, l: '100' }].map(({ v, l }) => (
            <button key={v} onClick={() => setCapacity(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${capacity === v ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>{l}</button>
          ))}
        </div>
        <button onClick={create} disabled={!name.trim() || (visibility === 'password' && !password.trim()) || saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Starting…' : 'Start Party'}</button>
      </div>
    </div>
  )
}
