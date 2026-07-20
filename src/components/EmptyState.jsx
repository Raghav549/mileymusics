export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-up">
      <div className="w-16 h-16 rounded-3xl card-surface flex items-center justify-center mb-4 animate-float">
        {icon}
      </div>
      <p className="font-display font-bold text-white text-base mb-1">{title}</p>
      {subtitle && <p className="text-sm text-white/40 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
