import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { Mail, Chrome, UserPlus, X } from 'lucide-react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { isActiveBan } from '../permissions'
import { sendWelcomeOnce } from '../officialDM'
import { _registerAuthGate } from '../authGate'
import Logo from '../components/Logo'

const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(auth.getCurrentUser())
  const [mod, setMod] = useState(null)
  const [modal, setModal] = useState(null) // { reason } | null
  const [busy, setBusy] = useState(false)
  const resolverRef = useRef(null)

  useEffect(() => auth.onAuthChange(setUser), [])

  useEffect(() => {
    if (!user) { setMod(null); return }
    db.getShared('user_moderation', user.id).then(setMod).catch(() => setMod(null))
    sendWelcomeOnce(user)
  }, [user?.id])

  // When the user becomes authenticated while the modal is open, resolve success.
  useEffect(() => {
    if (user && resolverRef.current) {
      resolverRef.current(true)
      resolverRef.current = null
      setModal(null)
      setBusy(false)
    }
  }, [user])

  const openGate = useCallback((reason) => {
    if (auth.isAuthenticated()) return Promise.resolve(true)
    return new Promise((resolve) => {
      // If a previous gate is still pending, resolve it false first.
      if (resolverRef.current) resolverRef.current(false)
      resolverRef.current = resolve
      setModal({ reason: reason || null })
    })
  }, [])

  useEffect(() => { _registerAuthGate(openGate) }, [openGate])

  const doSignIn = async () => {
    setBusy(true)
    try {
      await auth.signIn()
    } finally {
      // onAuthChange effect resolves on success; if dismissed, re-enable.
      if (!auth.isAuthenticated()) setBusy(false)
    }
  }

  const dismiss = () => {
    if (resolverRef.current) { resolverRef.current(false); resolverRef.current = null }
    setModal(null)
    setBusy(false)
  }

  // Banned users: block the whole app with a clear notice.
  if (user && isActiveBan(mod)) {
    const until = mod.banUntil ? new Date(mod.banUntil).toLocaleDateString() : null
    return (
      <div className="h-full w-full flex flex-col items-center justify-center px-8 text-center" style={{ background: '#0B0B0B' }}>
        <Logo size={44} />
        <h1 className="font-display font-bold text-xl text-white mt-6 mb-2">Account suspended</h1>
        <p className="text-white/40 text-sm max-w-xs">{until ? `Your access is restricted until ${until}.` : 'Your access to MiLey has been restricted by an administrator.'}</p>
        <button onClick={() => auth.signOut()} className="mt-8 card-surface px-6 py-3 rounded-2xl text-sm font-medium text-white/60">Sign out</button>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, requireAuth: openGate }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]"
          style={{ height: 'var(--visual-height, 100dvh)' }}
        >
          {/* Blurred glass backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-fade-in"
            onClick={dismiss}
          />
          <div
            className="relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-7 pb-9 animate-sheet-up overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(30,30,34,0.92), rgba(14,14,16,0.94))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* brand glow */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,61,174,0.28), transparent 70%)' }}
            />
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/50 hover:text-white bg-white/5"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <Logo size={46} showWordmark={false} />
              <h2 className="font-display font-bold text-2xl text-white mt-5">Continue with MiLey</h2>
              <p className="text-white/45 text-sm mt-2 leading-relaxed max-w-[17rem]">
                Sign in to play music, save your library, sync your playlists and connect with the MiLey community.
              </p>

              <div className="w-full mt-7 space-y-3">
                <button
                  onClick={doSignIn}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  <Chrome size={18} /> {busy ? 'Opening…' : 'Continue with Google'}
                </button>
                <button
                  onClick={doSignIn}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 btn-brand text-black font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  <Mail size={18} /> Continue with Email
                </button>
                <button
                  onClick={doSignIn}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-medium py-3.5 rounded-2xl text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  <UserPlus size={18} /> Create New Account
                </button>
              </div>

              <button
                onClick={dismiss}
                className="mt-5 text-white/40 text-sm font-medium hover:text-white/70"
              >
                Maybe Later
              </button>
              <p className="text-white/20 text-[11px] mt-4 leading-relaxed">
                Email &amp; Google sign-in with secure password recovery. One free MiLey account.
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}
