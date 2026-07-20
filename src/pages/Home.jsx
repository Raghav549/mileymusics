import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { useFollows } from '../hooks/useFollows'
import { SectionRow, TrackCard, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import Logo from '../components/Logo'
import { isPublicVisible } from '../musicHelpers'
import { UploadIcon, ChartIcon, PodcastIcon, LiveIcon, UsersIcon, SearchIcon, MessageIcon, BellIcon, CalendarIcon, VerifiedIcon, ChannelIcon, PlayIcon, ProfileIcon } from '../components/icons'
import { usePlayer } from '../context/PlayerContext'
import { useNotifications, useUnreadMessageCount } from '../hooks/useNotifications'

const TABS = [
  ['all', 'All'],
  ['music', 'Music'],
  ['playlists', 'Playlists'],
  ['channels', 'Channels'],
  ['rooms', 'Party Rooms'],
]

function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  if (h < 21) return 'Good Evening'
  return 'Good Night'
}

// ── Hero slide image with loading + error fallback ──
function HeroImg({ src, title }) {
  const [status, setStatus] = useState('loading')
  return (
    <>
      {status !== 'loaded' && (
        <div className={`absolute inset-0 bg-gradient-to-br from-emerald-500/25 to-pink-500/25 flex items-center justify-center ${status === 'loading' ? 'animate-pulse' : ''}`}>
          <span className="text-white/50 font-display font-bold text-base px-6 text-center line-clamp-2">{title}</span>
        </div>
      )}
      <img
        src={src}
        alt={title}
        loading="lazy"
        className={`w-full h-full object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </>
  )
}

// ── Premium hero carousel — latest 5 songs uploaded WITH a banner image ──
function HeroCarousel({ slides, onOpen }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const n = slides.length

  useEffect(() => {
    if (n <= 1) return
    const id = setInterval(() => setI((p) => (p + 1) % n), 5000)
    return () => clearInterval(id)
  }, [n])
  useEffect(() => { if (i >= n && n > 0) setI(0) }, [n, i])

  if (!n) return null
  const go = (d) => setI((p) => (p + d + n) % n)

  return (
    <div className="mb-7">
      <div
        className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-3xl overflow-hidden card-surface"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        {slides.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className={`absolute inset-0 text-left transition-opacity duration-700 ${idx === i ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <HeroImg src={s.bannerUrl} title={s.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute left-0 right-0 bottom-0 p-4 sm:p-6 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Featured</p>
                <h3 className="font-display font-bold text-white text-lg sm:text-2xl leading-tight truncate">{s.title}</h3>
                <p className="text-sm text-white/70 truncate">{s.artistName}</p>
              </div>
              <span className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full grad-brand flex items-center justify-center text-black shadow-lg">
                <PlayIcon size={18} />
              </span>
            </div>
          </button>
        ))}

        {n > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setI(idx) }}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { data: allTracks, loading: tracksLoading } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: albums, loading: albumsLoading } = useLiveShared('albums', { order: '-createdAt', limit: 40 })
  const { data: playlists } = useLiveShared('playlists', { order: '-createdAt', limit: 60 })
  const { data: channels } = useLiveShared('channels', { order: '-createdAt', limit: 60 })
  const { isFollowing } = useFollows()
  const { playQueue, openFullPlayer } = usePlayer()
  const { unreadCount } = useNotifications()
  const unreadMsgCount = useUnreadMessageCount()
  const { data: liveRooms } = useLiveShared('voice_rooms', { order: '-createdAt', limit: 20 })
  const { data: premieres } = useLiveShared('premieres', { order: 'scheduledAt', limit: 6 })
  const activeRooms = (liveRooms || []).filter((r) => !r.ended && r.visibility !== 'private')
  const upcomingPremieres = (premieres || []).filter((p) => new Date(p.scheduledAt).getTime() > Date.now() - 3600000)

  const [tab, setTab] = useState('all')
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!auth.isAuthenticated()) return
    db.select('history', {}, { limit: 40, order: '-createdAt' }).then(setHistory).catch(() => {})
  }, [])

  const currentUser = auth.getCurrentUser()
  const userName = currentUser?.displayName?.split(' ')[0] || ''

  // Live profile avatar (from backend), falling back to the auth account avatar.
  const [profileAvatar, setProfileAvatar] = useState('')
  useEffect(() => {
    const uid = currentUser?.id
    if (!uid) { setProfileAvatar(''); return }
    let alive = true
    db.getShared('profiles', uid)
      .then((p) => { if (alive) setProfileAvatar(p?.avatarUrl || '') })
      .catch(() => { if (alive) setProfileAvatar('') })
    return () => { alive = false }
  }, [currentUser?.id])
  const headerAvatar = profileAvatar || currentUser?.avatarUrl || ''

  const publicTracks = useMemo(() => (allTracks || []).filter(isPublicVisible), [allTracks])
  const songs = useMemo(() => publicTracks.filter((t) => t.type !== 'podcast'), [publicTracks])
  const podcasts = useMemo(() => publicTracks.filter((t) => t.type === 'podcast'), [publicTracks])

  // Hero: latest 5 songs uploaded WITH a real banner image (songs already -createdAt)
  const heroSlides = useMemo(() => songs.filter((t) => t.bannerUrl).slice(0, 5), [songs])

  const newReleases = songs.slice(0, 14)
  const trending = useMemo(() => [...songs].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 14), [songs])
  const charts = trending.slice(0, 10)

  const recommended = useMemo(() => {
    const genreW = {}, artistW = {}, played = new Set()
    for (const h of history) {
      played.add(h.trackId)
      const src = songs.find((s) => s.id === h.trackId)
      if (!src) continue
      if (src.genre) genreW[src.genre.toLowerCase()] = (genreW[src.genre.toLowerCase()] || 0) + 1
      if (src.artistId) artistW[src.artistId] = (artistW[src.artistId] || 0) + 1
    }
    const hasSignal = Object.keys(genreW).length || Object.keys(artistW).length
    if (!hasSignal) return trending
    return songs.map((t) => {
      let s = 0
      if (t.genre && genreW[t.genre.toLowerCase()]) s += genreW[t.genre.toLowerCase()] * 3
      if (t.artistId && artistW[t.artistId]) s += artistW[t.artistId] * 4
      if (t.artistId && isFollowing(t.artistId)) s += 5
      s += Math.min((t.plays || 0) / 50, 4)
      if (played.has(t.id)) s -= 3
      return { t, s }
    }).sort((a, b) => b.s - a.s).slice(0, 14).map((x) => x.t)
  }, [songs, history, trending, isFollowing])

  const dedupHistory = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const h of history) {
      if (seen.has(h.trackId)) continue
      seen.add(h.trackId)
      out.push({ ...h, id: h.trackId })
    }
    return out
  }, [history])
  const continueListening = dedupHistory.slice(0, 6)
  const recentlyPlayed = dedupHistory.slice(0, 14)

  const friendActivity = useMemo(
    () => songs.filter((t) => t.artistId && isFollowing(t.artistId)).slice(0, 14),
    [songs, isFollowing]
  )

  const publicPlaylists = useMemo(() => (playlists || []).filter((p) => !p.visibility || p.visibility === 'public'), [playlists])
  const moodCollections = publicPlaylists.filter((p) => p.mood)
  const genreCollections = publicPlaylists.filter((p) => p.genre)
  const recommendedPlaylists = publicPlaylists.slice(0, 14)
  const communityPicks = publicPlaylists.filter((p) => p.isCommunityPick)

  const approvedChannels = useMemo(
    () => (channels || []).filter((c) => c.status === 'approved' || !c.status),
    [channels]
  )
  const sortedChannels = useMemo(
    () => [...approvedChannels].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0)),
    [approvedChannels]
  )

  const openSong = (t) => { playQueue([t], 0); openFullPlayer() }

  const loading = tracksLoading || albumsLoading
  const isEmpty = !loading && publicTracks.length === 0

  if (isEmpty) {
    return (
      <div className="h-full px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="flex items-center gap-2.5 mb-2">
          <button
            onClick={() => navigate('/profile')}
            aria-label="Your profile"
            className="w-9 h-9 rounded-full overflow-hidden bg-white border border-black/10 flex items-center justify-center shrink-0"
          >
            {headerAvatar
              ? <img src={headerAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              : <ProfileIcon size={18} className="text-black/40" />}
          </button>
          <Logo size={30} />
        </div>
        <EmptyState
          icon={<UploadIcon size={26} className="grad-brand-text" />}
          title="The stage is empty — for now"
          subtitle="MiLey starts with zero fake songs. Be the first to upload a track, album or podcast and it'll appear here for the world."
          action={
            <button onClick={() => navigate('/upload')} className="btn-brand text-black font-semibold px-6 py-3 rounded-2xl text-sm">
              Upload your first track
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/profile')}
            aria-label="Your profile"
            className="w-9 h-9 rounded-full overflow-hidden bg-white border border-black/10 flex items-center justify-center shrink-0"
          >
            {headerAvatar
              ? <img src={headerAvatar} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              : <ProfileIcon size={18} className="text-black/40" />}
          </button>
          <Logo size={28} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/messages')} className="relative w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <MessageIcon size={17} />
            {unreadMsgCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadMsgCount}</span>}
          </button>
          <button onClick={() => navigate('/notifications')} className="relative w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <BellIcon size={17} />
            {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadCount}</span>}
          </button>
          <button onClick={() => navigate('/search')} className="w-10 h-10 rounded-full card-surface flex items-center justify-center text-white/60">
            <SearchIcon size={18} />
          </button>
        </div>
      </div>

      {/* Dynamic greeting */}
      <div className="mb-4">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-white leading-tight">
          {greetingText()}{userName ? <span className="grad-brand-text">, {userName}</span> : ''}
        </h1>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain -mx-4 px-4 md:mx-0 md:px-0 mb-6">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === id ? 'grad-brand text-black' : 'card-surface text-white/60'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ALL ── (hero only here) */}
      {tab === 'all' && (
        <>
          <HeroCarousel slides={heroSlides} onOpen={openSong} />

          {continueListening.length > 0 && (
            <SectionRow title="Continue Listening">
              {continueListening.map((t) => <TrackCard key={t.id} track={t} queueList={continueListening} wide />)}
            </SectionRow>
          )}

          {recentlyPlayed.length > 0 && (
            <SectionRow title="Recently Played" onSeeAll={() => navigate('/browse/recent')}>
              {recentlyPlayed.map((t) => <TrackCard key={t.id} track={t} queueList={recentlyPlayed} />)}
            </SectionRow>
          )}

          {trending.length > 0 && (
            <SectionRow title="Trending Now" onSeeAll={() => navigate('/browse/trending')}>
              {trending.map((t) => <TrackCard key={t.id} track={t} queueList={trending} />)}
            </SectionRow>
          )}

          {newReleases.length > 0 && (
            <SectionRow title="New Releases" onSeeAll={() => navigate('/browse/new')}>
              {newReleases.map((t) => <TrackCard key={t.id} track={t} queueList={newReleases} />)}
            </SectionRow>
          )}

          {recommended.length > 0 && (
            <SectionRow title="Recommended For You" onSeeAll={() => navigate('/browse/recommended')}>
              {recommended.map((t) => <TrackCard key={t.id} track={t} queueList={recommended} />)}
            </SectionRow>
          )}

          {charts.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-1">
                <ChartIcon size={17} className="grad-brand-text" />
                <h2 className="font-display font-bold text-lg text-white">Charts</h2>
              </div>
              <div className="card-surface rounded-2xl p-2 md:p-3">
                {charts.map((t, i) => (
                  <button key={t.id} onClick={() => playQueue(charts, i)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5">
                    <span className="w-6 text-center font-display font-bold text-white/30">{i + 1}</span>
                    <Cover track={t} size={44} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">{t.title}</p>
                      <p className="text-xs text-white/40 truncate">{t.artistName}</p>
                    </div>
                    <span className="text-xs text-white/30 shrink-0">{t.plays || 0} plays</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {albums && albums.length > 0 && (
            <SectionRow title="Albums" onSeeAll={() => navigate('/browse/albums')}>
              {albums.map((a) => (
                <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{a.title}</p>
                  <p className="text-xs text-white/40 truncate">{a.artistName}</p>
                </button>
              ))}
            </SectionRow>
          )}

          {sortedChannels.length > 0 && (
            <SectionRow title="Channels">
              {sortedChannels.map((c) => (
                <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="text-left shrink-0 w-24 md:w-28 flex flex-col items-center">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : <ChannelIcon size={24} className="text-white/60" />}
                  </div>
                  <div className="mt-2 flex items-center gap-1 max-w-full">
                    <p className="text-xs font-medium text-white truncate">{c.name}</p>
                    {c.verified && <VerifiedIcon size={12} className="grad-brand-text shrink-0" />}
                  </div>
                </button>
              ))}
            </SectionRow>
          )}

          {recommendedPlaylists.length > 0 && (
            <SectionRow title="Recommended Playlists" onSeeAll={() => navigate('/browse/playlists')}>
              {recommendedPlaylists.map((p) => (
                <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                  <p className="text-xs text-white/40 truncate">By {p.ownerName || 'MiLey user'}</p>
                </button>
              ))}
            </SectionRow>
          )}

          {moodCollections.length > 0 && (
            <SectionRow title="Mood Collections">
              {moodCollections.map((p) => (
                <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: p.mood, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{p.mood}</p>
                  <p className="text-xs text-white/40 truncate">{p.title}</p>
                </button>
              ))}
            </SectionRow>
          )}

          {genreCollections.length > 0 && (
            <SectionRow title="Genre Collections">
              {genreCollections.map((p) => (
                <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: p.genre, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{p.genre}</p>
                  <p className="text-xs text-white/40 truncate">{p.title}</p>
                </button>
              ))}
            </SectionRow>
          )}

          {podcasts.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-1"><PodcastIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Podcasts</h2></div>
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
                {podcasts.map((t) => <TrackCard key={t.id} track={t} queueList={podcasts} />)}
              </div>
            </section>
          )}

          <section className="mb-7">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2"><LiveIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Listening Parties</h2></div>
              <button onClick={() => navigate('/rooms')} className="text-xs font-medium text-white/40">See all</button>
            </div>
            {activeRooms.length === 0 ? (
              <div className="card-surface rounded-2xl p-5 text-sm text-white/40">No live listening parties right now — <button onClick={() => navigate('/rooms')} className="grad-brand-text font-medium">start one</button> and listen in sync with friends.</div>
            ) : (
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
                {activeRooms.map((r) => (
                  <button key={r.id} onClick={() => navigate(`/rooms/${r.id}`)} className="card-surface rounded-2xl p-3 shrink-0 w-40 text-left">
                    <div className="w-full aspect-square mb-2"><Cover track={{ title: r.name, coverUrl: r.coverUrl }} size="fill" rounded="rounded-xl" /></div>
                    <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[rgb(var(--color-secondary))] animate-pulse" /><span className="text-xs text-white/40">Live</span></div>
                    <p className="text-sm font-medium text-white truncate">{r.name}</p>
                    <p className="text-xs text-white/40 truncate">by {r.hostName}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {upcomingPremieres.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-1"><CalendarIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Music Premieres</h2></div>
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
                {upcomingPremieres.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/premieres/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                    <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                    <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                    <p className="text-xs text-white/40 truncate">{new Date(p.scheduledAt).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {communityPicks.length > 0 && (
            <SectionRow title="Community Picks">
              {communityPicks.map((p) => (
                <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                </button>
              ))}
            </SectionRow>
          )}

          {friendActivity.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-1"><UsersIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Friend Activity</h2></div>
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
                {friendActivity.map((t) => <TrackCard key={t.id} track={t} queueList={friendActivity} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── MUSIC ── */}
      {tab === 'music' && (
        <>
          {newReleases.length > 0 && (
            <SectionRow title="New Releases" onSeeAll={() => navigate('/browse/new')}>
              {newReleases.map((t) => <TrackCard key={t.id} track={t} queueList={newReleases} />)}
            </SectionRow>
          )}
          {trending.length > 0 && (
            <SectionRow title="Trending Now" onSeeAll={() => navigate('/browse/trending')}>
              {trending.map((t) => <TrackCard key={t.id} track={t} queueList={trending} />)}
            </SectionRow>
          )}
          {recommended.length > 0 && (
            <SectionRow title="Recommended For You" onSeeAll={() => navigate('/browse/recommended')}>
              {recommended.map((t) => <TrackCard key={t.id} track={t} queueList={recommended} />)}
            </SectionRow>
          )}
          {albums && albums.length > 0 && (
            <SectionRow title="Albums" onSeeAll={() => navigate('/browse/albums')}>
              {albums.map((a) => (
                <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="text-left shrink-0 w-32 md:w-40">
                  <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{a.title}</p>
                  <p className="text-xs text-white/40 truncate">{a.artistName}</p>
                </button>
              ))}
            </SectionRow>
          )}
          {podcasts.length > 0 && (
            <section className="mb-7">
              <div className="flex items-center gap-2 mb-3 px-1"><PodcastIcon size={17} className="grad-brand-text" /><h2 className="font-display font-bold text-lg text-white">Podcasts</h2></div>
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1">
                {podcasts.map((t) => <TrackCard key={t.id} track={t} queueList={podcasts} />)}
              </div>
            </section>
          )}
          {songs.length === 0 && <p className="text-sm text-white/40 py-10 text-center">No music yet.</p>}
        </>
      )}

      {/* ── PLAYLISTS ── */}
      {tab === 'playlists' && (
        publicPlaylists.length === 0 ? (
          <p className="text-sm text-white/40 py-10 text-center">No playlists yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {publicPlaylists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-white/40 truncate">By {p.ownerName || 'MiLey user'}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── CHANNELS ── (verified pinned at top) */}
      {tab === 'channels' && (
        sortedChannels.length === 0 ? (
          <p className="text-sm text-white/40 py-10 text-center">No channels yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedChannels.map((c) => (
              <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="card-surface rounded-2xl p-4 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center">
                  {c.avatarUrl ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" /> : <ChannelIcon size={26} className="text-white/60" />}
                </div>
                <div className="mt-2.5 flex items-center gap-1 max-w-full">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  {c.verified && <VerifiedIcon size={13} className="grad-brand-text shrink-0" />}
                </div>
                {c.username && <p className="text-xs text-white/40 truncate max-w-full">@{c.username}</p>}
              </button>
            ))}
          </div>
        )
      )}

      {/* ── PARTY ROOMS ── (active only) */}
      {tab === 'rooms' && (
        activeRooms.length === 0 ? (
          <div className="card-surface rounded-2xl p-6 text-sm text-white/50 text-center">
            No live listening parties right now.
            <div className="mt-3"><button onClick={() => navigate('/rooms')} className="btn-brand text-black font-semibold px-5 py-2.5 rounded-2xl text-sm">Start a party</button></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeRooms.map((r) => (
              <button key={r.id} onClick={() => navigate(`/rooms/${r.id}`)} className="card-surface rounded-2xl p-3 text-left">
                <div className="w-full aspect-square mb-2"><Cover track={{ title: r.name, coverUrl: r.coverUrl }} size="fill" rounded="rounded-xl" /></div>
                <div className="flex items-center gap-1.5 mb-1"><span className="w-2 h-2 rounded-full bg-[rgb(var(--color-secondary))] animate-pulse" /><span className="text-xs text-white/40">Live</span></div>
                <p className="text-sm font-medium text-white truncate">{r.name}</p>
                <p className="text-xs text-white/40 truncate">by {r.hostName}</p>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
