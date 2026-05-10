import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { Copy, Check, Plus, Crown, ChevronLeft, X } from '../components/Icons'

export default function GroupPage() {
  const { groupToken } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [thresholdType, setThresholdType] = useState('all')
  const [thresholdValue, setThresholdValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadGroup() }, [groupToken])

  async function loadGroup() {
    const { data: g } = await supabase.from('groups').select('*').eq('token', groupToken).single()
    if (!g) { navigate('/'); return }
    setGroup(g)
    setThresholdType(g.threshold_type || 'all')
    setThresholdValue(g.threshold_value || '')

    const { data: mems } = await supabase.from('members').select('*').eq('group_id', g.id)
    setMembers(mems || [])
    setLoading(false)
  }

  async function addMemberLink() {
    const token = uuidv4()
    const { error } = await supabase
      .from('members')
      .insert({ token, group_id: group.id, nickname: null, is_owner: false })
    if (!error) loadGroup()
  }

  async function removeMember(memberId) {
    await supabase.from('members').delete().eq('id', memberId)
    loadGroup()
  }

  function copyLink(token) {
    const url = `${window.location.origin}/m/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function saveThreshold() {
    setSaving(true)
    await supabase
      .from('groups')
      .update({
        threshold_type: thresholdType,
        threshold_value: thresholdType === 'all' ? null : parseInt(thresholdValue) || null
      })
      .eq('id', group.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
      <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto px-4 pt-4 pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#888] mb-6 -ml-1">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-1">{group.name}</h1>
      <p className="text-xs text-[#aaa] font-body mb-8">Group settings</p>

      {/* Threshold */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Availability threshold</h2>
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
          <div className="space-y-2">
            {[
              { value: 'all', label: 'All members must be free' },
              { value: 'count', label: 'Minimum number of members' },
              { value: 'required', label: 'Specific required members' },
            ].map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="threshold"
                  value={opt.value}
                  checked={thresholdType === opt.value}
                  onChange={() => setThresholdType(opt.value)}
                  className="accent-green-500"
                />
                <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">{opt.label}</span>
              </label>
            ))}
          </div>

          {thresholdType === 'count' && (
            <div className="pt-1">
              <label className="text-xs text-[#888] block mb-1">Minimum members needed</label>
              <input
                type="number"
                min={1}
                max={members.length}
                value={thresholdValue}
                onChange={e => setThresholdValue(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl bg-[#f0efec] dark:bg-white/10 border border-black/10 dark:border-white/10
                  font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-green-400/50"
              />
            </div>
          )}

          {thresholdType === 'required' && (
            <div className="pt-1">
              <label className="text-xs text-[#888] block mb-2">Required members (must be free for day to show green)</label>
              <div className="space-y-1">
                {members.filter(m => m.nickname).map(m => (
                  <label key={m.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="accent-green-500" />
                    <span className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-1">
                      {m.is_owner && <Crown size={12} />} {m.nickname}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={saveThreshold}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
              font-body text-sm font-medium disabled:opacity-50 transition-all"
          >
            {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving…' : 'Save threshold'}
          </button>
        </div>
      </section>

      {/* Members */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#888]">Members ({members.length})</h2>
          <button
            onClick={addMemberLink}
            className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
          >
            <Plus size={14} /> Add link
          </button>
        </div>

        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-white dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10">
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-1.5">
                  {m.is_owner && <Crown size={12} className="text-amber-500" />}
                  {m.nickname || <span className="text-[#aaa] italic">Awaiting name…</span>}
                </p>
                <p className="text-xs text-[#aaa] truncate">{window.location.origin}/m/{m.token}</p>
              </div>
              <button
                onClick={() => copyLink(m.token)}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
              >
                {copied === m.token ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              {!m.is_owner && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="p-2 rounded-xl hover:bg-red-500/10 transition-colors flex-shrink-0 text-red-400"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[#aaa] mt-4 text-center font-body">
          Share each link with the relevant bandmate. They tap their link to open the app — no account needed.
        </p>
      </section>
    </div>
  )
}
