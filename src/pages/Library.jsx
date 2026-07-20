import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { getLikedTracks } from '../hooks/useLikes'
import { useFollows } from '../hooks/useFollows'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { LibraryIcon, PlusIcon, HeartIcon, UploadIcon, UsersIcon, CloseIcon, CoverIcon, BannerIcon, LockIcon, GlobeIcon, DownloadIcon, CheckIcon, TrashIcon, MicIcon } from '../components/icons'
import { MOOD_SUGGESTIONS, GENRE_SUGGESTIONS, ensureCategory } from '../musicHelpers'
import { useHasApprovedChannel } from '../permissions'
import { useDownloads, formatBytes } from '../hooks/useDownloads'
import { offlineDownloads } from '../offlineDownloads'

const TABS = ['Playlists', 'Liked Songs', 'AI Creations', 'Downloads', 'My Uploads', 'Following']

export default function Library() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [tab, setTab] = useState('Playlists')
  const [showCreate, setShowCreate] = useState(false)
  const [liked, setLiked] = useState([])
  const { data: allPlaylists } = useLiveShared('playlists', { order: '-createdAt', limit: 200 })
  const { data: myUploads } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { followingIds } = useFollowingList()

  const myPlaylists = useMemo(() => (allPlaylists || []).filter((p) => p.ownerId === user?.id), [allPlaylists, user])
  const myTracks = useMemo(() => (myUploads || []).filter((t) => t.artistId === user?.id && !t.aiGenerated), [myUploads, user])
  const aiTracks = useMemo(() => (myUploads || []).filter((t) => t.artistId === user?.id && t.aiGenerated), [myUploads, user])

  useEffect(() => { getLikedTracks().then(setLiked) }, [])

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <LibraryIcon size={22} className="grad-brand-text" />
          <h1 className="font-display font-bold text-xl text-white">Your Library</h1>
        </div>
        {tab === 'Playlists' && (
          <button onClick={() => setShowCreate(true)} className="w-10 h-10 rounded-full btn-brand flex items-center justify-center">
            <PlusIcon size={18} color="#0B0B0B" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar overscroll-x-contain">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Playlists' && (
        myPlaylists.length === 0 ? (
          <EmptyState icon={<LibraryIcon size={24} className="grad-brand-text" />} title="No playlists yet" subtitle="Create your first playlist to organize your favorite tracks." action={<button onClick={() => setShowCreate(true)} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Create Playlist</button>} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {myPlaylists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-white/40 truncate">{p.visibility === 'public' ? 'Public' : p.visibility === 'friends' ? 'Friends Only' : 'Private'} · {(p.trackIds || []).length} tracks</p>
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'Liked Songs' && (
        liked.length === 0 ? (
          <EmptyState icon={<HeartIcon size={24} className="grad-brand-text" />} title="No liked songs yet" subtitle="Tap the heart on any track to save it here." />
        ) : (
          <div className="space-y-0.5">
            {liked.map((t) => <TrackRow key={t.id} track={t} queueList={liked} showMenu={false} />)}
          </div>
        )
      )}

      {tab === 'My Uploads' && (
        myTracks.length === 0 ? (
          <EmptyState icon={<UploadIcon size={24} className="grad-brand-text" />} title="You haven't uploaded anything" subtitle="Share your music, albums or podcasts with the world." action={<button onClick={() => navigate('/upload')} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Go to Upload Studio</button>} />
        ) : (
          <div className="space-y-0.5">
            {myTracks.map((t) => <TrackRow key={t.id} track={t} queueList={myTracks} showMenu={false} />)}
          </div>
        )
      )}

      {tab === 'AI Creations' && (
        aiTracks.length === 0 ? (
          <EmptyState icon={<MicIcon size={24} className="grad-brand-text" />} title="No AI songs yet" subtitle="Create original songs with MiLey+ AI Studio — they'll appear here." action={<button onClick={() => navigate('/ai')} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Open AI Studio</button>} />
        ) : (
          <div className="space-y-0.5">
            {aiTracks.map((t) => <TrackRow key={t.id} track={t} queueList={aiTracks} showMenu={false} />)}
          </div>
        )
      )}

      {tab === 'Downloads' && <DownloadsTab />}

      {tab === 'Following' && (
        <FollowingTab ids={followingIds} />
      )}

      {showCreate && <CreatePlaylistModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function DownloadsTab() {
  const { ready, list, totalBytes, active } = useDownloads()
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

  if (!ready) {
    return <div className="py-16 text-center text-white/30 text-sm">Loading downloads…</div>
  }
  if (list.length === 0 && Object.keys(active).length === 0) {
    return <EmptyState icon={<DownloadIcon size={24} className="grad-brand-text" />} title="No downloads yet" subtitle="Tap Download on any song to save it for offline listening. Downloads are stored privately inside the app on this device." />
  }

  return (
    <div>
      <div className="card-surface rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl grad-download flex items-center justify-center shrink-0">
          <DownloadIcon size={20} color="#04120c" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{list.length} song{list.length === 1 ? '' : 's'} available offline</p>
          <p className="text-xs text-white/40">{formatBytes(totalBytes)} stored on this device{isOnline ? '' : ' · Offline mode'}</p>
        </div>
        {!isOnline && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-300">OFFLINE</span>}
      </div>

      <div className="space-y-0.5">
        {list.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-1 py-2">
            <div className="flex-1 min-w-0"><TrackRow track={t} queueList={list} showMenu={false} /></div>
            <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><CheckIcon size={12} /></span>
            <button onClick={() => offlineDownloads.removeDownload(t.id)} className="shrink-0 p-2 text-white/40"><TrashIcon size={15} /></button>
          </div>
        ))}
        {Object.entries(active).filter(([, a]) => a.status === 'error').map(([id, a]) => (
          <div key={id} className="flex items-center gap-3 px-1 py-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <DownloadIcon size={16} className="text-red-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 font-medium">Download failed</p>
              <p className="text-xs text-white/40 truncate">{a.error || 'Try again from the player.'}</p>
            </div>
            <button onClick={() => offlineDownloads.cancel(id)} className="shrink-0 p-2 text-white/40"><CloseIcon size={15} /></button>
          </div>
        ))}
        {Object.entries(active).filter(([, a]) => a.status !== 'error').map(([id, a]) => {
          const pct = a.total ? Math.round((a.received / a.total) * 100) : 0
          return (
            <div key={id} className="flex items-center gap-3 px-1 py-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <DownloadIcon size={16} className="text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70">{a.status === 'paused' ? 'Paused' : 'Downloading'} · {pct}%</p>
                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full grad-download rounded-full" style={{ width: `${pct}%` }} /></div>
              </div>
              <button onClick={() => offlineDownloads.cancel(id)} className="shrink-0 p-2 text-white/40"><CloseIcon size={15} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useFollowingList() {
  const user = auth.getCurrentUser()
  const [followingIds, setFollowingIds] = useState([])
  useEffect(() => {
    if (!user) return
    db.selectShared('follows', { followerId: user.id }, { limit: 300 }).then((rows) => setFollowingIds(rows)).catch(() => {})
  }, [user])
  return { followingIds }
}

function FollowingTab({ ids }) {
  const navigate = useNavigate()
  if (!ids.length) {
    return <EmptyState icon={<UsersIcon size={24} className="grad-brand-text" />} title="Not following anyone yet" subtitle="Follow artists and users to see their new uploads here." />
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {ids.map((f) => (
        <button key={f.id} onClick={() => navigate(`/artist/${f.targetId}`)} className="flex flex-col items-center gap-2 card-surface rounded-2xl p-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
            {f.targetAvatar ? <img src={f.targetAvatar} className="w-full h-full object-cover" /> : <span className="font-display font-bold">{(f.targetName || '?')[0]}</span>}
          </div>
          <span className="text-sm text-white truncate w-full text-center">{f.targetName || 'MiLey user'}</span>
        </button>
      ))}
    </div>
  )
}

function CreatePlaylistModal({ onClose }) {
  const user = auth.getCurrentUser()
  const canPublic = useHasApprovedChannel()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState(canPublic ? 'public' : 'private')
  const [mood, setMood] = useState('')
  const [genre, setGenre] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCover = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoverFile(f)
    setCoverPreview(URL.createObjectURL(f))
  }
  const handleBanner = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBannerFile(f)
    setBannerPreview(URL.createObjectURL(f))
  }

  const create = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const vis = canPublic ? visibility : 'private'
      let coverUrl = ''
      if (coverFile) {
        const { url } = await storage.upload(coverFile, coverFile.name)
        coverUrl = url
      }
      let bannerUrl = ''
      if (bannerFile) {
        const { url } = await storage.upload(bannerFile, bannerFile.name)
        bannerUrl = url
      }
      if (mood) await ensureCategory(mood, 'mood')
      if (genre) await ensureCategory(genre, 'genre')
      await db.insertShared('playlists', {
        title: title.trim(), description, coverUrl, bannerUrl, ownerId: user.id, ownerName: user.displayName || 'MiLey user',
        trackIds: [], visibility: vis, mood: mood || null, genre: genre || null,
      }, undefined, { visibleTo: vis === 'public' ? 'public' : 'creator-and-admin' })
      onClose()
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">New Playlist</h3>
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
          <input value={mood} onChange={(e) => setMood(e.target.value)} list="mood-list" placeholder="Mood (optional)" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list" placeholder="Genre (optional)" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <datalist id="mood-list">{MOOD_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
          <datalist id="genre-list">{GENRE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
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
            <p className="text-xs text-white/40">This playlist will be <span className="text-white/70">Private</span> — only you can see it. Create an approved Channel to publish public playlists.</p>
          </div>
        )}

        <button onClick={create} disabled={!title.trim() || saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">
          {saving ? 'Creating…' : 'Create Playlist'}
        </button>
      </div>
    </div>
  )
}
