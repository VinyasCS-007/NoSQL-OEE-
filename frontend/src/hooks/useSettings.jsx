import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const Ctx = createContext(null)
const read = (k, fallback = null) => { try { return localStorage.getItem(k) ?? fallback } catch { return fallback } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

// each mood forces its own theme (cinematic = dark, airy = light); a manual flip is remembered per mood
const moodTheme = (m) => read('anon.theme.' + m) || (m === 'airy' ? 'light' : 'dark')

export function SettingsProvider({ children }) {
  const coarse = useMemo(() => matchMedia('(pointer: coarse)').matches, [])
  const [mood, setMoodState] = useState(() => read('anon.mood', 'cinematic'))
  const [theme, setThemeState] = useState(() => moodTheme(read('anon.mood', 'cinematic')))
  const [settings, setSettings] = useState(() => {
    let saved = {}
    try { saved = JSON.parse(read('anon.settings', '{}')) } catch {}
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    return { haptics: true, smooth: true, cursor: !coarse, motion: !reduce, ...saved }
  })
  const [toastMsg, setToastMsg] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [booted, setBooted] = useState(false)
  const live = useRef(settings)
  live.current = settings
  const toastT = useRef()

  useLayoutEffect(() => {
    const d = document.documentElement
    d.dataset.theme = theme
    d.dataset.mood = mood
    d.dataset.motion = settings.motion ? 'on' : 'off'
  }, [theme, mood, settings.motion])
  useEffect(() => write('anon.settings', JSON.stringify(settings)), [settings])

  // Android vibrates; iOS Safari has no Vibration API, so this is a no-op there
  const buzz = useCallback((p) => {
    if (live.current.haptics && navigator.vibrate) { try { navigator.vibrate(p) } catch {} }
  }, [])
  const toast = useCallback((msg) => {
    clearTimeout(toastT.current)
    setToastMsg(msg)
    toastT.current = setTimeout(() => setToastMsg(''), 2800)
  }, [])

  const value = useMemo(() => ({
    theme, dark: theme === 'dark', mood, cinematic: mood === 'cinematic', settings, coarse, booted, panelOpen,
    motion: settings.motion,
    setTheme: (t) => { write('anon.theme.' + mood, t); setThemeState(t); buzz(8) },
    toggleTheme: () => { const t = theme === 'dark' ? 'light' : 'dark'; write('anon.theme.' + mood, t); setThemeState(t); buzz(8) },
    setMood: (m) => { write('anon.mood', m); setMoodState(m); setThemeState(moodTheme(m)); buzz(8) },
    setSetting: (key, val) => {
      setSettings((s) => ({ ...s, [key]: val }))
      if (key === 'haptics' && val) {
        if (!navigator.vibrate) toast("This device doesn't support vibration. Press effects still apply.")
        else navigator.vibrate([12, 40, 12])
      }
    },
    openPanel: () => { setPanelOpen((o) => !o); buzz(6) },
    closePanel: () => setPanelOpen(false),
    setBooted, buzz, toast, toastMsg,
  }), [theme, mood, settings, coarse, booted, panelOpen, buzz, toast, toastMsg])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)

export function useIsMobile() {
  const [m, setM] = useState(() => innerWidth < 768)
  useEffect(() => {
    const on = () => setM(innerWidth < 768)
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return m
}
