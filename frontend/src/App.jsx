import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import Chat from './pages/Chat'
import Landing from './pages/Landing'

// charts (recharts) are only needed on the dashboard, so load them on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))

function RequireSession({ children }) {
  const { session } = useAuth()
  return session ? children : <Navigate to="/" replace />
}

export default function App() {
  const location = useLocation()
  // chat and chat/:roomId share one key so switching rooms doesn't remount the page
  const pageKey = location.pathname.startsWith('/chat') ? '/chat' : location.pathname

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={pageKey}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/chat/:roomId?" element={<RequireSession><Chat /></RequireSession>} />
        <Route path="/dashboard" element={<Suspense fallback={null}><Dashboard /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
