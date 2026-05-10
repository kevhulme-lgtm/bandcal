import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { addToken, formatDate, getStoredTokens } from '../lib/tokens'
import { MonthView, YearView, CalendarViewToggle } from '../components/Calendar'
import DayModal from '../components/DayModal'
import EventBanner from '../components/EventBanner'
import { Settings, Crown, Users } from '../components/Icons'
import NicknameModal from '../components/NicknameModal'
import { registerServiceWorker, requestPushPermission, isPushSupported, sendEventPush } from '../lib/push'

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
  const { memberToken } = useParams()
  const navigate = useNavigate()

  const [member, setMember] = useState(null)
  const [group, setGroup] = useState(null)
  const [allMembers, setAllMembers] = useState([])
  const [myUnavailable, setMyUnavailable] = useState(new Set())
  const [allUnavailability, setAllUnavailability] = useState({})
  const [memberUnavailMap, setMemberUnavailMap] = useState({})
  const [groupEvents, setGroupEvents] = useState({})
  const [myOverrides, setMyOverrides] = useState(new Set())
  const [unseenEvents, setUnseenEvents] = useState([])
  const [pushGranted, setPushGranted] = useState(false)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const [calView, setCalView] = useState('month')
  const [displayMode, setDisplayMode] = useState('personal')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [modalDate, setModalDate] = useState(null)
  const [showNickname, setShowNickname] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [showGroupSwitcher, setShowGroupSwitcher] = useState(false)
  const [allMyGroups, setAllMyGroups] = useState([])

  useEffect(() => {
    if (!memberToken) return
    registerServiceWorker()
    loadAll()
  }, [memberToken])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: mem } = await supabase
        .from('members').select('*, groups(*)').eq('token', memberToken).maybeSingle()
      if (!mem) {
        // Token invalid — do NOT store it, clear any existing tokens, go home
        localStorage.removeItem('bandcal_tokens')
        navigate('/', { replace: true })
        return
      }
      // Only store token once confirmed valid
      addToken(memberToken)

      setMember(mem)
      setGroup(mem.groups)
      if (!mem.nickname) setShowNickname(true)

      // Load all groups this device has access to (for switcher)
      const tokens = getStoredTokens()
      if (tokens.length > 1) {
        const { data: myMems } = await supabase
          .from('members')
          .select('token, nickname, groups(id, name)')
          .in('token', tokens)
        setAllMyGroups(myMems || [])
      }

      const { data: members } = await supabase
        .from('members').select('id, nickname, is_owner, token').eq('group_id', mem.groups.id)
      setAllMembers(members || [])

      const memberIds = (members || []).map(m => m.id)
      const myMember = members.find(m => m.token === memberToken)
      const myId = myMember?.id

      const { data: unavail } = await supabase
        .from('availability').select('member_id, date, type').in('member_id', memberIds)

      const mySet = new Set(), myOverrideSet = new Set(), countMap = {}, memberMap = {}
      ;(unavail || []).forEach(({ member_id, date, type }) => {
        if (member_id === myId) {
          if (type === 'personal') mySet.add(date)
          if (type === 'group_event_override') myOverrideSet.add(date)
        }
        if (type === 'personal') {
          countMap[date] = (countMap[date] || 0) + 1
          if (!memberMap[member_id]) memberMap[member_id] = new Set()
          memberMap[member_id].add(date)
        }
      })
      setMyUnavailable(mySet)
      setMyOverrides(myOverrideSet)
      setAllUnavailability(countMap)
      setMemberUnavailMap(memberMap)

      const { data: events } = await supabase
        .from('group_events').select('*').eq('group_id', mem.groups.id)
        .order('start_date', { ascending: true })

      const eventsMap = {}
      const today = formatDate(new Date())
      const seen = getSeenEventIds()
      const unseen = []

      ;(events || []).forEach(e => {
        eventsMap[e.start_date] = e
        // Show banner for future/today events not yet seen, not created by self
        if (e.start_date >= today && !seen.has(e.id) && e.created_by_member_id !== myId) {
          unseen.push(e)
        }
      })
      setGroupEvents(eventsMap)
      setUnseenEvents(unseen)

      // Check push permission status
      if (isPushSupported()) {
        const perm = Notification.permission
        setPushGranted(perm === 'granted')
        // Show prompt once if not decided
        if (perm === 'default' && mem.nickname) setShowPushPrompt(true)
      }

    } finally { setLoading(false) }
  }

  const myId = useMemo(() => allMembers.find(m => m.token === memberToken)?.id, [allMembers, memberToken])
  const myIdRef = useRef(null)
  useEffect(() => { myIdRef.current = myId }, [myId])

  useEffect(() => {
    if (!group) return
    const channel = supabase.channel(`group-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, (payload) => {
        const changed = payload.new?.member_id || payload.old?.member_id
        if (changed === myIdRef.current) return
        loadAll()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_events' }, () => {
        loadAll()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_events' }, () => {
        loadAll()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_events' }, () => {
        loadAll()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [group?.id])

  async function handlePersonalToggle(dateStr) {
    if (!myId || toggling) return
    setToggling(dateStr)
    const isOut = myUnavailable.has(dateStr)
    try {
      if (isOut) {
        await supabase.from('availability').delete()
          .eq('member_id', myId).eq('date', dateStr).eq('type', 'personal')
        setMyUnavailable(prev => { const n = new Set(prev); n.delete(dateStr); return n })
        setAllUnavailability(prev => {
          const n = { ...prev }
          n[dateStr] = Math.max(0, (n[dateStr] || 1) - 1)
          if (n[dateStr] === 0) delete n[dateStr]
          return n
        })
        setMemberUnavailMap(prev => {
          const n = { ...prev }
          if (n[myId]) { n[myId] = new Set(n[myId]); n[myId].delete(dateStr) }
          return n
        })
      } else {
        await supabase.from('availability').insert({ member_id: myId, date: dateStr, type: 'personal' })
        setMyUnavailable(prev => new Set([...prev, dateStr]))
        setAllUnavailability(prev => ({ ...prev, [dateStr]: (prev[dateStr] || 0) + 1 }))
        setMemberUnavailMap(prev => {
          const n = { ...prev }
          if (!n[myId]) n[myId] = new Set(); else n[myId] = new Set(n[myId])
          n[myId].add(dateStr)
          return n
        })
      }
    } catch (err) { console.error(err) }
    finally { setToggling(null) }
  }

  async function handleSaveEvent(dateStr, title, notes, endDate, isTimed, startTime, endTime) {
    if (!group || !myId) return
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
        .insert({ ...payload, group_id: group.id, created_by_member_id: myId })
        .select().single()
      if (data) {
        setGroupEvents(prev => ({ ...prev, [dateStr]: data }))
        // Send push to other members
        const shortDate = dateStr.split('-').reverse().slice(0, 2).join(' ')
        sendEventPushNotification(group.id, title, shortDate, member.nickname, `${window.location.origin}/m/${memberToken}`)
      }
    }
  }

  async function handleDeleteEvent(dateStr) {
    const existing = groupEvents[dateStr]
    if (!existing) return
    await supabase.from('group_events').delete().eq('id', existing.id)
    setGroupEvents(prev => { const n = { ...prev }; delete n[dateStr]; return n })
  }

  async function handleOverrideToggle(dateStr) {
    if (!myId) return
    const hasOverride = myOverrides.has(dateStr)
    if (hasOverride) {
      await supabase.from('availability').delete()
        .eq('member_id', myId).eq('date', dateStr).eq('type', 'group_event_override')
      setMyOverrides(prev => { const n = new Set(prev); n.delete(dateStr); return n })
    } else {
      await supabase.from('availability').insert({ member_id: myId, date: dateStr, type: 'group_event_override' })
      setMyOverrides(prev => new Set([...prev, dateStr]))
    }
  }

  function handleDayClick(dateStr) {
    if (displayMode === 'master' || groupEvents[dateStr]) {
      setModalDate(dateStr); return
    }
    handlePersonalToggle(dateStr)
  }

  function handleBannerNavigate(event) {
    markEventSeen(event.id)
    setUnseenEvents(prev => prev.filter(e => e.id !== event.id))
    // Navigate to event month
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
    if (!myId) return
    const granted = await requestPushPermission(myId)
    setPushGranted(granted)
  }

  function handleLongPress(dateStr) {
    // Long press on personal calendar = open event modal for personal event
    setModalDate(dateStr)
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

  const effectiveUnavailability = useMemo(() => {
    const result = { ...allUnavailability }
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
  }, [allUnavailability, groupEvents, allMembers])

  const modalUnavailSet = useMemo(() => {
    if (!modalDate) return new Set()
    const s = new Set()
    Object.entries(memberUnavailMap).forEach(([memberId, dates]) => {
      if (dates.has(modalDate)) s.add(memberId)
    })
    // Check if modalDate falls within any event range
    const eventOnDate = Object.values(groupEvents).find(e => {
      return modalDate >= e.start_date && modalDate <= (e.end_date || e.start_date)
    })
    if (eventOnDate) {
      allMembers.forEach(m => { s.add(m.id) })
      if (myOverrides.has(modalDate)) s.delete(myId)
    }
    return s
  }, [modalDate, memberUnavailMap, groupEvents, allMembers, myOverrides, myId])

  // Find the event for modal (could be multi-day — find by date range)
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
            onClick={() => allMyGroups.length > 1 && setShowGroupSwitcher(true)}
            className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] leading-none flex items-center gap-2"
          >
            {group?.name}
            {allMyGroups.length > 1 && <span className="text-xs font-body font-normal text-[#aaa] normal-case tracking-normal">▾</span>}
          </button>
          <p className="font-body text-xs text-[#888] mt-0.5 flex items-center gap-1">
            {member?.is_owner && <Crown size={11} />}
            {member?.nickname}
            <span className="mx-1 opacity-40">·</span>
            <Users size={11} />{allMembers.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarViewToggle view={calView} onChange={setCalView} />
          <button
            onClick={() => navigate('/settings', { state: { memberToken, groupId: group?.id } })}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Push notification prompt */}
      {showPushPrompt && isPushSupported() && (
        <div className="mx-4 mb-2 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] fade-in">
          <p className="flex-1 font-body text-xs text-white dark:text-[#1a1a18]">
            Enable notifications for new events?
          </p>
          <button onClick={handleEnablePush} className="text-xs font-semibold text-green-400 dark:text-green-600 font-body">
            Yes
          </button>
          <button onClick={() => setShowPushPrompt(false)} className="text-xs text-white/50 dark:text-black/40 font-body">
            Not now
          </button>
        </div>
      )}

      {/* Event banner */}
      <EventBanner
        unseenEvents={unseenEvents}
        onNavigate={handleBannerNavigate}
        onDismissAll={handleDismissAll}
      />

      {/* Mode toggle */}
      <div className="px-4 py-2">
        <div className="flex bg-black/5 dark:bg-white/10 rounded-2xl p-1 gap-1">
          {['personal', 'master'].map(mode => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all ${
                displayMode === mode
                  ? 'bg-white dark:bg-white/20 shadow-sm text-[#1a1a18] dark:text-[#e8e6e0]'
                  : 'text-[#888]'
              }`}
            >
              {mode === 'personal' ? 'My Calendar' : 'Group View'}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 pb-4 overflow-hidden">
        {calView === 'month'
          ? <MonthView year={year} month={month} myUnavailable={myUnavailable}
              allUnavailability={effectiveUnavailability} memberCount={allMembers.length}
              threshold={threshold} viewMode={displayMode} groupEvents={groupEvents}
              onDayClick={handleDayClick} onPrev={prevPeriod} onNext={nextPeriod} />
          : <YearView year={year} myUnavailable={myUnavailable}
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
              <span className="text-[#aaa] text-[10px]">Tap to toggle</span>
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
          myId={myId}
          myOverrides={myOverrides}
          displayMode={displayMode}
          onClose={() => setModalDate(null)}
          onSaveEvent={handleSaveEvent}
          onDeleteEvent={handleDeleteEvent}
          onOverrideToggle={handleOverrideToggle}
        />
      )}

      {/* Group switcher modal */}
      {showGroupSwitcher && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm fade-in"
          onClick={() => setShowGroupSwitcher(false)}
        >
          <div
            className="w-full max-w-lg bg-[#f8f7f4] dark:bg-[#1c1c1a] rounded-t-3xl p-6 pb-10 slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-4">Your Groups</h3>
            <div className="space-y-2">
              {allMyGroups.map(m => (
                <button
                  key={m.token}
                  onClick={() => {
                    setShowGroupSwitcher(false)
                    navigate(`/m/${m.token}`)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all
                    ${m.token === memberToken
                      ? 'border-green-400/50 bg-green-500/10'
                      : 'border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                >
                  <div className="flex-1">
                    <p className="font-body font-semibold text-sm text-[#1a1a18] dark:text-[#e8e6e0]">{m.groups?.name}</p>
                    <p className="text-xs text-[#888]">{m.nickname || 'No name set'}</p>
                  </div>
                  {m.token === memberToken && <span className="text-xs text-green-500 font-medium">Current</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNickname && (
        <NicknameModal
          onSave={async (name) => {
            if (!myId) return
            await supabase.from('members').update({ nickname: name }).eq('id', myId)
            setMember(prev => ({ ...prev, nickname: name }))
            setAllMembers(prev => prev.map(m => m.id === myId ? { ...m, nickname: name } : m))
            setShowNickname(false)
          }}
        />
      )}
    </div>
  )
}
