import { useEffect, useState } from 'react'

// Best-effort portrait lock for the whole app.
//
// The real screen.orientation.lock('portrait') API only works in browsers
// that support it AND (per spec) typically only while the page is in
// fullscreen — so it reliably locks on installed Android PWAs but is not
// available at all on iOS Safari (no vendor ships it there). We attempt the
// real lock wherever the browser allows it, and layer a CSS-only fallback
// (a "please rotate back" overlay) for everywhere else — so the app is never
// stuck showing a sideways, rebuilt layout, even where a true lock is
// impossible. The overlay never touches audio/voice state, so music and a
// live listening party keep running underneath while it's shown.
export function usePortraitLock() {
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
  )

  useEffect(() => {
    const tryLock = () => {
      try {
        const o = screen.orientation
        if (o && typeof o.lock === 'function') {
          o.lock('portrait').catch(() => { /* not supported / not fullscreen — fallback overlay covers it */ })
        }
      } catch { /* orientation API unavailable — fallback overlay covers it */ }
    }
    tryLock()

    const update = () => setIsLandscape(window.innerWidth > window.innerHeight)
    update()

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', () => { update(); tryLock() })
    screen.orientation?.addEventListener?.('change', () => { update(); tryLock() })

    return () => {
      window.removeEventListener('resize', update)
    }
  }, [])

  return isLandscape
}

// Overlay shown while the device is physically rotated to landscape on a
// browser that can't be forced back to portrait. Keeps audio/voice alive.
export function LandscapeGuard({ active }) {
  if (!active) return null
  return (
    <div className="fixed inset-0 z-[999] bg-[#0B0B0B] flex flex-col items-center justify-center gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-2xl border-2 border-white/25 flex items-center justify-center animate-[rotateHint_1.6s_ease-in-out_infinite]">
        <div className="w-7 h-10 rounded-md border-2 border-white/70" />
      </div>
      <p className="font-display font-bold text-lg text-white">Rotate back to portrait</p>
      <p className="text-sm text-white/50 max-w-xs">MiLey is designed for portrait mode. Playback and any active listening party keep running while you rotate your device back.</p>
      <style>{`@keyframes rotateHint { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(90deg); } }`}</style>
    </div>
  )
}
