import { useState, useEffect } from 'react'
import { X } from './Icons'
import { formatDate } from '../lib/tokens'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export default function EventBanner({ unseenEvents, onNavigate, onDismissAll }) {
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => { setCurrentIdx(0) }, [unseenEvents])

  if (!unseenEvents || unseenEvents.length === 0) return null

  const event = unseenEvents[currentIdx]
  const hasMore = unseenEvents.length > 1

  function handleTap() {
    onNavigate(event)
    if (currentIdx < unseenEvents.length - 1) {
      setCurrentIdx(i => i + 1)
    } else {
      onDismissAll()
    }
  }

  return (
    <div className="mx-4 mb-2 fade-in">
      <button
        onClick={handleTap}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl
          bg-blue-500 text-white text-left active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20"
      >
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold text-sm leading-tight truncate">
            New event: {event.title}
          </p>
          <p className="font-body text-xs text-blue-100 mt-0.5">
            {formatShortDate(event.start_date)}
            {event.end_date && event.end_date !== event.start_date ? ` – ${formatShortDate(event.end_date)}` : ''}
            {' · '}Tap to view
            {hasMore && ` · ${unseenEvents.length - currentIdx - 1} more`}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDismissAll() }}
          className="p-1 rounded-full hover:bg-white/20 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </button>
    </div>
  )
}
