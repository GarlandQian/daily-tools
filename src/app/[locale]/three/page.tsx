'use client'
import { OrbitControls, Stats } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

import Loader from '@/components/three/Loader'

import Model from './model'

const Home = () => {
  return (
    <div style={{ height: '100vh' }}>
      <Canvas camera={{ position: [2, 1, 2], near: 0.05 }} style={{ background: '#fff' }}>
        <ambientLight intensity={1} />
        <OrbitControls enableZoom={true} />
        <Stats />
        <directionalLight position={[5, 5, 5]} castShadow />
        <Suspense fallback={<Loader />}>
          <Model />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default dynamic(() => Promise.resolve(Home), { ssr: false })
