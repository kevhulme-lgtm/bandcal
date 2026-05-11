import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Copy, Check, Crown, ChevronLeft, X, RefreshCw, Calendar } from '../components/Icons'

export default function GroupPage() {
  const { groupToken } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [myMemberId, setMyMemberId] = useState(null)
  const [members, setMembers] = useState([])
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [thresholdType, setThresholdType] = useState('all')
  const [thresholdValue, setThresholdValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (user) loadGroup() }, [groupToken, user])

  async function loadGroup() {
    const { data: g, error: gErr } = await supabase.from('groups').select('*').eq('token', groupToken).single()
    if (gErr || !g) { setError('Could not load group.'); setLoading(false); return }

    const { data: me, error: meErr } = await supabase.from('members')
      .select('*').eq('group_id', g.id).eq('user_id', user.id).maybeSingle()
    if (meErr || !me) { setError('Could not load membership.'); setLoading(false); return }
    if (!me.is_owner) { navigate(`/app/g/${groupToken}/m/${g.id}`, { replace: true }); return }

    setMyMemberId(me.id)
    setGroup(g)
    setThresholdType(g.threshold_type || 'all')
    setThresholdValue(g.threshold_value || '')

    const { data: mems } = await supabase.from('members').select('*').eq('group_id', g.id)
    setMembers(mems || [])

    const { data: inv } = await supabase.from('group_invites')
      .select('*').eq('group_id', g.id).maybeSingle()
    setInvite(inv)
    setLoading(false)
  }

  async function generateInvite() {
    setRegenerating(true)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    if (invite) {
      const { data } = await supabase.from('group_invites')
        .update({ token: crypto.randomUUID(), expires_at: expiresAt, created_by: user.id })
        .eq('id', invite.id).select().single()
      setInvite(data)
    } else {
      const { data } = await supabase.from('group_invites')
        .insert({ group_id: group.id, created_by: user.id, expires_at: expiresAt })
        .select().single()
      setInvite(data)
    }
    setRegenerating(false)
  }

  function copyInviteLink() {
    if (!invite) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${invite.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function isExpired(inv) {
    return inv && new Date(inv.expires_at) < new Date()
  }

  function expiresLabel(inv) {
    if (!inv) return ''
    const diff = new Date(inv.expires_at) - new Date()
    if (diff <= 0) return 'Expired'
    const hrs = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hrs > 0) return `Expires in ${hrs}h ${mins}m`
    return `Expires in ${mins}m`
  }

  async function removeMember(memberId, memberUserId) {
    if (memberUserId === user.id) return
    await supabase.from('members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function saveThreshold() {
    setSaving(true)
    await supabase.from('groups').update({
      threshold_type: thresholdType,
      threshold_value: thresholdType === 'all' ? null : parseInt(thresholdValue) || null
    }).eq('id', group.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function deleteGroup() {
    setDeleting(true)
    const { error } = await supabase.rpc('delete_group', { group_id_param: group.id })
    if (error) { setDeleting(false); setConfirmDelete(false); setError('Delete failed: ' + error.message); return }
    navigate('/app', { replace: true })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
      <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8f7f4] dark:bg-[#111110] px-6">
      <p className="font-body text-red-500 text-center">{error}</p>
      <button onClick={() => navigate(-1)} className="font-body text-sm text-[#888] underline">Go back</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto px-4 pt-4 pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#888] mb-6 -ml-1">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-1">{group.name}</h1>
      <p className="text-xs text-[#aaa] font-body mb-8">Group settings</p>

      {/* Invite link */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Invite link</h2>
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
          {invite && !isExpired(invite) ? (
            <>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-[#aaa] font-body truncate">
                  {window.location.origin}/join/{invite.token}
                </p>
                <button onClick={copyInviteLink}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0">
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-[#aaa] font-body">{expiresLabel(invite)}</p>
            </>
          ) : (
            <p className="text-sm text-[#888] font-body">
              {invite ? 'This invite link has expired.' : 'No active invite link.'}
            </p>
          )}

          <button onClick={generateInvite} disabled={regenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
              font-body text-sm font-medium disabled:opacity-50 transition-all">
            <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
            {invite && !isExpired(invite) ? 'Regenerate link' : 'Generate link'}
          </button>
          <p className="text-xs text-[#aaa] font-body">Links expire after 24 hours and can be regenerated at any time.</p>
        </div>
      </section>

      {/* Threshold */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Availability threshold</h2>
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
          <div className="space-y-2">
            {[
              { value: 'all', label: 'All members must be free' },
              { value: 'count', label: 'Minimum number of members' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="threshold" value={opt.value}
                  checked={thresholdType === opt.value}
                  onChange={() => setThresholdType(opt.value)}
                  className="accent-green-500" />
                <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">{opt.label}</span>
              </label>
            ))}
          </div>
          {thresholdType === 'count' && (
            <div className="pt-1">
              <label className="text-xs text-[#888] block mb-1">Minimum members needed</label>
              <input type="number" min={1} max={members.length}
                value={thresholdValue} onChange={e => setThresholdValue(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl bg-[#f0efec] dark:bg-white/10 border border-black/10 dark:border-white/10
                  font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-green-400/50" />
            </div>
          )}
          <button onClick={saveThreshold} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
              font-body text-sm font-medium disabled:opacity-50 transition-all">
            {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving…' : 'Save threshold'}
          </button>
        </div>
      </section>

      {/* Members */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Members ({members.length})</h2>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-white dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-1.5">
                  {m.is_owner && <Crown size={12} className="text-amber-500" />}
                  {m.display_name || <span className="text-[#aaa] italic">No name set</span>}
                </p>
              </div>
              {!m.is_owner && (
                <button onClick={() => removeMember(m.id, m.user_id)}
                  className="p-2 rounded-xl hover:bg-red-500/10 transition-colors flex-shrink-0 text-red-400">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Open calendar */}
      <section className="mb-8">
        <button
          onClick={() => navigate(`/app/g/${groupToken}/m/${group.id}`)}
          className="w-full py-3.5 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm font-medium
            text-[#1a1a18] dark:text-[#e8e6e0] flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <Calendar size={16} /> Open group calendar
        </button>
      </section>

      {/* Delete group */}
      <section>
        {confirmDelete ? (
          <div className="bg-red-500/10 border border-red-400/30 rounded-2xl p-4 space-y-3">
            <p className="font-body text-sm text-red-500 font-medium">Delete {group.name}?</p>
            <p className="font-body text-xs text-[#888]">This removes the group, all members, events and invites. This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={deleteGroup} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-body text-sm font-medium disabled:opacity-50 transition-all">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-body text-sm text-[#888]">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full py-3.5 rounded-2xl border border-red-400/30 font-body text-sm font-medium
              text-red-500 hover:bg-red-500/5 transition-colors">
            Delete group
          </button>
        )}
      </section>
    </div>
  )
}
