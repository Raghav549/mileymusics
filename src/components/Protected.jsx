import { useEffect, useRef } from 'react'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { requireAuth } from '../authGate'
import Logo from './Logo'

// Wraps routes that need a signed-in identity (Profile, Upload, Messages…).
// Guests get a premium gate that opens the MiLey auth modal; once signed in the
// real page renders in place — no navigation away, so state is preserved.
export default function Protected({ children, title = 'Sign in to continue', subtitle }) {
  const { user } = useAuth()
  const promptedRef = useRef(false)

  useEffect(() => {
    if (!user && !promptedRef.current) {
      promptedRef.current = true
      requireAuth('protected').finally(() => { promptedRef.current = false })
    }
  }, [user])

  if (user) return children

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-8 text-center">
      <Logo size={44} showWordmark={false} />
      <h1 className="font-display font-bold text-xl text-white mt-6 mb-2">{title}</h1>
      <p className="text-white/40 text-sm max-w-xs mb-7">
        {subtitle || 'Sign in to your free MiLey account to access this area.'}
      </p>
      <button
        onClick={() => requireAuth('protected')}
        className="btn-brand text-black font-semibold px-7 py-3.5 rounded-2xl text-sm flex items-center gap-2"
      >
        <LogIn size={17} /> Continue with MiLey
      </button>
    </div>
  )
}
