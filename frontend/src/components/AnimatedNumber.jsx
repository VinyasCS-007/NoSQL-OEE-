import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Counts up from the previous value to `value` when scrolled into view. */
export default function AnimatedNumber({ value, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) return setShown(value)
    const controls = animate(from.current, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [inView, value, reduce])

  return <span ref={ref} className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>
}
