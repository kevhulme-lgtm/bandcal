import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Crown, Plus, Settings } from '../components/Icons'

export default function AppHome() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0]

  useEffect(() => { loadGroups() }, [user])

  async function loadGroups() {
    if (!user) return
    const { data } = await supabase
      .from('members')
      .select('*, groups(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setGroups(data || [])
    setLoading(false)

    // If only one group, go straight there
    if (data?.length === 1) {
      navigate(`/app/g/${data[0].groups.token}/m/${data[0].group_id}`, { replace: true })
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreating(true)

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), created_by: user.id })
      .select()
      .single()

    if (error) { setCreating(false); return }

    await supabase.from('members').insert({
      group_id: group.id,
      user_id: user.id,
      display_name: displayName,
      is_owner: true
    })

    setCreating(false)
    setNewGroupName('')
    setShowCreate(false)
    navigate(`/app/g/${group.token}/m/${group.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
        <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto px-4 pt-4 pb-10 fade-in">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">BANDCAL</h1>
        <button onClick={() => navigate('/app/settings')}
          className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <Settings size={18} />
        </button>
      </header>

      <p className="text-xs text-[#888] font-body mb-6">Hey {displayName} — pick a group or create one.</p>

      <div className="space-y-2 mb-6">
        {groups.map(m => (
          <button
            key={m.id}
            onClick={() => navigate(`/app/g/${m.groups.token}/m/${m.group_id}`)}
            className="w-full flex items-center gap-3 bg-white dark:bg-white/5 rounded-2xl px-4 py-4 border border-black/10 dark:border-white/10 text-left hover:border-black/20 dark:hover:border-white/20 transition-all"
          >
            <div className="flex-1">
              <p className="font-display text-xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-2">
                {m.is_owner && <Crown size={14} className="text-amber-500" />}
                {m.groups.name}
              </p>
              <p className="font-body text-xs text-[#888] mt-0.5">{m.display_name}</p>
            </div>
            <span className="text-[#aaa] text-lg">›</span>
          </button>
        ))}

        {groups.length === 0 && (
          <p className="text-center text-sm text-[#888] font-body py-8">
            No groups yet. Create one or use an invite link from a bandmate.
          </p>
        )}
      </div>

      {showCreate ? (
        <div className="space-y-3">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Group name"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && createGroup()}
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
              font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
          />
          <div className="flex gap-2">
            <button onClick={createGroup} disabled={creating || !newGroupName.trim()}
              className="flex-1 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18] font-body font-semibold text-sm disabled:opacity-40">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setNewGroupName('') }}
              className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)}
          className="w-full py-3.5 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm font-medium
            text-[#1a1a18] dark:text-[#e8e6e0] flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <Plus size={16} /> New group
        </button>
      )}
    </div>
  )
}
