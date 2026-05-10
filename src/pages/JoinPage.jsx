import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function JoinPage() {
  const { token } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'invalid' | 'expired' | 'ready' | 'joining' | 'already_member'

  const [group, setGroup] = useState(null)

  useEffect(() => {
    validateInvite()
  }, [token])

  async function validateInvite() {
    const { data: invite } = await supabase
      .from('group_invites')
      .select('*, groups(id, name)')
      .eq('token', token)
      .maybeSingle()

    if (!invite) { setStatus('invalid'); return }
    if (new Date(invite.expires_at) < new Date()) { setStatus('expired'); return }

    setGroup(invite.groups)

    // If logged in, check if already a member
    if (user) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('group_id', invite.groups.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) { setStatus('already_member'); return }
    }

    setStatus('ready')
  }

  async function handleJoin() {
    if (!user) {
      navigate(`/auth?redirect=/join/${token}`)
      return
    }

    setStatus('joining')

    const displayName = user.user_metadata?.display_name || user.email.split('@')[0]

    const { error } = await supabase.from('members').insert({
      group_id: group.id,
      user_id: user.id,
      display_name: displayName,
      is_owner: false
    })

    if (error) {
      setStatus('ready')
      return
    }

    navigate('/app', { replace: true })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
        <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#f8f7f4] dark:bg-[#111110]">
      <div className="w-full max-w-sm text-center fade-in">
        <h1 className="font-display text-6xl tracking-widest text-[#1a1a18] dark:text-[#e8e6e0] mb-10">BANDCAL</h1>

        {status === 'invalid' && (
          <div className="space-y-4">
            <p className="font-body text-[#888]">This invite link isn't valid.</p>
            <button onClick={() => navigate('/')} className="text-sm text-green-600 dark:text-green-400 font-body">Go home</button>
          </div>
        )}

        {status === 'expired' && (
          <div className="space-y-4">
            <p className="font-body text-[#888]">This invite link has expired. Ask the group owner to generate a new one.</p>
            <button onClick={() => navigate('/')} className="text-sm text-green-600 dark:text-green-400 font-body">Go home</button>
          </div>
        )}

        {status === 'already_member' && (
          <div className="space-y-4">
            <p className="font-body text-[#1a1a18] dark:text-[#e8e6e0]">You're already in <strong>{group?.name}</strong>.</p>
            <button onClick={() => navigate('/app')}
              className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18]">
              Go to app
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'joining') && group && (
          <div className="space-y-6">
            <div>
              <p className="font-body text-[#888] text-sm mb-2">You've been invited to join</p>
              <h2 className="font-display text-4xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0]">{group.name}</h2>
            </div>

            {user ? (
              <button onClick={handleJoin} disabled={status === 'joining'}
                className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18] disabled:opacity-40 transition-all active:scale-[0.98]">
                {status === 'joining' ? 'Joining…' : `Join ${group.name}`}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="font-body text-sm text-[#888]">Create an account or log in to join.</p>
                <button onClick={() => navigate(`/auth?redirect=/join/${token}`)}
                  className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18] transition-all active:scale-[0.98]">
                  Create account / Log in
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
