import { ArrowRight, BarChart3, Clock, Hand, ImageIcon, Plus, UserRound } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Counter, LivePing, Logo, Mark, Page, RoleBadge, SettingsBtn, ThemeToggle, TiltCard, TypingDots } from '../components/ui'
import { useJoin } from '../hooks/useAuth'
import { useScrollFx } from '../hooks/useScrollFx'
import { useIsMobile, useSettings } from '../hooks/useSettings'
import { api } from '../lib/api'
import { fmt } from '../lib/format'

const HeroScene = lazy(() => import('../components/three/HeroScene'))

// shown in the hero card only until the busiest room has real messages
const DEMO = [
  { alias: 'NightOwl', role: 'user', text: 'anyone still up?' },
  { alias: 'QuietOtter42', role: 'guest', text: 'always. what are we talking about' },
  { alias: 'Mothlight', role: 'user', text: 'the best song to hear at 3am' },
  { alias: 'QuietOtter42', role: 'guest', text: 'anything with rain in the background' },
]
const FAQS = [
  { q: 'Do I need an account?', a: 'No. Guests get a random alias and can chat in every public room straight away.' },
  { q: 'How long are messages kept?', a: "Guest messages are deleted 24 hours after they're sent. Messages from registered members stay until they delete them." },
  { q: 'Can other people see my email?', a: 'Never. Everyone, including whoever created the room, only sees your alias.' },
  { q: "Why can't guests share pictures?", a: 'Uploads are tied to an account so abuse can be removed. Every image is re-encoded and has its location and camera data stripped.' },
  { q: 'Can I turn off vibration and motion?', a: 'Yes. Open settings from the sliders icon in the top bar to switch off haptics, smooth scrolling, the custom cursor or motion effects.' },
]
const PRIVACY = [
  { icon: UserRound, color: 'var(--accent)', t: 'Anonymous by default', d: 'Everyone appears as an alias. Emails are never shown to anyone, including room creators.' },
  { icon: Clock, color: 'var(--accent-2)', t: 'Gone in 24 hours', d: "Guest messages delete themselves a day after they're sent." },
  { icon: ImageIcon, color: 'var(--accent-3)', t: 'Pictures for members', d: 'Registered members can share images. Location and camera data is stripped from every upload.' },
  { icon: BarChart3, color: 'var(--member)', t: 'Live stats', d: "See which rooms are busiest and who's sharing the most, updated as it happens." },
]
const STEPS = [
  { n: '01', g: 'var(--accent), var(--accent-2)', t: 'Pick a room', d: (n) => `${n ? `${n} public rooms are` : 'Public rooms are'} open right now. Or start your own with any name.` },
  { n: '02', g: 'var(--accent-2), var(--accent-3)', t: 'Get an alias', d: () => 'You get a random name like QuietOtter42. No email, no phone number.' },
  { n: '03', g: 'var(--accent-3), var(--accent)', t: 'Say anything', d: () => 'Messages arrive instantly. Guest messages are deleted after 24 hours.' },
]

const btnBrand = 'springy relative inline-flex h-14 cursor-pointer items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-full border-0 px-[26px] text-base font-semibold text-white shadow-[0_14px_36px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/.25)]'
const btnGhost = 'springy relative h-14 cursor-pointer overflow-hidden whitespace-nowrap rounded-full border border-border-strong px-6 text-base font-semibold text-text'
const navBtn = 'h-[38px] cursor-pointer rounded-full border-0 bg-transparent px-3.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text'
const h2 = 'm-0 text-[clamp(38px,5.6vw,76px)] font-bold leading-none tracking-[-0.045em] [text-wrap:balance]'
const section = 'mx-auto max-w-[1280px] px-[clamp(20px,5vw,56px)] pt-[clamp(80px,11vw,160px)]'

export default function Landing() {
  const navigate = useNavigate()
  const join = useJoin()
  const { dark, cinematic, motion: motionOn, booted, buzz, toast } = useSettings()
  const mobile = useIsMobile()
  const scroller = useRef(null), page = useRef(null), scroll = useRef(0)
  const { scrollToId, refresh } = useScrollFx(scroller, (p) => { scroll.current = p })

  const [rooms, setRooms] = useState([])
  const [recent, setRecent] = useState({})
  const [online, setOnline] = useState(null)
  const [totals, setTotals] = useState(null)
  const [faq, setFaq] = useState(0)

  // live data: rooms (+ online counts), the last few messages of the busiest rooms, totals
  useEffect(() => {
    let alive = true
    api.rooms().then((list) => {
      if (!alive) return
      const sorted = [...list].sort((a, b) => b.online - a.online || a.name.localeCompare(b.name))
      setRooms(sorted)
      sorted.slice(0, 6).forEach((r) => api.messages(r.id, { limit: 5 })
        .then((p) => alive && setRecent((m) => ({ ...m, [r.id]: p.messages.reverse() }))).catch(() => {}))
    }).catch(() => toast("Can't reach the server right now."))
    api.stats().then((s) => alive && setTotals(s.totals)).catch(() => {})
    const poll = () => api.presence().then((p) => alive && setOnline(p.online)).catch(() => {})
    poll()
    const id = setInterval(poll, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [toast])
  useEffect(refresh, [rooms, recent, refresh])

  // hero copy rises in once the loader has gone
  useEffect(() => {
    if (!booted || !motionOn || !page.current) return
    page.current.querySelectorAll('[data-rise]').forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(28px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 800, delay: 120 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }))
  }, [booted, motionOn, cinematic])

  const busiest = rooms[0]
  const script = useMemo(() => {
    const real = busiest && recent[busiest.id]
    return real?.length ? real.slice(-4).map((m) => ({ alias: m.sender.alias, role: m.sender.type, text: m.text || 'shared a picture' })) : DEMO
  }, [busiest, recent])
  const heroChat = useHeroChat(script)

  const joinRoom = (id) => () => join(id).catch(() => toast("Couldn't start a guest session. Try again."))
  const joinGuest = joinRoom(busiest?.id)
  const peopleOnline = online ?? rooms.reduce((n, r) => n + r.online, 0)
  const heroProps = {
    dark, reduced: !motionOn, scrollRef: scroll, avoidSelector: '[data-hero-copy]',
    onGrab: () => buzz(14), onRelease: (v) => buzz(v > 6 ? [8, 30, 20] : 6), onTap: () => buzz([6, 20, 6]),
  }

  const pill = (
    <div data-rise="" className={`inline-flex min-h-[34px] items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ${cinematic ? 'glass' : 'glass shadow-e1'}`}>
      <LivePing />{fmt(peopleOnline)} {peopleOnline === 1 ? 'person' : 'people'} chatting right now
    </div>
  )
  const ctas = (
    <div data-rise="" className="pointer-events-auto flex flex-wrap gap-3">
      <button type="button" data-magnetic="" data-ripple="light" onClick={joinGuest} className={`${btnBrand} ${cinematic ? 'bg-brand' : 'bg-accent'}`}>
        Join as guest<ArrowRight size={18} strokeWidth={2.2} />
      </button>
      <button type="button" data-magnetic="" data-ripple="" onClick={() => navigate('/register')}
        className={`${btnGhost} ${cinematic ? 'glass' : 'bg-surface-solid shadow-e1'}`}>Create account</button>
    </div>
  )
  const card = (compact) => (
    <>
      <div className="flex items-center gap-2.5">
        <span className={`${compact ? 'text-sm' : 'text-base'} font-bold tracking-[-0.02em]`}># {busiest?.name ?? 'late-night'}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span className="h-[7px] w-[7px] rounded-full bg-member" />{busiest ? `${busiest.online} online` : 'preview'}</span>
        {!compact && (
          <button type="button" data-ripple="" onClick={joinGuest} className="springy relative ml-auto h-8 cursor-pointer overflow-hidden rounded-full border border-border-strong bg-surface-2 px-3.5 text-[13px] font-semibold text-text">Join</button>
        )}
      </div>
      <div className={`fade-top mt-3 flex flex-col justify-end overflow-hidden ${compact ? 'h-[190px] gap-2.5' : 'h-[250px] gap-3'}`}>
        {heroChat.lines.map((m, i) => (
          <div key={`${heroChat.round}-${i}`} className="flex origin-bottom-left items-start gap-2.5 animate-[msgIn_.55s_cubic-bezier(.22,1,.36,1)_both]">
            <Avatar alias={m.alias} size={compact ? 26 : 30} radius={compact ? 9 : 11} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold">{m.alias}{!compact && <RoleBadge type={m.role} />}</div>
              <div className={`rounded-[4px_14px_14px_14px] border border-border bg-surface-2 leading-[1.4] ${compact ? 'px-[11px] py-[7px] text-[13px]' : 'px-3 py-2 text-sm'}`}>{m.text}</div>
            </div>
          </div>
        ))}
        {heroChat.typing && (
          <div className="flex items-center gap-2.5 animate-[fadeIn_.3s_both]">
            <Avatar alias={heroChat.typing} size={compact ? 26 : 30} radius={compact ? 9 : 11} />
            <div className="rounded-[4px_14px_14px_14px] border border-border bg-surface-2 px-3.5 py-3"><TypingDots /></div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <Page className="h-full">
      <div ref={scroller} className="scroll-thin h-full overflow-y-auto overflow-x-hidden">
        <div ref={page}>
          <header className="pointer-events-none sticky top-0 z-30 px-[clamp(12px,3vw,24px)] py-3">
            <nav className="glass pointer-events-auto mx-auto flex h-[58px] max-w-[1280px] items-center gap-2 rounded-full pl-[18px] pr-2 shadow-e2">
              <Logo onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })} />
              <div className="flex flex-1 justify-center gap-0.5">
                {!mobile && <>
                  <button type="button" className={navBtn} onClick={() => scrollToId('rooms')}>Rooms</button>
                  <button type="button" className={navBtn} onClick={() => scrollToId('how')}>How it works</button>
                  <button type="button" className={navBtn} onClick={() => scrollToId('faq')}>FAQ</button>
                  <button type="button" className={navBtn} onClick={() => navigate('/dashboard')}>Live stats</button>
                </>}
              </div>
              <div className="flex items-center gap-1.5">
                <ThemeToggle />
                <SettingsBtn />
                {!mobile && <button type="button" onClick={() => navigate('/login')} className="h-[42px] cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-text hover:bg-surface-2">Log in</button>}
                <button type="button" data-magnetic="" data-ripple="light" onClick={joinGuest}
                  className="springy bg-brand relative h-[42px] cursor-pointer overflow-hidden rounded-full border-0 px-[18px] text-sm font-semibold text-white shadow-[0_8px_24px_-8px_var(--glow),inset_0_1px_0_rgb(255_255_255/.25)]">Join</button>
              </div>
            </nav>
          </header>

          {cinematic ? (
            <section className="relative -mt-[82px] flex min-h-dvh flex-col justify-end">
              <Suspense fallback={null}><HeroScene {...heroProps} layout="full" className="absolute inset-x-0 top-0 h-dvh" /></Suspense>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]" style={{ background: 'linear-gradient(transparent, var(--bg))' }} />
              <div className="pointer-events-none relative mx-auto grid w-full max-w-[1280px] items-end gap-[clamp(32px,5vw,64px)] px-[clamp(20px,5vw,56px)] pb-[clamp(40px,8vh,88px)] pt-[max(140px,calc(100dvh-540px))] [grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))]">
                <div data-hero-copy="" className="relative flex flex-col items-start gap-6">
                  <div aria-hidden className="pointer-events-none absolute -inset-x-20 -inset-y-[60px] -z-10" style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--bg) 78%, transparent) 40%, transparent)' }} />
                  {pill}
                  <h1 data-rise="" className="m-0 text-[clamp(52px,9vw,132px)] font-extrabold leading-[.92] tracking-[-0.055em] [text-wrap:balance]">Talk to anyone.<br /><span className="text-pan">Stay no one.</span></h1>
                  <p data-rise="" className="m-0 max-w-[34rem] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-text opacity-[.82] [text-shadow:0_1px_12px_var(--bg)] [text-wrap:pretty]">anon is a free, real-time chat with public rooms. Join as a guest in one tap, or register to share pictures and keep your history.</p>
                  {ctas}
                  <div data-rise="" className="mono-label flex items-center gap-2 text-xs"><Hand size={14} />Grab a bubble and throw it</div>
                </div>
                <div data-rise="" data-tilt="8" className="pointer-events-auto relative w-full max-w-[400px] justify-self-end rounded-[26px] [transform-style:preserve-3d]">
                  <div className="glass-strong absolute inset-0 rounded-[inherit]" />
                  <div data-glare="" className="pointer-events-none absolute inset-0 rounded-[inherit]" />
                  <div className="relative p-4 [transform:translateZ(30px)]">{card(false)}</div>
                </div>
              </div>
            </section>
          ) : (
            <section className="mx-auto grid min-h-[calc(100dvh-82px)] max-w-[1280px] items-center gap-[clamp(24px,4vw,56px)] px-[clamp(20px,5vw,56px)] pt-[clamp(24px,6vh,72px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))]">
              <div className="flex flex-col items-start gap-6">
                {pill}
                <h1 data-rise="" className="m-0 text-[clamp(48px,7vw,104px)] font-bold leading-[.96] tracking-[-0.05em] [text-wrap:balance]">Talk to anyone. <span className="text-accent">Stay no one.</span></h1>
                <p data-rise="" className="m-0 max-w-[32rem] text-[clamp(17px,1.5vw,20px)] leading-[1.6] text-muted [text-wrap:pretty]">anon is a free, real-time chat with public rooms. Join as a guest in one tap, or register to share pictures and keep your history.</p>
                {ctas}
                <div data-rise="" className="mono-label text-xs">Grab a bubble and throw it →</div>
              </div>
              <div className="relative h-[clamp(420px,52vw,640px)]">
                <Suspense fallback={null}><HeroScene {...heroProps} layout="column" className="absolute inset-0" /></Suspense>
                <div data-rise="" data-tilt="8" className="absolute bottom-[clamp(0px,2vw,24px)] left-0 w-[min(330px,88%)] rounded-3xl [transform-style:preserve-3d]">
                  <div className="glass-strong absolute inset-0 rounded-[inherit]" />
                  <div data-glare="" className="pointer-events-none absolute inset-0 rounded-[inherit]" />
                  <div className="relative p-3.5 [transform:translateZ(30px)]">{card(true)}</div>
                </div>
              </div>
            </section>
          )}

          {rooms.length > 0 && (
            <section aria-label="Active rooms" className="fade-x flex flex-col gap-3 overflow-hidden py-[clamp(24px,4vw,48px)]">
              <div className="flex w-max gap-3 pr-3 animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
                {[...rooms, ...rooms].map((r, i) => (
                  <button key={i} type="button" onClick={joinRoom(r.id)}
                    className="springy glass flex h-12 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full px-5 text-[15px] font-semibold text-text hover:border-accent">
                    <span className="text-accent">#</span>{r.name}<span className="text-[13px] font-medium text-muted">{r.online} online</span>
                  </button>
                ))}
              </div>
              {Object.keys(recent).length > 0 && (
                <div className="flex w-max gap-3 pr-3 animate-[marqueeRev_70s_linear_infinite] hover:[animation-play-state:paused]">
                  {[0, 1].flatMap((k) => rooms.filter((r) => recent[r.id]?.length).map((r) => (
                    <button key={`${k}-${r.id}`} type="button" onClick={joinRoom(r.id)}
                      className="springy flex h-12 max-w-[420px] cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-full border border-border bg-transparent px-5 text-[15px] font-medium text-muted hover:text-text">
                      <span className="truncate">{recent[r.id].at(-1).text || 'shared a picture'}</span><span className="text-accent">#{r.name}</span>
                    </button>
                  )))}
                </div>
              )}
            </section>
          )}

          <section className="mx-auto max-w-[1280px] px-[clamp(20px,5vw,56px)] pt-[clamp(24px,4vw,48px)]">
            <div data-reveal="" className="grid border-y border-border [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
              {[[peopleOnline, '', 'people online now'], [totals?.messages, '', 'messages sent'], [totals?.rooms ?? (rooms.length || null), '', 'public rooms open'], [24, 'h', 'before a guest message vanishes']].map(([v, suf, label]) => (
                <div key={label} className="flex flex-col gap-1.5 px-1 py-7">
                  <Counter value={v} suffix={suf} className="text-[clamp(44px,5vw,64px)] font-bold leading-none tracking-[-0.05em]" />
                  <div className="text-[15px] text-muted">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="how" className={section}>
            <div data-reveal="" className="mb-[clamp(32px,5vw,56px)] flex flex-col gap-3.5">
              <div className="kicker">How it works</div>
              <h2 className={h2}>Three steps. No sign-up.</h2>
            </div>
            <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
              {STEPS.map((s) => (
                <div key={s.n} data-reveal="" className="flex">
                  <TiltCard tilt={12} radius="rounded-[28px]" className="min-h-[300px] flex-1 active:scale-[.98]" depth={0}
                    inner="flex flex-col justify-between gap-10 p-7 [transform-style:preserve-3d]">
                    <div className="text-[96px] font-extrabold leading-[.8] tracking-[-0.06em] text-transparent [-webkit-background-clip:text] [background-clip:text] [transform:translateZ(60px)]"
                      style={{ backgroundImage: `linear-gradient(160deg, ${s.g})` }}>{s.n}</div>
                    <div className="[transform:translateZ(30px)]">
                      <div className="mb-2 text-2xl font-bold tracking-[-0.03em]">{s.t}</div>
                      <div className="text-base leading-[1.55] text-muted [text-wrap:pretty]">{s.d(rooms.length)}</div>
                    </div>
                  </TiltCard>
                </div>
              ))}
            </div>
          </section>

          <section id="rooms" className={section}>
            <div data-reveal="" className="mb-[clamp(32px,5vw,56px)] flex flex-wrap items-end justify-between gap-5">
              <div className="flex flex-col gap-3.5">
                <div className="kicker">Rooms</div>
                <h2 className={h2}>Already awake.</h2>
              </div>
              <p className="m-0 max-w-[24rem] text-base leading-[1.55] text-muted">Jump into any room as a guest. Tap a card to join.</p>
            </div>
            {rooms.length === 0 ? (
              // distinct keys: without them React reuses this div for the grid below and the grid
              // inherits the inline opacity the scroll reveal left on it (cards stuck at 8%)
              <div key="rooms-empty" data-reveal="" className="glass flex flex-wrap items-center justify-between gap-4 rounded-[26px] p-6">
                <div className="text-base text-muted">No rooms yet. Open the first one and it shows up here.</div>
                <button type="button" onClick={joinGuest} className="springy bg-brand inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-0 px-5 text-sm font-semibold text-white"><Plus size={16} />Start a room</button>
              </div>
            ) : (
              <div key="rooms-grid" className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                {rooms.slice(0, 6).map((r) => {
                  const ms = recent[r.id] || [], last = ms.at(-1)
                  const people = [...new Set(ms.map((m) => m.sender.alias))].slice(0, 3)
                  return (
                    <div key={r.id} data-reveal="" className="flex">
                      <TiltCard tilt={10} onClick={joinRoom(r.id)} className="flex-1" inner="flex flex-col gap-[18px] p-6">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[22px] font-bold tracking-[-0.03em]"><span className="text-accent">#</span> {r.name}</div>
                          <span className="inline-flex h-7 shrink-0 items-center gap-[7px] rounded-full bg-member-soft px-2.5 text-xs font-semibold text-member"><LivePing className="bg-current" size={7} />{r.online} online</span>
                        </div>
                        <div className="flex-1 rounded-2xl border border-border bg-surface-2 px-3.5 py-3">
                          <div className="mb-1 text-xs font-semibold text-muted">{last ? last.sender.alias : 'Quiet for now'}</div>
                          <div className="line-clamp-2 text-[15px] leading-[1.45]">{last ? last.text || 'shared a picture' : 'Be the first to say something.'}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex">{people.map((a) => <Avatar key={a} alias={a} size={30} radius={999} className="-mr-2 border-2 border-surface-solid" />)}</div>
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">Join<ArrowRight size={16} strokeWidth={2.2} /></span>
                        </div>
                      </TiltCard>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className={section}>
            <div data-reveal="" className="mb-[clamp(32px,5vw,56px)] flex flex-col gap-3.5">
              <div className="kicker">Privacy</div>
              <h2 className={h2}>Private by design.</h2>
            </div>
            <div className="grid gap-[clamp(28px,4vw,48px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {PRIVACY.map(({ icon: Icon, color, t, d }) => (
                <div key={t} data-reveal="" className="flex flex-col gap-3.5 border-t border-border-strong pt-5">
                  <Icon size={28} strokeWidth={1.8} color={color} />
                  <div className="text-xl font-bold tracking-[-0.02em]">{t}</div>
                  <div className="text-base leading-[1.55] text-muted [text-wrap:pretty]">{d}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className={`${section} grid items-start gap-[clamp(24px,5vw,64px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]`}>
            <div data-reveal="" className="flex flex-col gap-3.5">
              <div className="kicker">FAQ</div>
              <h2 className={h2}>Questions.</h2>
            </div>
            <div data-reveal="" className="border-t border-border">
              {FAQS.map((f, i) => (
                <div key={f.q} className="border-b border-border">
                  <button type="button" data-ripple="" aria-expanded={faq === i} onClick={() => { setFaq(faq === i ? -1 : i); buzz(6) }}
                    className="relative flex w-full cursor-pointer items-center justify-between gap-4 overflow-hidden border-0 bg-transparent px-1 py-[22px] text-left text-[clamp(17px,1.6vw,19px)] font-semibold tracking-[-0.01em] text-text">
                    {f.q}
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-surface-2 transition-transform duration-[450ms] ease-[cubic-bezier(.34,1.56,.64,1)]"
                      style={{ transform: `rotate(${faq === i ? 45 : 0}deg)` }}><Plus size={16} strokeWidth={2.2} /></span>
                  </button>
                  {faq === i && <p className="m-0 pb-6 pl-1 pr-14 text-base leading-[1.6] text-muted [text-wrap:pretty] animate-[popIn_.35s_cubic-bezier(.22,1,.36,1)_both]">{f.a}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className={section}>
            <div data-reveal="" className="bg-brand relative overflow-hidden rounded-[36px] px-[clamp(24px,6vw,80px)] py-[clamp(40px,7vw,96px)] text-white shadow-[0_40px_100px_-30px_var(--glow)]">
              <div aria-hidden className="absolute -right-[10%] -top-[40%] aspect-square w-[60%] rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 255 255/.28), transparent 65%)' }} />
              <div className="relative flex flex-col items-start gap-7">
                <h2 className="m-0 max-w-[14ch] text-[clamp(40px,6.4vw,88px)] font-extrabold leading-[.95] tracking-[-0.05em] [text-wrap:balance]">The rooms are already talking.</h2>
                <div className="flex flex-wrap gap-3">
                  <button type="button" data-magnetic="" data-ripple="" onClick={joinGuest}
                    className="springy relative inline-flex h-14 cursor-pointer items-center gap-2.5 overflow-hidden rounded-full border-0 bg-white px-[26px] text-base font-bold text-[#1a1240] shadow-[0_14px_30px_-10px_rgb(0_0_0/.35)]">
                    {busiest ? `Join #${busiest.name}` : 'Join as guest'}<ArrowRight size={18} strokeWidth={2.2} />
                  </button>
                  <button type="button" data-magnetic="" data-ripple="light" onClick={() => scrollToId('rooms')}
                    className="springy relative h-14 cursor-pointer overflow-hidden whitespace-nowrap rounded-full border border-white/50 bg-white/[.12] px-6 text-base font-semibold text-white">Browse rooms</button>
                </div>
              </div>
            </div>
          </section>

          <footer className="mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-7 px-[clamp(20px,5vw,56px)] pb-10 pt-[clamp(56px,8vw,96px)]">
            <div className="flex max-w-[22rem] flex-col gap-3">
              <div className="flex items-center gap-2.5"><Mark size={26} /><span className="text-lg font-extrabold tracking-[-0.04em]">anon</span></div>
              <div className="text-sm leading-[1.55] text-muted">Guest messages disappear after 24 hours. Emails are never shown.</div>
            </div>
            <div className="flex flex-wrap gap-x-1 gap-y-1.5">
              {[['Rooms', () => scrollToId('rooms')], ['FAQ', () => scrollToId('faq')], ['Live stats', () => navigate('/dashboard')], ['Log in', () => navigate('/login')]].map(([l, fn]) => (
                <button key={l} type="button" onClick={fn} className="h-9 cursor-pointer rounded-full border-0 bg-transparent px-3 text-sm text-muted hover:text-text">{l}</button>
              ))}
            </div>
            <div className="w-full border-t border-border pt-6 font-mono text-xs text-muted">© 2026 anon</div>
          </footer>
        </div>
      </div>
    </Page>
  )
}

/** Plays a short conversation into the hero card, line by line with a typing indicator, then loops. */
function useHeroChat(script) {
  const [state, setState] = useState({ lines: [], typing: null, round: 0 })
  useEffect(() => {
    let t, alive = true
    const step = (i) => {
      if (!alive) return
      if (i >= script.length) { t = setTimeout(() => { setState((s) => ({ lines: [], typing: null, round: s.round + 1 })); step(0) }, 3200); return }
      const m = script[i]
      t = setTimeout(() => {
        setState((s) => ({ ...s, typing: m.alias }))
        t = setTimeout(() => { setState((s) => ({ ...s, typing: null, lines: [...s.lines, m] })); step(i + 1) }, 1100)
      }, i === 0 ? 600 : 900)
    }
    setState((s) => ({ lines: [], typing: null, round: s.round + 1 }))
    step(0)
    return () => { alive = false; clearTimeout(t) }
  }, [script])
  return state
}
