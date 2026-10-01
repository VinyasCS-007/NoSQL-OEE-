import { useCallback, useEffect, useRef } from 'react'
import { useSettings } from './useSettings'

/**
 * Inertia wheel scrolling + scroll-driven 3D fly-ins ([data-reveal]) for one scroll container.
 * onProgress(viewportsScrolled) drives the hero scene. Returns scrollToId(id).
 */
export function useScrollFx(ref, onProgress) {
  const { settings, buzz } = useSettings()
  const live = useRef(settings)
  live.current = settings
  const api = useRef({})
  const prog = useRef(onProgress)
  prog.current = onProgress

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let target = el.scrollTop, cur = target, animating = false, raf = 0
    const smoothOn = () => live.current.smooth && live.current.motion

    const frame = () => {
      const vh = el.clientHeight, top0 = el.getBoundingClientRect().top
      prog.current?.(el.scrollTop / vh)
      const on = live.current.motion
      el.querySelectorAll('[data-reveal]').forEach((r) => {
        const y = r.getBoundingClientRect().top - top0
        const p = on ? Math.max(0, Math.min(1, (vh * 0.98 - y) / (vh * 0.45))) : 1
        const e = 1 - Math.pow(1 - p, 3)
        r.style.opacity = String(0.08 + 0.92 * e)
        r.style.transform = e >= 1 ? 'none'
          : `perspective(1200px) translate3d(0,${(1 - e) * 70}px,${(1 - e) * -160}px) rotateX(${(1 - e) * 16}deg)`
      })
    }
    const kick = () => {
      if (animating) return
      animating = true
      const step = () => {
        cur += (target - cur) * 0.1
        if (Math.abs(target - cur) < 0.5) { cur = target; el.scrollTop = cur; animating = false; return }
        el.scrollTop = cur
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const onWheel = (e) => {
      if (!smoothOn() || e.ctrlKey) return
      e.preventDefault()
      const max = el.scrollHeight - el.clientHeight
      target = Math.max(0, Math.min(max, target + e.deltaY * (e.deltaMode === 1 ? 40 : 1)))
      kick()
    }
    const onScroll = () => {
      if (!animating) target = cur = el.scrollTop
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame() })
    }
    api.current.to = (top) => {
      if (smoothOn()) { target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, top)); kick() }
      else el.scrollTo({ top, behavior: 'smooth' })
    }
    api.current.frame = frame
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(frame)
    ro.observe(el)
    requestAnimationFrame(frame)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [ref])

  // content that loads later (rooms, stats) needs a fresh pass
  // returns nothing on purpose: callers use it directly as a useEffect callback,
  // and a returned rAF id would be mistaken for a cleanup function
  const refresh = useCallback(() => { requestAnimationFrame(() => api.current.frame?.()) }, [])

  const scrollToId = useCallback((id) => {
    const el = ref.current, t = el?.querySelector('#' + id)
    if (!t) return
    api.current.to?.(t.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 84)
    buzz(6)
  }, [ref, buzz])

  return { scrollToId, refresh }
}
