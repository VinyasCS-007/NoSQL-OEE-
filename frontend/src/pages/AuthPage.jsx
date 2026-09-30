import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import TiltCard from '../components/TiltCard'
import { Button, Input, Logo, Page, ThemeToggle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'

/** Shared screen for both login and register. */
export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', alias: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { email: form.email, password: form.password }
      if (isRegister && form.alias.trim()) body.alias = form.alias.trim()
      signIn(await (isRegister ? api.register(body) : api.login(body)))
      navigate('/chat')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const guest = async () => {
    try {
      signIn(await api.guest())
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Page className="relative flex min-h-full flex-col">
      <AuroraBackground intensity={1.2} />
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted shadow-e1 hover:text-text">
          <ArrowLeft size={16} /> Back
        </Link>
        <ThemeToggle />
      </header>

      <div className="grid flex-1 place-items-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          className="w-full max-w-[420px] perspective-[1200px]"
        >
          <TiltCard max={5} className="glass ring-gradient rounded-[32px] shadow-e3">
            <form onSubmit={submit} className="p-7 sm:p-9">
              <div className="transform-[translateZ(30px)]"><Logo /></div>
              <AnimatePresence mode="wait">
                <motion.div key={mode} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                  <h1 className="mt-7 text-[28px] font-bold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
                  <p className="mt-1.5 text-sm text-muted">
                    {isRegister ? 'Members can share pictures and keep their messages.' : 'Log in to share pictures and keep your messages.'}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-7 space-y-4">
                <Input id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
                <Input id="password" label="Password" type="password" required minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')}
                  placeholder={isRegister ? 'At least 8 characters' : '••••••••'} />
                {isRegister && (
                  <Input id="alias" label="Public alias (optional)" placeholder="Leave empty for a random one"
                    minLength={2} maxLength={40} value={form.alias} onChange={set('alias')} />
                )}
              </div>
              {isRegister && <p className="mt-3 text-xs text-muted">🔒 Your email stays private. Others only see your alias.</p>}

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -4, 4, 0] }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }} className="mt-4 rounded-2xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger" role="alert">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" disabled={busy} className="mt-7 w-full py-3.5" magnetic={false}>
                {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
                {!busy && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
              </Button>

              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" onClick={guest} className="w-full" magnetic={false}>
                Continue as guest
              </Button>

              <p className="mt-6 text-center text-sm text-muted">
                {isRegister ? 'Already have an account? ' : 'New here? '}
                <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-accent hover:underline">
                  {isRegister ? 'Log in' : 'Create one'}
                </Link>
              </p>
            </form>
          </TiltCard>
        </motion.div>
      </div>
    </Page>
  )
}
