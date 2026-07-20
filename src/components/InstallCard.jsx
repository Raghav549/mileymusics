import { useEffect, useState } from 'react'
import { Download, Share, Plus, X, Check } from 'lucide-react'
import { push } from '../lib/push'
import Logo from './Logo'

const DISMISS_KEY = 'miley_install_dismissed_until'
const DISMISS_DAYS = 30

function dismissedRecently() {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return until > Date.now()
  } catch { return false }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5))
  } catch { /* ignore */ }
}

export default function InstallCard() {
  const [show, setShow] = useState(false)
  const [iosGuide, setIosGuide] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Already installed → never show.
    if (push.isInstalled()) return
    if (dismissedRecently()) return

    const isIOS = push.isIOS()
    let timer = null

    const reveal = () => {
      // Show after a short delay so it never blocks first paint.
      timer = setTimeout(() => setShow(true), 2600)
    }

    if (isIOS) {
      // iOS has no beforeinstallprompt — offer the Add to Home Screen guide.
      reveal()
    } else if (push.canInstall()) {
      reveal()
    } else {
      // Wait for the browser to fire beforeinstallprompt, then reveal.
      const onReady = () => { if (!dismissedRecently() && !push.isInstalled()) reveal() }
      window.addEventListener('beforeinstallprompt', onReady)
      // Also poll briefly in case the event already fired before mount.
      const poll = setInterval(() => {
        if (push.canInstall()) { clearInterval(poll); onReady() }
      }, 800)
      setTimeout(() => clearInterval(poll), 8000)
      return () => { window.removeEventListener('beforeinstallprompt', onReady); clearInterval(poll); if (timer) clearTimeout(timer) }
    }
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  const close = () => { setShow(false); setIosGuide(false); rememberDismiss() }

  const install = async () => {
    if (push.isIOS()) { setIosGuide(true); return }
    const result = await push.promptInstall()
    if (result === 'accepted') {
      setDone(true)
      setTimeout(() => setShow(false), 1400)
    } else if (result === 'unavailable') {
      setIosGuide(true) // fall back to manual guidance
    } else {
      close()
    }
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pointer-events-none"
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-3xl p-5 animate-sheet-up relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(32,32,36,0.96), rgba(14,14,16,0.97))',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="absolute -top-16 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,224,168,0.22), transparent 70%)' }}
        />
        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white bg-white/5"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        {done ? (
          <div className="flex items-center gap-3 py-2 relative">
            <div className="w-11 h-11 rounded-2xl bg-secondary/20 flex items-center justify-center">
              <Check size={22} className="text-secondary" />
            </div>
            <div>
              <p className="font-display font-semibold text-white">Installing MiLey…</p>
              <p className="text-white/45 text-sm">Find it on your home screen.</p>
            </div>
          </div>
        ) : iosGuide ? (
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Logo size={30} showWordmark={false} />
              <p className="font-display font-bold text-white text-lg">Install MiLey</p>
            </div>
            <p className="text-white/50 text-sm mb-4">Add MiLey to your home screen in two taps:</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">1</span>
                <span className="flex items-center gap-1.5">Tap the <Share size={15} className="inline text-secondary" /> Share button in Safari</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">2</span>
                <span className="flex items-center gap-1.5">Choose <Plus size={15} className="inline text-secondary" /> Add to Home Screen</span>
              </div>
            </div>
            <button onClick={close} className="w-full mt-5 bg-white/5 border border-white/10 text-white/70 font-medium py-3 rounded-2xl text-sm">Got it</button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-3">
              <Logo size={38} showWordmark={false} />
              <div className="min-w-0">
                <p className="font-display font-bold text-white text-lg leading-tight">Install MiLey</p>
                <p className="text-white/45 text-[13px] leading-snug mt-0.5">Install MiLey for faster launch, offline support and a native app experience.</p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={install}
                className="flex-1 flex items-center justify-center gap-2 btn-brand text-black font-semibold py-3 rounded-2xl text-sm active:scale-[0.98] transition-transform"
              >
                <Download size={17} /> Install Now
              </button>
              <button
                onClick={close}
                className="px-4 bg-white/5 border border-white/10 text-white/60 font-medium py-3 rounded-2xl text-sm"
              >
                Continue in Browser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
