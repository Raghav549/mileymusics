import { usePlayer } from '../context/PlayerContext'
import { Cover } from './TrackViews'
import { PlayIcon, PauseIcon, NextIcon } from './icons'

// Shown on immersive screens (Chat, Premiere) INSTEAD of the bottom mini player,
// so music never covers the message input. A spinning vinyl disc in the top-right
// that opens the full music control panel.
export function FloatingDisc() {
  const { currentTrack, isPlaying, openFullPlayer } = usePlayer()
  if (!currentTrack) return null
  return (
    <button
      onClick={openFullPlayer}
      aria-label="Open player"
      className="fixed z-30 right-3 top-[calc(env(safe-area-inset-top,0px)+3.75rem)] w-14 h-14 rounded-full shadow-2xl overflow-hidden border border-white/15 active:scale-95 transition-transform"
    >
      <div className={`w-full h-full ${isPlaying ? 'animate-spin-disc' : ''}`}>
        <Cover track={currentTrack} size="fill" rounded="rounded-full" />
      </div>
      <span className="absolute inset-0 rounded-full ring-2 ring-black/50 pointer-events-none" />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-black/85 border border-white/25 pointer-events-none" />
    </button>
  )
}

export default function MiniPlayer({ bottomOffsetClass }) {
  const { currentTrack, isPlaying, togglePlay, next, openFullPlayer, currentTime, duration } = usePlayer()
  if (!currentTrack) return null
  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className={`fixed left-0 right-0 z-20 px-3 ${bottomOffsetClass}`}>
      <button
        onClick={openFullPlayer}
        className="w-full max-w-3xl mx-auto flex items-center gap-3 card-surface backdrop-blur-xl rounded-2xl px-3 py-2.5 shadow-2xl relative overflow-hidden active:scale-[0.99] transition-transform"
      >
        <div className="absolute bottom-0 left-0 h-0.5 grad-brand" style={{ width: `${pct}%` }} />
        <Cover track={currentTrack} size={42} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-white/40 truncate">{currentTrack.artistName}</p>
        </div>
        <div
          role="button"
          onClick={(e) => { e.stopPropagation(); togglePlay() }}
          className="w-9 h-9 rounded-full btn-brand flex items-center justify-center shrink-0"
        >
          {isPlaying ? <PauseIcon size={16} color="#0B0B0B" /> : <PlayIcon size={16} color="#0B0B0B" />}
        </div>
        <div
          role="button"
          onClick={(e) => { e.stopPropagation(); next() }}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white/60"
        >
          <NextIcon size={18} />
        </div>
      </button>
    </div>
  )
}
