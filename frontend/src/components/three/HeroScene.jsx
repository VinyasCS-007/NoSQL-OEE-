import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { cursor } from '../Fx'
import { animateDots, Bubble, GL, Lights, onCreated, PALETTE, StudioEnv } from './shared'

const SPECS = [
  { p: [-2.3, 1.1, 0], r: [0.1, 0.35, -0.08], s: 0.95, sp: 1 },
  { p: [2.5, 1.35, -0.4], r: [-0.05, -0.4, 0.1], s: 0.75, sp: 0.8, flip: true },
  { p: [2.2, -1.35, 0.5], r: [0.15, -0.3, 0.06], s: 0.85, sp: 1.2, flip: true },
  { p: [-2.1, -1.5, 0.3], r: [-0.1, 0.45, -0.1], s: 0.7, sp: 0.9 },
  { p: [0.1, 2.15, -1.6], r: [0.05, 0.1, 0.05], s: 0.5, sp: 1.1 },
  { p: [-0.5, -2.35, -0.9], r: [0.1, -0.2, -0.05], s: 0.48, sp: 0.95, flip: true },
]

/**
 * Hero: an iridescent blob plus six chat bubbles on springs. Bubbles can be grabbed,
 * dragged and thrown; a tap pops one upward. Camera parallax follows the pointer,
 * scrollRef.current (viewports scrolled) lifts and turns the cluster away.
 */
export default function HeroScene({ dark, layout = 'column', reduced, intensity = 1, scrollRef, avoidSelector, onGrab, onRelease, onTap, className = '' }) {
  const wrap = useRef(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    wrap.current && io.observe(wrap.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={wrap} className={className}>
      <Canvas dpr={[1, 1.75]} gl={GL} onCreated={onCreated} frameloop={visible ? 'always' : 'never'}
        camera={{ fov: 38, position: [0, 0, 7], near: 0.1, far: 100 }}>
        <Lights />
        <StudioEnv dark={dark} />
        <Rig {...{ dark, layout, reduced, intensity, scrollRef, avoidSelector, onGrab, onRelease, onTap, wrap }} />
      </Canvas>
    </div>
  )
}

function Rig({ dark, layout, reduced, intensity, scrollRef, avoidSelector, onGrab, onRelease, onTap, wrap }) {
  const pal = PALETTE[dark ? 'dark' : 'light']
  const { camera, gl, size } = useThree()
  const root = useRef(), orb = useRef()
  const groups = useRef([]), bodies = useRef([]), dots = useRef(SPECS.map(() => []))
  const base = useMemo(() => new THREE.Vector3(), [])
  const uTime = useMemo(() => ({ value: 0 }), [])
  const st = useMemo(() => SPECS.map((sp, i) => ({
    home0: new THREE.Vector3(...sp.p), home: new THREE.Vector3(...sp.p), rot: new THREE.Euler(...sp.r),
    s: sp.s, sp: sp.sp, flip: !!sp.flip, vel: new THREE.Vector3(), spin: 0, spinV: 0, grab: 1, phase: i * 1.7,
  })), [])
  const live = useRef({})
  live.current = { reduced, intensity, onGrab, onRelease, onTap }
  const ix = useRef({ drag: -1, hover: -1, look: new THREE.Vector2(), t: 0 })

  // the orb's surface wobbles in the vertex shader
  const onBC = useMemo(() => (sh) => {
    sh.uniforms.uTime = uTime
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = position + normal * (sin(position.x*3.1+uTime*1.6)*sin(position.y*2.7+uTime*1.3)*sin(position.z*3.3+uTime*1.1)*0.28);')
  }, [uTime])

  // framing per layout, then keep bubbles out of the hero copy column so its text never sits on a glossy surface
  useEffect(() => {
    const a = size.width / Math.max(1, size.height)
    let sc
    if (layout === 'full') {
      const wide = a > 1.15
      base.set(wide ? Math.min(2.8, 0.9 + (a - 1.15) * 2.2) : 0, wide ? 0.35 : 1.1, 0)
      sc = wide ? 1 : Math.max(0.5, Math.min(1, a * 0.95))
    } else { base.set(0, 0, 0); sc = Math.max(0.55, Math.min(1, a * 0.9)) }
    root.current.scale.setScalar(sc)
    st.forEach((u) => u.home.copy(u.home0))
    const el = avoidSelector && document.querySelector(avoidSelector)
    if (!el || layout !== 'full') return
    const cr = gl.domElement.getBoundingClientRect(), r = el.getBoundingClientRect()
    if (!cr.width || r.width > cr.width * 0.7) return
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * 7, halfW = halfH * a
    const edge = -halfW + ((r.right - cr.left) / cr.width) * 2 * halfW
    st.forEach((u) => {
      const rad = u.s * 1.15, min = (edge - base.x) / sc + rad, max = (halfW - base.x) / sc - rad * 0.4
      if (u.home0.x < min) u.home.x = Math.min(max, min + (u.home0.x + 2.5) * 0.25)
    })
  }, [size, layout, avoidSelector, base, st, camera, gl])

  // grab / drag / throw: raw DOM pointer events so the page keeps scrolling everywhere else
  useEffect(() => {
    const canvas = gl.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane()
    const hit = new THREE.Vector3(), tmp = new THREE.Vector3(), wp = new THREE.Vector3()
    let down = null, grabOff = new THREE.Vector3(), lastT = 0
    const I = ix.current
    const toNdc = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1) }
    const pick = () => {
      ray.setFromCamera(ndc, camera)
      const h = ray.intersectObjects(bodies.current.filter(Boolean), false)
      return h.length ? bodies.current.indexOf(h[0].object) : -1
    }
    const onWin = (e) => I.look.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1)
    const onDown = (e) => {
      toNdc(e); const i = pick(); down = { x: e.clientX, y: e.clientY }
      if (i < 0) return
      I.drag = i
      groups.current[i].getWorldPosition(wp)
      plane.setFromNormalAndCoplanarPoint(tmp.set(0, 0, 1), wp)
      ray.ray.intersectPlane(plane, hit)
      grabOff = root.current.worldToLocal(hit.clone()).sub(groups.current[i].position)
      lastT = performance.now(); st[i].vel.set(0, 0, 0)
      try { canvas.setPointerCapture(e.pointerId) } catch {}
      canvas.style.cursor = 'grabbing'
      live.current.onGrab?.()
    }
    const onMove = (e) => {
      toNdc(e)
      if (I.drag >= 0) {
        ray.setFromCamera(ndc, camera)
        if (ray.ray.intersectPlane(plane, hit)) {
          const g = groups.current[I.drag], u = st[I.drag]
          const lp = root.current.worldToLocal(hit.clone()).sub(grabOff)
          const now = performance.now(), dt = Math.max(8, now - lastT) / 1000
          tmp.copy(lp).sub(g.position).divideScalar(dt)
          u.vel.lerp(tmp, 0.5)
          g.position.copy(lp); lastT = now
        }
        return
      }
      const i = pick()
      if (i !== I.hover) { I.hover = i; canvas.style.cursor = i >= 0 ? 'grab' : ''; cursor.label = i >= 0 ? 'drag' : '' }
    }
    const onUp = (e) => {
      if (I.drag < 0) return
      const u = st[I.drag]
      const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 99
      if (moved < 6) { u.vel.set(0, 6, 0); u.spinV = 12; live.current.onTap?.() }
      else { const sp = u.vel.length(); u.vel.clampLength(0, 18); u.spinV = Math.min(14, sp * 1.2); live.current.onRelease?.(sp) }
      I.drag = -1; canvas.style.cursor = I.hover >= 0 ? 'grab' : ''
    }
    const onLeave = () => { if (I.hover >= 0) { I.hover = -1; cursor.label = '' } }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    addEventListener('pointermove', onWin, { passive: true })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      removeEventListener('pointermove', onWin)
      cursor.label = ''
    }
  }, [gl, camera, st])

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    const I = ix.current, L = live.current
    const dt = Math.min(1 / 30, delta); I.t += dt
    const t = I.t, fl = L.reduced ? 0 : L.intensity
    st.forEach((u, i) => {
      const b = groups.current[i]
      if (!b) return
      if (i !== I.drag) {
        tmp.copy(u.home)
        tmp.y += Math.sin(t * 1.4 * u.sp + u.phase) * 0.14 * fl
        tmp.x += Math.cos(t * 0.9 * u.sp + u.phase) * 0.06 * fl
        const k = 38, c = 4.2 // spring stiffness, damping
        u.vel.x += ((tmp.x - b.position.x) * k - u.vel.x * c) * dt
        u.vel.y += ((tmp.y - b.position.y) * k - u.vel.y * c) * dt
        u.vel.z += ((tmp.z - b.position.z) * k - u.vel.z * c) * dt
        b.position.addScaledVector(u.vel, dt)
      }
      u.spinV += -u.spin * 20 * dt; u.spinV *= Math.exp(-dt * 3); u.spin += u.spinV * dt
      b.rotation.x = u.rot.x + Math.sin(t * 1.1 * u.sp + u.phase) * 0.12 * fl - u.vel.y * 0.035
      b.rotation.y = u.rot.y + Math.cos(t * 0.8 * u.sp + u.phase) * 0.15 * fl + u.vel.x * 0.04 + u.spin
      b.rotation.z = u.rot.z - u.vel.x * 0.025
      const target = i === I.drag ? 1.14 : i === I.hover ? 1.06 : 1
      u.grab += (target - u.grab) * Math.min(1, dt * 12)
      const sq = 1 + Math.min(0.22, u.vel.length() * 0.012) // squash with speed
      b.scale.set(u.s * u.grab * sq * (u.flip ? -1 : 1), (u.s * u.grab) / sq, u.s * u.grab)
      animateDots(dots.current[i], t * 3 * u.sp)
    })
    uTime.value = t * (L.reduced ? 0 : 1)
    orb.current.rotation.y += dt * 0.15 * (L.reduced ? 0 : 1)
    orb.current.position.y = 0.1 + Math.sin(t) * 0.1 * fl
    const sc = Math.min(1.6, Math.max(0, scrollRef?.current ?? 0))
    root.current.position.set(base.x, base.y + sc * 1.4, base.z)
    root.current.rotation.set(sc * 0.25, sc * 0.7, 0)
    if (!L.reduced) {
      tmp.set(I.look.x * 0.9 * L.intensity, I.look.y * 0.5 * L.intensity, 7 + sc * 1.2)
      camera.position.lerp(tmp, 1 - Math.exp(-dt * 2.5))
    }
    camera.lookAt(0, -sc * 0.4, 0)
  })

  return (
    <group ref={root}>
      <mesh ref={orb} position={[0.4, 0.1, -1.2]} scale={1.55}>
        <icosahedronGeometry args={[1, 24]} />
        <meshPhysicalMaterial color={pal.orb} roughness={0.08} metalness={0.25} clearcoat={1} iridescence={1} iridescenceIOR={1.5} onBeforeCompile={onBC} />
      </mesh>
      {SPECS.map((sp, i) => (
        <Bubble key={i} color={pal.bubbles[i]} dot={pal.dots[i]} dotsRef={dots.current[i]}
          bodyRef={(m) => { bodies.current[i] = m }}
          groupRef={(g) => {
            if (g && !groups.current[i]) { g.position.set(...sp.p); g.rotation.set(...sp.r) }
            groups.current[i] = g
          }} />
      ))}
      <Sparkles count={70} scale={[10, 6, 4]} size={3} speed={reduced ? 0 : 0.25} color={pal.spark} opacity={0.8} />
    </group>
  )
}
