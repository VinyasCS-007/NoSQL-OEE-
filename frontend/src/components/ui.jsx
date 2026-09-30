import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { Moon, Sparkles, Sun, UserRound } from 'lucide-react'
import { useRef } from 'react'
import { useTheme } from '../hooks/useTheme'

const spring = { type: 'spring', stiffness: 420, damping: 26 }

const variants = {
  primary:
    'bg-brand text-on-accent shadow-[0_10px_30px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)] hover:shadow-[0_16px_40px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.3)]',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  outline: 'glass text-text shadow-e1 hover:border-border-strong hover:shadow-e2',
}

/**
 * Primary call-to-action button. Magnetic: it leans toward the cursor, and the primary variant has a light sheen that sweeps across on hover. Variants: primary (brand gradient), outline (glass), ghost.
 * @category Actions
 */
export function Button({ variant = 'primary', className = '', children, magnetic = true, ...props }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 })
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 20 })

  const onMove = (e) => {
    if (!magnetic || reduce || props.disabled) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.18)
    y.set((e.clientY - r.top - r.height / 2) * 0.28)
  }
  const reset = () => { x.set(0); y.set(0) }

  return (
    <motion.button
      ref={ref}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileTap={{ scale: props.disabled ? 1 : 0.96 }}
      transition={spring}
      className={`group relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-2.5
        text-sm font-semibold tracking-tight transition-[box-shadow,background-color,border-color] duration-300
        disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {variant === 'primary' && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[120%] bg-linear-to-r from-transparent via-white/35 to-transparent group-hover:animate-[sheen_0.9s_ease]" />
      )}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.button>
  )
}

/**
 * Square 40px icon-only button with hover and tap feedback. Always pass `label`; it becomes aria-label and title.
 * @category Actions
 */
export function IconButton({ label, className = '', children, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition-colors
        hover:bg-surface-2 hover:text-text disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/**
 * Labelled text input with a soft accent focus glow. Pass `id` and `label`; every other prop goes to the <input>.
 * @category Forms
 */
export function Input({ label, id, ...props }) {
  return (
    <label htmlFor={id} className="group block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted transition-colors group-focus-within:text-accent">{label}</span>
      <input
        id={id}
        className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text shadow-e1 outline-none
          transition-all duration-200 placeholder:text-muted/60 hover:border-border-strong
          focus:border-accent focus:bg-surface-solid focus:shadow-[0_0_0_4px_var(--accent-soft),0_8px_24px_-12px_var(--glow)]"
        {...props}
      />
    </label>
  )
}

/**
 * Small pill that marks a user as Guest (amber) or Member (green). Shown next to aliases.
 * @category Display
 */
export function RoleBadge({ type, className = '' }) {
  const guest = type === 'guest'
  const Icon = guest ? UserRound : Sparkles
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset
        ${guest ? 'bg-guest-soft text-guest ring-guest/25' : 'bg-member-soft text-member ring-member/25'} ${className}`}
    >
      <Icon size={10} strokeWidth={2.75} aria-hidden />
      {guest ? 'Guest' : 'Member'}
    </span>
  )
}

/**
 * Light/dark theme switch. Toggles the `dark` class on <html> and remembers the choice in localStorage; the sun/moon icon flips over in 3D.
 * @category Actions
 */
export function ThemeToggle() {
  const [dark, toggle] = useTheme()
  return (
    <IconButton label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle} className="perspective-[400px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'moon' : 'sun'}
          initial={{ rotateY: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          exit={{ rotateY: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22 }}
          className="grid place-items-center"
        >
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </IconButton>
  )
}

/**
 * Whisper brand mark: gradient chat-bubble tile plus wordmark. `compact` hides the wordmark.
 * @category Brand
 */
export function Logo({ className = '', compact = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${className}`}>
      <motion.span
        whileHover={{ rotate: -8, scale: 1.08 }}
        transition={spring}
        className="relative grid h-9 w-9 place-items-center rounded-[12px] bg-brand text-on-accent shadow-[0_8px_24px_-8px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.35)]"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-2 ring-2 ring-bg" />
      </motion.span>
      {!compact && <span className="text-[17px]">Whisper</span>}
    </span>
  )
}

/**
 * Shimmering loading placeholder. Size and shape it with className (e.g. `h-4 w-32`, `rounded-full`).
 * @category Feedback
 */
export function Skeleton({ className = '', ...props }) {
  return <div className={`shimmer rounded-xl ${className}`} {...props} />
}

/**
 * Route wrapper that fades, lifts and un-blurs its content on enter, and reverses on exit. Use as the root element of a page.
 * @category Layout
 */
export function Page({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.main>
  )
}
