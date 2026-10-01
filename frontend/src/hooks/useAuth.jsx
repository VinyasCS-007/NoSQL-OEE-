import { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const AuthContext = createContext(null)
const KEY = 'session'

// Reads the "exp" claim of a JWT so an expired token is dropped on load.
function isExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return s && !isExpired(s.token) ? s : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(load)

  const signIn = useCallback((data) => {
    const s = { token: data.token, role: data.role, alias: data.alias }
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {}
    setSession(s)
    return s
  }, [])

  const signOut = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch {}
    setSession(null)
  }, [])

  return <AuthContext.Provider value={{ session, signIn, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** Join a room: reuses the session, or asks the server for a guest alias first. */
export function useJoin() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  return useCallback(async (roomId) => {
    if (!session) signIn(await api.guest())
    navigate(roomId ? `/chat/${roomId}` : '/chat')
  }, [session, signIn, navigate])
}
