import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfficialThread, MILEY_NAME } from '../officialDM'
import { timeAgo } from '../musicHelpers'
import EmptyState from '../components/EmptyState'
import { BackIcon, VerifiedIcon, BellIcon } from '../components/icons'

export default function OfficialInbox() {
  const navigate = useNavigate()
  const { messages, loading, markAllRead } = useOfficialThread()
  const bottomRef = useRef(null)

  // Mark the whole official thread read once it's open.
  useEffect(() => { markAllRead() }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0B0B0B] text-white" style={{ height: 'var(--visual-height, 100dvh)' }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.7rem)] pb-3 border-b border-white/10 bg-[#0B0B0B]/95 backdrop-blur">
        <button onClick={() => navigate('/messages')} className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:bg-white/5"><BackIcon size={20} /></button>
        <div className="w-10 h-10 rounded-full grad-brand flex items-center justify-center shrink-0">
          <span className="font-display font-black text-black text-lg">M</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-display font-bold text-white truncate">{MILEY_NAME}</p>
            <VerifiedIcon size={15} className="grad-brand-text shrink-0" />
          </div>
          <p className="text-[11px] text-white/40">Official platform updates</p>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-5 space-y-4">
        {loading && messages.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-10">Loading…</p>
        ) : messages.length === 0 ? (
          <EmptyState icon={<BellIcon size={24} className="grad-brand-text" />} title="No updates yet" subtitle="Approvals, milestones and announcements from MiLey will appear here." />
        ) : (
          messages.map((m) => <OfficialCard key={m.id} m={m} onAction={(url) => url && navigate(url)} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function OfficialCard({ m, onAction }) {
  return (
    <div className="max-w-[85%] rounded-3xl rounded-tl-lg overflow-hidden card-surface border border-white/10">
      {m.banner ? (
        <div className="w-full aspect-[2/1] bg-white/5 overflow-hidden">
          <img src={m.banner} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
      ) : (
        <div className="w-full h-1.5 grad-brand" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <VerifiedIcon size={14} className="grad-brand-text shrink-0" />
          <p className="font-display font-bold text-white text-[15px] leading-tight">{m.title}</p>
        </div>
        {m.body && <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{m.body}</p>}
        {m.reason && (
          <div className="mt-2.5 rounded-xl bg-white/5 px-3 py-2 border-l-2 border-[rgb(var(--color-primary))]">
            <p className="text-[11px] uppercase tracking-wide text-white/35 mb-0.5">Reason</p>
            <p className="text-xs text-white/70">{m.reason}</p>
          </div>
        )}
        {m.actionLabel && (
          <button onClick={() => onAction(m.actionUrl)} className="mt-3 btn-brand text-black font-semibold text-xs px-4 py-2 rounded-xl">
            {m.actionLabel}
          </button>
        )}
        <p className="text-[10px] text-white/25 mt-2.5">{timeAgo(m.createdAt)}</p>
      </div>
    </div>
  )
}
