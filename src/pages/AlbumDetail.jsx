import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { usePlayer } from '../context/PlayerContext'
import { TrackRow, Cover } from '../components/TrackViews'
import { BackIcon, PlayIcon, EditIcon, CloseIcon, TrashIcon, CoverIcon, BannerIcon, LockIcon, GlobeIcon, UsersIcon } from '../components/icons'
import { isPublicVisible, LANGUAGE_SUGGESTIONS, GENRE_SUGGESTIONS, ensureCategory } from '../musicHelpers'
import { useHasApprovedChannel } from '../permissions'

export default function AlbumDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [album, setAlbum] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { playQueue } = usePlayer()

  useEffect(() => { db.getShared('albums', id).then(setAlbum).catch(() => setAlbum(null)) }, [id])

  const isOwner = album && user?.id === album.artistId
  const tracks = useMemo(() => (allTracks || []).filter((t) => t.albumId === id && (isOwner || isPublicVisible(t))), [allTracks, id, isOwner])

  if (!album) return null

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-56 md:h-72 w-full">
        {album.bannerUrl ? <img src={album.bannerUrl} className="w-full h-full object-cover" /> : <Cover track={{ coverUrl: album.coverUrl, title: album.title }} size="fill" rounded="" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-black/30 to-black/40" />
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><BackIcon size={20} /></button>
        {isOwner && (
          <button onClick={() => setShowEdit(true)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><EditIcon size={18} /></button>
        )}
        <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
          <div className="w-24 h-24 shrink-0"><Cover track={{ coverUrl: album.coverUrl, title: album.title }} size="fill" rounded="rounded-2xl" /></div>
          <div className="min-w-0 pb-1">
            <p className="text-xs text-white/60 uppercase tracking-wide">Album{album.visibility && album.visibility !== 'public' ? ' · Private' : ''}</p>
            <h1 className="font-display font-bold text-2xl text-white truncate">{album.title}</h1>
            <button onClick={() => navigate(`/artist/${album.artistId}`)} className="text-sm text-white/60 truncate">{album.artistName}</button>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        {album.description && <p className="text-sm text-white/50 mb-4">{album.description}</p>}
        <button
          onClick={() => tracks.length && playQueue(tracks, 0)}
          disabled={!tracks.length}
          className="w-14 h-14 rounded-full btn-brand flex items-center justify-center mb-5 disabled:opacity-40"
        >
          <PlayIcon size={22} color="#0B0B0B" />
        </button>

        <div className="space-y-0.5">
          {tracks.map((t, i) => <TrackRow key={t.id} track={t} queueList={tracks} index={i} showMenu={false} />)}
        </div>
        {tracks.length === 0 && <p className="text-sm text-white/30 py-6 text-center">No tracks available in this album.</p>}
      </div>

      {showEdit && <EditAlbumModal album={album} tracks={tracks} onClose={() => setShowEdit(false)} onSaved={(a) => { setAlbum(a); setShowEdit(false) }} onDeleted={() => navigate(-1)} />}
    </div>
  )
}

function EditAlbumModal({ album, tracks, onClose, onSaved, onDeleted }) {
  const canPublic = useHasApprovedChannel()
  const [title, setTitle] = useState(album.title || '')
  const [description, setDescription] = useState(album.description || '')
  const [visibility, setVisibility] = useState(album.visibility || 'public')
  const [genre, setGenre] = useState(album.genre || '')
  const [language, setLanguage] = useState(album.language || '')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(album.coverUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(album.bannerUrl || '')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleCover = (e) => { const f = e.target.files?.[0]; if (!f) return; setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) }
  const handleBanner = (e) => { const f = e.target.files?.[0]; if (!f) return; setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) }

  const visScope = (v) => (v === 'public' ? 'public' : 'creator-and-admin')

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const vis = canPublic ? visibility : 'private'
      const patch = { title: title.trim(), description, visibility: vis, genre: genre || null, language: language || null }
      if (coverFile) { const { url } = await storage.upload(coverFile, coverFile.name); patch.coverUrl = url }
      if (bannerFile) { const { url } = await storage.upload(bannerFile, bannerFile.name); patch.bannerUrl = url }
      if (genre) await ensureCategory(genre, 'genre')
      if (language) await ensureCategory(language, 'language')
      await db.upsertShared('albums', patch, album.id, { visibleTo: visScope(vis) })
      // Keep the album's tracks in sync: title/cover/visibility propagate to them.
      const tPatch = { albumTitle: patch.title, visibility: vis }
      if (patch.coverUrl) tPatch.coverUrl = patch.coverUrl
      for (const t of tracks) {
        await db.upsertShared('tracks', tPatch, t.id, { visibleTo: visScope(vis) }).catch(() => {})
      }
      onSaved({ ...album, ...patch })
    } catch (e) { setSaving(false) }
  }

  const del = async () => {
    setSaving(true)
    try {
      for (const t of tracks) { await db.deleteShared('tracks', t.id).catch(() => {}) }
      await db.deleteShared('albums', album.id)
      onDeleted()
    } catch (e) { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">Edit Album</h3>
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

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Album title" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list-a" placeholder="Genre" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <input value={language} onChange={(e) => setLanguage(e.target.value)} list="lang-list-a" placeholder="Language" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <datalist id="genre-list-a">{GENRE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
          <datalist id="lang-list-a">{LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}</datalist>
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
            <p className="text-xs text-white/40">This album stays <span className="text-white/70">Private</span>. An approved Channel is required to publish publicly.</p>
          </div>
        )}

        <button onClick={save} disabled={!title.trim() || saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50 mb-3">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {confirmDel ? (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-white/80 mb-3">Delete this album and its {tracks.length} track{tracks.length === 1 ? '' : 's'} permanently?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-medium">Cancel</button>
              <button onClick={del} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 text-red-400 text-sm font-medium">
            <TrashIcon size={16} /> Delete Album
          </button>
        )}
      </div>
    </div>
  )
}
