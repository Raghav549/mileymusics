import { useState } from 'react'
import { useTrackDownload } from '../hooks/useDownloads'
import { DownloadIcon, CheckIcon, CloseIcon, PauseIcon, PlayIcon, TrashIcon } from './icons'

// Premium "Download for offline" control.
// States: idle → downloading (progress + pause/cancel) → paused → downloaded.
export default function DownloadButton({ track, compact = false, iconOnly = false }) {
  const { downloaded, active, progress, download, pause, resume, cancel, remove } = useTrackDownload(track?.id)
  const [ripple, setRipple] = useState(0)

  if (!track) return null
  const pct = Math.round(progress * 100)
  const errored = active && active.status === 'error'

  const fireRipple = () => setRipple((n) => n + 1)

  // Compact icon control — grouped with the Like button in the player actions.
  if (iconOnly) {
    if (errored) {
      return (
        <button
          onClick={() => { fireRipple(); download(track) }}
          title={active.error || 'Download failed — tap to retry'}
          className="relative overflow-hidden w-9 h-9 rounded-full flex items-center justify-center bg-red-500/15 border border-red-400/50 text-red-300 active:scale-90 transition"
        >
          {ripple > 0 && <span key={ripple} className="download-ripple" />}
          <DownloadIcon size={15} color="currentColor" />
        </button>
      )
    }
    if (downloaded) {
      return (
        <button
          onClick={() => remove(track.id)}
          title="Downloaded — tap to remove"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 active:scale-90 transition"
        >
          <CheckIcon size={16} />
        </button>
      )
    }
    if (active && (active.status === 'downloading' || active.status === 'paused')) {
      const paused = active.status === 'paused'
      const R = 15
      const C = 2 * Math.PI * R
      return (
        <button
          onClick={() => (paused ? resume(track) : pause(track.id))}
          title={`${pct}% — tap to ${paused ? 'resume' : 'pause'}`}
          className="relative w-9 h-9 rounded-full flex items-center justify-center text-emerald-300"
        >
          <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r={R} fill="none" stroke="rgb(52,211,153)" strokeWidth="3"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.2s linear' }}
            />
          </svg>
          {paused ? <PlayIcon size={13} color="currentColor" /> : <span className="text-[9px] font-bold">{pct}</span>}
        </button>
      )
    }
    return (
      <button
        onClick={() => { fireRipple(); download(track) }}
        title="Download for offline"
        className="relative overflow-hidden w-9 h-9 rounded-full flex items-center justify-center bg-emerald-400/12 border border-emerald-400/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)] active:scale-90 transition"
      >
        {ripple > 0 && <span key={ripple} className="download-ripple" />}
        <DownloadIcon size={16} color="currentColor" />
      </button>
    )
  }

  if (downloaded) {
    return (
      <button
        onClick={() => remove(track.id)}
        className="relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-sm w-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300 active:scale-[0.98] transition"
      >
        <CheckIcon size={17} />
        <span>Downloaded · Offline ready</span>
        <TrashIcon size={15} className="ml-1 opacity-60" />
      </button>
    )
  }

  if (active && (active.status === 'downloading' || active.status === 'paused')) {
    const paused = active.status === 'paused'
    return (
      <div className="w-full rounded-2xl overflow-hidden border border-emerald-400/40 bg-emerald-400/5">
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="absolute left-0 top-0 bottom-0 bg-emerald-400/15 transition-all duration-200" style={{ width: `${pct}%` }} />
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">{paused ? 'Paused' : 'Downloading…'} {pct}%</p>
            <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full grad-download rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button onClick={() => (paused ? resume(track) : pause(track.id))} className="relative p-2 text-emerald-300">
            {paused ? <PlayIcon size={16} color="currentColor" /> : <PauseIcon size={16} color="currentColor" />}
          </button>
          <button onClick={() => cancel(track.id)} className="relative p-2 text-white/50"><CloseIcon size={15} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <button
        onClick={() => { fireRipple(); download(track) }}
        className="btn-download relative overflow-hidden flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-sm text-[#04120c] w-full active:scale-[0.98]"
      >
        {ripple > 0 && <span key={ripple} className="download-ripple" />}
        <DownloadIcon size={17} color="#04120c" />
        <span>{errored ? 'Retry Download' : compact ? 'Download' : 'Download for Offline'}</span>
      </button>
      {errored && <p className="mt-2 text-xs text-red-300 text-center">{active.error}</p>}
    </div>
  )
}
