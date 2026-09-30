import { motion, useReducedMotion } from 'framer-motion'
import { lazy, Suspense } from 'react'

// three.js is large, so it is loaded in its own chunk only on pages that show the scene
const Scene3D = lazy(() => import('./Scene3D'))

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const hasWebGL = typeof document !== 'undefined' && webglAvailable()

/** 3D scene with a soft gradient fallback while loading or when WebGL is missing. */
export default function HeroScene({ className = '' }) {
  const reduce = useReducedMotion()
  const fallback = (
    <div className="absolute inset-0 grid place-items-center">
      <div className="h-56 w-56 rounded-full bg-brand opacity-40 blur-3xl" />
    </div>
  )
  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      {hasWebGL ? <Suspense fallback={fallback}><Scene3D reduceMotion={reduce} /></Suspense> : fallback}
    </motion.div>
  )
}
