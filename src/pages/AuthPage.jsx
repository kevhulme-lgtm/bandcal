import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const redirect = searchParams.get('redirect') || '/app'

  function validateUsername(u) {
    if (!u.trim()) return 'Please enter a username.'
    if (u.trim().length < 2) return 'Username must be at least 2 characters.'
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(u.trim())) return 'Username can only contain letters, numbers, spaces, and _ - .'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const usernameError = validateUsername(username)
    if (usernameError) { setError(usernameError); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(username, password)
      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Incorrect username or password.'
          : error.message)
      } else {
        navigate(redirect, { replace: true })
      }
    } else {
      const { error } = await signUp(username, password)
      if (error) {
        setError(error.message.includes('already registered')
          ? 'That username is already taken.'
          : error.message)
      } else {
        navigate(redirect, { replace: true })
      }
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
          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={mode === 'register' ? 'What your bandmates will see' : 'Your username'}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-widest text-[#888] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
                font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18] disabled:opacity-40 transition-all active:scale-[0.98]">
            {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

      </div>
    </div>
  )
}
