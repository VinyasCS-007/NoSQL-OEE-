import { lazy, Suspense, useEffect, useRef } from 'react'
import { useSettings } from '../hooks/useSettings'
import { Mark } from './ui'

const sceneImport = () => import('./three/LoaderScene')
const LoaderScene = lazy(sceneImport)
const STATUSES = [[0, 'Waking up the rooms'], [0.3, 'Shuffling aliases'], [0.6, 'Inflating bubbles'], [0.9, 'Almost there'], [1, 'Say hi']]

/**
 * First-load overlay: a percentage counter and bubbles assembling into a cluster.
 * Progress is real (fonts, the 3D chunks, the hero scene) but never faster than a
 * short minimum so the animation can play. Calls onDone() after the wipe-out.
 */
export default function Loader({ onReveal, onDone, preload = [] }) {
  const { dark, motion: motionOn, buzz } = useSettings()
  const box = useRef(null), pct = useRef(null), bar = useRef(null), status = useRef(null)
  const progress = useRef(0), finish = useRef(null)

  useEffect(() => {
    let alive = true, cap = 0.2, disp = 0
    const t0 = performance.now(), minMs = motionOn ? 2800 : 900
    const bump = (v) => { cap = Math.max(cap, v) }
    const fail = setTimeout(() => bump(1), 9000)
    const fonts = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => bump(0.35))
    const scene = sceneImport().then(() => bump(0.5))
    const rest = Promise.all(preload.map((p) => p().catch(() => {}))).then(() => bump(0.85))
    Promise.all([fonts, scene, rest]).then(() => bump(1))

    const done = async () => {
      clearTimeout(fail)
      buzz([10, 30, 10, 30, 24])
      try { await finish.current?.() } catch {}
      onReveal?.()
      const el = box.current
      if (el) { try { await el.animate([{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 900, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' }).finished } catch {} }
      alive && onDone()
    }
    const tick = () => {
      if (!alive) return
      const target = Math.min(Math.min(1, (performance.now() - t0) / minMs), cap)
      disp += (target - disp) * 0.09
      if (target >= 1 && disp > 0.996) disp = 1
      progress.current = disp
      if (pct.current) pct.current.textContent = Math.round(disp * 100)
      if (bar.current) bar.current.style.transform = `scaleX(${disp})`
      const s = STATUSES.filter((x) => disp >= x[0]).pop()
      if (status.current && s) status.current.textContent = s[1]
      if (disp >= 1) return done()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => { alive = false; clearTimeout(fail) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} role="progressbar" aria-label="Loading anon" className="fixed inset-0 z-[100] overflow-hidden bg-bg text-text [clip-path:inset(0_0_0%_0)]">
      <div aria-hidden className="absolute left-1/2 top-[45%] -ml-[40vmax] -mt-[40vmax] h-[80vmax] w-[80vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 60%)', opacity: 'calc(.32 * var(--aurora))' }} />
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <LoaderScene dark={dark} progressRef={progress} finishRef={finish} onLock={() => buzz(10)} />
        </Suspense>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-[clamp(20px,4vw,48px)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5"><Mark size={30} /><span className="text-[20px] font-extrabold tracking-[-0.04em]">anon</span></div>
          <span ref={status} className="mono-label text-xs">Waking up the rooms</span>
        </div>
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-start text-[clamp(96px,24vw,280px)] font-extrabold leading-[.8] tracking-[-0.06em] tabular-nums">
              <span ref={pct}>0</span><span className="ml-[.08em] mt-[.08em] text-[.32em] text-accent">%</span>
            </div>
            <div className="max-w-[240px] pb-2 text-[15px] text-muted [text-wrap:pretty]">Talk to anyone. Stay no one.</div>
          </div>
          <div className="h-0.5 overflow-hidden rounded-sm bg-border">
            <div ref={bar} className="h-full origin-left" style={{ transform: 'scaleX(0)', background: 'linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3))' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
