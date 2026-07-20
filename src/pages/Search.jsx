import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { social } from '../lib/social'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { BackIcon, SearchIcon, MicIcon, FilterIcon, CloseIcon, ChannelIcon, ChartIcon, VerifiedIcon } from '../components/icons'
import { GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS, isPublicVisible } from '../musicHelpers'
import { useLiveShared } from '../lib/useLive'

const RECENT_KEY = 'miley_recent_searches'

// Highlights the part of `text` that matches `query` (case-insensitive, first hit).
function Highlight({ text, query }) {
  const str = text == null ? '' : String(text)
  const term = (query || '').trim()
  if (!term) return <>{str}</>
  const idx = str.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return <>{str}</>
  return (
    <>
      {str.slice(0, idx)}
      <span className="grad-brand-text font-semibold">{str.slice(idx, idx + term.length)}</span>
      {str.slice(idx + term.length)}
    </>
  )
}

export default function Search() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tracks, setTracks] = useState([])
  const [albums, setAlbums] = useState([])
  const [artists, setArtists] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ language: '', genre: '', mood: '', duration: '', sort: 'relevance' })
  const [listening, setListening] = useState(false)
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch (e) { return [] } })
  const debounceRef = useRef(null)
  const recognitionRef = useRef(null)

  const { data: allTracksForTrending } = useLiveShared('tracks', { order: '-plays', limit: 300 })

  const pubTracks = useMemo(() => (allTracksForTrending || []).filter(isPublicVisible), [allTracksForTrending])

  const trendingSearches = useMemo(
    () => [...pubTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 8).map((t) => t.title),
    [pubTracks],
  )

  // "Recommended searches": genres actually present in the catalog, ranked by total plays.
  const recommendedSearches = useMemo(() => {
    const byGenre = {}
    for (const t of pubTracks) {
      const g = (t.genre || '').trim()
      if (!g) continue
      byGenre[g] = (byGenre[g] || 0) + (t.plays || 1)
    }
    return Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g)
  }, [pubTracks])

  const matchedGenres = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return GENRE_SUGGESTIONS.filter((g) => g.toLowerCase().includes(term)).slice(0, 6)
  }, [q])

  const runSearch = (term) => setQ(term)

  const saveRecent = (term) => {
    if (!term.trim()) return
    setRecent((r) => {
      const next = [term, ...r.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 10)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }

  const removeRecent = (term) => {
    setRecent((r) => {
      const next = r.filter((x) => x !== term)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }

  const clearRecent = () => {
    setRecent([])
    try { localStorage.removeItem(RECENT_KEY) } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setTracks([]); setAlbums([]); setArtists([]); setPlaylists([]); setChannels([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const [t, a, p, ar, ch] = await Promise.all([
          db.searchShared('tracks', q, { fields: ['title', 'artistName', 'lyrics', 'genre'], limit: 60 }),
          db.searchShared('albums', q, { fields: ['title', 'artistName'], limit: 20 }),
          db.searchShared('playlists', q, { fields: ['title'], limit: 20 }),
          social.searchUsers(q.trim()).catch(() => []),
          db.searchShared('channels', q, { fields: ['name', 'username'], limit: 20 }),
        ])
        setTracks(t.filter(isPublicVisible))
        setAlbums(a)
        setPlaylists(p.filter((pl) => !pl.visibility || pl.visibility === 'public'))
        setArtists(ar)
        setChannels(ch.filter((c) => c.status === 'approved' || !c.status))
        saveRecent(q.trim())
      } catch (e) { /* ignore */ }
      setLoading(false)
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q])

  const filteredTracks = useMemo(() => {
    let list = [...tracks]
    if (filters.language) list = list.filter((t) => (t.language || '').toLowerCase() === filters.language.toLowerCase())
    if (filters.genre) list = list.filter((t) => (t.genre || '').toLowerCase() === filters.genre.toLowerCase())
    if (filters.mood) list = list.filter((t) => (t.mood || '').toLowerCase() === filters.mood.toLowerCase())
    if (filters.duration === 'short') list = list.filter((t) => (t.duration || 0) < 180)
    if (filters.duration === 'medium') list = list.filter((t) => (t.duration || 0) >= 180 && (t.duration || 0) <= 360)
    if (filters.duration === 'long') list = list.filter((t) => (t.duration || 0) > 360)
    if (filters.sort === 'popularity') list.sort((a, b) => (b.plays || 0) - (a.plays || 0))
    if (filters.sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return list
  }, [tracks, filters])

  const startVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.onresult = (e) => { setQ(e.results[0][0].transcript) }
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    try { rec.start() } catch (e) { /* ignore */ }
  }

  useEffect(() => () => { try { recognitionRef.current?.stop() } catch (e) { /* ignore */ } }, [])

  const hasResults = filteredTracks.length || albums.length || playlists.length || artists.length || channels.length || matchedGenres.length
  const voiceSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-10 max-w-4xl mx-auto w-full overflow-x-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/60 shrink-0"><BackIcon size={22} /></button>
        <div className="flex-1 min-w-0 flex items-center gap-2 card-surface rounded-2xl px-4 py-2.5">
          <SearchIcon size={17} className="text-white/40 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Songs, artists, albums, lyrics…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder-white/30"
          />
          {q && <button onClick={() => setQ('')} className="text-white/30 shrink-0"><CloseIcon size={14} /></button>}
        </div>
        {voiceSupported && (
          <button onClick={startVoiceSearch} className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${listening ? 'btn-brand' : 'card-surface text-white/50'}`}>
            <MicIcon size={18} color={listening ? '#0B0B0B' : undefined} />
          </button>
        )}
        <button onClick={() => setShowFilters((s) => !s)} className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${showFilters ? 'btn-brand' : 'card-surface text-white/50'}`}>
          <FilterIcon size={18} color={showFilters ? '#0B0B0B' : undefined} />
        </button>
      </div>

      {listening && <p className="text-xs grad-brand-text mb-3 animate-pulse">Listening… speak now</p>}

      {showFilters && (
        <div className="card-surface rounded-2xl p-4 mb-5 space-y-3 animate-fade-up">
          <FilterRow label="Language" value={filters.language} options={LANGUAGE_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, language: v }))} />
          <FilterRow label="Genre" value={filters.genre} options={GENRE_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, genre: v }))} />
          <FilterRow label="Mood" value={filters.mood} options={MOOD_SUGGESTIONS} onChange={(v) => setFilters((f) => ({ ...f, mood: v }))} />
          <FilterRow label="Duration" value={filters.duration} options={['short', 'medium', 'long']} labels={{ short: '< 3 min', medium: '3–6 min', long: '> 6 min' }} onChange={(v) => setFilters((f) => ({ ...f, duration: v }))} />
          <FilterRow label="Sort" value={filters.sort} options={['relevance', 'popularity', 'newest']} onChange={(v) => setFilters((f) => ({ ...f, sort: v }))} />
        </div>
      )}

      {/* Empty state — trending / recent / recommended */}
      {!q.trim() && (
        <div className="animate-fade-up">
          {recent.length > 0 && (
            <Section title="Recently Searched" action={<button onClick={clearRecent} className="text-xs text-white/40">Clear all</button>}>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <span key={r} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs bg-white/5 text-white/60">
                    <button onClick={() => runSearch(r)} className="truncate max-w-[10rem]">{r}</button>
                    <button onClick={() => removeRecent(r)} className="text-white/30 hover:text-white/60"><CloseIcon size={11} /></button>
                  </span>
                ))}
              </div>
            </Section>
          )}
          {trendingSearches.length > 0 && (
            <Section title="Trending Searches">
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((r) => (
                  <button key={r} onClick={() => runSearch(r)} className="px-3 py-1.5 rounded-full text-xs card-surface grad-brand-text flex items-center gap-1 max-w-full">
                    <ChartIcon size={11} className="shrink-0" /> <span className="truncate">{r}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {recommendedSearches.length > 0 && (
            <Section title="Recommended For You">
              <div className="flex flex-wrap gap-2">
                {recommendedSearches.map((r) => (
                  <button key={r} onClick={() => runSearch(r)} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/70">{r}</button>
                ))}
              </div>
            </Section>
          )}
          <EmptyState icon={<SearchIcon size={24} className="grad-brand-text" />} title="Find your next favorite" subtitle="Search by track title, artist, album, playlist, channel, or even a lyric line." />
        </div>
      )}

      {/* Loading */}
      {q.trim() && loading && (
        <div className="space-y-2 animate-fade-up">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3 rounded bg-white/5 animate-pulse" style={{ width: `${60 - i * 6}%` }} />
                <div className="h-2.5 rounded bg-white/5 animate-pulse w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {q.trim() && !loading && !hasResults && (
        <EmptyState icon={<SearchIcon size={24} className="grad-brand-text" />} title={`No results for "${q}"`} subtitle="Try a different keyword or check your filters." />
      )}

      {/* Genres */}
      {q.trim() && !loading && matchedGenres.length > 0 && (
        <Section title="Genres">
          <div className="flex flex-wrap gap-2">
            {matchedGenres.map((g) => (
              <button key={g} onClick={() => { setFilters((f) => ({ ...f, genre: g })); setShowFilters(true) }} className="px-3 py-1.5 rounded-full text-xs card-surface text-white/70">
                <Highlight text={g} query={q} />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Artists / users */}
      {q.trim() && !loading && artists.length > 0 && (
        <Section title="Artists">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {artists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/artist/${p.id}`)} className="flex flex-col items-center gap-2 shrink-0 w-20">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                  {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover" /> : <span className="font-display font-bold">{(p.displayName || '?')[0]}</span>}
                </div>
                <span className="text-xs text-white/70 truncate w-full text-center"><Highlight text={p.displayName} query={q} /></span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Songs */}
      {q.trim() && !loading && filteredTracks.length > 0 && (
        <Section title="Songs">
          <div className="space-y-0.5">
            {filteredTracks.map((t) => <TrackRow key={t.id} track={t} queueList={filteredTracks} showMenu={false} titleNode={<Highlight text={t.title} query={q} />} />)}
          </div>
        </Section>
      )}

      {/* Albums */}
      {q.trim() && !loading && albums.length > 0 && (
        <Section title="Albums">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {albums.map((a) => (
              <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="shrink-0 w-32 text-left">
                <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm text-white truncate"><Highlight text={a.title} query={q} /></p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Playlists */}
      {q.trim() && !loading && playlists.length > 0 && (
        <Section title="Playlists">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {playlists.map((p) => (
              <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="shrink-0 w-32 text-left">
                <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                <p className="mt-2 text-sm text-white truncate"><Highlight text={p.title} query={q} /></p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Channels */}
      {q.trim() && !loading && channels.length > 0 && (
        <Section title="Channels">
          <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
            {channels.map((c) => (
              <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="flex flex-col items-center gap-2 shrink-0 w-20">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                  {c.avatarUrl ? <img src={c.avatarUrl} className="w-full h-full object-cover" /> : <ChannelIcon size={18} className="text-white/60" />}
                </div>
                <span className="text-xs text-white/70 truncate w-full text-center flex items-center justify-center gap-0.5">
                  <span className="truncate"><Highlight text={c.name} query={q} /></span>
                  {c.verified && <VerifiedIcon size={11} className="grad-brand-text shrink-0" />}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <section className="mb-7">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-display font-bold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function FilterRow({ label, value, options, labels, onChange }) {
  return (
    <div>
      <p className="text-xs text-white/40 mb-1.5">{label}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain">
        <button onClick={() => onChange('')} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${!value ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>Any</button>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={`px-3 py-1.5 rounded-full text-xs shrink-0 ${value === o ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}>
            {labels?.[o] || o}
          </button>
        ))}
      </div>
    </div>
  )
}
