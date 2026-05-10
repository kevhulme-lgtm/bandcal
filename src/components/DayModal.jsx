import { useState, useEffect } from 'react'
import { X, Check } from './Icons'

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  return `${DAYS_FULL[obj.getDay()]}, ${d} ${MONTHS_FULL[m - 1]} ${y}`
}

function formatTimeDisplay(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

export default function DayModal({
  dateStr, members, unavailableSet, event,
  myId, myOverrides, displayMode,
  onClose, onSaveEvent, onDeleteEvent, onOverrideToggle
}) {
  const [editingEvent, setEditingEvent] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isTimed, setIsTimed] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setNotes(event.notes || '')
      setEndDate(event.end_date && event.end_date !== event.start_date ? event.end_date : '')
      setIsTimed(!!event.is_timed)
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '')
      setEndTime(event.end_time ? event.end_time.slice(0, 5) : '')
    } else {
      setTitle(''); setNotes(''); setEndDate('')
      setIsTimed(false); setStartTime(''); setEndTime('')
    }
    setEditingEvent(false)
    setConfirmDelete(false)
  }, [dateStr, event])

  if (!dateStr) return null

  const hasEvent = !!event
  const myHasOverride = myOverrides?.has(dateStr)
  const availMembers = members.filter(m => !unavailableSet.has(m.id))
  const unavailMembers = members.filter(m => unavailableSet.has(m.id))

  const isMultiDay = hasEvent && event.end_date && event.end_date !== event.start_date
  const headerLabel = hasEvent && !editingEvent
    ? (isMultiDay
        ? `${formatDateLabel(event.start_date)} — ${formatDateLabel(event.end_date)}`
        : formatDateLabel(event.start_date))
    : formatDateLabel(dateStr)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    await onSaveEvent(dateStr, title.trim(), notes.trim(), endDate || dateStr, isTimed, startTime, endTime)
    setSaving(false)
    setEditingEvent(false)
  }

  async function handleDelete() {
    await onDeleteEvent(dateStr)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#f8f7f4] dark:bg-[#1c1c1a] rounded-t-3xl slide-up overflow-y-auto"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 ${hasEvent ? (event.is_timed ? 'bg-amber-500/10 dark:bg-amber-500/10' : 'bg-blue-500/10 dark:bg-blue-500/15') : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {hasEvent && !editingEvent && (
                <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${event.is_timed ? 'text-amber-500' : 'text-blue-500 dark:text-blue-400'}`}>
                  {event.is_timed ? 'Timed Event' : 'Group Event'}
                  {event.is_timed && event.start_time && ` · ${formatTimeDisplay(event.start_time)}${event.end_time ? ` – ${formatTimeDisplay(event.end_time)}` : ''}`}
                </p>
              )}
              {hasEvent && !editingEvent
                ? <h3 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] leading-tight">{event.title}</h3>
                : <h3 className="font-display text-lg tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">{headerLabel}</h3>
              }
              {hasEvent && !editingEvent && (
                <p className="text-xs text-[#999] mt-1">{headerLabel}</p>
              )}
              {hasEvent && event.notes && !editingEvent && (
                <p className="font-body text-sm text-[#666] dark:text-[#999] mt-2 whitespace-pre-line">{event.notes}</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-10 space-y-5 pt-4">

          {/* Event editor */}
          {editingEvent && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Event title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Gig at The Buttermarket"
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Notes <span className="normal-case text-[#aaa]">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Load-in time, venue address, soundcheck..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-none"
                />
              </div>

              {/* End date */}
              <div>
                <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">
                  End date <span className="normal-case text-[#aaa]">(leave blank for single day)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={dateStr}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
              </div>

              {/* Timed event toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsTimed(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${isTimed ? 'bg-amber-500' : 'bg-black/20 dark:bg-white/20'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isTimed ? 'translate-x-5' : ''}`} />
                </div>
                <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">Specific time <span className="text-[#888]">(shows amber — partial day)</span></span>
              </label>

              {isTimed && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Start time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">End time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-body font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving…' : <><Check size={14} /> Save event</>}
                </button>
                <button
                  onClick={() => { setEditingEvent(false) }}
                  className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!editingEvent && (
            <div className="flex gap-2 flex-wrap">
              {!hasEvent && (
                <button
                  onClick={() => setEditingEvent(true)}
                  className="px-4 py-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400
                    font-body text-sm font-medium border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                >
                  + Add event
                </button>
              )}
              {hasEvent && <>
                <button
                  onClick={() => setEditingEvent(true)}
                  className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400
                    font-body text-sm font-medium border border-blue-400/20 hover:bg-blue-500/20 transition-colors"
                >
                  Edit
                </button>
                {!confirmDelete
                  ? <button onClick={() => setConfirmDelete(true)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-body text-sm font-medium border border-red-400/20">
                      Delete
                    </button>
                  : <button onClick={handleDelete}
                      className="px-4 py-2 rounded-xl bg-red-500 text-white font-body text-sm font-medium">
                      Confirm delete
                    </button>
                }
                <button
                  onClick={() => onOverrideToggle(dateStr)}
                  className={`px-4 py-2 rounded-xl font-body text-sm font-medium border transition-colors ${
                    myHasOverride
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-400/20'
                      : 'bg-black/5 dark:bg-white/5 text-[#888] border-black/10 dark:border-white/10'
                  }`}
                >
                  {myHasOverride ? '✓ I\'m free for this' : 'I\'m free for this group'}
                </button>
              </>}
            </div>
          )}

          {/* Divider + member list */}
          {!editingEvent && <>
            <div className="h-px bg-black/10 dark:bg-white/10" />
            <div className="space-y-4">
              {unavailMembers.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-red-500 dark:text-red-400 mb-2">Unavailable</p>
                  <div className="space-y-2">
                    {unavailMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-2.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="font-body font-medium text-[#1a1a18] dark:text-[#e8e6e0]">{m.nickname}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {availMembers.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-green-600 dark:text-green-400 mb-2">Available</p>
                  <div className="space-y-2">
                    {availMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-green-500/10 rounded-xl px-4 py-2.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="font-body font-medium text-[#1a1a18] dark:text-[#e8e6e0]">{m.nickname}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {members.length === 0 && (
                <p className="text-center text-sm text-[#888] py-4">No members yet</p>
              )}
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
