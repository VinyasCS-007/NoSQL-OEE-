import { ArrowLeft, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { avatarBg, initials } from '../lib/format'
import { useSettings } from '../hooks/useSettings'

/** Chat-bubble brand mark (three dots). size in px. */
export function Mark({ size = 30, className = '' }) {
  const dot = Math.max(3.5, size * 0.13)
  return (
    <span className={`bg-mark flex shrink-0 items-center justify-center shadow-[0_6px_16px_-4px_var(--glow),inset_0_1px_0_rgb(255_255_255/.35)] ${className}`}
      style={{ width: size, height: size, gap: dot * 0.75, borderRadius: `${size * 0.36}px ${size * 0.36}px ${size * 0.36}px ${size * 0.13}px` }}>
      {[0, 1, 2].map((i) => <span key={i} className="rounded-full bg-white" style={{ width: dot, height: dot }} />)}
    </span>
  )
}

export function Logo({ size = 30, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-text">
      <Mark size={size} />
      <span className="text-[20px] font-extrabold tracking-[-0.04em]">anon</span>
    </button>
  )
}

export function IconBtn({ label, children, className = '', solid = false, ...props }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`springy grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full border border-border text-text active:scale-[.85] ${solid ? 'bg-surface' : 'bg-surface-2'} ${className}`}
      {...props}>
      {children}
    </button>
  )
}

export function ThemeToggle(props) {
  const { dark, toggleTheme } = useSettings()
  return <IconBtn label="Toggle theme" onClick={toggleTheme} {...props}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconBtn>
}

export function SettingsBtn(props) {
  const { openPanel } = useSettings()
  return <IconBtn label="Settings" onClick={openPanel} {...props}><SlidersHorizontal size={18} /></IconBtn>
}

export function BackBtn({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="springy glass inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full pl-3 pr-4 text-sm font-semibold text-text active:scale-90">
      <ArrowLeft size={16} strokeWidth={2.2} />Back
    </button>
  )
}

export function RoleBadge({ type }) {
  const guest = type === 'guest'
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.06em] ${guest ? 'bg-guest-soft text-guest' : 'bg-member-soft text-member'}`}>
      {guest ? 'Guest' : 'Member'}
    </span>
  )
}

export function Avatar({ alias, size = 34, radius = 12, className = '' }) {
  return (
    <div className={`grid shrink-0 place-items-center font-bold text-white ${className}`}
      style={{ width: size, height: size, borderRadius: radius, background: avatarBg(alias), fontSize: Math.round(size * 0.35) }}>
      {initials(alias)}
    </div>
  )
}

export function LivePing({ className = 'bg-member', size = 8 }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className={`absolute inset-0 rounded-full animate-[ping_1.6s_cubic-bezier(0,0,.2,1)_infinite] ${className}`} />
      <span className={`absolute inset-0 rounded-full ${className}`} />
    </span>
  )
}

export function TypingDots({ size = 6, color = 'bg-muted' }) {
  return (
    <span className="flex gap-1">
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className={`rounded-full ${color} animate-[typing_1.2s_infinite]`} style={{ width: size, height: size, animationDelay: `${d}s` }} />
      ))}
    </span>
  )
}

/** Number that counts up (expo-out) the first time it scrolls into view, and again when value changes. */
export function Counter({ value, suffix = '', className = '' }) {
  const ref = useRef(null)
  const shown = useRef(0)
  const [seen, setSeen] = useState(false)
  const { motion: motionOn } = useSettings()

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.2 })
    ref.current && io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !seen || value == null) return
    const from = shown.current, to = Number(value)
    const paint = (v) => { shown.current = v; el.textContent = Math.round(v).toLocaleString('en-US') + suffix }
    if (!motionOn) return paint(to)
    let raf, t0 = performance.now()
    const f = (now) => {
      const p = Math.min(1, (now - t0) / 1400), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      paint(from + (to - from) * e)
      if (p < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [seen, value, suffix, motionOn])

  return <span ref={ref} className={`tabular-nums ${className}`}>0{suffix}</span>
}

/** Glass card with cursor tilt + glare (handled globally by <Fx/> through data-tilt / data-glare). */
export function TiltCard({ tilt = 10, radius = 'rounded-[26px]', className = '', inner = '', depth = 26, onClick, children, style }) {
  return (
    <div data-tilt={tilt} onClick={onClick} style={style}
      className={`relative [transform-style:preserve-3d] ${radius} ${onClick ? 'cursor-pointer active:scale-[.97]' : ''} ${className}`}>
      <div className="glass absolute inset-0 rounded-[inherit] shadow-e2" />
      <div data-glare="" className="pointer-events-none absolute inset-0 rounded-[inherit]" />
      <div className={`relative h-full ${inner}`} style={{ transform: `translateZ(${depth}px)` }}>{children}</div>
    </div>
  )
}

/**
 * Route wrapper: the page swings in on a slight 3D tilt. Uses the Web Animations API with no
 * fill, so no transform/filter is left behind (either would trap position:fixed children).
 */
export function Page({ children, className = '' }) {
  const { motion: on } = useSettings()
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (!on || !ref.current) return
    ref.current.animate(
      [{ opacity: 0, transform: 'perspective(1400px) translateY(18px) rotateX(4deg) scale(.985)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className={className}>{children}</div>
}

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute -left-[15%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full blur-[110px] animate-[aurora_22s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 62%)', opacity: 'calc(.28 * var(--aurora))' }} />
      <div className="absolute -right-[20%] top-[5%] h-[60vmax] w-[60vmax] rounded-full blur-[120px] animate-[aurora_26s_ease-in-out_infinite_reverse]"
        style={{ background: 'radial-gradient(circle, var(--accent-2) 0%, transparent 60%)', opacity: 'calc(.2 * var(--aurora))' }} />
      <div className="absolute -bottom-[30%] left-[25%] h-[55vmax] w-[55vmax] rounded-full blur-[120px] animate-[aurora_30s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, var(--accent-3) 0%, transparent 60%)', opacity: 'calc(.16 * var(--aurora))' }} />
      <div className="bg-grid absolute inset-0" />
    </div>
  )
}

export function Toast() {
  const { toastMsg } = useSettings()
  if (!toastMsg) return null
  return (
    <div role="status" className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-[90] max-w-[calc(100vw-32px)] rounded-2xl bg-text px-[18px] py-3 text-sm font-medium text-bg shadow-e3 animate-[toastIn_.4s_cubic-bezier(.34,1.56,.64,1)_both]">
      {toastMsg}
    </div>
  )
}
