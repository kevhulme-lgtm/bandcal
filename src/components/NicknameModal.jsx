import { useState } from 'react'

export default function NicknameModal({ onSave }) {
  const [name, setName] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#f8f7f4] dark:bg-[#1a1a18] rounded-t-3xl p-6 pb-12 slide-up">
        <h3 className="font-display text-3xl tracking-wider text-[#1a1a18] dark:text-[#e8e6e0] mb-2">Welcome</h3>
        <p className="font-body text-sm text-[#888] mb-6">What should we call you in this group?</p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name or nickname"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10
            font-body text-[#1a1a18] dark:text-[#e8e6e0] placeholder-[#aaa] focus:outline-none focus:ring-2 focus:ring-green-400/50 mb-4"
        />

        <button
          onClick={() => name.trim() && onSave(name.trim())}
          disabled={!name.trim()}
          className="w-full py-3.5 rounded-2xl font-body font-semibold text-white bg-[#1a1a18] dark:bg-[#e8e6e0] dark:text-[#1a1a18]
            disabled:opacity-40 transition-all"
        >
          Save
        </button>
      </div>
    </div>
  )
}
