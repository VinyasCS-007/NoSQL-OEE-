import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

export const PALETTE = {
  dark: { bubbles: ['#8b6cff', '#f4f5ff', '#22d3ee', '#ff5fb0', '#b9a6ff', '#5eead4'], dots: ['#ffffff', '#6d4aff', '#ffffff', '#ffffff', '#ffffff', '#0f1224'], orb: '#7c5cff', spark: '#c4b5fd' },
  light: { bubbles: ['#6d4aff', '#ffffff', '#00b8d9', '#ff4fa3', '#a78bfa', '#2dd4bf'], dots: ['#ffffff', '#6d4aff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], orb: '#7c5cff', spark: '#8b6cff' },
}

// one shared geometry for every bubble: a rounded speech bubble with a tail, extruded and bevelled
let bubbleGeo, dotGeo
export function geometries() {
  if (!bubbleGeo) {
    const w = 1.7, h = 1.05, r = 0.42, x = -w / 2, y = -h / 2
    const s = new THREE.Shape()
    s.moveTo(x + 0.66, y)
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
    s.quadraticCurveTo(x + 0.28, y - 0.08, x + 0.08, y - 0.36)
    s.quadraticCurveTo(x + 0.42, y - 0.22, x + 0.66, y)
    bubbleGeo = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 10, curveSegments: 28 })
    bubbleGeo.center()
    bubbleGeo.computeVertexNormals()
    dotGeo = new THREE.SphereGeometry(0.1, 24, 24)
  }
  return { bubbleGeo, dotGeo }
}

/** A glossy chat bubble with three "typing" dots. dotsRef receives the three dot meshes. */
export function Bubble({ color, dot, bodyRef, dotsRef, groupRef }) {
  const { bubbleGeo: g, dotGeo: d } = geometries()
  return (
    <group ref={groupRef}>
      <mesh ref={bodyRef} geometry={g}>
        <meshPhysicalMaterial color={color} roughness={0.16} metalness={0.05} clearcoat={1} clearcoatRoughness={0.1} iridescence={0.6} iridescenceIOR={1.3} />
      </mesh>
      {[-0.38, 0, 0.38].map((x, i) => (
        <mesh key={x} geometry={d} position={[x, 0.06, 0.24]} ref={(m) => { if (dotsRef) dotsRef[i] = m }}>
          <meshStandardMaterial color={dot} emissive={dot} emissiveIntensity={0.35} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

export function animateDots(dots, t) {
  dots.forEach((m, i) => {
    if (!m) return
    const k = Math.max(0, Math.sin(t - i * 0.7))
    m.scale.setScalar(0.75 + k * 0.45)
    m.position.z = 0.24 + k * 0.05
  })
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight intensity={1.6} position={[4, 5, 5]} />
      <pointLight color="#22d3ee" intensity={30} position={[-4, -2, 3]} />
      <pointLight color="#ff5fb0" intensity={25} position={[4, 2, 2]} />
    </>
  )
}

/** Studio reflections: coloured light panels baked once into an env map (re-baked on theme change). */
export function StudioEnv({ dark }) {
  return (
    <Environment key={dark ? 'd' : 'l'} resolution={128} frames={1}>
      <color attach="background" args={[dark ? '#07080f' : '#d9dcef']} />
      <Lightformer form="rect" color="#ffffff" intensity={3} position={[0, 5, -5]} scale={[10, 3, 1]} />
      <Lightformer form="rect" color="#a78bfa" intensity={2} position={[-5, 1, 1]} scale={[3, 6, 1]} />
      <Lightformer form="rect" color="#22d3ee" intensity={2} position={[5, -1, 1]} scale={[3, 6, 1]} />
      <Lightformer form="rect" color="#ff5fb0" intensity={1.2} position={[0, -4, 3]} scale={[6, 2, 1]} />
      <Lightformer form="rect" color="#ffffff" intensity={1.5} position={[0, 1, 6]} scale={[5, 2, 1]} />
    </Environment>
  )
}

export const GL = { antialias: true, alpha: true, powerPreference: 'high-performance' }
export const onCreated = ({ gl }) => {
  gl.toneMappingExposure = 1.05
  gl.domElement.style.touchAction = 'pan-y'
}
