import { useEffect, useMemo, useRef, useState } from 'react'
import { LyricsIcon, ChevronDownIcon } from './icons'

function parseLyrics(raw) {
  if (!raw) return { timed: false, lines: [] }
  const rawLines = raw.split('\n')
  const timedLines = []
  let anyTimed = false
  for (const line of rawLines) {
    const m = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/)
    if (m) {
      anyTimed = true
      const t = Number(m[1]) * 60 + Number(m[2])
      timedLines.push({ t, text: m[3] })
    } else if (line.trim()) {
      timedLines.push({ t: null, text: line })
    }
  }
  return { timed: anyTimed, lines: timedLines }
}

export default function LyricsView({ lyrics, currentTime = 0 }) {
  const { timed, lines } = useMemo(() => parseLyrics(lyrics), [lyrics])
  const [expanded, setExpanded] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef(null)
  const activeRef = useRef(null)

  const activeIndex = useMemo(() => {
    if (!timed) return -1
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].t != null && lines[i].t <= currentTime) idx = i
    }
    return idx
  }, [timed, lines, currentTime])

  useEffect(() => {
    if (timed && autoScroll && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeIndex, autoScroll, timed])

  if (!lyrics) return <p className="text-xs text-white/25 mb-4">No lyrics added for this track.</p>

  const visibleLines = expanded ? lines : lines.slice(0, 6)

  return (
    <div className="card-surface rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-white/40 text-xs font-medium"><LyricsIcon size={14} /> LYRICS {timed && <span className="grad-brand-text">· Synced</span>}</div>
        {timed && (
          <button onClick={() => setAutoScroll((s) => !s)} className={`text-[10px] px-2 py-1 rounded-full ${autoScroll ? 'btn-brand text-black' : 'bg-white/10 text-white/50'}`}>Auto-scroll {autoScroll ? 'On' : 'Off'}</button>
        )}
      </div>

      <div
        ref={containerRef}
        onWheel={() => timed && setAutoScroll(false)}
        onTouchMove={() => timed && setAutoScroll(false)}
        className={`space-y-1.5 ${expanded ? 'max-h-64 overflow-y-auto no-scrollbar' : ''}`}
      >
        {visibleLines.map((l, i) => (
          <p
            key={i}
            ref={timed && i === activeIndex ? activeRef : null}
            className={`text-sm leading-relaxed transition-all duration-300 ${
              timed
                ? i === activeIndex ? 'grad-brand-text font-semibold text-base' : i < activeIndex ? 'text-white/25' : 'text-white/60'
                : 'text-white/70 whitespace-pre-line'
            }`}
          >
            {l.text || '\u00A0'}
          </p>
        ))}
      </div>

      {lines.length > 6 && (
        <button onClick={() => setExpanded((e) => !e)} className="flex items-center gap-1 text-xs grad-brand-text font-medium mt-2">
          {expanded ? 'Show Less' : 'Show More'} <ChevronDownIcon size={12} className={expanded ? 'rotate-180' : ''} />
        </button>
      )}
    </div>
  )
}
