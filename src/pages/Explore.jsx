import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveShared } from '../lib/useLive'
import { TrackRow } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import { GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS, isPublicVisible } from '../musicHelpers'
import { SearchIcon, CompassIcon, GlobeIcon, ChannelIcon, RoomIcon, CalendarIcon, VerifiedIcon } from '../components/icons'

const TABS = [
  { key: 'genre', label: 'Genres' },
  { key: 'language', label: 'Languages' },
  { key: 'mood', label: 'Moods' },
  { key: 'channels', label: 'Channels' },
]

export default function Explore() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('genre')
  const [active, setActive] = useState(null)
  const { data: categories } = useLiveShared('categories', { limit: 200 })
  const { data: allTracks, loading } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { data: channelsRaw } = useLiveShared('channels', { order: '-createdAt', limit: 100 })
  const channels = (channelsRaw || []).filter((c) => c.status === 'approved' || !c.status)

  const suggestions = tab === 'genre' ? GENRE_SUGGESTIONS : tab === 'language' ? LANGUAGE_SUGGESTIONS : MOOD_SUGGESTIONS

  const list = useMemo(() => {
    const custom = (categories || []).filter((c) => c.type === tab).map((c) => c.name)
    const merged = Array.from(new Set([...suggestions, ...custom]))
    return merged
  }, [categories, tab, suggestions])

  const publicTracks = useMemo(() => (allTracks || []).filter(isPublicVisible), [allTracks])

  const filtered = useMemo(() => {
    if (!active) return []
    return publicTracks.filter((t) => (t[tab] || '').toLowerCase() === active.toLowerCase())
  }, [publicTracks, active, tab])

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5">
        <CompassIcon size={22} className="grad-brand-text" />
        <h1 className="font-display font-bold text-xl text-white">Explore</h1>
      </div>

      <button
        onClick={() => navigate('/search')}
        className="w-full flex items-center gap-3 card-surface rounded-2xl px-4 py-3 mb-4 text-white/40 text-sm"
      >
        <SearchIcon size={17} />
        Search songs, artists, albums, playlists…
      </button>

      <div className="flex gap-2 mb-5">
        <button onClick={() => navigate('/rooms')} className="flex-1 flex items-center justify-center gap-2 card-surface rounded-2xl py-3 text-sm font-medium text-white/70"><RoomIcon size={16} /> Listening Parties</button>
        <button onClick={() => navigate('/premieres')} className="flex-1 flex items-center justify-center gap-2 card-surface rounded-2xl py-3 text-sm font-medium text-white/70"><CalendarIcon size={16} /> Premieres</button>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setActive(null) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === t.key ? 'btn-brand text-black' : 'card-surface text-white/60'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'channels' ? (
        (channels || []).length === 0 ? (
          <EmptyState icon={<ChannelIcon size={24} className="grad-brand-text" />} title="No channels yet" subtitle="Anyone can start a channel from their profile." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
            {(channels || []).map((c) => (
              <button key={c.id} onClick={() => navigate(`/channel/${c.username}`)} className="card-surface rounded-2xl p-4 flex flex-col items-center text-center gap-2">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/30 to-pink-500/30 flex items-center justify-center">
                  {c.avatarUrl ? <img src={c.avatarUrl} className="w-full h-full object-cover" /> : <ChannelIcon size={20} className="text-white/60" />}
                </div>
                <div className="flex items-center gap-1"><span className="text-sm font-medium text-white truncate">{c.name}</span>{c.verified && <VerifiedIcon size={13} className="grad-brand-text" />}</div>
                <span className="text-xs text-white/40">@{c.username}</span>
              </button>
            ))}
          </div>
        )
      ) : !active && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {list.map((name, i) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className="aspect-[2/1] rounded-2xl p-4 flex items-end font-display font-bold text-white text-left relative overflow-hidden card-surface hover:scale-[1.02] transition-transform"
              style={{ background: `linear-gradient(135deg, rgba(0,224,168,${0.1 + (i % 5) * 0.03}), rgba(255,61,174,${0.08 + (i % 4) * 0.03}))` }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg text-white">{active}</h2>
            <button onClick={() => setActive(null)} className="text-xs text-white/40">Back to categories</button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<GlobeIcon size={24} className="grad-brand-text" />}
              title={`No tracks in ${active} yet`}
              subtitle="Once channels tag uploads with this category, they'll show up here."
            />
          ) : (
            <div className="space-y-0.5">
              {filtered.map((t) => <TrackRow key={t.id} track={t} queueList={filtered} showMenu={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
