import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { animateDots, Bubble, GL, Lights, onCreated, PALETTE, StudioEnv } from './shared'

const TGT = [
  { p: [-0.95, 0.62, 0], r: [0.1, 0.3, -0.08], s: 0.85 },
  { p: [1.0, 0.82, -0.3], r: [-0.05, -0.35, 0.1], s: 0.72, flip: 1 },
  { p: [0.1, -0.22, 0.45], r: [0.12, -0.1, 0.04], s: 0.95 },
  { p: [-1.2, -0.88, -0.2], r: [-0.1, 0.4, -0.1], s: 0.62 },
  { p: [1.25, -0.72, 0.1], r: [0.15, -0.3, 0.06], s: 0.66, flip: 1 },
  { p: [0.05, 1.45, -0.6], r: [0.05, 0.1, 0.05], s: 0.5 },
]
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }

/**
 * Loader: bubbles fly in from all sides and lock into a cluster as progressRef.current goes 0 → 1.
 * finishRef.current() plays the pulse + zoom-through exit and resolves when done.
 */
export default function LoaderScene({ dark, progressRef, finishRef, onLock }) {
  return (
    <Canvas dpr={[1, 1.75]} gl={GL} onCreated={onCreated} camera={{ fov: 36, position: [0, 0, 8], near: 0.1, far: 100 }}>
      <Lights />
      <StudioEnv dark={dark} />
      <Cluster dark={dark} progressRef={progressRef} finishRef={finishRef} onLock={onLock} />
    </Canvas>
  )
}

function Cluster({ dark, progressRef, finishRef, onLock }) {
  const pal = PALETTE[dark ? 'dark' : 'light']
  const { camera, size } = useThree()
  const root = useRef(), groups = useRef([]), dots = useRef(TGT.map(() => []))
  const st = useMemo(() => TGT.map((g, i) => {
    const a = (i / TGT.length) * Math.PI * 2 + Math.random() * 0.6
    return {
      start: new THREE.Vector3(Math.cos(a) * 9, Math.sin(a) * 6, -4 - Math.random() * 6),
      target: new THREE.Vector3(...g.p),
      r0: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6),
      r1: new THREE.Vector3(...g.r), s: g.s, flip: !!g.flip, locked: false, kick: 0,
    }
  }), [])
  const fin = useRef(null), t = useRef(0), baseScale = useRef(1)
  const lock = useRef(onLock)
  lock.current = onLock

  useEffect(() => { baseScale.current = Math.max(0.55, Math.min(1, (size.width / Math.max(1, size.height)) * 0.8)) }, [size])
  useEffect(() => {
    finishRef.current = () => new Promise((resolve) => { fin.current = { t0: performance.now(), dur: 900, resolve } })
    return () => { finishRef.current = null }
  }, [finishRef])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta); t.current += dt
    const p = progressRef.current ?? 0, w = 1 / TGT.length
    st.forEach((u, i) => {
      const b = groups.current[i]
      if (!b) return
      const lt = Math.max(0, Math.min(1, (p - i * w * 0.85) / (w * 1.8)))
      b.visible = lt > 0
      const e = easeOutBack(lt)
      b.position.lerpVectors(u.start, u.target, e)
      b.position.y += Math.sin(t.current * 1.6 + i) * 0.05 * lt
      b.rotation.set(u.r0.x + (u.r1.x - u.r0.x) * e, u.r0.y + (u.r1.y - u.r0.y) * e, u.r0.z + (u.r1.z - u.r0.z) * e)
      if (lt >= 1 && !u.locked) { u.locked = true; u.kick = 1; lock.current?.(i) } // haptic tick per bubble
      u.kick *= Math.exp(-dt * 6)
      const sc = u.s * (0.25 + 0.75 * Math.min(1, lt * 1.6)) * (1 + u.kick * 0.14)
      b.scale.set(sc * (u.flip ? -1 : 1), sc, sc)
      animateDots(dots.current[i], t.current * 3 + i)
    })
    const r = root.current
    r.rotation.y = Math.sin(t.current * 0.6) * 0.25
    r.rotation.x = Math.cos(t.current * 0.5) * 0.08
    let scale = baseScale.current
    const f = fin.current
    if (f) {
      const k = Math.min(1, (performance.now() - f.t0) / f.dur)
      const pulse = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) * 0.12 : 0
      const zoom = k < 0.35 ? 0 : Math.pow((k - 0.35) / 0.65, 2.2)
      scale *= 1 + pulse + zoom * 1.4
      r.rotation.z = zoom * 0.6
      camera.position.z = 8 - zoom * 5.5
      if (k >= 1 && !f.done) { f.done = true; f.resolve() } // hold the last frame while the overlay wipes away
    }
    r.scale.setScalar(scale)
  })

  return (
    <group ref={root}>
      {TGT.map((g, i) => (
        <Bubble key={i} color={pal.bubbles[i]} dot={pal.dots[i]} dotsRef={dots.current[i]}
          groupRef={(el) => { if (el && !groups.current[i]) el.visible = false; groups.current[i] = el }} />
      ))}
    </group>
  )
}
