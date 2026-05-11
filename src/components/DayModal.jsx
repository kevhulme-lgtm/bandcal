import { useState, useEffect } from 'react'
import { X, Check } from './Icons'

function downloadICS({ title, startDate, endDate, notes, startTime, endTime }) {
  const uid = `${Date.now()}@lineup-app`
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const safeEnd = endDate || startDate

  let dtStart, dtEnd
  if (startTime) {
    const [sh, sm] = startTime.split(':')
    dtStart = `DTSTART:${startDate.replace(/-/g, '')}T${sh}${sm}00`
    if (endTime) {
      const [eh, em] = endTime.split(':')
      dtEnd = `DTEND:${safeEnd.replace(/-/g, '')}T${eh}${em}00`
    } else {
      dtEnd = `DTEND:${startDate.replace(/-/g, '')}T${sh}${sm}00`
    }
  } else {
    const after = new Date(safeEnd + 'T00:00:00')
    after.setDate(after.getDate() + 1)
    const afterStr = after.toISOString().slice(0, 10).replace(/-/g, '')
    dtStart = `DTSTART;VALUE=DATE:${startDate.replace(/-/g, '')}`
    dtEnd = `DTEND;VALUE=DATE:${afterStr}`
  }

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lineup//Lineup//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${now}`,
    dtStart, dtEnd,
    `SUMMARY:${title}`,
    ...(notes ? [`DESCRIPTION:${notes.replace(/\r?\n/g, '\\n')}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

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
  dateStr, members, unavailableSet, tentativeSet = new Set(), event,
  myId, myOverrides, displayMode,
  myRsvps = {}, allRsvps = {},
  personalEvent,
  canManageEvent = true,
  eventGroupName = null,
  onClose,
  onSaveGroupEvent, onDeleteGroupEvent,
  onSavePersonalEvent, onDeletePersonalEvent,
  onOverrideToggle, onRsvp
}) {
  const [tab, setTab] = useState('group')

  const [editingEvent, setEditingEvent] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isTimed, setIsTimed] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editingPersonal, setEditingPersonal] = useState(false)
  const [personalTitle, setPersonalTitle] = useState('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [personalEndDate, setPersonalEndDate] = useState('')
  const [personalIsTentative, setPersonalIsTentative] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [confirmDeletePersonal, setConfirmDeletePersonal] = useState(false)

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setNotes(event.notes || '')
      setEndDate(event.end_date && event.end_date !== event.start_date ? event.end_date : '')
      setIsTimed(!!event.is_timed)
      setStartTime(event.start_time ? event.start_time.slice(0, 5) : '')
      setEndTime(event.end_time ? event.end_time.slice(0, 5) : '')
    } else {
      setTitle(''); setNotes(''); setEndDate(''); setIsTimed(false); setStartTime(''); setEndTime('')
    }
    setEditingEvent(false)
    setConfirmDelete(false)
  }, [dateStr, event])

  useEffect(() => {
    if (personalEvent) {
      setPersonalTitle(personalEvent.title || '')
      setPersonalNotes(personalEvent.notes || '')
      setPersonalEndDate(personalEvent.end_date && personalEvent.end_date !== personalEvent.date ? personalEvent.end_date : '')
      setPersonalIsTentative(!!personalEvent.is_tentative)
    } else {
      setPersonalTitle(''); setPersonalNotes(''); setPersonalEndDate(''); setPersonalIsTentative(false)
    }
    setEditingPersonal(false)
    setConfirmDeletePersonal(false)
  }, [dateStr, personalEvent])

  if (!dateStr) return null

  const hasGroupEvent = !!event
  const hasPersonalEvent = !!personalEvent
  const myHasOverride = myOverrides?.has(dateStr)
  const unavailMembers = members.filter(m => unavailableSet.has(m.user_id))
  const tentativeMembers = members.filter(m => !unavailableSet.has(m.user_id) && tentativeSet.has(m.user_id))
  const availMembers = members.filter(m => !unavailableSet.has(m.user_id) && !tentativeSet.has(m.user_id))
  const isMultiDay = hasGroupEvent && event.end_date && event.end_date !== event.start_date
  const groupEventHeaderLabel = hasGroupEvent
    ? (isMultiDay ? `${formatDateLabel(event.start_date)} — ${formatDateLabel(event.end_date)}` : formatDateLabel(event.start_date))
    : formatDateLabel(dateStr)
  const myRsvpStatus = event ? myRsvps[event.id] : null
  const eventRsvps = event ? (allRsvps[event.id] || []) : []

  async function handleSaveGroupEvent() {
    if (!title.trim()) return
    setSaving(true)
    await onSaveGroupEvent(dateStr, title.trim(), notes.trim(), endDate || dateStr, isTimed, startTime, endTime)
    setSaving(false)
    setEditingEvent(false)
  }

  async function handleSavePersonalEvent() {
    if (!personalTitle.trim()) return
    setSavingPersonal(true)
    await onSavePersonalEvent(dateStr, personalEndDate || dateStr, personalTitle.trim(), personalNotes.trim(), personalIsTentative)
    setSavingPersonal(false)
    setEditingPersonal(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-[#f8f7f4] dark:bg-[#1c1c1a] rounded-t-3xl slide-up overflow-y-auto"
        style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>

        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">
              {formatDateLabel(dateStr)}
            </h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 pb-2">
          <div className="flex bg-black/5 dark:bg-white/10 rounded-2xl p-1 gap-1">
            <button onClick={() => setTab('group')}
              className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === 'group' ? 'bg-white dark:bg-white/20 shadow-sm text-[#1a1a18] dark:text-[#e8e6e0]' : 'text-[#888]'
              }`}>
              Group {hasGroupEvent && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
            <button onClick={() => setTab('personal')}
              className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === 'personal' ? 'bg-white dark:bg-white/20 shadow-sm text-[#1a1a18] dark:text-[#e8e6e0]' : 'text-[#888]'
              }`}>
              Personal {hasPersonalEvent && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
            </button>
          </div>
        </div>

        <div className="px-6 pb-10 space-y-5 pt-4">

          {/* ── GROUP TAB ── */}
          {tab === 'group' && (
            <>
              {hasGroupEvent && !editingEvent && (
                <div className={`rounded-2xl p-4 border ${event.is_timed ? 'bg-amber-500/10 border-amber-400/20' : 'bg-blue-500/10 border-blue-400/20'}`}>
                  <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${event.is_timed ? 'text-amber-500' : 'text-blue-500 dark:text-blue-400'}`}>
                    {eventGroupName ? eventGroupName : (event.is_timed ? 'Timed Event' : 'Group Event')}
                    {event.is_timed && event.start_time && ` · ${formatTimeDisplay(event.start_time)}${event.end_time ? ` – ${formatTimeDisplay(event.end_time)}` : ''}`}
                  </p>
                  <h3 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">{event.title}</h3>
                  <p className="text-xs text-[#999] mt-1">{groupEventHeaderLabel}</p>
                  {event.notes && <p className="font-body text-sm text-[#666] dark:text-[#999] mt-2 whitespace-pre-line">{event.notes}</p>}
                  <button
                    onClick={() => downloadICS({ title: event.title, startDate: event.start_date, endDate: event.end_date, notes: event.notes, startTime: event.start_time?.slice(0,5), endTime: event.end_time?.slice(0,5) })}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 font-body text-xs font-medium text-[#555] dark:text-[#bbb] hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                    + Add to calendar
                  </button>
                </div>
              )}

              {editingEvent && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Event title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Gig at The Buttermarket" autoFocus
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Notes <span className="normal-case text-[#aaa]">(optional)</span></label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Load-in time, venue address, soundcheck..." rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">
                      End date <span className="normal-case text-[#aaa]">(leave blank for single day)</span>
                    </label>
                    <input type="date" value={endDate} min={dateStr} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setIsTimed(v => !v)}
                      className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${isTimed ? 'bg-amber-500' : 'bg-black/20 dark:bg-white/20'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isTimed ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">Specific time <span className="text-[#888]">(shows amber)</span></span>
                  </label>
                  {isTimed && (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Start</label>
                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">End</label>
                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none" />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleSaveGroupEvent} disabled={saving || !title.trim()}
                      className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-body font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? 'Saving…' : <><Check size={14} /> Save event</>}
                    </button>
                    <button onClick={() => setEditingEvent(false)}
                      className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {!editingEvent && canManageEvent && (
                <div className="flex gap-2 flex-wrap">
                  {!hasGroupEvent && (
                    <button onClick={() => setEditingEvent(true)}
                      className="px-4 py-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400
                        font-body text-sm font-medium border border-blue-400/20 hover:bg-blue-500/20 transition-colors">
                      + Add group event
                    </button>
                  )}
                  {hasGroupEvent && (
                    <>
                      <button onClick={() => setEditingEvent(true)}
                        className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-body text-sm font-medium border border-blue-400/20">Edit</button>
                      {!confirmDelete
                        ? <button onClick={() => setConfirmDelete(true)}
                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-body text-sm font-medium border border-red-400/20">Delete</button>
                        : <button onClick={() => { onDeleteGroupEvent(dateStr); onClose() }}
                            className="px-4 py-2 rounded-xl bg-red-500 text-white font-body text-sm font-medium">Confirm delete</button>
                      }
                    </>
                  )}
                </div>
              )}

              {/* Availability response — only for current group's events */}
              {hasGroupEvent && !editingEvent && canManageEvent && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (myHasOverride) {
                        onOverrideToggle(dateStr)
                      } else {
                        if (myRsvpStatus === 'declined' || myRsvpStatus === 'maybe') onRsvp(event.id, null)
                        onOverrideToggle(dateStr)
                      }
                    }}
                    className={`flex-1 py-2.5 rounded-xl border font-body text-sm font-medium transition-colors ${
                      myHasOverride
                        ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-400/30'
                        : 'border-black/10 dark:border-white/10 text-[#888] hover:border-black/20 dark:hover:border-white/20'
                    }`}>
                    {myHasOverride ? "✓ Going" : "Going"}
                  </button>
                  <button
                    onClick={() => {
                      if (myHasOverride) onOverrideToggle(dateStr)
                      onRsvp(event.id, myRsvpStatus === 'maybe' ? null : 'maybe')
                    }}
                    className={`flex-1 py-2.5 rounded-xl border font-body text-sm font-medium transition-colors ${
                      myRsvpStatus === 'maybe' && !myHasOverride
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30'
                        : 'border-black/10 dark:border-white/10 text-[#888] hover:border-black/20 dark:hover:border-white/20'
                    }`}>
                    {myRsvpStatus === 'maybe' && !myHasOverride ? "~ Maybe" : "Maybe"}
                  </button>
                  <button
                    onClick={() => {
                      if (myHasOverride) onOverrideToggle(dateStr)
                      onRsvp(event.id, myRsvpStatus === 'declined' ? null : 'declined')
                    }}
                    className={`flex-1 py-2.5 rounded-xl border font-body text-sm font-medium transition-colors ${
                      myRsvpStatus === 'declined' && !myHasOverride
                        ? 'bg-red-500/10 text-red-500 border-red-400/30'
                        : 'border-black/10 dark:border-white/10 text-[#888] hover:border-black/20 dark:hover:border-white/20'
                    }`}>
                    {myRsvpStatus === 'declined' && !myHasOverride ? "✕ Can't" : "Can't"}
                  </button>
                </div>
              )}

              {/* Member list — only in group view */}
              {!editingEvent && displayMode !== 'personal' && (
                <>
                  <div className="h-px bg-black/10 dark:bg-white/10" />
                  <div className="space-y-4">
                    {unavailMembers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-red-500 dark:text-red-400 mb-2">Unavailable</p>
                        <div className="space-y-2">
                          {unavailMembers.map(m => (
                            <div key={m.id} className="flex items-center gap-3 bg-red-500/10 rounded-xl px-4 py-2.5">
                              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                              <span className="font-body font-medium text-[#1a1a18] dark:text-[#e8e6e0]">{m.display_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {tentativeMembers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-amber-500 mb-2">Tentative</p>
                        <div className="space-y-2">
                          {tentativeMembers.map(m => (
                            <div key={m.id} className="flex items-center gap-3 bg-amber-500/10 rounded-xl px-4 py-2.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                              <span className="font-body font-medium text-[#1a1a18] dark:text-[#e8e6e0]">{m.display_name}</span>
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
                              <span className="font-body font-medium text-[#1a1a18] dark:text-[#e8e6e0]">{m.display_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {members.length === 0 && (
                      <p className="text-center text-sm text-[#888] py-4">No members yet</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── PERSONAL TAB ── */}
          {tab === 'personal' && (
            <>
              {hasPersonalEvent && !editingPersonal && (
                <div className="rounded-2xl p-4 border bg-purple-500/10 border-purple-400/20">
                  <p className="text-xs font-medium uppercase tracking-widest text-purple-500 mb-1">
                    Personal Event{personalEvent.is_tentative && <span className="ml-2 text-amber-500">· Tentative</span>}
                  </p>
                  <h3 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">{personalEvent.title}</h3>
                  {personalEvent.end_date && personalEvent.end_date !== personalEvent.date && (
                    <p className="text-xs text-[#999] mt-1">{formatDateLabel(personalEvent.date)} — {formatDateLabel(personalEvent.end_date)}</p>
                  )}
                  {personalEvent.notes && <p className="font-body text-sm text-[#666] dark:text-[#999] mt-2 whitespace-pre-line">{personalEvent.notes}</p>}
                  <p className="text-xs text-[#aaa] mt-2">Only you can see this. Your unavailability is shared with all your groups.</p>
                  <button
                    onClick={() => downloadICS({ title: personalEvent.title, startDate: personalEvent.date, endDate: personalEvent.end_date, notes: personalEvent.notes })}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 font-body text-xs font-medium text-[#555] dark:text-[#bbb] hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                    + Add to calendar
                  </button>
                </div>
              )}

              {editingPersonal && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Event title</label>
                    <input type="text" value={personalTitle} onChange={e => setPersonalTitle(e.target.value)}
                      placeholder="e.g. Doctor's appointment" autoFocus
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-purple-400/50" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">Notes <span className="normal-case text-[#aaa]">(optional)</span></label>
                    <textarea value={personalNotes} onChange={e => setPersonalNotes(e.target.value)}
                      placeholder="Details..." rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-widest text-[#888] block mb-1.5">
                      End date <span className="normal-case text-[#aaa]">(leave blank for single day)</span>
                    </label>
                    <input type="date" value={personalEndDate} min={dateStr} onChange={e => setPersonalEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                        font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-purple-400/50" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setPersonalIsTentative(v => !v)}
                      className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${personalIsTentative ? 'bg-amber-500' : 'bg-black/20 dark:bg-white/20'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${personalIsTentative ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">
                      Tentative <span className="text-[#888]">(shows as maybe to groups)</span>
                    </span>
                  </label>
                  <p className="text-xs text-[#aaa] font-body">Details are private. Your unavailability will be visible to all your groups.</p>
                  <div className="flex gap-2">
                    <button onClick={handleSavePersonalEvent} disabled={savingPersonal || !personalTitle.trim()}
                      className="flex-1 py-3 rounded-2xl bg-purple-500 text-white font-body font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                      {savingPersonal ? 'Saving…' : <><Check size={14} /> Save</>}
                    </button>
                    <button onClick={() => setEditingPersonal(false)}
                      className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {!editingPersonal && (
                <div className="flex gap-2 flex-wrap">
                  {!hasPersonalEvent ? (
                    <button onClick={() => setEditingPersonal(true)}
                      className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400
                        font-body text-sm font-medium border border-purple-400/20 hover:bg-purple-500/20 transition-colors">
                      + Add personal event
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setEditingPersonal(true)}
                        className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-body text-sm font-medium border border-purple-400/20">Edit</button>
                      {!confirmDeletePersonal
                        ? <button onClick={() => setConfirmDeletePersonal(true)}
                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-body text-sm font-medium border border-red-400/20">Delete</button>
                        : <button onClick={() => { onDeletePersonalEvent(dateStr); onClose() }}
                            className="px-4 py-2 rounded-xl bg-red-500 text-white font-body text-sm font-medium">Confirm delete</button>
                      }
                    </>
                  )}
                </div>
              )}

              {!editingPersonal && (
                <p className="text-xs text-[#aaa] font-body mt-2">
                  Personal events are private — only your unavailability is visible to your groups.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
