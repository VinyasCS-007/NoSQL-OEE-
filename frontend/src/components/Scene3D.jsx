import { Environment, Float, Lightformer, MeshDistortMaterial, RoundedBox, Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

/** A glossy 3D chat bubble whose three dots pulse like a typing indicator. */
function ChatBubble({ color, position, rotation, scale = 1, speed = 1, dotColor = '#ffffff', flip = false }) {
  const dots = useRef([])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 3 * speed
    dots.current.forEach((d, i) => {
      if (!d) return
      const s = 0.75 + Math.max(0, Math.sin(t - i * 0.7)) * 0.45
      d.scale.setScalar(s)
      d.position.z = 0.2 + Math.max(0, Math.sin(t - i * 0.7)) * 0.05
    })
  })

  return (
    <Float speed={1.4 * speed} rotationIntensity={0.6} floatIntensity={1.1}>
      <group position={position} rotation={rotation} scale={scale}>
        <RoundedBox args={[1.7, 1.05, 0.36]} radius={0.32} smoothness={6}>
          <meshPhysicalMaterial color={color} roughness={0.18} metalness={0.05} clearcoat={1} clearcoatRoughness={0.12} iridescence={0.6} iridescenceIOR={1.3} />
        </RoundedBox>
        {/* bubble tail */}
        <mesh position={[flip ? 0.55 : -0.55, -0.6, 0]} rotation={[0, 0, flip ? -2.5 : 2.5]}>
          <coneGeometry args={[0.2, 0.42, 24]} />
          <meshPhysicalMaterial color={color} roughness={0.18} clearcoat={1} />
        </mesh>
        {[-0.38, 0, 0.38].map((x, i) => (
          <mesh key={i} ref={(el) => (dots.current[i] = el)} position={[x, 0, 0.2]}>
            <sphereGeometry args={[0.1, 24, 24]} />
            <meshStandardMaterial color={dotColor} emissive={dotColor} emissiveIntensity={0.35} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </Float>
  )
}

/** Iridescent wobbling orb in the centre. */
function Orb() {
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation.y += dt * 0.15 })
  return (
    <Float speed={1} floatIntensity={0.6} rotationIntensity={0.3}>
      <mesh ref={ref} position={[0.4, 0.1, -1.2]} scale={1.55}>
        <icosahedronGeometry args={[1, 24]} />
        <MeshDistortMaterial color="#7c5cff" distort={0.32} speed={1.6} roughness={0.08} metalness={0.25} clearcoat={1} iridescence={1} iridescenceIOR={1.5} />
      </mesh>
    </Float>
  )
}

/** Camera gently follows the pointer for parallax depth. */
function Rig() {
  const target = new THREE.Vector3()
  useFrame(({ camera, pointer }, dt) => {
    target.set(pointer.x * 0.9, pointer.y * 0.5, 7)
    camera.position.lerp(target, 1 - Math.exp(-dt * 2.5))
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Scene3D({ reduceMotion = false }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 7], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={reduceMotion ? 'demand' : 'always'}
      aria-hidden
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={30} color="#22d3ee" />
      <pointLight position={[4, 2, 2]} intensity={25} color="#ff5fb0" />

      <Orb />
      <ChatBubble color="#8b6cff" position={[-2.3, 1.1, 0]} rotation={[0.1, 0.35, -0.08]} scale={0.95} />
      <ChatBubble color="#f4f5ff" dotColor="#6d4aff" position={[2.5, 1.35, -0.4]} rotation={[-0.05, -0.4, 0.1]} scale={0.75} speed={0.8} flip />
      <ChatBubble color="#22d3ee" position={[2.2, -1.35, 0.5]} rotation={[0.15, -0.3, 0.06]} scale={0.85} speed={1.2} flip />
      <ChatBubble color="#ff5fb0" position={[-2.1, -1.5, 0.3]} rotation={[-0.1, 0.45, -0.1]} scale={0.7} speed={0.9} />

      <Sparkles count={60} scale={[10, 6, 4]} size={2.2} speed={0.35} opacity={0.7} color="#c4b5fd" />

      {/* studio lighting built in code: no HDR download needed */}
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 3, 1]} />
        <Lightformer intensity={1.5} color="#a78bfa" position={[-5, 1, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer intensity={1.5} color="#22d3ee" position={[5, -1, 1]} scale={[3, 6, 1]} rotation-y={-Math.PI / 2} />
      </Environment>

      {!reduceMotion && <Rig />}
    </Canvas>
  )
}
