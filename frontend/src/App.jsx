import { lazy, Suspense, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Fx from './components/Fx'
import Loader from './components/Loader'
import SettingsPanel from './components/SettingsPanel'
import { Aurora, Toast } from './components/ui'
import { useAuth } from './hooks/useAuth'
import { useSettings } from './hooks/useSettings'
import AuthPage from './pages/AuthPage'
import Chat from './pages/Chat'
import Landing from './pages/Landing'

// charts (recharts) are only needed on the dashboard, so load them on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
// warm the hero's 3D chunk while the loader plays
const preload = [() => import('./components/three/HeroScene')]

function RequireSession({ children }) {
  const { session } = useAuth()
  return session ? children : <Navigate to="/" replace />
}

export default function App() {
  const location = useLocation()
  const { motion: motionOn, setBooted } = useSettings()
  const [loading, setLoading] = useState(true)
  const content = useRef(null)
  // chat and chat/:roomId share one key so switching rooms doesn't remount the page
  const pageKey = location.pathname.startsWith('/chat') ? '/chat' : location.pathname

  const reveal = () => {
    setBooted(true)
    if (motionOn && content.current) {
      content.current.animate(
        [{ transform: 'perspective(1400px) translateY(60px) rotateX(10deg) scale(.94)', opacity: 0.3, filter: 'blur(8px)' }, { transform: 'none', opacity: 1, filter: 'blur(0px)' }],
        { duration: 1200, easing: 'cubic-bezier(.22,1,.36,1)' })
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-text">
      <Aurora />
      <div ref={content} className="relative z-[1] h-full">
        <Routes location={location} key={pageKey}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/chat/:roomId?" element={<RequireSession><Chat /></RequireSession>} />
            <Route path="/dashboard" element={<Suspense fallback={null}><Dashboard /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <SettingsPanel />
      <Toast />
      <Fx />
      {loading && <Loader preload={preload} onReveal={reveal} onDone={() => setLoading(false)} />}
    </div>
  )
}
