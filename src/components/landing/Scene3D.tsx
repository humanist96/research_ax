'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

function AnimatedIcosahedron({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.3
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.2
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={meshRef} position={position}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.15}
          distort={0.4}
          speed={2}
          roughness={0.2}
        />
      </mesh>
    </Float>
  )
}

function SceneContent() {
  const shapes = useMemo(() => [
    { position: [-4, 2, -5] as [number, number, number], color: '#6366f1', speed: 0.5 },
    { position: [4, -1, -3] as [number, number, number], color: '#8b5cf6', speed: 0.7 },
    { position: [0, 3, -8] as [number, number, number], color: '#22d3ee', speed: 0.4 },
    { position: [-3, -3, -6] as [number, number, number], color: '#6366f1', speed: 0.6 },
  ], [])

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      {shapes.map((shape, i) => (
        <AnimatedIcosahedron key={i} {...shape} />
      ))}
    </>
  )
}

export function Scene3D() {
  return (
    <>
      {/* CSS gradient fallback (always visible, acts as base layer) */}
      <div
        className="fixed inset-0 -z-20"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%), #0b1120',
        }}
      />
      {/* 3D canvas (hidden on mobile for performance) */}
      <div className="fixed inset-0 -z-10 hidden md:block">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 60 }}
          dpr={[1, 1.5]}
          style={{ pointerEvents: 'none' }}
        >
          <SceneContent />
        </Canvas>
      </div>
    </>
  )
}
