import { motion } from 'framer-motion'
import { ArrowLeft, Hash, ImageIcon, MessageSquare, RefreshCw, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AnimatedNumber from '../components/AnimatedNumber'
import AuroraBackground from '../components/AuroraBackground'
import TiltCard from '../components/TiltCard'
import { IconButton, Logo, Page, Skeleton, ThemeToggle } from '../components/ui'
import { api } from '../lib/api'

// chart colours read from the CSS tokens so they follow the theme
const css = (name) => `var(--${name})`

const TILES = [
  { key: 'rooms', label: 'Rooms', icon: Hash, tone: 'from-accent to-accent-3' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, tone: 'from-accent-2 to-accent' },
  { key: 'members', label: 'Members', icon: Users, tone: 'from-member to-accent-2' },
  { key: 'uploads', label: 'Uploads', icon: ImageIcon, tone: 'from-accent-3 to-accent-2' },
]

/** SVG gradients referenced by the bars (fill="url(#…)") */
function Gradients() {
  return (
    <defs>
      <linearGradient id="g-member" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={css('accent')} /><stop offset="100%" stopColor={css('accent')} stopOpacity={0.55} />
      </linearGradient>
      <linearGradient id="g-guest" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={css('accent-3')} /><stop offset="100%" stopColor={css('accent-3')} stopOpacity={0.55} />
      </linearGradient>
      <linearGradient id="g-uploads" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={css('accent-2')} stopOpacity={0.6} /><stop offset="100%" stopColor={css('accent-2')} />
      </linearGradient>
    </defs>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.stats().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <Page className="relative mx-auto min-h-full max-w-7xl px-4 pb-16 sm:px-6">
      <AuroraBackground intensity={0.8} />
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link to="/chat" aria-label="Back to chat" className="glass grid h-10 w-10 place-items-center rounded-xl text-muted shadow-e1 hover:text-text">
            <ArrowLeft size={18} />
          </Link>
          <Logo />
        </div>
        <div className="glass flex items-center gap-1 rounded-2xl p-1 shadow-e1">
          <IconButton label="Refresh" onClick={load}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></IconButton>
          <ThemeToggle />
        </div>
      </header>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-accent">Analytics</p>
        <h1 className="mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)] font-extrabold tracking-[-0.03em]">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Live numbers from MongoDB aggregation pipelines.</p>
      </motion.div>
      {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TILES.map((t, i) => (
          <motion.div key={t.key} initial={{ opacity: 0, y: 24, rotateX: 25 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: i * 0.07, type: 'spring', stiffness: 170, damping: 20 }}>
            <TiltCard className="glass ring-gradient rounded-3xl p-5 shadow-e2">
              <div className="transform-[translateZ(30px)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">{t.label}</span>
                  <span className={`grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br ${t.tone} text-white shadow-[0_8px_20px_-8px_var(--glow)]`}>
                    <t.icon size={17} />
                  </span>
                </div>
                {data
                  ? <p className="mt-3 text-[clamp(1.8rem,1.4rem+1.5vw,2.6rem)] font-bold tracking-tight"><AnimatedNumber value={data.totals[t.key]} /></p>
                  : <Skeleton className="mt-4 h-9 w-20" />}
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Messages per room" subtitle="$group by room_id → $lookup rooms" loading={!data} empty={data?.messages_per_room.length === 0} delay={0.2}>
          <BarChart data={data?.messages_per_room} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <Gradients />
            <CartesianGrid strokeDasharray="3 6" stroke={css('border-strong')} vertical={false} />
            <XAxis dataKey="room" tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: css('accent-soft'), radius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            <Bar dataKey="member" name="Member" stackId="a" fill="url(#g-member)" animationDuration={900} maxBarSize={48} />
            <Bar dataKey="guest" name="Guest" stackId="a" fill="url(#g-guest)" radius={[10, 10, 0, 0]} animationDuration={900} maxBarSize={48} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Uploads per user" subtitle="$group on fs.files metadata.user_id → $lookup users" loading={!data} empty={data?.uploads_per_user.length === 0} delay={0.28}>
          <BarChart data={data?.uploads_per_user} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <Gradients />
            <CartesianGrid strokeDasharray="3 6" stroke={css('border-strong')} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="alias" width={100} tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: css('accent-soft'), radius: 8 }} />
            <Bar dataKey="uploads" name="Uploads" fill="url(#g-uploads)" radius={[0, 10, 10, 0]} animationDuration={900} maxBarSize={36} />
          </BarChart>
        </ChartCard>
      </div>
    </Page>
  )
}

function ChartCard({ title, subtitle, loading, empty, delay, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass ring-gradient rounded-3xl p-6 shadow-e2">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 font-mono text-[11px] text-muted">{subtitle}</p>
      <div className="mt-5 h-72">
        {loading ? <Skeleton className="h-full w-full" />
          : empty ? <div className="grid h-full place-items-center text-sm text-muted">No data yet</div>
          : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
      </div>
    </motion.div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-2xl px-3.5 py-2.5 text-xs shadow-e3">
      <p className="mb-1 font-semibold text-text">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.dataKey === 'guest' ? 'var(--accent-3)' : p.dataKey === 'uploads' ? 'var(--accent-2)' : 'var(--accent)' }} />
          {p.name}: <b className="text-text">{p.value}</b>
        </p>
      ))}
    </div>
  )
}
