import { useState, useEffect } from 'react'
import { X } from './Icons'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export default function EventBanner({ pendingEvents, onNavigate, onRsvp }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(i => Math.min(i, Math.max((pendingEvents?.length || 1) - 1, 0)))
  }, [pendingEvents?.length])

  if (!pendingEvents || pendingEvents.length === 0) return null

  const safeIdx = Math.min(idx, pendingEvents.length - 1)
  const event = pendingEvents[safeIdx]
  const remaining = pendingEvents.length

  function handleSkip() {
    setIdx(i => (i + 1) % pendingEvents.length)
  }

  return (
    <div className="mx-4 mb-2 fade-in">
      <div className="rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden shadow-sm">
        <button onClick={() => onNavigate(event)}
          className="w-full flex items-center gap-3 px-4 pt-3 pb-2.5 text-left active:bg-black/5 dark:active:bg-white/5 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-body font-semibold text-sm text-[#1a1a18] dark:text-[#e8e6e0] truncate">
              {event.title}
            </p>
            <p className="font-body text-xs text-[#888] mt-0.5">
              {formatShortDate(event.start_date)}
              {event.end_date && event.end_date !== event.start_date
                ? ` – ${formatShortDate(event.end_date)}` : ''}
              {remaining > 1 && ` · ${remaining} to respond`}
            </p>
          </div>
          {remaining > 1 && (
            <button
              onClick={e => { e.stopPropagation(); handleSkip() }}
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0 text-[#aaa]">
              <X size={14} />
            </button>
          )}
        </button>

        <div className="flex border-t border-black/10 dark:border-white/10">
          <button
            onClick={() => onRsvp(event.id, 'accepted')}
            className="flex-1 py-2.5 text-xs font-body font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors">
            ✓ Going
          </button>
          <div className="w-px bg-black/10 dark:bg-white/10" />
          <button
            onClick={() => onRsvp(event.id, 'maybe')}
            className="flex-1 py-2.5 text-xs font-body font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">
            ~ Maybe
          </button>
          <div className="w-px bg-black/10 dark:bg-white/10" />
          <button
            onClick={() => onRsvp(event.id, 'declined')}
            className="flex-1 py-2.5 text-xs font-body font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
            ✕ Can't
          </button>
        </div>
      </div>
    </div>
  )
}
