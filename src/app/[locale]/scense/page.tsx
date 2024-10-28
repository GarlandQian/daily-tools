'use client'
import Loader from '@/components/three/Loader'
import { Canvas } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { OrbitControls } from '@react-three/drei'
import Model from './model/main'

const Home = () => {
  return (
    <div style={{ height: '100vh' }}>
      <h1>3D Models with Reusable Three.js Component</h1>
      <Canvas>
        <ambientLight intensity={1} />
        <directionalLight />
        <Suspense fallback={<Loader />}>
          <Model />
          <OrbitControls enableZoom={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default dynamic(() => Promise.resolve(Home), { ssr: false })
