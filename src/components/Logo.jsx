export default function Logo({ size = 32, showWordmark = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <defs>
          <linearGradient id="mileyGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgb(var(--color-primary))" />
            <stop offset="1" stopColor="rgb(var(--color-secondary))" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" stroke="url(#mileyGrad)" strokeWidth="2.4" />
        <path d="M24 34c-6-3-9-8-9-13a6 6 0 0 1 9-5.2A6 6 0 0 1 33 21c0 5-3 10-9 13Z" fill="url(#mileyGrad)" />
        <path d="M24 17.5v9" stroke="#0B0B0B" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
          <span className="text-white">Mi</span>
          <span className="grad-brand-text">Ley</span>
        </span>
      )}
    </div>
  )
}
