'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { float, Fn, Loop, mix, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import WebGPURenderer from 'three/webgpu'

import { useTheme } from '@/components/ThemeProvider'

/**
 * WebGPU-accelerated Mesh Gradient using TSL (Three Shading Language).
 * Renders 5 colored "blobs" with smooth exponential falloff that drift slowly,
 * creating a liquid, refractive glass-like background.
 *
 * Uses WebGPURenderer + TSL node materials for maximum performance on
 * modern browsers with WebGPU support.
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

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function MeshGradientWebGPU() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WebGPURenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const materialRef = useRef<THREE.MeshBasicNodeMaterial | null>(null)
  const timeRef = useRef(0)
  const reducedMotionRef = useRef(prefersReducedMotion())
  const rafRef = useRef<number | null>(null)

  const { isDarkMode } = useTheme()
  const palette = isDarkMode ? DARK_PALETTE : LIGHT_PALETTE
  const bg = isDarkMode ? DARK_BG : LIGHT_BG
  const bgCss = `rgb(${Math.round(bg[0] * 255)}, ${Math.round(bg[1] * 255)}, ${Math.round(bg[2] * 255)})`

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Create orthographic camera for fullscreen quad
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    cameraRef.current = camera

    // Create WebGPU renderer
    const renderer = new WebGPURenderer({
      antialias: false,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // TSL uniforms
    const uTime = uniform(0)
    const uResolution = uniform(vec2(container.clientWidth, container.clientHeight))
    const uBgColor = uniform(vec3(bg[0], bg[1], bg[2]))
    const uColors = palette.map(c => uniform(vec3(c[0], c[1], c[2])))
    const uCenters = CENTERS.map(c => uniform(vec2(c[0], c[1])))
    const uRadii = RADII.map(r => uniform(float(r)))
    const uDarkMix = uniform(float(isDarkMode ? 1.0 : 0.0))

    // Drift function in TSL
    const drift = Fn(([t, seed]) => {
      const x = t
        .mul(0.05)
        .add(seed.mul(1.7))
        .sin()
        .mul(0.09)
        .add(t.mul(0.03).add(seed.mul(0.7)).cos().mul(0.04))
      const y = t
        .mul(0.07)
        .add(seed.mul(2.3))
        .cos()
        .mul(0.09)
        .add(t.mul(0.04).add(seed.mul(1.3)).sin().mul(0.04))
      return vec2(x, y)
    })

    // Fragment shader in TSL
    const fragmentNode = Fn(() => {
      const uvCoord = uv()
      const aspect = uResolution.x.div(uResolution.y.max(1.0))
      const auv = uvCoord.sub(0.5).mul(vec2(aspect, 1.0)).add(0.5)

      let finalColor = uBgColor

      Loop(5, ({ i }) => {
        const center = uCenters[i.value].add(drift(uTime, float(i.value)))
        const d = auv.sub(center)
        const dist2 = d.dot(d)
        const r = uRadii[i.value]

        // Gaussian falloff: exp(-d²/r²)
        const influence = dist2.negate().div(r.mul(r)).exp()

        finalColor = mix(finalColor, uColors[i.value], influence.clamp(0, 1))
      })

      // Vignette
      const vignette = smoothstep(0.55, 1.05, uvCoord.sub(0.5).length()).oneMinus()
      finalColor = finalColor.mul(mix(0.85, 1.0, vignette))

      // Dark mode contrast boost
      finalColor = mix(finalColor, finalColor.mul(1.15), uDarkMix.mul(0.3))

      return vec4(finalColor, 1.0)
    })()

    // Create material with TSL node
    const material = new THREE.MeshBasicNodeMaterial()
    material.colorNode = fragmentNode
    materialRef.current = material

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Animation loop
    let lastTime = performance.now()
    const animate = () => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      if (!reducedMotionRef.current) {
        timeRef.current += delta
        uTime.value = timeRef.current
      }

      uResolution.value.set(container.clientWidth, container.clientHeight)
      renderer.render(scene, camera)
      rafRef.current = requestAnimationFrame(animate)
    }

    // Initialize renderer and start animation
    renderer.init().then(() => {
      animate()
    })

    // Handle resize
    const handleResize = () => {
      if (!container || !renderer) return
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      uResolution.value.set(width, height)
    }
    window.addEventListener('resize', handleResize)

    // Watch reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches
    }
    mq.addEventListener('change', handleMotionChange)

    // Cleanup
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      window.removeEventListener('resize', handleResize)
      mq.removeEventListener('change', handleMotionChange)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Note: Theme switching in WebGPU path requires page reload.
  // TSL uniform updates would need proper uniform node access.
  // This is acceptable as WebGPU is a progressive enhancement.

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: bgCss }}
      aria-hidden="true"
    />
  )
}
