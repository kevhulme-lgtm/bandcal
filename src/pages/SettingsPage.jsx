import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getStoredTokens, addToken } from '../lib/tokens'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeft, Crown, Link, Check, Copy, Plus } from '../components/Icons'

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { memberToken, groupId } = location.state || {}

  const [member, setMember] = useState(null)
  const [group, setGroup] = useState(null)
  const [nickname, setNickname] = useState('')
  const [groups, setGroups] = useState([]) // all groups this device has tokens for
  const [mergeLink, setMergeLink] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeMsg, setMergeMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadData() }, [memberToken])

  async function loadData() {
    if (!memberToken) return

    const { data: mem } = await supabase
      .from('members')
      .select('*, groups(*)')
      .eq('token', memberToken)
      .single()

    if (mem) {
      setMember(mem)
      setGroup(mem.groups)
      setNickname(mem.nickname || '')
    }

    // Load all groups from stored tokens
    const tokens = getStoredTokens()
    if (tokens.length > 0) {
      const { data: mems } = await supabase
        .from('members')
        .select('*, groups(*)')
        .in('token', tokens)

      setGroups(mems || [])
    }
  }

  async function saveNickname() {
    if (!member || !nickname.trim()) return
    setSaving(true)
    await supabase.from('members').update({ nickname: nickname.trim() }).eq('id', member.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function mergeAccount() {
    setMerging(true)
    setMergeMsg('')

    // Extract token from URL or raw token
    let token = mergeLink.trim()
    const match = token.match(/\/m\/([a-f0-9-]{36})/)
    if (match) token = match[1]

    if (!token.match(/^[a-f0-9-]{36}$/)) {
      setMergeMsg('That doesn\'t look like a valid link.')
      setMerging(false)
      return
    }

    const { data: existing } = await supabase.from('members').select('*, groups(*)').eq('token', token).single()
    if (!existing) {
      setMergeMsg('Link not found. Double-check and try again.')
      setMerging(false)
      return
    }

    addToken(token)
    setMergeLink('')
    setMergeMsg(`Linked! ${existing.groups?.name} added to your groups.`)
    loadData()
    setMerging(false)
  }

  function copyMyLink() {
    if (!memberToken) return
    navigator.clipboard.writeText(`${window.location.origin}/m/${memberToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function createNewGroup() {
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const ownerToken = uuidv4()
      const groupToken = uuidv4()
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ token: groupToken, name: newGroupName.trim(), owner_token: ownerToken, threshold_type: 'all', threshold_value: null })
        .select().single()
      if (gErr) throw gErr
      await supabase.from('members').insert({
        token: ownerToken, group_id: group.id,
        nickname: member?.nickname || 'Owner', is_owner: true
      })
      addToken(ownerToken)
      setNewGroupName('')
      setShowCreateGroup(false)
      navigate(`/m/${ownerToken}`)
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] dark:bg-[#111110] max-w-lg mx-auto px-4 pt-4 pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#888] mb-6 -ml-1">
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-8">Settings</h1>

      {/* Nickname */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Your name in {group?.name}</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Nickname"
            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
              font-body text-[#1a1a18] dark:text-[#e8e6e0] focus:outline-none focus:ring-2 focus:ring-green-400/50"
          />
          <button
            onClick={saveNickname}
            disabled={saving}
            className="px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
              font-body text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {saved ? <><Check size={14} /> Saved</> : 'Save'}
          </button>
        </div>
      </section>

      {/* My link */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">My link for {group?.name}</h2>
        <div className="bg-white dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10 flex items-center gap-3">
          <p className="text-xs text-[#aaa] truncate flex-1 font-body">{window.location.origin}/m/{memberToken}</p>
          <button onClick={copyMyLink} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0">
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-xs text-[#aaa] mt-2">This is your personal link for this group. Keep it safe — anyone with it can update your availability.</p>
      </section>

      {/* My groups */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Your groups</h2>
        <div className="space-y-2">
          {groups.map(m => (
            <button
              key={m.token}
              onClick={() => navigate(`/m/${m.token}`)}
              className="w-full flex items-center gap-3 bg-white dark:bg-white/5 rounded-2xl px-4 py-3 border border-black/10 dark:border-white/10 text-left"
            >
              <div className="flex-1">
                <p className="font-body text-sm font-medium text-[#1a1a18] dark:text-[#e8e6e0] flex items-center gap-1.5">
                  {m.is_owner && <Crown size={12} className="text-amber-500" />}
                  {m.groups?.name}
                </p>
                <p className="text-xs text-[#aaa]">{m.nickname || 'No name set'}</p>
              </div>
              <ChevronLeft size={16} className="rotate-180 text-[#aaa]" />
            </button>
          ))}
        </div>
      </section>

      {/* Create new group */}
      <section className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Create another group</h2>
        {!showCreateGroup ? (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="w-full py-3.5 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm font-medium
              text-[#1a1a18] dark:text-[#e8e6e0] flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            + Create new group
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createNewGroup()}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
            <div className="flex gap-2">
              <button
                onClick={createNewGroup}
                disabled={creating || !newGroupName.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
                  font-body text-sm font-semibold disabled:opacity-40"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => { setShowCreateGroup(false); setNewGroupName('') }}
                className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Merge links */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-1">Link another group</h2>
        <p className="text-xs text-[#aaa] mb-3 font-body">Paste a member link from another group to access it from this device.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={mergeLink}
            onChange={e => setMergeLink(e.target.value)}
            placeholder="https://bandcal.app/m/..."
            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
              font-body text-xs text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
          />
          <button
            onClick={mergeAccount}
            disabled={merging || !mergeLink.trim()}
            className="px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
              font-body text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <Link size={14} /> Link
          </button>
        </div>
        {mergeMsg && <p className="text-xs mt-2 text-green-600 dark:text-green-400">{mergeMsg}</p>}
      </section>

      {/* Create new group */}
      <section className="mt-8 pt-8 border-t border-black/10 dark:border-white/10">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#888] mb-3">Create another group</h2>
        {!showCreateGroup ? (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="w-full py-3 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm font-medium
              text-[#1a1a18] dark:text-[#e8e6e0] flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Plus size={16} /> New group
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createNewGroup()}
              className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
            <button
              onClick={createNewGroup}
              disabled={creatingGroup || !newGroupName.trim()}
              className="px-4 py-3 rounded-2xl bg-[#1a1a18] dark:bg-[#e8e6e0] text-white dark:text-[#1a1a18]
                font-body text-sm font-semibold disabled:opacity-40"
            >
              {creatingGroup ? '…' : 'Create'}
            </button>
          </div>
        )}
      </section>

      {/* Owner link to group management */}
      {member?.is_owner && group && (
        <section className="mt-4">
          <button
            onClick={() => navigate(`/g/${group.token}`)}
            className="w-full py-3.5 rounded-2xl border border-black/10 dark:border-white/10 font-body text-sm font-medium
              text-[#1a1a18] dark:text-[#e8e6e0] flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Crown size={16} /> Manage group & members
          </button>
        </section>
      )}
    </div>
  )
}
