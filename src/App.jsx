import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GroupPage from './pages/GroupPage'
import MemberPage from './pages/MemberPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/g/:groupToken" element={<GroupPage />} />
      <Route path="/m/:memberToken" element={<MemberPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
