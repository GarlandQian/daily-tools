import { useGLTF } from '@react-three/drei'
import { PrimitiveProps, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

export default function Model() {
  const { scene } = useGLTF('/models/Frey_FirstAnniversary/Frey_FirstAnniversary.gltf')
  const modelRef = useRef<PrimitiveProps>()
  useFrame(() => {
    const arm = modelRef.current?.getObjectByName('Bip001')
    if (arm) {
      arm.rotation.x += 0.01
    }
  })
  return <primitive ref={modelRef} object={scene} />
}
