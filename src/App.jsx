import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import AuthPage from './pages/AuthPage'
import AppHome from './pages/AppHome'
import GroupPage from './pages/GroupPage'
import MemberPage from './pages/MemberPage'
import SettingsPage from './pages/SettingsPage'
import JoinPage from './pages/JoinPage'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] dark:bg-[#111110]">
        <div className="font-display text-2xl tracking-widest text-[#888] animate-pulse">LOADING</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  return children
}

function RedirectIfAuthed({ children }) {
  const { user } = useAuth()
  if (user === undefined) return null
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />

        <Route path="/auth" element={
          <RedirectIfAuthed><AuthPage /></RedirectIfAuthed>
        } />

        <Route path="/join/:token" element={<JoinPage />} />

        <Route path="/app" element={
          <RequireAuth><AppHome /></RequireAuth>
        } />

        <Route path="/app/g/:groupToken" element={
          <RequireAuth><GroupPage /></RequireAuth>
        } />

        <Route path="/app/g/:groupToken/m/:groupId" element={
          <RequireAuth><MemberPage /></RequireAuth>
        } />

        <Route path="/app/settings" element={
          <RequireAuth><SettingsPage /></RequireAuth>
        } />
      </Routes>
    </AuthProvider>
  )
}
