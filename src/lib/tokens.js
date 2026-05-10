// All identity is token-based. Tokens are UUIDs stored in localStorage.
// A user may have multiple tokens (one per group) merged into one identity.

const TOKENS_KEY = 'lineup_tokens'

export function getStoredTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToken(token) {
  const tokens = getStoredTokens()
  if (!tokens.includes(token)) {
    tokens.push(token)
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  }
}

export function hasToken(token) {
  return getStoredTokens().includes(token)
}

export function getPrimaryToken() {
  return getStoredTokens()[0] || null
}

// Format a date as YYYY-MM-DD (local time, no UTC shift)
export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isSameDay(a, b) {
  return formatDate(a) === formatDate(b)
}
