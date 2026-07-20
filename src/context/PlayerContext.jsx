import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { requireAuth } from '../authGate'
import { offlineDownloads } from '../offlineDownloads'
import { isPublicVisible } from '../musicHelpers'

const PlayerContext = createContext(null)

export function usePlayer() {
  return useContext(PlayerContext)
}

const EQ_FREQS = [60, 250, 1000, 4000, 12000]

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const filtersRef = useRef([])
  const bassFilterRef = useRef(null)

  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off') // off | all | one
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false)
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState(null)
  const [eqBands, setEqBandsState] = useState([0, 0, 0, 0, 0])
  const [bassBoost, setBassBoost] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [autoPlay, setAutoPlay] = useState(() => {
    try { return localStorage.getItem('miley_autoplay') !== '0' } catch (e) { return true }
  })

  const sleepTimeoutRef = useRef(null)
  const sleepIntervalRef = useRef(null)
  const historyLoggedRef = useRef(new Set())
  const queueRef = useRef([])
  const indexRef = useRef(-1)
  const autoPlayRef = useRef(true)

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null

  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { indexRef.current = currentIndex }, [currentIndex])
  useEffect(() => {
    autoPlayRef.current = autoPlay
    try { localStorage.setItem('miley_autoplay', autoPlay ? '1' : '0') } catch (e) {}
  }, [autoPlay])
  const toggleAutoPlay = useCallback(() => setAutoPlay((a) => !a), [])

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
      // Play as high-quality MEDIA (not a communication/voice stream) and keep
      // native pitch so full-bitrate stereo output is preserved.
      try { el.preservesPitch = true } catch {}
      try { el.mozPreservesPitch = true } catch {}
      try { el.webkitPreservesPitch = true } catch {}
      el.setAttribute('x-webkit-airplay', 'allow')
      audioRef.current = el
    }
    return audioRef.current
  }, [])

  const ensureGraph = useCallback(() => {
    const el = ensureAudio()
    if (audioCtxRef.current) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      // Full-quality media playback profile: high sample rate + playback latency
      // hint keeps the graph on the high-fidelity media path (not the voice-call path).
      let ctx
      try {
        ctx = new Ctx({ latencyHint: 'playback', sampleRate: 48000 })
      } catch {
        ctx = new Ctx()
      }
      const source = ctx.createMediaElementSource(el)
      const filters = EQ_FREQS.map((f) => {
        const filt = ctx.createBiquadFilter()
        filt.type = 'peaking'
        filt.frequency.value = f
        filt.Q.value = 1
        filt.gain.value = 0
        return filt
      })
      const bass = ctx.createBiquadFilter()
      bass.type = 'lowshelf'
      bass.frequency.value = 120
      bass.gain.value = 0
      let node = source
      filters.forEach((f) => { node.connect(f); node = f })
      node.connect(bass)
      bass.connect(ctx.destination)
      audioCtxRef.current = ctx
      sourceNodeRef.current = source
      filtersRef.current = filters
      bassFilterRef.current = bass
    } catch (e) {
      // Web Audio graph unavailable — playback still works without EQ
    }
  }, [ensureAudio])

  useEffect(() => { offlineDownloads.init() }, [])

  // Returning from background can leave the Web Audio graph suspended, which
  // makes the element advance silently. Resume it whenever the app is visible.
  useEffect(() => {
    const resumeCtx = () => {
      if (document.visibilityState === 'visible') {
        const ctx = audioCtxRef.current
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', resumeCtx)
    window.addEventListener('focus', resumeCtx)
    return () => {
      document.removeEventListener('visibilitychange', resumeCtx)
      window.removeEventListener('focus', resumeCtx)
    }
  }, [])

  useEffect(() => {
    const el = ensureAudio()
    const onTime = () => {
      setCurrentTime(el.currentTime)
      if ('mediaSession' in navigator && el.duration && isFinite(el.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: el.duration,
            playbackRate: el.playbackRate || 1,
            position: Math.min(el.currentTime, el.duration),
          })
        } catch (e) {}
      }
    }
    const onDur = () => setDuration(el.duration || 0)
    const onEnd = () => handleEndedRef.current && handleEndedRef.current()
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onDur)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('waiting', onWaiting)
    el.addEventListener('playing', onPlaying)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onDur)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('playing', onPlaying)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEndedRef = useRef(null)

  const playIndex = useCallback((list, idx) => {
    const track = list[idx]
    if (!track) return
    const el = ensureAudio()
    ensureGraph()
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    el.src = offlineDownloads.getOfflineUrl(track.id) || track.audioUrl
    el.playbackRate = playbackRate
    el.volume = volume
    el.play().catch(() => {})
    setCurrentIndex(idx)
    // fire-and-forget play count + history (best effort, ignore failures)
    const key = track.id
    if (key && !historyLoggedRef.current.has(key + Date.now().toString().slice(0, 5))) {
      historyLoggedRef.current.add(key)
      db.incrementShared('tracks', key, 'plays').catch(() => {})
      if (auth.isAuthenticated()) {
        db.insert('history', {
          trackId: key, playedAt: new Date().toISOString(), title: track.title,
          artistName: track.artistName, coverUrl: track.coverUrl, audioUrl: track.audioUrl,
          duration: track.duration, type: track.type, artistId: track.artistId, genre: track.genre,
        }).catch(() => {})
      }
    }
  }, [ensureAudio, ensureGraph, playbackRate, volume])

  // Auto Play: when the queue runs out, pull related/recommended tracks from the
  // real backend (same genre first, then most-played recent) and extend the queue
  // so playback never stops unexpectedly after a few songs.
  const fetchContinuation = useCallback(async (existing) => {
    try {
      const have = new Set(existing.map((t) => t.id))
      const seed = existing[existing.length - 1] || {}
      let pool = []
      if (seed.genre) {
        pool = await db.selectShared('tracks', { genre: seed.genre }, { order: '-createdAt', limit: 80 })
      }
      if (pool.length < 8) {
        const recent = await db.selectShared('tracks', {}, { order: '-createdAt', limit: 100 })
        const ids = new Set(pool.map((t) => t.id))
        pool = [...pool, ...recent.filter((t) => !ids.has(t.id))]
      }
      const playable = pool.filter(isPublicVisible).filter((t) => t.audioUrl && !have.has(t.id))
      playable.sort((a, b) => (b.plays || 0) - (a.plays || 0))
      const top = playable.slice(0, 40)
      for (let i = top.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[top[i], top[j]] = [top[j], top[i]]
      }
      return top.slice(0, 20)
    } catch (e) {
      return []
    }
  }, [])

  const next = useCallback(async (isAuto = false) => {
    const q = queueRef.current
    const idx = indexRef.current
    if (q.length === 0) return
    if (shuffle && q.length > 1) {
      let n
      do { n = Math.floor(Math.random() * q.length) } while (n === idx)
      playIndex(q, n)
      return
    }
    const n = idx + 1
    if (n < q.length) { playIndex(q, n); return }
    // reached the end of the queue
    if (repeatMode === 'all' && q.length > 0) { playIndex(q, 0); return }
    if (autoPlayRef.current) {
      const more = await fetchContinuation(q)
      if (more.length) {
        const merged = [...q, ...more]
        queueRef.current = merged
        setQueue(merged)
        playIndex(merged, q.length)
        return
      }
    }
    if (isAuto) setIsPlaying(false)
  }, [shuffle, repeatMode, playIndex, fetchContinuation])

  const prev = useCallback(() => {
    const q = queueRef.current
    const idx = indexRef.current
    const el = audioRef.current
    if (el && el.currentTime > 3) { el.currentTime = 0; return }
    let prevIdx = idx - 1
    if (prevIdx < 0) prevIdx = repeatMode === 'all' ? q.length - 1 : 0
    playIndex(q, prevIdx)
  }, [repeatMode, playIndex])

  useEffect(() => {
    handleEndedRef.current = () => {
      if (repeatMode === 'one') {
        const el = audioRef.current
        if (el) { el.currentTime = 0; el.play().catch(() => {}) }
        return
      }
      next(true)
    }
  }, [repeatMode, next])

  const playQueue = useCallback(async (list, startIndex = 0) => {
    if (!(await requireAuth('play'))) return
    queueRef.current = list
    setQueue(list)
    playIndex(list, startIndex)
  }, [playIndex])

  const playTrack = useCallback(async (track, contextList) => {
    if (!(await requireAuth('play'))) return
    const list = contextList && contextList.length ? contextList : [track]
    const idx = list.findIndex((t) => t.id === track.id)
    playQueue(list, idx >= 0 ? idx : 0)
  }, [playQueue])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !currentTrack) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }, [currentTrack])

  const seek = useCallback((t) => {
    const el = audioRef.current
    if (el) el.currentTime = t
    setCurrentTime(t)
  }, [])

  const setVolume = useCallback((v) => {
    setVolumeState(v)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  const setPlaybackRate = useCallback((r) => {
    setPlaybackRateState(r)
    if (audioRef.current) audioRef.current.playbackRate = r
  }, [])

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), [])
  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
  }, [])

  const addToQueueNext = useCallback((track) => {
    setQueue((q) => {
      const copy = [...q]
      copy.splice(currentIndex + 1, 0, track)
      return copy
    })
  }, [currentIndex])

  const addToQueueEnd = useCallback((track) => {
    setQueue((q) => [...q, track])
  }, [])

  const removeFromQueue = useCallback((idx) => {
    setQueue((q) => q.filter((_, i) => i !== idx))
    setCurrentIndex((ci) => (idx < ci ? ci - 1 : ci))
  }, [])

  const setEqBand = useCallback((i, val) => {
    setEqBandsState((bands) => {
      const copy = [...bands]
      copy[i] = val
      return copy
    })
    if (filtersRef.current[i]) filtersRef.current[i].gain.value = val
  }, [])

  const toggleBassBoostFn = useCallback(() => {
    setBassBoost((b) => {
      const nb = !b
      if (bassFilterRef.current) bassFilterRef.current.gain.value = nb ? 8 : 0
      return nb
    })
  }, [])

  const clearSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current)
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current)
    sleepTimeoutRef.current = null
    sleepIntervalRef.current = null
    setSleepMinutesLeft(null)
  }, [])

  const setSleepTimer = useCallback((minutes) => {
    clearSleepTimer()
    if (!minutes) return
    setSleepMinutesLeft(minutes)
    sleepIntervalRef.current = setInterval(() => {
      setSleepMinutesLeft((m) => (m && m > 0 ? m - 1 : m))
    }, 60000)
    sleepTimeoutRef.current = setTimeout(() => {
      const el = audioRef.current
      if (el) el.pause()
      clearSleepTimer()
    }, minutes * 60000)
  }, [clearSleepTimer])

  // Media Session API — lock-screen + notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentTrack) return
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artistName,
      album: currentTrack.albumTitle || 'MiLey',
      artwork: currentTrack.coverUrl ? [
        { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/png' },
      ] : [],
    })
    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    navigator.mediaSession.setActionHandler('nexttrack', () => next())
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime)
    })
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [currentTrack, isPlaying, togglePlay, prev, next, seek])

  const value = {
    queue, currentIndex, currentTrack, isPlaying, currentTime, duration, volume, playbackRate,
    shuffle, repeatMode, fullPlayerOpen, sleepMinutesLeft, eqBands, bassBoost, buffering,
    autoPlay, toggleAutoPlay,
    playTrack, playQueue, togglePlay, next, prev, seek, setVolume, setPlaybackRate,
    toggleShuffle, cycleRepeat, addToQueueNext, addToQueueEnd, removeFromQueue,
    openFullPlayer: () => setFullPlayerOpen(true),
    closeFullPlayer: () => setFullPlayerOpen(false),
    setSleepTimer, clearSleepTimer, setEqBand, toggleBassBoost: toggleBassBoostFn,
  }

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}
