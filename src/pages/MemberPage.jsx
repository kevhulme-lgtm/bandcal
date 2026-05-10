import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDate } from '../lib/tokens'
import { MonthView, YearView, CalendarViewToggle } from '../components/Calendar'
import DayModal from '../components/DayModal'
import EventBanner from '../components/EventBanner'
import { Settings, Crown, Users, ChevronLeft } from '../components/Icons'
import { registerServiceWorker, requestPushPermission, isPushSupported, sendEventPushNotification } from '../lib/push'

const SEEN_KEY = 'bandcal_seen_events'
function getSeenEventIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) }
  catch { return new Set() }
}
function markEventSeen(id) {
  const seen = getSeenEventIds()
  seen.add(id)
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
}

export default function MemberPage() {
  const { groupToken, groupId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [myMember, setMyMember] = useState(null)
  const [allMembers, setAllMembers] = useState([])

  // Unavailability: user-level (personal) + accepted RSVPs from other groups
  const [myUnavailDates, setMyUnavailDates] = useState(new Set())       // user_unavailability dates
  const [membersUnavail, setMembersUnavail] = useState({})              // user_id -> Set<date>
  const [groupEvents, setGroupEvents] = useState({})                    // start_date -> event
  const [myRsvps, setMyRsvps] = useState({})                           // event_id -> status
  const [allRsvps, setAllRsvps] = useState({})                         // event_id -> [{ user_id, status }]
  const [myOverrides, setMyOverrides] = useState(new Set())             // group_event_overrides dates
  const [myPersonalEvents, setMyPersonalEvents] = useState({})          // date -> personal_event

  const [unseenEvents, setUnseenEvents] = useState([])
  const [pushGranted, setPushGranted] = useState(false)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const [calView, setCalView] = useState('month')
  const [displayMode, setDisplayMode] = useState('personal')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modalDate, setModalDate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [showGroupSwitcher, setShowGroupSwitcher] = useState(false)
  const [allMyGroups, setAllMyGroups] = useState([])

  useEffect(() => {
    if (!user) return
    registerServiceWorker()
    loadAll()
  }, [user, groupId])

  async function loadAll() {
    setLoading(true)
    try {
      // Load group
      const { data: g } = await supabase.from('groups').select('*').eq('token', groupToken).maybeSingle()
      if (!g) { navigate('/app'); return }
      setGroup(g)

      // Load members of this group
      const { data: members } = await supabase
        .from('members').select('*').eq('group_id', g.id)
      setAllMembers(members || [])

      const me = members?.find(m => m.user_id === user.id)
      setMyMember(me || null)
      if (!me) { navigate('/app'); return }

      // All groups this user is in (for switcher)
      const { data: myMems } = await supabase
        .from('members').select('*, groups(id, name, token)').eq('user_id', user.id)
      setAllMyGroups(myMems || [])

      // Load user_unavailability for all members in this group
      const memberUserIds = (members || []).map(m => m.user_id)
      const { data: unavail } = await supabase
        .from('user_unavailability')
        .select('user_id, date')
        .in('user_id', memberUserIds)

      const mySet = new Set()
      const memberMap = {}
      ;(unavail || []).forEach(({ user_id, date }) => {
        if (user_id === user.id) mySet.add(date)
        if (!memberMap[user_id]) memberMap[user_id] = new Set()
        memberMap[user_id].add(date)
      })
      setMyUnavailDates(mySet)
      setMembersUnavail(memberMap)

      // Load personal events for current user
      const { data: personalEvs } = await supabase
        .from('personal_events').select('*').eq('user_id', user.id)
      const peMap = {}
      ;(personalEvs || []).forEach(e => { peMap[e.date] = e })
      setMyPersonalEvents(peMap)

      // Load group events
      const { data: events } = await supabase
        .from('group_events').select('*').eq('group_id', g.id).order('start_date')
      const evMap = {}
      const today = formatDate(new Date())
      const seen = getSeenEventIds()
      const unseen = []
      ;(events || []).forEach(e => {
        evMap[e.start_date] = e
        if (e.start_date >= today && !seen.has(e.id) && e.created_by !== user.id) unseen.push(e)
      })
      setGroupEvents(evMap)
      setUnseenEvents(unseen)

      // Load RSVPs for all events in this group
      if (events?.length) {
        const eventIds = events.map(e => e.id)
        const { data: rsvps } = await supabase
          .from('event_rsvps').select('*').in('event_id', eventIds)

        const myRsvpMap = {}
        const allRsvpMap = {}
        ;(rsvps || []).forEach(r => {
          if (r.user_id === user.id) myRsvpMap[r.event_id] = r.status
          if (!allRsvpMap[r.event_id]) allRsvpMap[r.event_id] = []
          allRsvpMap[r.event_id].push({ user_id: r.user_id, status: r.status })
        })
        setMyRsvps(myRsvpMap)
        setAllRsvps(allRsvpMap)
      }

      // Load group event overrides for this user in this group
      const { data: overrides } = await supabase
        .from('group_event_overrides')
        .select('date')
        .eq('user_id', user.id)
        .eq('group_id', g.id)
      setMyOverrides(new Set((overrides || []).map(o => o.date)))

      // Push permission
      if (isPushSupported()) {
        const perm = Notification.permission
        setPushGranted(perm === 'granted')
        if (perm === 'default') setShowPushPrompt(true)
      }

    } finally { setLoading(false) }
  }

  // Realtime
  useEffect(() => {
    if (!group) return
    const channel = supabase.channel(`group-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_unavailability' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_events', filter: `group_id=eq.${group.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => loadAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [group?.id])

  // Build effective unavailability count per date for this group's calendar
  // A member is unavailable on a date if:
  //   - they have user_unavailability for that date, OR
  //   - they have accepted a group event (in any group) that covers that date
  //     unless they have a group_event_override for THIS group on that date
  const effectiveUnavailability = useMemo(() => {
    const result = {}

    // Count personal unavailability
    Object.entries(membersUnavail).forEach(([userId, dates]) => {
      dates.forEach(date => {
        result[date] = (result[date] || 0) + 1
      })
    })

    // Group events make all members "unavailable" in the master view for those dates
    Object.values(groupEvents).forEach(event => {
      const start = new Date(event.start_date + 'T00:00:00')
      const end = new Date((event.end_date || event.start_date) + 'T00:00:00')
      let cur = new Date(start)
      while (cur <= end) {
        const ds = formatDate(cur)
        if (!result[ds] || result[ds] < allMembers.length) result[ds] = allMembers.length
        cur.setDate(cur.getDate() + 1)
      }
    })

    return result
  }, [membersUnavail, groupEvents, allMembers])

  async function handlePersonalToggle(dateStr) {
    if (!user || toggling) return
    setToggling(dateStr)
    const isOut = myUnavailDates.has(dateStr)
    try {
      if (isOut) {
        await supabase.from('user_unavailability').delete().eq('user_id', user.id).eq('date', dateStr)
        setMyUnavailDates(prev => { const n = new Set(prev); n.delete(dateStr); return n })
        setMembersUnavail(prev => {
          const n = { ...prev }
          if (n[user.id]) { n[user.id] = new Set(n[user.id]); n[user.id].delete(dateStr) }
          return n
        })
      } else {
        await supabase.from('user_unavailability').insert({ user_id: user.id, date: dateStr })
        setMyUnavailDates(prev => new Set([...prev, dateStr]))
        setMembersUnavail(prev => {
          const n = { ...prev }
          if (!n[user.id]) n[user.id] = new Set(); else n[user.id] = new Set(n[user.id])
          n[user.id].add(dateStr)
          return n
        })
      }
    } finally { setToggling(null) }
  }

  async function handleSavePersonalEvent(dateStr, title, notes) {
    const existing = myPersonalEvents[dateStr]
    if (existing) {
      const { data } = await supabase.from('personal_events')
        .update({ title, notes }).eq('id', existing.id).select().single()
      if (data) setMyPersonalEvents(prev => ({ ...prev, [dateStr]: data }))
    } else {
      const { data } = await supabase.from('personal_events')
        .insert({ user_id: user.id, date: dateStr, title, notes }).select().single()
      if (data) {
        setMyPersonalEvents(prev => ({ ...prev, [dateStr]: data }))
        // Also mark as unavailable if not already
        if (!myUnavailDates.has(dateStr)) {
          await supabase.from('user_unavailability').insert({ user_id: user.id, date: dateStr })
          setMyUnavailDates(prev => new Set([...prev, dateStr]))
        }
      }
    }
  }

  async function handleDeletePersonalEvent(dateStr) {
    const existing = myPersonalEvents[dateStr]
    if (!existing) return
    await supabase.from('personal_events').delete().eq('id', existing.id)
    setMyPersonalEvents(prev => { const n = { ...prev }; delete n[dateStr]; return n })
    // Remove unavailability too
    await supabase.from('user_unavailability').delete().eq('user_id', user.id).eq('date', dateStr)
    setMyUnavailDates(prev => { const n = new Set(prev); n.delete(dateStr); return n })
  }

  async function handleSaveGroupEvent(dateStr, title, notes, endDate, isTimed, startTime, endTime) {
    if (!group || !user) return
    const existing = groupEvents[dateStr]
    const payload = {
      title, notes,
      start_date: dateStr,
      end_date: endDate || dateStr,
      is_timed: isTimed,
      start_time: isTimed && startTime ? startTime : null,
      end_time: isTimed && endTime ? endTime : null,
    }
    if (existing) {
      const { data } = await supabase.from('group_events')
        .update(payload).eq('id', existing.id).select().single()
      if (data) setGroupEvents(prev => ({ ...prev, [dateStr]: data }))
    } else {
      const { data } = await supabase.from('group_events')
        .insert({ ...payload, group_id: group.id, created_by: user.id }).select().single()
      if (data) {
        setGroupEvents(prev => ({ ...prev, [dateStr]: data }))
        const shortDate = dateStr.split('-').reverse().slice(0, 2).join(' ')
        sendEventPushNotification(data.id, group.id, title, shortDate, user.id)
      }
    }
  }

  async function handleDeleteGroupEvent(dateStr) {
    const existing = groupEvents[dateStr]
    if (!existing) return
    await supabase.from('group_events').delete().eq('id', existing.id)
    setGroupEvents(prev => { const n = { ...prev }; delete n[dateStr]; return n })
  }

  async function handleRsvp(eventId, status) {
    await supabase.from('event_rsvps').upsert(
      { event_id: eventId, user_id: user.id, status, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' }
    )
    setMyRsvps(prev => ({ ...prev, [eventId]: status }))
    setAllRsvps(prev => {
      const existing = (prev[eventId] || []).filter(r => r.user_id !== user.id)
      return { ...prev, [eventId]: [...existing, { user_id: user.id, status }] }
    })
  }

  async function handleOverrideToggle(dateStr) {
    if (!user || !group) return
    const hasOverride = myOverrides.has(dateStr)
    if (hasOverride) {
      await supabase.from('group_event_overrides')
        .delete().eq('user_id', user.id).eq('group_id', group.id).eq('date', dateStr)
      setMyOverrides(prev => { const n = new Set(prev); n.delete(dateStr); return n })
    } else {
      await supabase.from('group_event_overrides')
        .insert({ user_id: user.id, group_id: group.id, date: dateStr })
      setMyOverrides(prev => new Set([...prev, dateStr]))
    }
  }

  function handleDayClick(dateStr) {
    if (displayMode === 'master' || groupEvents[dateStr]) {
      setModalDate(dateStr); return
    }
    handlePersonalToggle(dateStr)
  }

  function handleLongPress(dateStr) {
    setModalDate(dateStr)
  }

  function handleBannerNavigate(event) {
    markEventSeen(event.id)
    setUnseenEvents(prev => prev.filter(e => e.id !== event.id))
    const [y, m] = event.start_date.split('-').map(Number)
    setYear(y); setMonth(m - 1); setCalView('month')
    setDisplayMode('master')
    setTimeout(() => setModalDate(event.start_date), 100)
  }

  function handleDismissAll() {
    unseenEvents.forEach(e => markEventSeen(e.id))
    setUnseenEvents([])
  }

  async function handleEnablePush() {
    setShowPushPrompt(false)
    const granted = await requestPushPermission()
    setPushGranted(granted)
  }

  function prevPeriod() {
    if (calView === 'month') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
    } else setYear(y => y - 1)
  }
  function nextPeriod() {
    if (calView === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
    } else setYear(y => y + 1)
  }

  const threshold = group ? { type: group.threshold_type, value: group.threshold_value } : null

  // Modal unavailability set for the selected date
  const modalUnavailSet = useMemo(() => {
    if (!modalDate) return new Set()
    const s = new Set()
    Object.entries(membersUnavail).forEach(([userId, dates]) => {
      if (dates.has(modalDate)) s.add(userId)
    })
    const eventOnDate = Object.values(groupEvents).find(e =>
      modalDate >= e.start_date && modalDate <= (e.end_date || e.start_date)
    )
    if (eventOnDate) {
      allMembers.forEach(m => { s.add(m.user_id) })
      if (myOverrides.has(modalDate)) s.delete(user.id)
    }
    return s
  }, [modalDate, membersUnavail, groupEvents, allMembers, myOverrides, user])

  const modalEvent = useMemo(() => {
    if (!modalDate) return null
    return Object.values(groupEvents).find(e =>
      modalDate >= e.start_date && modalDate <= (e.end_date || e.start_date)
    ) || null
  }, [modalDate, groupEvents])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
        <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <button
            onClick={() => allMyGroups.length > 1 ? setShowGroupSwitcher(true) : navigate('/app')}
            className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] leading-none flex items-center gap-2"
          >
            {group?.name}
            {allMyGroups.length > 1 && <span className="text-xs font-body font-normal text-[#aaa] normal-case tracking-normal">▾</span>}
          </button>
          <p className="font-body text-xs text-[#888] mt-0.5 flex items-center gap-1">
            {myMember?.is_owner && <Crown size={11} />}
            {myMember?.display_name}
            <span className="mx-1 opacity-40">·</span>
            <Users size={11} />{allMembers.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarViewToggle view={calView} onChange={setCalView} />
          <button
            onClick={() => navigate('/app/settings')}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {showPushPrompt && isPushSupported() && (
        <div className="mx-4 mb-2 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] fade-in">
          <p className="flex-1 font-body text-xs text-white dark:text-[#1a1a18]">Enable notifications for new events?</p>
          <button onClick={handleEnablePush} className="text-xs font-semibold text-green-400 dark:text-green-600 font-body">Yes</button>
          <button onClick={() => setShowPushPrompt(false)} className="text-xs text-white/50 dark:text-black/40 font-body">Not now</button>
        </div>
      )}

      <EventBanner
        unseenEvents={unseenEvents}
        onNavigate={handleBannerNavigate}
        onDismissAll={handleDismissAll}
      />

      <div className="px-4 py-2">
        <div className="flex bg-black/5 dark:bg-white/10 rounded-2xl p-1 gap-1">
          {['personal', 'master'].map(mode => (
            <button key={mode} onClick={() => setDisplayMode(mode)}
              className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all ${
                displayMode === mode
                  ? 'bg-white dark:bg-white/20 shadow-sm text-[#1a1a18] dark:text-[#e8e6e0]'
                  : 'text-[#888]'
              }`}>
              {mode === 'personal' ? 'My Calendar' : 'Group View'}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 pb-4 overflow-hidden">
        {calView === 'month'
          ? <MonthView year={year} month={month} myUnavailable={myUnavailDates}
              allUnavailability={effectiveUnavailability} memberCount={allMembers.length}
              threshold={threshold} viewMode={displayMode} groupEvents={groupEvents}
              onDayClick={handleDayClick} onLongPress={handleLongPress}
              onPrev={prevPeriod} onNext={nextPeriod} />
          : <YearView year={year} myUnavailable={myUnavailDates}
              allUnavailability={effectiveUnavailability} memberCount={allMembers.length}
              threshold={threshold} viewMode={displayMode} groupEvents={groupEvents}
              onMonthClick={(mi) => { setMonth(mi); setCalView('month') }}
              onPrev={prevPeriod} onNext={nextPeriod} />
        }
      </main>

      <div className="px-4 pb-6 flex items-center justify-center gap-3 text-xs text-[#888] font-body flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Event</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Timed</span>
        {displayMode === 'personal'
          ? <>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Unavailable</span>
              <span className="text-[#aaa] text-[10px]">Tap to toggle · Long press to add event</span>
            </>
          : <>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />All free</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Not enough</span>
            </>
        }
      </div>

      {modalDate && (
        <DayModal
          dateStr={modalDate}
          members={allMembers}
          unavailableSet={modalUnavailSet}
          event={modalEvent}
          myId={user.id}
          myOverrides={myOverrides}
          myRsvps={myRsvps}
          allRsvps={allRsvps}
          displayMode={displayMode}
          personalEvent={myPersonalEvents[modalDate] || null}
          onClose={() => setModalDate(null)}
          onSaveGroupEvent={handleSaveGroupEvent}
          onDeleteGroupEvent={handleDeleteGroupEvent}
          onSavePersonalEvent={handleSavePersonalEvent}
          onDeletePersonalEvent={handleDeletePersonalEvent}
          onOverrideToggle={handleOverrideToggle}
          onRsvp={handleRsvp}
        />
      )}

      {showGroupSwitcher && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in"
          onClick={() => setShowGroupSwitcher(false)}>
          <div className="w-full max-w-lg bg-[#f8f7f4] dark:bg-[#1c1c1a] rounded-t-3xl p-6 pb-10 slide-up"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-4">Your Groups</h3>
            <div className="space-y-2">
              {allMyGroups.map(m => (
                <button key={m.id}
                  onClick={() => { setShowGroupSwitcher(false); navigate(`/app/g/${m.groups.token}/m/${m.group_id}`) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all
                    ${m.group_id === groupId
                      ? 'border-green-400/50 bg-green-500/10'
                      : 'border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}>
                  <div className="flex-1">
                    <p className="font-body font-semibold text-sm text-[#1a1a18] dark:text-[#e8e6e0]">{m.groups?.name}</p>
                    <p className="text-xs text-[#888]">{m.display_name}</p>
                  </div>
                  {m.group_id === groupId && <span className="text-xs text-green-500 font-medium">Current</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
