import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { PlayIcon, PauseIcon, MoreIcon, HeartIcon } from './icons'
import { formatDuration, gradientFor } from '../musicHelpers'

export function Cover({ track, size = 48, rounded = 'rounded-xl' }) {
  const [err, setErr] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fill = size === 'fill'
  const boxStyle = fill ? {} : { width: size, height: size }
  const boxClass = fill ? 'w-full h-full' : ''
  if (!track?.coverUrl || err) {
    return (
      <div
        className={`shrink-0 ${boxClass} ${rounded} bg-gradient-to-br ${gradientFor(track?.title)} flex items-center justify-center border border-white/10`}
        style={boxStyle}
      >
        <span className="text-white/70 font-display font-bold" style={{ fontSize: fill ? '30%' : size * 0.3 }}>
          {(track?.title || '?').slice(0, 1).toUpperCase()}
        </span>
      </div>
    )
  }
  return (
    <div className={`shrink-0 ${boxClass} ${rounded} overflow-hidden border border-white/10 relative`} style={boxStyle}>
      {!loaded && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
      <img
        src={track.coverUrl}
        alt={track.title}
        className="w-full h-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setErr(true)}
      />
    </div>
  )
}

export function TrackRow({ track, queueList, showMenu = true, onOpenMenu, index, titleNode }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const isCurrent = currentTrack?.id === track.id

  const handlePlay = () => {
    if (isCurrent) togglePlay()
    else playTrack(track, queueList)
  }

  return (
    <div className={`flex items-center gap-3 px-2 py-2 rounded-2xl transition-colors ${isCurrent ? 'bg-white/5' : 'hover:bg-white/5'}`}>
      {index != null && (
        <span className="w-5 text-center text-xs text-white/30 shrink-0">{index + 1}</span>
      )}
      <button onClick={handlePlay} className="relative shrink-0">
        <Cover track={track} size={48} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 rounded-xl transition-opacity">
          {isCurrent && isPlaying ? <PauseIcon size={18} color="#fff" /> : <PlayIcon size={18} color="#fff" />}
        </div>
      </button>
      <div className="flex-1 min-w-0" onClick={handlePlay}>
        <p className={`text-sm font-medium truncate ${isCurrent ? 'grad-brand-text' : 'text-white'}`}>{titleNode || track.title}</p>
        <p className="text-xs text-white/40 truncate">{track.artistName}{track.type === 'podcast' ? ' · Podcast' : ''}</p>
      </div>
      <span className="text-xs text-white/30 shrink-0 hidden sm:inline">{formatDuration(track.duration)}</span>
      {showMenu && (
        <button onClick={() => onOpenMenu?.(track)} className="p-2 text-white/40 shrink-0">
          <MoreIcon size={16} />
        </button>
      )}
    </div>
  )
}

export function TrackCard({ track, queueList, wide = false }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer()
  const isCurrent = currentTrack?.id === track.id
  const handlePlay = () => {
    if (isCurrent) togglePlay()
    else playTrack(track, queueList)
  }
  return (
    <button onClick={handlePlay} className={`text-left shrink-0 ${wide ? 'w-44 md:w-52' : 'w-32 md:w-40'} group`}>
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

export function SectionRow({ title, children, onSeeAll }) {
  return (
    <section className="mb-7 animate-fade-up">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-display font-bold text-lg text-white">{title}</h2>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs font-medium text-white/40 hover:text-white/70">See all</button>
        )}
      </div>
      <div className="flex gap-3.5 overflow-x-auto no-scrollbar overscroll-x-contain px-1 pb-1">
        {children}
      </div>
    </section>
  )
}

export function LikeButton({ track, size = 20 }) {
  return null // placeholder retained for API compatibility (real logic lives in useLikes)
}
