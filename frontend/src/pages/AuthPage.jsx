import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackBtn, Mark, Page, SettingsBtn, ThemeToggle } from '../components/ui'
import { useAuth, useJoin } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { api } from '../lib/api'

const field = 'h-[52px] rounded-[14px] border border-border bg-surface-2 px-4 text-base font-normal outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]'

export default function AuthPage({ mode }) {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const join = useJoin()
  const { buzz, toast } = useSettings()
  const [form, setForm] = useState({ email: '', password: '', alias: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [card, setCard] = useState(null)
  const isReg = mode === 'register'
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const go = (m) => { setError(''); buzz(6); navigate(m === 'register' ? '/register' : '/login', { replace: true }) }

  const fail = (msg) => {
    setError(msg)
    card?.animate([{ translate: '0' }, { translate: '-9px' }, { translate: '9px' }, { translate: '-5px' }, { translate: '5px' }, { translate: '0' }], { duration: 420 })
    buzz([30, 60, 30])
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return fail('Enter a valid email address.')
    if (isReg && form.password.length < 8) return fail('Password needs at least 8 characters.')
    if (!form.password) return fail('Enter your password.')
    setBusy(true); setError('')
    try {
      const body = isReg ? { email: form.email, password: form.password, ...(form.alias.trim() ? { alias: form.alias.trim() } : {}) } : { email: form.email, password: form.password }
      signIn(await (isReg ? api.register(body) : api.login(body)))
      buzz([12, 40, 18])
      navigate('/chat')
    } catch (err) {
      fail(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page className="h-full">
      <div className="flex h-full flex-col items-center overflow-y-auto px-[clamp(16px,4vw,40px)] pb-10 pt-4">
        <div className="flex w-full max-w-[1280px] items-center justify-between gap-3">
          <BackBtn onClick={() => navigate('/')} />
          <div className="flex gap-1.5"><ThemeToggle solid /><SettingsBtn solid /></div>
        </div>
        <div className="flex w-full max-w-[440px] flex-1 flex-col justify-center py-[clamp(24px,6vh,64px)]">
          <div ref={setCard} data-tilt="5" className="relative rounded-[30px] [transform-style:preserve-3d] animate-[cardIn_.8s_cubic-bezier(.22,1,.36,1)_backwards]">
            <div className="glass-strong absolute inset-0 rounded-[inherit]" />
            <div data-glare="" className="pointer-events-none absolute inset-0 rounded-[inherit]" />
            <div className="relative flex flex-col gap-[22px] p-[clamp(24px,6vw,36px)] [transform:translateZ(20px)]">
              <div className="[transform:translateZ(30px)]"><Mark size={52} /></div>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
                {[['login', 'Log in'], ['register', 'Register']].map(([m, l]) => (
                  <button key={m} type="button" onClick={() => go(m)}
                    className={`h-[42px] cursor-pointer rounded-xl border-0 text-[15px] font-semibold transition-colors ${mode === m ? 'bg-surface-solid text-text' : 'bg-transparent text-muted'}`}>{l}</button>
                ))}
              </div>
              <div>
                <h1 className="m-0 mb-2 text-[clamp(28px,6vw,34px)] font-bold leading-[1.05] tracking-[-0.04em]">{isReg ? 'Create your account' : 'Welcome back'}</h1>
                <p className="m-0 text-[15px] leading-normal text-muted">{isReg ? 'Members share pictures and keep every message.' : 'Log in to share pictures and keep your messages.'}</p>
              </div>
              <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
                {isReg && (
                  <label className="flex flex-col gap-[7px] text-[13px] font-semibold animate-[popIn_.3s_both]">
                    <span>Alias <span className="font-normal text-muted">Optional. Leave blank to get a random one.</span></span>
                    <input value={form.alias} onChange={set('alias')} minLength={2} maxLength={40} placeholder="QuietOtter42" className={field} />
                  </label>
                )}
                <label className="flex flex-col gap-[7px] text-[13px] font-semibold">Email
                  <input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className={field} />
                </label>
                <label className="flex flex-col gap-[7px] text-[13px] font-semibold">Password
                  <input type="password" autoComplete={isReg ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} maxLength={72}
                    placeholder={isReg ? 'At least 8 characters' : '••••••••'} className={field} />
                </label>
                {error && <div role="alert" className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-danger animate-[popIn_.3s_both]" style={{ background: 'color-mix(in oklab, var(--danger) 12%, transparent)' }}>{error}</div>}
                <button type="submit" data-ripple="light" disabled={busy}
                  className="springy bg-brand relative mt-1.5 h-[54px] cursor-pointer overflow-hidden rounded-2xl border-0 text-base font-semibold text-white shadow-[0_14px_30px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/.25)] active:scale-[.96] disabled:opacity-70">
                  {busy ? 'Please wait…' : isReg ? 'Create account' : 'Log in'}
                </button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <button type="button" data-ripple="" onClick={() => join().catch(() => toast("Couldn't start a guest session. Try again."))}
                className="springy relative h-[52px] cursor-pointer overflow-hidden rounded-2xl border border-border-strong bg-transparent text-[15px] font-semibold text-text active:scale-[.96]">Continue as guest</button>
              <div className="text-center text-sm text-muted">
                {isReg ? 'Already have an account?' : 'New here?'}{' '}
                <button type="button" onClick={() => go(isReg ? 'login' : 'register')} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-accent">{isReg ? 'Log in' : 'Create one'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}
