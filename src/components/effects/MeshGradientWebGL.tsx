'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { useTheme } from '@/components/ThemeProvider'

/**
 * GPU-accelerated Mesh Gradient using a fullscreen metaball fragment shader.
 * Renders 5 colored "blobs" with smooth exponential falloff that drift slowly,
 * creating a liquid, refractive glass-like background.
 *
 * Uses GLSL ShaderMaterial via the default WebGLRenderer. WebGPU detection in
 * the parent dispatcher routes here as well — for a 2D fullscreen quad the
 * visual difference is negligible, while WebGL guarantees universal support.
 */

const LIGHT_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [120 / 255, 119 / 255, 198 / 255],
  [255 / 255, 119 / 255, 115 / 255],
  [78 / 255, 205 / 255, 196 / 255],
  [99 / 255, 179 / 255, 237 / 255],
  [183 / 255, 148 / 255, 244 / 255]
]

const DARK_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [88 / 255, 86 / 255, 214 / 255],
  [255 / 255, 55 / 255, 95 / 255],
  [48 / 255, 209 / 255, 88 / 255],
  [94 / 255, 158 / 255, 255 / 255],
  [191 / 255, 90 / 255, 242 / 255]
]

const CENTERS: ReadonlyArray<readonly [number, number]> = [
  [0.25, 0.75],
  [0.7, 0.85],
  [0.55, 0.25],
  [0.35, 0.3],
  [0.8, 0.5]
]

const RADII: ReadonlyArray<number> = [0.5, 0.42, 0.55, 0.45, 0.4]

const LIGHT_BG: readonly [number, number, number] = [0.94, 0.95, 0.96]
const DARK_BG: readonly [number, number, number] = [0.047, 0.047, 0.078]

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uBgColor;
uniform vec3 uColors[5];
uniform vec2 uCenters[5];
uniform float uRadii[5];
uniform float uIntensity;
uniform float uDarkMix;

vec2 drift(float t, float seed) {
  // slow, irregular orbital drift (~30-50s loop feel)
  return vec2(
    sin(t * 0.05 + seed * 1.7) * 0.09 + cos(t * 0.03 + seed * 0.7) * 0.04,
    cos(t * 0.07 + seed * 2.3) * 0.09 + sin(t * 0.04 + seed * 1.3) * 0.04
  );
}

void main() {
  vec2 uv = vUv;
  // correct aspect so blobs stay circular
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 auv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

  vec3 color = uBgColor;
  float totalInfluence = 0.0;

  for (int i = 0; i < 5; i++) {
    vec2 c = uCenters[i] + drift(uTime, float(i));
    vec2 d = auv - c;
    float dist2 = dot(d, d);
    float r = uRadii[i];
    // gaussian-ish falloff for smooth metaball blending
    float influence = exp(-dist2 / (r * r)) * uIntensity;
    color = mix(color, uColors[i], clamp(influence, 0.0, 1.0));
    totalInfluence += influence;
  }

  // subtle vignette to ground the composition
  float vignette = 1.0 - smoothstep(0.55, 1.05, length(uv - 0.5));
  color *= mix(0.85, 1.0, vignette);

  // dark mode adds a hint more contrast
  color = mix(color, color * 1.15, uDarkMix * 0.3);

  gl_FragColor = vec4(color, 1.0);
}
`

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true
  return document.visibilityState !== 'hidden'
}

function getGradientDpr(): [number, number] {
  if (typeof window === 'undefined') return [1, 1]

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const smallViewport = window.innerWidth < 768
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const maxDpr = coarsePointer || smallViewport || deviceMemory <= 4 ? 1 : 1.25

  return [1, maxDpr]
}

function useGradientRuntime() {
  const [runtime, setRuntime] = useState(() => ({
    dpr: getGradientDpr(),
    isVisible: isDocumentVisible(),
    reducedMotion: prefersReducedMotion()
  }))

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0

    const updateRuntime = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0
        setRuntime({
          dpr: getGradientDpr(),
          isVisible: isDocumentVisible(),
          reducedMotion: reducedMotionQuery.matches
        })
      })
    }

    const updateRuntimeNow = () => {
      setRuntime({
        dpr: getGradientDpr(),
        isVisible: isDocumentVisible(),
        reducedMotion: reducedMotionQuery.matches
      })
    }

    document.addEventListener('visibilitychange', updateRuntimeNow)
    window.addEventListener('resize', updateRuntime, { passive: true })
    reducedMotionQuery.addEventListener('change', updateRuntimeNow)

    return () => {
      document.removeEventListener('visibilitychange', updateRuntimeNow)
      window.removeEventListener('resize', updateRuntime)
      reducedMotionQuery.removeEventListener('change', updateRuntimeNow)
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [])

  return runtime
}

function MeshGradientScene({
  isDarkMode,
  reducedMotion
}: {
  isDarkMode: boolean
  reducedMotion: boolean
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { invalidate, size } = useThree()
  const reducedMotionRef = useRef(reducedMotion)
  const targetBgRef = useRef(new THREE.Vector3(...(isDarkMode ? DARK_BG : LIGHT_BG)))
  const targetColorsRef = useRef(
    (isDarkMode ? DARK_PALETTE : LIGHT_PALETTE).map(c => new THREE.Vector3(c[0], c[1], c[2]))
  )
  const targetDarkMixRef = useRef(isDarkMode ? 1 : 0)

  const palette = isDarkMode ? DARK_PALETTE : LIGHT_PALETTE
  const bg = isDarkMode ? DARK_BG : LIGHT_BG

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uBgColor: { value: new THREE.Vector3(bg[0], bg[1], bg[2]) },
      uColors: {
        value: palette.map(c => new THREE.Vector3(c[0], c[1], c[2]))
      },
      uCenters: {
        value: CENTERS.map(c => new THREE.Vector2(c[0], c[1]))
      },
      uRadii: { value: [...RADII] },
      uIntensity: { value: 1.0 },
      uDarkMix: { value: isDarkMode ? 1.0 : 0.0 }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Smooth theme transition: set targets here; interpolate them inside the render loop.
  useEffect(() => {
    const next = isDarkMode ? DARK_PALETTE : LIGHT_PALETTE
    const nextBg = isDarkMode ? DARK_BG : LIGHT_BG
    next.forEach((c, i) => {
      targetColorsRef.current[i].set(c[0], c[1], c[2])
    })
    targetBgRef.current.set(nextBg[0], nextBg[1], nextBg[2])
    targetDarkMixRef.current = isDarkMode ? 1 : 0
    if (reducedMotionRef.current) invalidate()
  }, [invalidate, isDarkMode])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
    if (reducedMotion) invalidate()
  }, [invalidate, reducedMotion])

  useFrame((state, delta) => {
    const mat = matRef.current
    if (!mat) return
    const u = mat.uniforms
    const alpha = reducedMotionRef.current ? 1 : 1 - Math.pow(0.002, delta)

    ;(u.uBgColor.value as THREE.Vector3).lerp(targetBgRef.current, alpha)
    ;(u.uColors.value as THREE.Vector3[]).forEach((color, index) => {
      color.lerp(targetColorsRef.current[index], alpha)
    })
    ;(u.uDarkMix as { value: number }).value = THREE.MathUtils.lerp(
      (u.uDarkMix as { value: number }).value,
      targetDarkMixRef.current,
      alpha
    )

    if (!reducedMotionRef.current) {
      ;(u.uTime as { value: number }).value += delta
    }
    ;(u.uResolution.value as THREE.Vector2).set(state.size.width, state.size.height)
  })

  return (
    /* eslint-disable react/no-unknown-property -- @react-three/fiber JSX intrinsics */
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </mesh>
    /* eslint-enable react/no-unknown-property */
  )
}

export function MeshGradientWebGL() {
  const { isDarkMode } = useTheme()
  const { dpr, isVisible, reducedMotion } = useGradientRuntime()
  const bg = isDarkMode ? DARK_BG : LIGHT_BG
  const bgCss = `rgb(${Math.round(bg[0] * 255)}, ${Math.round(bg[1] * 255)}, ${Math.round(bg[2] * 255)})`

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        backgroundColor: bgCss,
        transition: 'background-color 900ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
      aria-hidden="true"
    >
      <Canvas
        orthographic
        dpr={dpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          depth: false,
          stencil: false
        }}
        frameloop={isVisible && !reducedMotion ? 'always' : 'demand'}
        style={{ width: '100%', height: '100%' }}
      >
        <MeshGradientScene isDarkMode={isDarkMode} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
