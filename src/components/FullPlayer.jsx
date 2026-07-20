import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { useLikes } from '../hooks/useLikes'
import { Cover } from './TrackViews'
import LyricsView from './LyricsView'
import {
  ChevronDownIcon, PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon,
  RepeatOneIcon, HeartIcon, ShareIcon, QueueIcon, LyricsIcon, SlidersIcon, TimerIcon,
  SpeedIcon, CloseIcon, DownloadIcon, MoreIcon,
} from './icons'
import { formatDuration } from '../musicHelpers'
import { shareBase } from '../shareBase'
import DownloadButton from './DownloadButton'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SLEEP_OPTIONS = [5, 15, 30, 45, 60]

export default function FullPlayer() {
  const player = usePlayer()
  const {
    currentTrack, isPlaying, togglePlay, next, prev, seek, currentTime, duration,
    shuffle, toggleShuffle, repeatMode, cycleRepeat, closeFullPlayer, queue, currentIndex,
    playQueue, removeFromQueue, playbackRate, setPlaybackRate, sleepMinutesLeft, setSleepTimer,
    eqBands, setEqBand, bassBoost, toggleBassBoost, buffering, autoPlay, toggleAutoPlay,
  } = player
  const { isLiked, toggleLike } = useLikes()
  const [tab, setTab] = useState('lyrics') // lyrics | queue
  const [showEq, setShowEq] = useState(false)
  const [showSpeed, setShowSpeed] = useState(false)
  const [showSleep, setShowSleep] = useState(false)

  if (!currentTrack) return null
  const liked = isLiked(currentTrack.id)
  const pct = duration ? (currentTime / duration) * 100 : 0

  const handleShare = async () => {
    const url = `${shareBase()}/#/`
    if (navigator.share) {
      try { await navigator.share({ title: currentTrack.title, text: `Listen to ${currentTrack.title} by ${currentTrack.artistName} on MiLey`, url }) } catch (e) {}
    } else {
      try { await navigator.clipboard.writeText(url) } catch (e) {}
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-[#0B0B0B] flex flex-col"
      style={{ height: 'var(--visual-height, 100dvh)' }}
    >
      <div className="absolute inset-0 opacity-25 blur-3xl scale-125 pointer-events-none">
        <Cover track={currentTrack} size="fill" rounded="" />
      </div>
      <div className="relative flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar px-5 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-6">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <button onClick={closeFullPlayer} className="p-2 -ml-2 text-white/70"><ChevronDownIcon size={24} /></button>
          <p className="text-xs tracking-widest text-white/40 uppercase">{currentTrack.type === 'podcast' ? 'Now Playing Podcast' : 'Now Playing'}</p>
          <button onClick={handleShare} className="p-2 -mr-2 text-white/70"><ShareIcon size={20} /></button>
        </div>

        {tab === 'lyrics' && (
          <div className="flex-1 flex flex-col">
            <div className="w-full max-w-xs mx-auto aspect-square mb-6 shrink-0">
              <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
                <Cover track={currentTrack} size="fill" rounded="" />
                {buffering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
              <div className="min-w-0">
                <h1 className="font-display font-bold text-xl text-white truncate">{currentTrack.title}</h1>
                <p className="text-sm text-white/40 truncate">{currentTrack.artistName}</p>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <button onClick={() => toggleLike(currentTrack)} className="p-2">
                  <HeartIcon size={24} filled={liked} color={liked ? 'rgb(var(--color-secondary))' : '#ffffff99'} />
                </button>
                <DownloadButton track={currentTrack} iconOnly />
              </div>
            </div>

            <LyricsView lyrics={currentTrack.lyrics} currentTime={currentTime} />
          </div>
        )}

        {tab === 'queue' && (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-white/40">UP NEXT ({Math.max(queue.length - currentIndex - 1, 0)})</p>
              <button onClick={toggleAutoPlay} className={`flex items-center gap-2 text-xs font-medium ${autoPlay ? 'grad-brand-text' : 'text-white/40'}`}>
                Autoplay
                <span className={`w-8 h-4 rounded-full relative transition-colors ${autoPlay ? 'bg-emerald-400/40' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoPlay ? 'left-[1.125rem]' : 'left-0.5'}`} />
                </span>
              </button>
            </div>
            <div className="space-y-1">
              {queue.map((t, i) => (
                <div key={t.id + i} className={`flex items-center gap-3 px-2 py-2 rounded-xl ${i === currentIndex ? 'bg-white/5' : ''}`}>
                  <button className="flex-1 flex items-center gap-3 min-w-0 text-left" onClick={() => playQueue(queue, i)}>
                    <Cover track={t} size={40} />
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${i === currentIndex ? 'grad-brand-text font-medium' : 'text-white'}`}>{t.title}</p>
                      <p className="text-xs text-white/40 truncate">{t.artistName}</p>
                    </div>
                  </button>
                  {i !== currentIndex && (
                    <button onClick={() => removeFromQueue(i)} className="p-2 text-white/30"><CloseIcon size={14} /></button>
                  )}
                </div>
              ))}
              {queue.length === 0 && <p className="text-sm text-white/30">Queue is empty.</p>}
            </div>
          </div>
        )}

        <div className="shrink-0 mt-4">
          <input
            type="range" min={0} max={duration || 0} value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-[rgb(var(--color-primary))] h-1"
            style={{ background: `linear-gradient(to right, rgb(var(--color-primary)) ${pct}%, rgba(255,255,255,0.15) ${pct}%)` }}
          />
          <div className="flex justify-between text-[11px] text-white/35 mt-1">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button onClick={toggleShuffle} className={shuffle ? 'grad-brand-text' : 'text-white/50'}><ShuffleIcon size={20} /></button>
            <button onClick={prev} className="text-white"><PrevIcon size={30} /></button>
            <button onClick={togglePlay} className="w-16 h-16 rounded-full btn-brand flex items-center justify-center">
              {isPlaying ? <PauseIcon size={26} color="#0B0B0B" /> : <PlayIcon size={26} color="#0B0B0B" />}
            </button>
            <button onClick={next} className="text-white"><NextIcon size={30} /></button>
            <button onClick={cycleRepeat} className={repeatMode !== 'off' ? 'grad-brand-text' : 'text-white/50'}>
              {repeatMode === 'one' ? <RepeatOneIcon size={20} /> : <RepeatIcon size={20} />}
            </button>
          </div>

          <div className="flex items-center justify-between mt-5 px-1 text-white/50">
            <button onClick={() => setTab(tab === 'lyrics' ? 'queue' : 'lyrics')} className={`p-2 ${tab === 'queue' ? 'grad-brand-text' : ''}`}>
              <QueueIcon size={19} />
            </button>
            <button onClick={() => setShowSpeed(true)} className="p-2 flex items-center gap-1 text-xs font-medium">
              <SpeedIcon size={19} /><span>{playbackRate}x</span>
            </button>
            <button onClick={() => setShowEq(true)} className="p-2"><SlidersIcon size={19} /></button>
            <button onClick={() => setShowSleep(true)} className={`p-2 relative ${sleepMinutesLeft ? 'grad-brand-text' : ''}`}>
              <TimerIcon size={19} />
              {sleepMinutesLeft ? <span className="absolute -top-1 -right-1 text-[9px] bg-black/80 rounded-full px-1">{sleepMinutesLeft}</span> : null}
            </button>
          </div>

        </div>
      </div>

      {showSpeed && (
        <Sheet onClose={() => setShowSpeed(false)} title="Playback Speed">
          <div className="grid grid-cols-4 gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => { setPlaybackRate(s); setShowSpeed(false) }}
                className={`py-2.5 rounded-xl text-sm font-medium ${playbackRate === s ? 'btn-brand text-black' : 'card-surface text-white/70'}`}
              >{s}x</button>
            ))}
          </div>
        </Sheet>
      )}

      {showSleep && (
        <Sheet onClose={() => setShowSleep(false)} title="Sleep Timer">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => { setSleepTimer(null); setShowSleep(false) }} className={`py-2.5 rounded-xl text-sm font-medium ${!sleepMinutesLeft ? 'btn-brand text-black' : 'card-surface text-white/70'}`}>Off</button>
            {SLEEP_OPTIONS.map((m) => (
              <button key={m} onClick={() => { setSleepTimer(m); setShowSleep(false) }} className="py-2.5 rounded-xl text-sm font-medium card-surface text-white/70">{m}m</button>
            ))}
          </div>
        </Sheet>
      )}

      {showEq && (
        <Sheet onClose={() => setShowEq(false)} title="Equalizer">
          <div className="flex items-end justify-between gap-2 h-40 mb-4 px-2">
            {eqBands.map((val, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <input
                  type="range" min={-12} max={12} step={1} value={val}
                  onChange={(e) => setEqBand(i, Number(e.target.value))}
                  className="eq-slider accent-[rgb(var(--color-primary))]"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px', width: '18px' }}
                />
                <span className="text-[10px] text-white/40">{['60', '250', '1K', '4K', '12K'][i]}</span>
              </div>
            ))}
          </div>
          <button
            onClick={toggleBassBoost}
            className={`w-full py-2.5 rounded-xl text-sm font-medium ${bassBoost ? 'btn-brand text-black' : 'card-surface text-white/70'}`}
          >
            Bass Boost {bassBoost ? 'On' : 'Off'}
          </button>
        </Sheet>
      )}
    </div>
  )
}

function Sheet({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
      style={{ height: 'var(--visual-height, 100dvh)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#141414] rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] animate-sheet-up"
        style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)', overflowY: 'auto' }}
      >
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
