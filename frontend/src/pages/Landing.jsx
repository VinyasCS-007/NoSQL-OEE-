import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Clock, ImageIcon, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import HeroScene from '../components/HeroScene'
import TiltCard from '../components/TiltCard'
import { Button, Logo, Page, ThemeToggle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'

const features = [
  { icon: UserRound, title: 'No sign-up needed', text: 'Get a random alias and start chatting in one click.', tone: 'from-accent to-accent-3' },
  { icon: Clock, title: 'Guest messages vanish', text: 'Guest messages auto-delete after 24 hours via a TTL index.', tone: 'from-accent-2 to-accent' },
  { icon: ImageIcon, title: 'Members share pictures', text: 'Upload images — we re-encode them and strip metadata.', tone: 'from-accent-3 to-accent-2' },
  { icon: ShieldCheck, title: 'Stay anonymous', text: 'Others only ever see your alias, never your email.', tone: 'from-member to-accent-2' },
]

const rise = (delay) => ({
  initial: { opacity: 0, y: 24, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
})

export default function Landing() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const joinAsGuest = async () => {
    setBusy(true)
    try {
      signIn(await api.guest())
      navigate('/chat')
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Page className="relative min-h-full overflow-x-hidden">
      <AuroraBackground />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="glass flex items-center gap-1 rounded-2xl p-1 shadow-e1">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text">
            <BarChart3 size={15} /> Stats
          </Link>
          {!session && <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text">Log in</Link>}
          <ThemeToggle />
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-4 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <div className="relative z-10 text-center lg:text-left">
          <motion.span {...rise(0.05)} className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted shadow-e1">
            <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-member opacity-60" /><span className="relative h-2 w-2 rounded-full bg-member" /></span>
            Free · Anonymous · Real-time
          </motion.span>

          <motion.h1 {...rise(0.12)} className="mt-6 text-[clamp(2.6rem,1.6rem+4.4vw,5.4rem)] font-extrabold leading-[0.98] tracking-[-0.04em]">
            Chat freely.<br />
            <span className="text-gradient">Stay anonymous.</span>
          </motion.h1>

          <motion.p {...rise(0.2)} className="mx-auto mt-6 max-w-xl text-[clamp(1rem,0.9rem+0.4vw,1.2rem)] leading-relaxed text-muted lg:mx-0">
            Jump into public rooms as a guest, or create an account to share pictures and keep your messages forever.
          </motion.p>

          <motion.div {...rise(0.28)} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {session ? (
              <Button onClick={() => navigate('/chat')} className="w-full px-7 py-3.5 text-[15px] sm:w-auto">
                Back to chat as {session.alias} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <>
                <Button onClick={joinAsGuest} disabled={busy} className="w-full px-7 py-3.5 text-[15px] sm:w-auto">
                  {busy ? 'Joining…' : 'Continue as guest'} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/register')} className="w-full px-7 py-3.5 text-[15px] sm:w-auto">
                  Create account
                </Button>
              </>
            )}
          </motion.div>
          {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        </div>

        {/* 3D scene: floating chat bubbles */}
        <HeroScene className="pointer-events-auto -mx-4 h-[340px] sm:h-[440px] lg:mx-0 lg:h-[560px]" />
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map(({ icon: Icon, title, text, tone }) => (
            <motion.div key={title} variants={{ hidden: { opacity: 0, y: 30, rotateX: 20 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', stiffness: 160, damping: 20 } } }}>
              <TiltCard className="glass ring-gradient h-full rounded-3xl p-6 shadow-e2">
                <div className="transform-[translateZ(40px)]">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br ${tone} text-white shadow-[0_12px_28px_-10px_var(--glow)]`}>
                    <Icon size={22} />
                  </span>
                  <h2 className="mt-5 text-[17px] font-semibold tracking-tight">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </Page>
  )
}
