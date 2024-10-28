import React, { useState, useEffect, useCallback, Ref } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import {
  Euler,
  ExtendedColors,
  Layers,
  Matrix4,
  NodeProps,
  NonFunctionKeys,
  Overwrite,
  Quaternion,
  useFrame,
  Vector3,
} from '@react-three/fiber'
import { useSpring, animated, config, AnimatedProps } from '@react-spring/three'
import { EventHandlers } from '@react-three/fiber/dist/declarations/src/core/events'
import { Group, Object3DEventMap } from 'three'

export default function Model(
  props: React.JSX.IntrinsicAttributes &
    AnimatedProps<
      Omit<
        ExtendedColors<Overwrite<Partial<Group<Object3DEventMap>>, NodeProps<Group<Object3DEventMap>, typeof Group>>>,
        NonFunctionKeys<{
          position?: Vector3
          up?: Vector3
          scale?: Vector3
          rotation?: Euler
          matrix?: Matrix4
          quaternion?: Quaternion
          layers?: Layers
          dispose?: (() => void) | null
        }>
      > & {
        position?: Vector3
        up?: Vector3
        scale?: Vector3
        rotation?: Euler
        matrix?: Matrix4
        quaternion?: Quaternion
        layers?: Layers
        dispose?: (() => void) | null
      } & EventHandlers
    >
) {
  // const group = useRef();
  const { scene, animations } = useGLTF('/models/Frey_FirstAnniversary.glb')
  const { actions, names, ref } = useAnimations(animations)
  useFrame(({ clock }) => {
    ref.current!.rotation.y = Math.sin(clock.getElapsedTime())
  })
  const [active, setActive] = useState(false)
  const { scale } = useSpring({
    scale: active ? 0.6 : 1,
    config: config.wobbly,
  })

  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    console.log(actions, 'actions', animations, names)
    if (actions) {
      actions[names[activeIndex]]?.reset().fadeIn(0.5).play()
    }
    actions[names[activeIndex]]?.fadeOut(0.5)
  }, [actions, names, activeIndex, animations])

  const handleChangeAnmition = useCallback(() => {
    if (activeIndex < names.length - 1) {
      setActiveIndex(activeIndex + 1)
    } else {
      setActiveIndex(0)
    }
  }, [activeIndex, names.length])

  return (
    <animated.group
      ref={ref as Ref<Group<Object3DEventMap>> | undefined}
      {...props}
      dispose={null}
      scale={scale}
      onPointerOver={() => setActive(!active)}
      onClick={handleChangeAnmition}
    >
      <primitive object={scene} />
    </animated.group>
  )
}

useGLTF.preload('/models/Frey_FirstAnniversary.glb')
