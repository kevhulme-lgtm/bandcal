import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ChevronLeft, Check, Crown } from '../components/Icons'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [groups, setGroups] = useState([])
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '')
  const [savingName, setSavingName] = useState(false)
  const [savedName, setSavedName] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadGroups() }, [user])

  async function loadGroups() {
    if (!user) return
    const { data } = await supabase
      .from('members').select('*, groups(*)')
      .eq('user_id', user.id)
    setGroups(data || [])
    setLoading(false)
  }

  async function saveDisplayName() {
    if (!displayName.trim()) return
    setSavingName(true)
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
    setSavingName(false)
    setSavedName(true)
    setTimeout(() => setSavedName(false), 2000)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto px-4 pt-4 pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#888] mb-6 -ml-1">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-8">Settings</h1>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Account</h2>
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10 space-y-3">
          <p className="font-body text-xs text-[#888]">{user?.email}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="flex-1 px-4 py-3 rounded-2xl bg-[#f0efec] dark:bg-white/10 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
            <button onClick={saveDisplayName} disabled={savingName}
              className="px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
                font-body text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
              {savedName ? <><Check size={14} /> Saved</> : 'Save'}
            </button>
          </div>
          <p className="text-xs text-[#aaa] font-body">This is your default name across all groups.</p>
        </div>
      </section>

      {/* Groups */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Your groups</h2>
        {loading ? (
          <p className="text-sm text-[#888] font-body">Loading…</p>
        ) : (
          <div className="space-y-2">
            {groups.map(m => (
              <button key={m.id}
                onClick={() => navigate(`/app/g/${m.groups.token}/m/${m.group_id}`)}
                className="w-full flex items-center gap-3 bg-white dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10 text-left hover:border-black/20 dark:hover:border-white/20 transition-all">
                <div className="flex-1">
                  <p className="font-body text-sm font-medium text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-1.5">
                    {m.is_owner && <Crown size={12} className="text-amber-500" />}
                    {m.groups?.name}
                  </p>
                  <p className="text-xs text-[#aaa]">{m.display_name}</p>
                </div>
                <span className="text-[#aaa]">›</span>
              </button>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-[#888] font-body">No groups yet.</p>
            )}
          </div>
        )}
      </section>

      {/* Sign out */}
      <section>
        <button onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl border border-red-400/30 font-body text-sm font-medium
            text-red-500 hover:bg-red-500/5 transition-colors">
          Sign out
        </button>
      </section>
    </div>
  )
}
