import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { social } from '../lib/social'
import { ensureCategory, GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS } from '../musicHelpers'
import { canUploadDirect } from '../permissions'
import { notifyFollowers } from '../hooks/useNotifications'
import { UploadIcon, CoverIcon, BannerIcon, CheckIcon, TrashIcon, LockIcon, GlobeIcon, UsersIcon, CollabIcon, ChannelIcon } from '../components/icons'

const TYPES = [
  { key: 'song', label: 'Song' },
  { key: 'podcast', label: 'Podcast' },
  { key: 'album', label: 'Album' },
]

const AUDIO_ACCEPT = '.mp3,.wav,.flac,.aac,.ogg,audio/*'

function readAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { resolve(audio.duration || 0); URL.revokeObjectURL(url) }
    audio.onerror = () => resolve(0)
    audio.src = url
  })
}

export default function Upload() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [type, setType] = useState('song')
  const [title, setTitle] = useState('')
  const [artistName, setArtistName] = useState(user?.displayName || '')
  const [language, setLanguage] = useState('')
  const [genre, setGenre] = useState('')
  const [mood, setMood] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [scheduledAt, setScheduledAt] = useState('')
  const [copyright, setCopyright] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [albumTracks, setAlbumTracks] = useState([]) // [{file, title}]
  const [seasonNumber, setSeasonNumber] = useState('')
  const [episodeNumber, setEpisodeNumber] = useState('')
  const [channel, setChannel] = useState(null)
  const [channelLoaded, setChannelLoaded] = useState(false)
  const [uploadsSuspended, setUploadsSuspended] = useState(false)
  const [coArtistQuery, setCoArtistQuery] = useState('')
  const [coArtistResults, setCoArtistResults] = useState([])
  const [coArtists, setCoArtists] = useState([])
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!user) return
    db.selectShared('channels', { ownerId: user.id }, { limit: 1 }).then((r) => setChannel(r[0] || null)).catch(() => {}).finally(() => setChannelLoaded(true))
    db.getShared('user_moderation', user.id).then((m) => setUploadsSuspended(!!m?.uploadsSuspended)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!coArtistQuery.trim()) { setCoArtistResults([]); return }
    const t = setTimeout(() => {
      social.searchUsers(coArtistQuery.trim()).then(setCoArtistResults).catch(() => setCoArtistResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [coArtistQuery])
  const [saving, setSaving] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [done, setDone] = useState(false)
  const audioInputRef = useRef(null)

  const reset = () => {
    setTitle(''); setLanguage(''); setGenre(''); setMood(''); setLyrics(''); setScheduledAt('')
    setCopyright(false); setCoverFile(null); setCoverPreview(''); setBannerFile(null); setBannerPreview('')
    setAudioFile(null); setAlbumTracks([]); setDone(false)
  }

  const handleCover = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f))
  }
  const handleBanner = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBannerFile(f); setBannerPreview(URL.createObjectURL(f))
  }
  const handleAudio = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setAudioFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }
  const handleAlbumFiles = (files) => {
    const arr = Array.from(files).map((f) => ({ file: f, title: f.name.replace(/\.[^.]+$/, '') }))
    setAlbumTracks((prev) => [...prev, ...arr])
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const files = e.dataTransfer.files
    if (!files.length) return
    if (type === 'album') handleAlbumFiles(files)
    else { setAudioFile(files[0]); if (!title) setTitle(files[0].name.replace(/\.[^.]+$/, '')) }
  }

  const canSubmit = () => {
    if (!copyright) return false
    if (!coverFile) return false
    if (type === 'album') return title.trim() && albumTracks.length > 0
    return title.trim() && audioFile
  }

  const submit = async () => {
    if (!canSubmit()) return
    setSaving(true)
    try {
      setProgressLabel('Uploading cover art…')
      const { url: coverUrl } = await storage.upload(coverFile, coverFile.name)
      let bannerUrl = ''
      if (bannerFile) { setProgressLabel('Uploading banner…'); const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      if (genre) await ensureCategory(genre, 'genre')
      if (language) await ensureCategory(language, 'language')
      if (mood) await ensureCategory(mood, 'mood')

      const iso = scheduledAt ? new Date(scheduledAt).toISOString() : null
      const visMap = { public: 'public', private: 'creator-and-admin', friends: 'creator-and-admin' }
      let followerAlert = null

      if (type === 'album') {
        setProgressLabel('Creating album…')
        const album = await db.insertShared('albums', {
          title: title.trim(), artistName: artistName || 'Unknown Artist', artistId: user.id,
          coverUrl, bannerUrl, genre, language, visibility, channelId: channel?.id || null,
          coArtistIds: coArtists.map((c) => c.id), coArtistNames: coArtists.map((c) => c.displayName),
        }, undefined, { visibleTo: visMap[visibility] })
        followerAlert = { url: `/album/${album.id}`, body: `${artistName || 'An artist'} released the album "${title.trim()}"` }

        for (let i = 0; i < albumTracks.length; i++) {
          const t = albumTracks[i]
          setProgressLabel(`Uploading track ${i + 1} of ${albumTracks.length}…`)
          const { url: audioUrl } = await storage.upload(t.file, t.file.name)
          const duration = await readAudioDuration(t.file)
          await db.insertShared('tracks', {
            title: t.title, artistName: artistName || 'Unknown Artist', artistId: user.id,
            coverUrl, bannerUrl, audioUrl, duration, genre, language, mood, lyrics: '',
            type: 'song', albumId: album.id, albumTitle: title.trim(), visibility, channelId: channel?.id || null,
            coArtistIds: coArtists.map((c) => c.id),
            scheduledAt: iso, copyrightOwned: true, plays: 0, likesCount: 0,
          }, undefined, { visibleTo: visMap[visibility] })
        }
      } else {
        setProgressLabel('Uploading audio…')
        const { url: audioUrl } = await storage.upload(audioFile, audioFile.name)
        const duration = await readAudioDuration(audioFile)
        await db.insertShared('tracks', {
          title: title.trim(), artistName: artistName || 'Unknown Artist', artistId: user.id,
          coverUrl, bannerUrl, audioUrl, duration, genre, language, mood, lyrics,
          type, albumId: null, albumTitle: null, visibility, channelId: channel?.id || null,
          seasonNumber: type === 'podcast' && seasonNumber ? Number(seasonNumber) : null,
          episodeNumber: type === 'podcast' && episodeNumber ? Number(episodeNumber) : null,
          scheduledAt: iso, copyrightOwned: true, plays: 0, likesCount: 0,
        }, undefined, { visibleTo: visMap[visibility] })
        followerAlert = { url: `/artist/${user.id}`, body: `${artistName || 'An artist'} uploaded "${title.trim()}"` }
      }

      // Alert followers in real time — only for content that is public and live now
      // (scheduled releases fire their own premiere notification at publish time).
      if (followerAlert && visibility === 'public' && !iso) {
        await notifyFollowers(user.id, { type: 'upload', title: 'New from someone you follow', body: followerAlert.body, url: followerAlert.url })
      }

      setDone(true)
    } catch (e) {
      setProgressLabel('Upload failed — please try again.')
    }
    setSaving(false)
  }

  if (uploadsSuspended) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-3xl card-surface flex items-center justify-center mb-4"><LockIcon size={26} className="grad-brand-text" /></div>
        <h2 className="font-display font-bold text-xl text-white mb-2">Uploads suspended</h2>
        <p className="text-white/40 text-sm max-w-xs">An administrator has temporarily suspended uploads on your account.</p>
      </div>
    )
  }

  const directUpload = canUploadDirect(user)
  const channelApproved = channel && channel.status === 'approved'
  if (!directUpload && !channelApproved) {
    if (!channelLoaded) return null
    return <UploadLocked channel={channel} navigate={navigate} />
  }

  if (done) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-3xl btn-brand flex items-center justify-center mb-4"><CheckIcon size={28} color="#0B0B0B" /></div>
        <h2 className="font-display font-bold text-xl text-white mb-2">Uploaded!</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs">Your {type === 'album' ? 'album' : type} is live{visibility !== 'public' ? ' (not public)' : ' on MiLey'}.</p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/library')} className="card-surface px-5 py-2.5 rounded-2xl text-sm font-medium text-white">View in Library</button>
          <button onClick={reset} className="btn-brand text-black px-5 py-2.5 rounded-2xl text-sm font-semibold">Upload Another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5">
        <UploadIcon size={22} className="grad-brand-text" />
        <h1 className="font-display font-bold text-xl text-white">Upload Studio</h1>
      </div>
      {channel && <p className="text-xs text-white/40 -mt-3 mb-4">Publishing to your channel <span className="grad-brand-text font-medium">@{channel.username}</span></p>}

      <div className="flex gap-2 mb-5">
        {TYPES.map((t) => (
          <button key={t.key} onClick={() => { setType(t.key); setAudioFile(null); setAlbumTracks([]) }} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${type === t.key ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t.label}</button>
        ))}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed ${dragOver ? 'border-[rgb(var(--color-primary))] bg-white/5' : 'border-white/10'} p-6 text-center mb-5 transition-colors`}
      >
        {type !== 'album' ? (
          <>
            <UploadIcon size={26} className="mx-auto mb-2 text-white/40" />
            <p className="text-sm text-white/60 mb-3">Drag & drop your audio file, or</p>
            <button onClick={() => audioInputRef.current?.click()} className="card-surface px-4 py-2 rounded-xl text-sm font-medium text-white">Choose File</button>
            <input ref={audioInputRef} type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={handleAudio} />
            <p className="text-xs text-white/25 mt-3">MP3, WAV, FLAC, AAC, OGG</p>
            {audioFile && (
              <div className="mt-4 flex items-center justify-between card-surface rounded-xl px-3 py-2 text-left">
                <span className="text-sm text-white truncate">{audioFile.name}</span>
                <button onClick={() => setAudioFile(null)}><TrashIcon size={16} className="text-white/40" /></button>
              </div>
            )}
          </>
        ) : (
          <>
            <UploadIcon size={26} className="mx-auto mb-2 text-white/40" />
            <p className="text-sm text-white/60 mb-3">Drag & drop multiple audio files for this album, or</p>
            <button onClick={() => audioInputRef.current?.click()} className="card-surface px-4 py-2 rounded-xl text-sm font-medium text-white">Choose Files</button>
            <input ref={audioInputRef} type="file" accept={AUDIO_ACCEPT} multiple className="hidden" onChange={(e) => handleAlbumFiles(e.target.files)} />
            {albumTracks.length > 0 && (
              <div className="mt-4 space-y-2 text-left">
                {albumTracks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 card-surface rounded-xl px-3 py-2">
                    <span className="text-xs text-white/30 w-5">{i + 1}</span>
                    <input
                      value={t.title}
                      onChange={(e) => setAlbumTracks((prev) => prev.map((p, pi) => pi === i ? { ...p, title: e.target.value } : p))}
                      className="flex-1 bg-transparent text-sm text-white outline-none min-w-0"
                    />
                    <button onClick={() => setAlbumTracks((prev) => prev.filter((_, pi) => pi !== i))}><TrashIcon size={15} className="text-white/40" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex gap-4 mb-5">
        <label className="flex-1 flex flex-col items-center justify-center aspect-square rounded-2xl card-surface overflow-hidden cursor-pointer">
          {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : (<><CoverIcon size={22} className="text-white/30 mb-1" /><span className="text-xs text-white/40">Cover Art*</span></>)}
          <input type="file" accept="image/*" className="hidden" onChange={handleCover} />
        </label>
        <label className="flex-[2] flex flex-col items-center justify-center aspect-[2/1] rounded-2xl card-surface overflow-hidden cursor-pointer">
          {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : (<><BannerIcon size={22} className="text-white/30 mb-1" /><span className="text-xs text-white/40">Banner (optional)</span></>)}
          <input type="file" accept="image/*" className="hidden" onChange={handleBanner} />
        </label>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'album' ? 'Album title' : 'Track title'} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
      <input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Artist name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <input value={language} onChange={(e) => setLanguage(e.target.value)} list="lang-list" placeholder="Language" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        <input value={genre} onChange={(e) => setGenre(e.target.value)} list="genre-list" placeholder="Genre" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        <input value={mood} onChange={(e) => setMood(e.target.value)} list="mood-list" placeholder="Mood" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        <datalist id="lang-list">{LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}</datalist>
        <datalist id="genre-list">{GENRE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
        <datalist id="mood-list">{MOOD_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
      </div>

      {type !== 'album' && (
        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Lyrics (optional — timed lines like [00:12] your line enable synced highlighting)" rows={4} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />
      )}

      {type === 'podcast' && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={seasonNumber} onChange={(e) => setSeasonNumber(e.target.value)} type="number" placeholder="Season number" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          <input value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} type="number" placeholder="Episode number" className="bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
        </div>
      )}

      {type === 'album' && (
        <div className="mb-3">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1"><CollabIcon size={13} /> Collaborating artists (optional)</p>
          <input value={coArtistQuery} onChange={(e) => setCoArtistQuery(e.target.value)} placeholder="Search users to add as co-artists…" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none" />
          {coArtistResults.length > 0 && (
            <div className="card-surface rounded-xl mt-1 max-h-32 overflow-y-auto no-scrollbar">
              {coArtistResults.map((u) => (
                <button key={u.id} onClick={() => { setCoArtists((c) => c.find((x) => x.id === u.id) ? c : [...c, u]); setCoArtistQuery('') }} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5">{u.displayName}</button>
              ))}
            </div>
          )}
          {coArtists.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {coArtists.map((c) => <span key={c.id} onClick={() => setCoArtists((arr) => arr.filter((x) => x.id !== c.id))} className="text-xs px-3 py-1.5 rounded-full card-surface text-white cursor-pointer">{c.displayName} ✕</span>)}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-white/40 mb-2">Visibility</p>
      <div className="flex gap-2 mb-4">
        {[{ k: 'public', l: 'Public', Icon: GlobeIcon }, { k: 'friends', l: 'Friends Only', Icon: UsersIcon }, { k: 'private', l: 'Private', Icon: LockIcon }].map(({ k, l, Icon }) => (
          <button key={k} onClick={() => setVisibility(k)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium ${visibility === k ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>
            <Icon size={16} /> {l}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <p className="text-xs text-white/40 mb-2">Scheduled publishing (optional)</p>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none [color-scheme:dark]" />
      </div>

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <div onClick={() => setCopyright((c) => !c)} className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0 ${copyright ? 'btn-brand' : 'bg-white/10'}`}>
          {copyright && <CheckIcon size={13} color="#0B0B0B" />}
        </div>
        <span className="text-xs text-white/50">I confirm I own the rights to this content or have permission to upload and distribute it on MiLey.</span>
      </label>

      {progressLabel && <p className="text-xs text-white/40 mb-3">{progressLabel}</p>}

      <button onClick={submit} disabled={!canSubmit() || saving} className="w-full btn-brand text-black font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-40">
        {saving ? 'Uploading…' : `Publish ${type === 'album' ? 'Album' : type === 'podcast' ? 'Podcast' : 'Track'}`}
      </button>
    </div>
  )
}

function UploadLocked({ channel, navigate }) {
  const status = channel?.status
  let title = 'Create a Channel to upload'
  let subtitle = 'Uploading music on MiLey is done through a Channel. Create your channel and submit it for approval — once an admin approves it, you can upload songs, albums and podcasts from your dashboard.'
  let cta = 'Create Your Channel'
  if (status === 'pending') {
    title = 'Channel awaiting approval'
    subtitle = 'Your channel request has been submitted and is pending admin review. As soon as it\u2019s approved you\u2019ll be able to upload here.'
    cta = 'View Channel Status'
  } else if (status === 'rejected') {
    title = 'Channel request declined'
    subtitle = 'Your channel wasn\u2019t approved this time. You can update its details and request approval again from your dashboard.'
    cta = 'Review & Resubmit'
  }
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-3xl card-surface flex items-center justify-center mb-4">
        {status === 'pending' ? <ChannelIcon size={26} className="grad-brand-text" /> : <LockIcon size={26} className="grad-brand-text" />}
      </div>
      <h2 className="font-display font-bold text-xl text-white mb-2">{title}</h2>
      <p className="text-white/40 text-sm mb-6 max-w-xs">{subtitle}</p>
      <button onClick={() => navigate('/channel-dashboard')} className="btn-brand text-black font-semibold px-6 py-3 rounded-2xl text-sm">{cta}</button>
    </div>
  )
}
