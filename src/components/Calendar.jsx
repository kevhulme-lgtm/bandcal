import { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Grid3X3 } from './Icons'
import { formatDate } from '../lib/tokens'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

function useSwipe(onLeft, onRight) {
  const startX = useRef(null)
  const startY = useRef(null)
  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])
  const onTouchEnd = useCallback((e) => {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) onLeft(); else onRight()
    }
    startX.current = null
  }, [onLeft, onRight])
  return { onTouchStart, onTouchEnd }
}


function useLongPress(onLongPress, onClick, delay = 500) {
  const timerRef = useRef(null)
  const isLong = useRef(false)

  const start = useCallback((e) => {
    isLong.current = false
    timerRef.current = setTimeout(() => {
      isLong.current = true
      onLongPress && onLongPress()
    }, delay)
  }, [onLongPress, delay])

  const end = useCallback((e) => {
    clearTimeout(timerRef.current)
    if (!isLong.current) onClick && onClick()
  }, [onClick])

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
    isLong.current = false
  }, [])

  return { onTouchStart: start, onTouchEnd: end, onTouchCancel: cancel, onMouseDown: start, onMouseUp: end, onMouseLeave: cancel }
}

function getDayStatus(dateStr, myUnavailable, myTentative, allUnavailability, effectiveTentative, memberCount, threshold) {
  const myOut = myUnavailable.has(dateStr)
  const myTent = myTentative?.has(dateStr) || false
  if (allUnavailability && memberCount > 0) {
    const unavailCount = allUnavailability[dateStr] || 0
    const tentCount = effectiveTentative?.[dateStr] || 0
    const availCount = memberCount - unavailCount
    let required = memberCount
    if (threshold) {
      if (threshold.type === 'count') required = threshold.value
      else if (threshold.type === 'required_members') required = threshold.value
    }
    if (unavailCount === 0 && tentCount === 0) return { master: 'avail', myOut, myTent }
    if (unavailCount === 0 && tentCount > 0) return { master: 'tentative', myOut, myTent }
    if (availCount >= required) return { master: 'partial', myOut, myTent }
    return { master: 'unavail', myOut, myTent }
  }
  return { master: null, myOut, myTent }
}

// Build a map of dateStr -> event info (including multi-day spans)
function buildEventDayMap(groupEvents) {
  const map = {}
  Object.values(groupEvents).forEach(event => {
    const start = new Date(event.start_date + 'T00:00:00')
    const end = new Date((event.end_date || event.start_date) + 'T00:00:00')
    let cur = new Date(start)
    while (cur <= end) {
      const ds = formatDate(cur)
      map[ds] = {
        event,
        isStart: ds === event.start_date,
        isEnd: ds === (event.end_date || event.start_date),
        isMid: ds !== event.start_date && ds !== (event.end_date || event.start_date),
        isMultiDay: event.start_date !== (event.end_date || event.start_date)
      }
      cur.setDate(cur.getDate() + 1)
    }
  })
  return map
}

function DayCell({ dateStr, status, isToday, isFaded, onClick, onLongPress, viewMode, eventInfo, isDeclined, isOtherGroup }) {
  const day = parseInt(dateStr.split('-')[2], 10)
  const hasEvent = !!eventInfo

  let baseBg = ''
  if (hasEvent && isDeclined) {
    baseBg = 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
  } else if (hasEvent && isOtherGroup) {
    baseBg = 'bg-red-500/20 border-red-400/40'
  } else if (hasEvent) {
    baseBg = 'bg-blue-500/20 border-blue-400/40'
  } else if (viewMode === 'master') {
    if (status.master === 'avail') baseBg = 'bg-green-500/20 border-green-400/50'
    else if (status.master === 'unavail') baseBg = 'bg-red-500/20 border-red-400/50'
    else if (status.master === 'partial') baseBg = 'bg-amber-500/20 border-amber-400/50'
    else if (status.master === 'tentative') baseBg = 'bg-amber-500/20 border-amber-400/50'
    else baseBg = 'border-transparent'
  } else {
    if (status.myTent) baseBg = 'bg-amber-500/40 border-amber-400/70'
    else baseBg = status.myOut ? 'bg-red-500/25 border-red-400/50' : 'border-transparent'
  }

  // Span styling for multi-day events
  let spanClass = ''
  if (hasEvent && eventInfo.isMultiDay) {
    if (eventInfo.isStart) spanClass = 'rounded-r-none border-r-0'
    else if (eventInfo.isEnd) spanClass = 'rounded-l-none border-l-0'
    else spanClass = 'rounded-none border-x-0'
  }

  const todayRing = isToday ? 'ring-2 ring-inset ring-indigo-400' : ''

  const pressHandlers = useLongPress(
    onLongPress ? () => onLongPress(dateStr) : null,
    onClick ? () => onClick(dateStr, status) : null
  )

  return (
    <button
      {...pressHandlers}
      onContextMenu={e => e.preventDefault()}
      className={`
        relative flex items-center justify-center rounded-lg border
        font-body font-medium text-sm transition-all duration-150 active:scale-95
        select-none
        ${baseBg} ${spanClass} ${todayRing}
        ${isFaded ? 'opacity-20' : isDeclined ? 'opacity-50' : 'opacity-100'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        aspect-square w-full
      `}
    >
      <span className="relative z-10">{day}</span>
      {hasEvent && eventInfo.isStart && !eventInfo.isMultiDay && (
        <span className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${isOtherGroup ? 'bg-red-400' : 'bg-blue-400'}`} />
      )}
      {!hasEvent && viewMode === 'master' && status.master === 'partial' && (
        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
    </button>
  )
}

export function MonthView({ year, month, myUnavailable, myTentative, allUnavailability, effectiveTentative, memberCount, threshold, viewMode, groupEvents = {}, declinedEventIds, currentGroupId, onDayClick, onLongPress, onPrev, onNext }) {
  const today = formatDate(new Date())
  const { onTouchStart, onTouchEnd } = useSwipe(onNext, onPrev)
  const eventDayMap = useMemo(() => buildEventDayMap(groupEvents), [groupEvents])

  const days = useMemo(() => {
    const result = []
    const firstDay = new Date(year, month, 1)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      result.push({ dateStr: formatDate(d), faded: true })
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ dateStr: formatDate(new Date(year, month, d)), faded: false })
    }
    const remaining = (7 - (result.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      result.push({ dateStr: formatDate(new Date(year, month + 1, i)), faded: true })
    }
    return result
  }, [year, month])

  return (
    <div className="flex flex-col h-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={onPrev} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft />
        </button>
        <h2 className="font-display text-3xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">
          {MONTHS_FULL[month]} {year}
        </h2>
        <button onClick={onNext} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <ChevronRight />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-[#888] uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1">
        {days.map(({ dateStr, faded }) => {
          const status = getDayStatus(dateStr, myUnavailable, myTentative, allUnavailability, effectiveTentative, memberCount, threshold)
          return (
            <DayCell
              key={dateStr}
              dateStr={dateStr}
              status={status}
              isToday={dateStr === today}
              isFaded={faded}
              onClick={onDayClick}
              onLongPress={onLongPress}
              viewMode={viewMode}
              eventInfo={eventDayMap[dateStr] || null}
              isDeclined={!!(declinedEventIds && eventDayMap[dateStr] && declinedEventIds.has(eventDayMap[dateStr].event?.id))}
              isOtherGroup={!!(currentGroupId && eventDayMap[dateStr] && eventDayMap[dateStr].event?.group_id && eventDayMap[dateStr].event.group_id !== currentGroupId)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function YearView({ year, myUnavailable, myTentative, allUnavailability, effectiveTentative, memberCount, threshold, viewMode, groupEvents = {}, onMonthClick, onPrev, onNext }) {
  const { onTouchStart, onTouchEnd } = useSwipe(onNext, onPrev)
  return (
    <div className="flex flex-col h-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={onPrev} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <ChevronLeft />
        </button>
        <h2 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">{year}</h2>
        <button onClick={onNext} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <ChevronRight />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1 overflow-auto">
        {MONTHS.map((m, mi) => {
          const daysInMonth = new Date(year, mi + 1, 0).getDate()
          let availCount = 0, unavailCount = 0, partialCount = 0, hasEvents = false
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = formatDate(new Date(year, mi, d))
            const status = getDayStatus(dateStr, myUnavailable, myTentative, allUnavailability, effectiveTentative, memberCount, threshold)
            if (Object.values(groupEvents).some(e => {
              const start = e.start_date, end = e.end_date || e.start_date
              return dateStr >= start && dateStr <= end
            })) hasEvents = true
            if (viewMode === 'master') {
              if (status.master === 'avail') availCount++
              else if (status.master === 'unavail') unavailCount++
              else if (status.master === 'partial' || status.master === 'tentative') partialCount++
            } else {
              if (status.myTent) partialCount++
              else if (status.myOut) unavailCount++
              else availCount++
            }
          }
          return (
            <button
              key={m}
              onClick={() => onMonthClick(mi)}
              className="flex flex-col items-center justify-center rounded-2xl p-3 border transition-all active:scale-95
                border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20
                bg-white/50 dark:bg-white/5"
            >
              <span className="font-display text-xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-2">{m}</span>
              <div className="flex gap-1">
                {hasEvents && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                {availCount > 0 && <span className="w-2 h-2 rounded-full bg-green-500" />}
                {partialCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                {unavailCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1">
      <button
        onClick={() => onChange('month')}
        className={`p-1.5 rounded-full transition-all ${view === 'month' ? 'bg-white dark:bg-white/20 shadow-sm' : 'opacity-50'}`}
      >
        <Calendar size={16} />
      </button>
      <button
        onClick={() => onChange('year')}
        className={`p-1.5 rounded-full transition-all ${view === 'year' ? 'bg-white dark:bg-white/20 shadow-sm' : 'opacity-50'}`}
      >
        <Grid3X3 size={16} />
      </button>
    </div>
  )
}
