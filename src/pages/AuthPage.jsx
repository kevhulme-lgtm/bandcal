import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const redirect = searchParams.get('redirect') || '/app'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
      else navigate(redirect, { replace: true })
    } else if (mode === 'register') {
      if (!displayName.trim()) { setError('Please enter your name.'); setLoading(false); return }
      const { error } = await signUp(email, password, displayName.trim())
      if (error) setError(error.message)
      else navigate(redirect, { replace: true })
    } else if (mode === 'reset') {
      const { error } = await resetPassword(email)
      if (error) setError(error.message)
      else setResetSent(true)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#f8f7f4] dark:bg-[#111110]">
      <div className="w-full max-w-sm fade-in">

        <div className="text-center mb-10">
          <h1 className="font-display text-6xl tracking-widest text-[#1a1a18] dark:text-[#e8e6e0]">BANDCAL</h1>
          <p className="font-body text-sm text-[#888] mt-1 tracking-wide">Band availability, zero hassle.</p>
        </div>

        {mode === 'reset' ? (
          resetSent ? (
            <div className="text-center space-y-4">
              <p className="font-body text-sm text-[#1a1a18] dark:text-[#e8e6e0]">
                Check your email — we've sent a reset link to <strong>{email}</strong>.
              </p>
              <button onClick={() => { setMode('login'); setResetSent(false) }}
                className="text-sm text-green-600 dark:text-green-400 font-body">
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-display text-2xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-6">Reset password</h2>
              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50" />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18] disabled:opacity-40 transition-all active:scale-[0.98]">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => setMode('login')}
                className="w-full text-sm text-[#888] font-body text-center">
                Back to login
              </button>
            </form>
          )
        ) : (
          <>
            {/* Tab toggle */}
            <div className="flex bg-black/5 dark:bg-white/10 rounded-2xl p-1 gap-1 mb-6">
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => { setMode(m); setError('') }}
                  className={`flex-1 py-2 rounded-xl text-sm font-body font-medium transition-all ${
                    mode === m
                      ? 'bg-white dark:bg-white/20 shadow-sm text-[#1a1a18] dark:text-[#e8e6e0]'
                      : 'text-[#888]'
                  }`}>
                  {m === 'login' ? 'Log in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Your name</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    placeholder="What your bandmates will see"
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                      font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50" />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                    font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18] disabled:opacity-40 transition-all active:scale-[0.98]">
                {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>

              {mode === 'login' && (
                <button type="button" onClick={() => { setMode('reset'); setError('') }}
                  className="w-full text-sm text-[#888] font-body text-center">
                  Forgot password?
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
