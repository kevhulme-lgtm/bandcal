import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { addToken, getStoredTokens } from '../lib/tokens'

export default function Home() {
  const [groupName, setGroupName] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // On load, if we have a stored token, validate it before redirecting
  useEffect(() => {
    const tokens = getStoredTokens()
    if (tokens.length === 0) { setLoading(false); return }

    const validate = async () => {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('id')
          .eq('token', tokens[0])
          .maybeSingle()

        if (data && !error) {
          // Valid token — redirect
          navigate(`/m/${tokens[0]}`, { replace: true })
        } else {
          // Invalid, expired, or network error — clear all tokens and show homepage
          localStorage.removeItem('bandcal_tokens')
          setLoading(false)
        }
      } catch {
        // Any unexpected error — clear and show homepage, never loop
        localStorage.removeItem('bandcal_tokens')
        setLoading(false)
      }
    }

    validate()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!groupName.trim() || !nickname.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const ownerToken = uuidv4()
      const groupToken = uuidv4()

      // Create group
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .insert({ token: groupToken, name: groupName.trim(), owner_token: ownerToken, threshold_type: 'all', threshold_value: null })
        .select()
        .single()

      if (gErr) throw gErr

      // Create owner as first member
      const { error: mErr } = await supabase
        .from('members')
        .insert({ token: ownerToken, group_id: group.id, nickname: nickname.trim(), is_owner: true })

      if (mErr) throw mErr

      addToken(ownerToken)
      navigate(`/m/${ownerToken}`)
    } catch (err) {
      setError('Something went wrong. Check your Supabase setup.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const [existingLink, setExistingLink] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  async function handleExistingLink() {
    let token = existingLink.trim()
    const match = token.match(/\/m\/([a-f0-9-]{36})/)
    if (match) token = match[1]

    if (!token.match(/^[a-f0-9-]{36}$/)) {
      setLinkError("That doesn't look like a valid link.")
      return
    }

    setLinkLoading(true)
    setLinkError('')
    const { data } = await supabase.from('members').select('id').eq('token', token).single()
    if (!data) {
      setLinkError('Link not found. Double-check and try again.')
      setLinkLoading(false)
      return
    }
    addToken(token)
    navigate(`/m/${token}`, { replace: true })
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#f8f7f4] dark:bg-[#111110]">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-6xl tracking-widest text-[#1a1a18] dark:text-[#e8e6e0]">BANDCAL</h1>
          <p className="font-body text-sm text-[#888] mt-1 tracking-wide">Band availability, zero hassle.</p>
        </div>

        {/* Existing link login */}
        <div className="mb-8">
          <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Already have a link?</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={existingLink}
              onChange={e => { setExistingLink(e.target.value); setLinkError('') }}
              placeholder="Paste your unique link here"
              className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50 transition-all"
            />
            <button
              onClick={handleExistingLink}
              disabled={linkLoading || !existingLink.trim()}
              className="px-4 py-3 rounded-2xl bg-green-500 text-white font-body font-semibold text-sm
                disabled:opacity-40 transition-all active:scale-[0.98] flex-shrink-0"
            >
              {linkLoading ? '…' : 'Go'}
            </button>
          </div>
          {linkError && <p className="text-xs text-red-500 mt-1.5">{linkError}</p>}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
          <span className="text-xs text-[#aaa] font-body">or create a new group</span>
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Give your group a name"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Your name</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Give yourself a nickname"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50 transition-all"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !groupName.trim() || !nickname.trim()}
            className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18]
              disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {submitting ? 'Creating…' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  )
}
