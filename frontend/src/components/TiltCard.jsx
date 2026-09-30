import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

/**
 * Card that tilts in 3D toward the pointer, with a moving glare highlight. Style the surface with className (e.g. `glass ring-gradient rounded-3xl p-6`); children can float above it with `transform-[translateZ(40px)]`.
 * @category Effects
 */
export function TiltCard({ children, className = '', max = 10, glare = true, as = 'div', ...props }) {
  const reduce = useReducedMotion()
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const cfg = { stiffness: 220, damping: 22, mass: 0.6 }
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), cfg)
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), cfg)
  const gx = useTransform(px, (v) => `${v * 100}%`)
  const gy = useTransform(py, (v) => `${v * 100}%`)
  const glareBg = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgb(255 255 255 / 0.18), transparent 45%)`

  const onMove = (e) => {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const reset = () => { px.set(0.5); py.set(0.5) }

  const Comp = motion[as]
  return (
    <div className="perspective-[1000px]">
      <Comp
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`relative ${className}`}
        {...props}
      >
        {children}
        {glare && !reduce && (
          <motion.div aria-hidden style={{ background: glareBg }} className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay" />
        )}
      </Comp>
    </div>
  )
}

export default TiltCard
