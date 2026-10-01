import { Hash, ImageIcon, MessageSquare, RefreshCw, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BackBtn, Counter, IconBtn, Page, SettingsBtn, ThemeToggle, TiltCard } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { api } from '../lib/api'

const css = (name) => `var(--${name})`
const TILES = [
  { key: 'messages', label: 'Messages sent', icon: MessageSquare, tone: 'bg-accent-soft text-accent' },
  { key: 'online', label: 'Online now', icon: Users, tone: 'bg-member-soft text-member' },
  { key: 'uploads', label: 'Pictures shared', icon: ImageIcon, tone: 'text-accent-3 bg-[color-mix(in_oklab,var(--accent-3)_15%,transparent)]' },
  { key: 'rooms', label: 'Public rooms', icon: Hash, tone: 'text-accent-2 bg-[color-mix(in_oklab,var(--accent-2)_15%,transparent)]' },
]
const card = 'glass relative rounded-[26px] p-[clamp(18px,3vw,26px)] shadow-e2 animate-[cardIn_.8s_cubic-bezier(.22,1,.36,1)_both]'

export default function Dashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { buzz, motion: motionOn } = useSettings()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)
  const spin = useRef(null)

  const load = useCallback(() => {
    api.stats().then((d) => { setData(d); setError('') }).catch((e) => setError(e.message))
  }, [])
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id) }, [load])

  const refresh = () => {
    spin.current?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 700, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    buzz(8)
    setRound((r) => r + 1) // replays the bar animation
    load()
  }
  const anim = motionOn ? 900 : 0

  return (
    <Page className="h-full">
      <div className="scroll-thin h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[clamp(20px,3vw,32px)] px-[clamp(16px,4vw,40px)] pb-16 pt-4">
          <div className="flex items-center justify-between gap-3">
            <BackBtn onClick={() => navigate(session ? '/chat' : '/')} />
            <div className="flex gap-1.5">
              <IconBtn label="Refresh" solid onClick={refresh}><span ref={spin} className="grid place-items-center"><RefreshCw size={18} /></span></IconBtn>
              <ThemeToggle solid />
              <SettingsBtn solid />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="kicker">From MongoDB aggregation pipelines</div>
            <h1 className="m-0 text-[clamp(40px,6vw,72px)] font-bold leading-none tracking-[-0.05em]">Live stats</h1>
          </div>
          {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))]">
            {TILES.map((t, i) => (
              <TiltCard key={t.key} tilt={10} radius="rounded-3xl" depth={24} inner="flex flex-col gap-[18px] p-[22px]"
                className="animate-[cardIn_.7s_cubic-bezier(.22,1,.36,1)_backwards]" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className={`grid h-[42px] w-[42px] place-items-center rounded-[14px] ${t.tone}`}><t.icon size={20} /></div>
                <div>
                  <Counter value={data?.totals[t.key]} className="block text-[44px] font-bold leading-none tracking-[-0.05em]" />
                  <div className="mt-1.5 text-sm text-muted">{t.label}</div>
                </div>
              </TiltCard>
            ))}
          </div>

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr))]">
            <div className={card} style={{ animationDelay: '.2s' }}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold tracking-[-0.02em]">Messages by room</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">$group by room_id → $lookup rooms</div>
                </div>
                <div className="flex gap-3.5 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />Members</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-accent-2" />Guests</span>
                </div>
              </div>
              <ChartBox loading={!data} empty={data?.messages_per_room.length === 0}>
                <BarChart key={round} data={data?.messages_per_room} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke={css('border-strong')} vertical={false} />
                  <XAxis dataKey="room" tick={{ fill: css('muted'), fontSize: 12 }} tickFormatter={(v) => `#${v}`} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fill: css('muted'), fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: css('accent-soft'), radius: 10 }} />
                  <Bar dataKey="member" name="Members" stackId="a" fill={css('accent')} radius={[4, 4, 4, 4]} animationDuration={anim} maxBarSize={56} />
                  <Bar dataKey="guest" name="Guests" stackId="a" fill={css('accent-2')} radius={[10, 10, 4, 4]} animationDuration={anim} maxBarSize={56} />
                </BarChart>
              </ChartBox>
            </div>

            <div className={card} style={{ animationDelay: '.28s' }}>
              <div className="mb-6">
                <div className="text-lg font-bold tracking-[-0.02em]">Top picture sharers</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">$group on fs.files metadata.user_id → $lookup users</div>
              </div>
              <ChartBox loading={!data} empty={data?.uploads_per_user.length === 0}>
                <BarChart key={round} data={data?.uploads_per_user.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-up" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={css('accent')} /><stop offset="100%" stopColor={css('accent-3')} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="alias" width={110} tick={{ fill: css('text'), fontSize: 14, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: css('accent-soft'), radius: 10 }} />
                  <Bar dataKey="uploads" name="Pictures" fill="url(#g-up)" radius={[999, 999, 999, 999]} background={{ fill: css('surface-2'), radius: 999 }} animationDuration={anim} barSize={10} />
                </BarChart>
              </ChartBox>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

function ChartBox({ loading, empty, children }) {
  return (
    <div className="h-[260px]">
      {loading ? <div className="h-full w-full animate-pulse rounded-2xl bg-surface-2" />
        : empty ? <div className="grid h-full place-items-center text-sm text-muted">No data yet</div>
        : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
    </div>
  )
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-border-strong bg-surface-solid px-3.5 py-2.5 text-xs shadow-e3">
      <p className="m-0 mb-1 font-semibold text-text">{payload[0].payload.room ? `#${label}` : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="m-0 flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.dataKey === 'guest' ? 'var(--accent-2)' : 'var(--accent)' }} />
          {p.name}: <b className="text-text">{p.value}</b>
        </p>
      ))}
    </div>
  )
}
