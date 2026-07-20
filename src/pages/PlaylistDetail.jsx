import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { TrackRow, Cover } from '../components/TrackViews'
import { BackIcon, PlayIcon, PlusIcon, CloseIcon, SearchIcon, TrashIcon, EditIcon, CoverIcon, BannerIcon, LockIcon, GlobeIcon, UsersIcon } from '../components/icons'
import { isPublicVisible, MOOD_SUGGESTIONS, GENRE_SUGGESTIONS, ensureCategory } from '../musicHelpers'
import { useHasApprovedChannel } from '../permissions'

export default function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [playlist, setPlaylist] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { playQueue } = usePlayer()

  const load = () => db.getShared('playlists', id).then(setPlaylist).catch(() => setPlaylist(null))
  useEffect(() => { load() }, [id])

  const trackMap = useMemo(() => {
    const m = new Map()
    for (const t of allTracks || []) m.set(t.id, t)
    return m
  }, [allTracks])

  const tracks = useMemo(() => {
    if (!playlist) return []
    return (playlist.trackIds || []).map((tid) => trackMap.get(tid)).filter(Boolean)
  }, [playlist, trackMap])

  const isOwner = playlist && user?.id === playlist.ownerId

  const removeTrack = async (tid) => {
    const newIds = (playlist.trackIds || []).filter((x) => x !== tid)
    await db.updateShared('playlists', id, { trackIds: newIds })
    setPlaylist((p) => ({ ...p, trackIds: newIds }))
  }

  const addTrack = async (tid) => {
    if ((playlist.trackIds || []).includes(tid)) return
    const newIds = [...(playlist.trackIds || []), tid]
    await db.updateShared('playlists', id, { trackIds: newIds })
    setPlaylist((p) => ({ ...p, trackIds: newIds }))
  }

  if (!playlist) return null

  const visLabel = playlist.visibility === 'public' ? 'Public' : playlist.visibility === 'friends' ? 'Friends Only' : 'Private'

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-56 md:h-72 w-full">
        {playlist.bannerUrl ? <img src={playlist.bannerUrl} className="w-full h-full object-cover" /> : <Cover track={{ coverUrl: playlist.coverUrl, title: playlist.title }} size="fill" rounded="" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-black/30 to-black/40" />
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><BackIcon size={20} /></button>
        {isOwner && (
          <button onClick={() => setShowEdit(true)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><EditIcon size={18} /></button>
        )}
        <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
          <div className="w-24 h-24 shrink-0"><Cover track={{ coverUrl: playlist.coverUrl, title: playlist.title }} size="fill" rounded="rounded-2xl" /></div>
          <div className="min-w-0 pb-1">
            <p className="text-xs text-white/60 uppercase tracking-wide">Playlist · {visLabel}</p>
            <h1 className="font-display font-bold text-2xl text-white truncate">{playlist.title}</h1>
            <p className="text-sm text-white/60 truncate">By {playlist.ownerName || 'MiLey user'}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        {playlist.description && <p className="text-sm text-white/50 mb-4">{playlist.description}</p>}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => tracks.length && playQueue(tracks, 0)} disabled={!tracks.length} className="w-14 h-14 rounded-full btn-brand flex items-center justify-center disabled:opacity-40">
            <PlayIcon size={22} color="#0B0B0B" />
          </button>
          {isOwner && (
            <button onClick={() => setShowAdd(true)} className="w-14 h-14 rounded-full card-surface flex items-center justify-center text-white">
              <PlusIcon size={20} />
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {tracks.map((t, i) => (
            <div key={t.id} className="flex items-center">
              <div className="flex-1 min-w-0"><TrackRow track={t} queueList={tracks} index={i} showMenu={false} /></div>
              {isOwner && <button onClick={() => removeTrack(t.id)} className="p-2 text-white/30 shrink-0"><TrashIcon size={16} /></button>}
            </div>
          ))}
        </div>
        {tracks.length === 0 && <p className="text-sm text-white/30 py-6 text-center">No tracks in this playlist yet.</p>}
      </div>

      {showAdd && <AddTrackModal onClose={() => setShowAdd(false)} onAdd={addTrack} existing={playlist.trackIds || []} />}
      {showEdit && <EditPlaylistModal playlist={playlist} onClose={() => setShowEdit(false)} onSaved={(p) => { setPlaylist(p); setShowEdit(false) }} onDeleted={() => navigate('/library')} />}
    </div>
  )
}

function EditPlaylistModal({ playlist, onClose, onSaved, onDeleted }) {
  const canPublic = useHasApprovedChannel()
  const [title, setTitle] = useState(playlist.title || '')
  const [description, setDescription] = useState(playlist.description || '')
  const [visibility, setVisibility] = useState(playlist.visibility || 'private')
  const [mood, setMood] = useState(playlist.mood || '')
  const [genre, setGenre] = useState(playlist.genre || '')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(playlist.coverUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(playlist.bannerUrl || '')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleCover = (e) => { const f = e.target.files?.[0]; if (!f) return; setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) }
  const handleBanner = (e) => { const f = e.target.files?.[0]; if (!f) return; setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) }

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const vis = canPublic ? visibility : 'private'
      const patch = { title: title.trim(), description, visibility: vis, mood: mood || null, genre: genre || null }
      if (coverFile) { const { url } = await storage.upload(coverFile, coverFile.name); patch.coverUrl = url }
      if (bannerFile) { const { url } = await storage.upload(bannerFile, bannerFile.name); patch.bannerUrl = url }
      if (mood) await ensureCategory(mood, 'mood')
      if (genre) await ensureCategory(genre, 'genre')
      await db.upsertShared('playlists', patch, playlist.id, { visibleTo: vis === 'public' ? 'public' : 'creator-and-admin' })
      onSaved({ ...playlist, ...patch })
    } catch (e) { setSaving(false) }
  }

  const del = async () => {
    setSaving(true)
    try { await db.deleteShared('playlists', playlist.id); onDeleted() }
    catch (e) { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">Edit Playlist</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl card-surface shrink-0 overflow-hidden cursor-pointer">
            {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : <><CoverIcon size={22} className="text-white/30" /><span className="text-[10px] text-white/30 mt-1">Cover</span></>}
            <input type="file" accept="image/*" className="hidden" onChange={handleCover} />
          </label>
          <label className="flex-1 h-24 flex flex-col items-center justify-center rounded-2xl card-surface overflow-hidden cursor-pointer">
            {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <><BannerIcon size={22} className="text-white/30" /><span className="text-[10px] text-white/30 mt-1">Banner (optional)</span></>}
            <input type="file" accept="image/*" className="hidden" onChange={handleBanner} />
          </label>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Playlist title" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={mood} onChange={(e) => setMood(e.target.value)} list="mood-list-e" placeholder="Mood (optional)" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list-e" placeholder="Genre (optional)" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <datalist id="mood-list-e">{MOOD_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="genre-list-e">{GENRE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
        </div>

        <p className="text-xs text-white/40 mb-2">Visibility</p>
        {canPublic ? (
          <div className="flex gap-2 mb-5">
            {[{ k: 'public', l: 'Public', Icon: GlobeIcon }, { k: 'friends', l: 'Friends Only', Icon: UsersIcon }, { k: 'private', l: 'Private', Icon: LockIcon }].map(({ k, l, Icon }) => (
              <button key={k} onClick={() => setVisibility(k)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium ${visibility === k ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>
                <Icon size={16} /> {l}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-2 mb-5 rounded-xl bg-white/5 px-3 py-2.5">
            <LockIcon size={16} className="text-white/40 mt-0.5 shrink-0" />
            <p className="text-xs text-white/40">This playlist stays <span className="text-white/70">Private</span>. Create an approved Channel to publish public playlists.</p>
          </div>
        )}

        <button onClick={save} disabled={!title.trim() || saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50 mb-3">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {confirmDel ? (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-white/80 mb-3">Delete this playlist permanently?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium">Cancel</button>
              <button onClick={del} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 text-red-400 text-sm font-medium">
            <TrashIcon size={16} /> Delete Playlist
          </button>
        )}
      </div>
    </div>
  )
}

function AddTrackModal({ onClose, onAdd, existing }) {
  const [q, setQ] = useState('')
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const list = useMemo(() => {
    const pub = (allTracks || []).filter(isPublicVisible)
    if (!q.trim()) return pub.slice(0, 40)
    return pub.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()) || t.artistName.toLowerCase().includes(q.toLowerCase()))
  }, [allTracks, q])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-white text-lg">Add Tracks</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 mb-3">
          <SearchIcon size={15} className="text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tracks…" className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30" />
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto no-scrollbar">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-1 py-1.5">
              <Cover track={t} size={38} />
              <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{t.title}</p><p className="text-xs text-white/40 truncate">{t.artistName}</p></div>
              <button
                onClick={() => onAdd(t.id)}
                disabled={existing.includes(t.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${existing.includes(t.id) ? 'bg-white/5 text-white/30' : 'btn-brand text-black'}`}
              >
                {existing.includes(t.id) ? 'Added' : 'Add'}
              </button>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-white/30 text-center py-6">No tracks found.</p>}
        </div>
      </div>
    </div>
  )
}
