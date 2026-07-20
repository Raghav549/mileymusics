import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveShared } from '../lib/useLive'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { usePlayer } from '../context/PlayerContext'
import { useFollows } from '../hooks/useFollows'
import { Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { BackIcon, PlayIcon, PauseIcon, SearchIcon } from '../components/icons'
import { GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS, isPublicVisible } from '../musicHelpers'

const PAGE = 24

const SECTIONS = {
  trending: { title: 'Trending Now', kind: 'songs', filters: true },
  new: { title: 'New Releases', kind: 'songs', filters: true },
  recommended: { title: 'Recommended For You', kind: 'songs', filters: true },
  recent: { title: 'Recently Played', kind: 'songs', filters: false },
  albums: { title: 'Albums', kind: 'albums', filters: false },
  artists: { title: 'Artists', kind: 'artists', filters: false },
  playlists: { title: 'Playlists', kind: 'playlists', filters: false },
}

export default function Browse() {
  const { section } = useParams()
  const navigate = useNavigate()
  const cfg = SECTIONS[section] || SECTIONS.trending

  const { data: allTracks, loading: tLoading } = useLiveShared('tracks', { order: '-createdAt', limit: 500 })
  const { data: albums, loading: aLoading } = useLiveShared('albums', { order: '-createdAt', limit: 200 })
  const { data: playlists, loading: pLoading } = useLiveShared('playlists', { order: '-createdAt', limit: 200 })
  const { isFollowing } = useFollows()

  const [history, setHistory] = useState([])
  const [visible, setVisible] = useState(PAGE)
  const [filters, setFilters] = useState({ genre: '', language: '', mood: '', duration: '', sort: cfg.kind === 'songs' ? (section === 'trending' ? 'popularity' : section === 'new' ? 'newest' : 'relevance') : '' })
  const sentinelRef = useRef(null)

  useEffect(() => { setVisible(PAGE) }, [section, filters])

  useEffect(() => {
    if (!auth.isAuthenticated()) return
    db.select('history', {}, { limit: 200, order: '-createdAt' }).then(setHistory).catch(() => {})
  }, [])

  const songs = useMemo(() => (allTracks || []).filter(isPublicVisible).filter((t) => t.type !== 'podcast'), [allTracks])

  // Content-based recommendation: score public tracks by affinity to the user's
  // real listening history (genre/language/artist) + followed artists, minus
  // tracks already heavily played, with popularity as a tiebreaker.
  const recommended = useMemo(() => {
    const genreW = {}, langW = {}, artistW = {}, played = {}
    for (const h of history) {
      played[h.trackId] = (played[h.trackId] || 0) + 1
      const src = songs.find((s) => s.id === h.trackId)
      if (!src) continue
      if (src.genre) genreW[src.genre.toLowerCase()] = (genreW[src.genre.toLowerCase()] || 0) + 1
      if (src.language) langW[src.language.toLowerCase()] = (langW[src.language.toLowerCase()] || 0) + 1
      if (src.artistId) artistW[src.artistId] = (artistW[src.artistId] || 0) + 1
    }
    const hasSignal = Object.keys(genreW).length || Object.keys(artistW).length
    const scored = songs.map((t) => {
      let score = 0
      if (t.genre && genreW[t.genre.toLowerCase()]) score += genreW[t.genre.toLowerCase()] * 3
      if (t.language && langW[t.language.toLowerCase()]) score += langW[t.language.toLowerCase()] * 1.5
      if (t.artistId && artistW[t.artistId]) score += artistW[t.artistId] * 4
      if (t.artistId && isFollowing(t.artistId)) score += 5
      score += Math.min((t.plays || 0) / 50, 4)
      if (played[t.id]) score -= played[t.id] * 2
      return { t, score }
    })
    if (!hasSignal) return [...songs].sort((a, b) => (b.plays || 0) - (a.plays || 0))
    return scored.sort((a, b) => b.score - a.score).map((x) => x.t)
  }, [songs, history, isFollowing])

  const recentDedup = useMemo(() => {
    const seen = new Set(); const out = []
    for (const h of history) { if (seen.has(h.trackId)) continue; seen.add(h.trackId); const t = songs.find((s) => s.id === h.trackId); if (t) out.push(t) }
    return out
  }, [history, songs])

  const publicPlaylists = useMemo(() => (playlists || []).filter((p) => !p.visibility || p.visibility === 'public'), [playlists])

  const artists = useMemo(() => {
    const map = new Map()
    for (const t of songs) {
      if (!t.artistId) continue
      const cur = map.get(t.artistId) || { id: t.artistId, name: t.artistName, avatarUrl: t.artistAvatar, plays: 0, count: 0 }
      cur.plays += t.plays || 0; cur.count += 1
      map.set(t.artistId, cur)
    }
    return [...map.values()].sort((a, b) => b.plays - a.plays)
  }, [songs])

  let baseList = []
  if (cfg.kind === 'songs') {
    if (section === 'trending') baseList = [...songs].sort((a, b) => (b.plays || 0) - (a.plays || 0))
    else if (section === 'new') baseList = [...songs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (section === 'recommended') baseList = recommended
    else if (section === 'recent') baseList = recentDedup
    else baseList = songs
  } else if (cfg.kind === 'albums') baseList = albums || []
  else if (cfg.kind === 'artists') baseList = artists
  else if (cfg.kind === 'playlists') baseList = publicPlaylists

  const filtered = useMemo(() => {
    if (cfg.kind !== 'songs') return baseList
    let list = [...baseList]
    if (filters.genre) list = list.filter((t) => (t.genre || '').toLowerCase() === filters.genre.toLowerCase())
    if (filters.language) list = list.filter((t) => (t.language || '').toLowerCase() === filters.language.toLowerCase())
    if (filters.mood) list = list.filter((t) => (t.mood || '').toLowerCase() === filters.mood.toLowerCase())
    if (filters.duration === 'short') list = list.filter((t) => (t.duration || 0) < 180)
    if (filters.duration === 'medium') list = list.filter((t) => (t.duration || 0) >= 180 && (t.duration || 0) <= 360)
    if (filters.duration === 'long') list = list.filter((t) => (t.duration || 0) > 360)
    if (filters.sort === 'popularity') list.sort((a, b) => (b.plays || 0) - (a.plays || 0))
    else if (filters.sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (filters.sort === 'az') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    return list
  }, [baseList, filters, cfg.kind])

  const shown = filtered.slice(0, visible)
  const loading = tLoading || aLoading || pLoading

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => (v < filtered.length ? v + PAGE : v))
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length])

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5 sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-[rgb(var(--color-bg))]/80 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/60"><BackIcon size={22} /></button>
        <h1 className="font-display font-bold text-xl text-white flex-1 truncate">{cfg.title}</h1>
        {!loading && <span className="text-xs text-white/30">{filtered.length}</span>}
      </div>

      {cfg.filters && (
        <div className="space-y-3 mb-5">
          <ChipRow value={filters.sort} onChange={(v) => setFilters((f) => ({ ...f, sort: v }))} options={['relevance', 'popularity', 'newest', 'az']} labels={{ relevance: 'Best match', popularity: 'Most played', newest: 'Newest', az: 'A–Z' }} allowClear={false} />
          <ChipRow value={filters.genre} onChange={(v) => setFilters((f) => ({ ...f, genre: v }))} options={GENRE_SUGGESTIONS} placeholder="Genre" />
          <ChipRow value={filters.language} onChange={(v) => setFilters((f) => ({ ...f, language: v }))} options={LANGUAGE_SUGGESTIONS} placeholder="Language" />
          <ChipRow value={filters.duration} onChange={(v) => setFilters((f) => ({ ...f, duration: v }))} options={['short', 'medium', 'long']} labels={{ short: '< 3 min', medium: '3–6 min', long: '> 6 min' }} placeholder="Length" />
        </div>
      )}

      {loading && shown.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse"><div className="aspect-square rounded-2xl bg-white/5" /><div className="h-3 w-3/4 mt-2 rounded bg-white/5" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<SearchIcon size={24} className="grad-brand-text" />} title="Nothing here yet" subtitle={cfg.kind === 'songs' ? 'Try clearing filters, or check back as the community uploads more.' : 'Check back soon.'} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
            {cfg.kind === 'songs' && shown.map((t) => <SongCell key={t.id} track={t} queue={filtered} />)}
            {cfg.kind === 'albums' && shown.map((a) => (
              <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="text-left group">
                <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm font-medium text-white truncate">{a.title}</p>
                <p className="text-xs text-white/40 truncate">{a.artistName}</p>
              </button>
            ))}
            {cfg.kind === 'playlists' && shown.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left group">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-white/40 truncate">By {p.ownerName || 'MiLey user'}</p>
              </button>
            ))}
            {cfg.kind === 'artists' && shown.map((ar) => (
              <button key={ar.id} onClick={() => navigate(`/artist/${ar.id}`)} className="flex flex-col items-center text-center group">
                <div className="w-full aspect-square rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center">
                  {ar.avatarUrl ? <img src={ar.avatarUrl} alt={ar.name} className="w-full h-full object-cover" /> : <span className="font-display font-bold text-2xl text-white/70">{(ar.name || '?')[0]}</span>}
                </div>
                <p className="mt-2 text-sm font-medium text-white truncate w-full">{ar.name}</p>
                <p className="text-xs text-white/40 truncate w-full">{ar.count} track{ar.count === 1 ? '' : 's'}</p>
              </button>
            ))}
          </div>
          {visible < filtered.length && <div ref={sentinelRef} className="h-16 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" /></div>}
        </>
      )}
    </div>
  )
}

function SongCell({ track, queue }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const isCurrent = currentTrack?.id === track.id
  const onPlay = () => { if (isCurrent) togglePlay(); else playTrack(track, queue) }
  return (
    <button onClick={onPlay} className="text-left group">
      <div className="relative aspect-square">
        <Cover track={track} size="fill" rounded="rounded-2xl" />
        <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full btn-brand flex items-center justify-center opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity shadow-lg">
          {isCurrent && isPlaying ? <PauseIcon size={16} color="#0B0B0B" /> : <PlayIcon size={16} color="#0B0B0B" />}
        </div>
      </div>
      <p className={`mt-2 text-sm font-medium truncate ${isCurrent ? 'grad-brand-text' : 'text-white'}`}>{track.title}</p>
      <p className="text-xs text-white/40 truncate">{track.artistName}</p>
    </button>
  )
}

function ChipRow({ value, onChange, options, labels, placeholder, allowClear = true }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
      {allowClear && <button onClick={() => onChange('')} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${!value ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>{placeholder || 'Any'}</button>}
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${value === o ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>
          {labels?.[o] || o}
        </button>
      ))}
    </div>
  )
}
