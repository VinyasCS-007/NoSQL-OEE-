import { useEffect, useRef } from 'react'
import { useSettings } from '../hooks/useSettings'

// The hero scene sets cursor.label = 'drag' while a bubble is under the pointer.
export const cursor = { label: '' }

/**
 * Global pointer effects, driven by data attributes so any element can opt in:
 *  data-tilt="10"   card leans toward the cursor (+ [data-glare] child gets a light spot)
 *  data-magnetic    button drifts toward the cursor
 *  data-ripple      ripple from the tap point ("light" for buttons on accent fills)
 * Plus the trailing ring cursor.
 */
export default function Fx() {
  const { settings, coarse, buzz } = useSettings()
  const live = useRef(settings)
  live.current = settings
  const ring = useRef(null), dot = useRef(null)

  useEffect(() => {
    let tiltEl = null, magEl = null, cur = null, rp = null, rs = 28, hover = false, raf = 0
    const on = () => live.current.motion

    const resetTilt = (el) => {
      el.style.transition = 'transform .8s cubic-bezier(.34,1.56,.64,1)'
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
      const g = el.querySelector('[data-glare]'); if (g) g.style.background = 'transparent'
      tiltEl = null
    }
    const resetMag = (el) => {
      el.style.transition = 'translate .6s cubic-bezier(.34,1.56,.64,1), scale .4s cubic-bezier(.34,1.56,.64,1)'
      el.style.translate = '0px 0px'
      magEl = null
    }
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return
      cur = { x: e.clientX, y: e.clientY }
      if (!on()) return
      const t = e.target.closest?.('[data-tilt]')
      if (tiltEl && tiltEl !== t) resetTilt(tiltEl)
      if (t) {
        const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height, max = +t.dataset.tilt || 10
        t.style.transition = 'transform .12s ease-out'
        t.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)`
        const g = t.querySelector('[data-glare]')
        if (g) g.style.background = `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, rgb(255 255 255 / .18), transparent 45%)`
        tiltEl = t
      }
      const m = e.target.closest?.('[data-magnetic]')
      if (magEl && magEl !== m) resetMag(magEl)
      if (m) {
        const r = m.getBoundingClientRect()
        m.style.transition = 'translate .2s ease-out, scale .4s cubic-bezier(.34,1.56,.64,1)'
        m.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.2}px ${(e.clientY - r.top - r.height / 2) * 0.3}px`
        magEl = m
      }
      hover = !!e.target.closest?.('button,a,input,textarea,[data-tilt]')
    }
    const onDown = (e) => {
      const r = e.target.closest?.('[data-ripple]')
      if (!r) return
      const b = r.getBoundingClientRect(), d = Math.max(b.width, b.height) * 2.2, s = document.createElement('span')
      Object.assign(s.style, {
        position: 'absolute', left: e.clientX - b.left - d / 2 + 'px', top: e.clientY - b.top - d / 2 + 'px', width: d + 'px', height: d + 'px',
        borderRadius: '50%', pointerEvents: 'none',
        background: r.dataset.ripple === 'light' ? 'rgb(255 255 255 / .45)' : 'color-mix(in oklab, var(--accent) 28%, transparent)',
      })
      r.appendChild(s)
      s.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove()
      buzz(8)
    }
    const onLeave = () => { cur = null; tiltEl && resetTilt(tiltEl); magEl && resetMag(magEl) }

    const loop = () => {
      const R = ring.current, D = dot.current
      const show = live.current.cursor && !coarse && on() && cur
      if (R && D) {
        if (!show) { R.style.opacity = '0'; D.style.opacity = '0' }
        else {
          if (!rp) rp = { ...cur }
          rp.x += (cur.x - rp.x) * 0.2; rp.y += (cur.y - rp.y) * 0.2
          const big = cursor.label ? 64 : hover ? 46 : 28
          rs += (big - rs) * 0.2
          R.style.opacity = '1'; D.style.opacity = cursor.label ? '0' : '1'
          R.style.width = R.style.height = rs + 'px'
          R.style.transform = `translate3d(${rp.x - rs / 2}px,${rp.y - rs / 2}px,0)`
          R.style.background = cursor.label ? 'var(--accent)' : hover ? 'var(--accent-soft)' : 'transparent'
          if (R.textContent !== cursor.label) R.textContent = cursor.label
          D.style.transform = `translate3d(${cur.x - 3}px,${cur.y - 3}px,0)`
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('pointerdown', onDown, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerdown', onDown)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [coarse, buzz])

  return (
    <>
      <div ref={ring} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[200] flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-accent font-mono text-[11px] uppercase tracking-[.08em] text-white opacity-0 transition-[opacity,background] duration-200" />
      <div ref={dot} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[201] h-1.5 w-1.5 rounded-full bg-accent opacity-0" />
    </>
  )
}
