'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { MeshGradientCSS } from './MeshGradientCSS'

type RendererTier = 'detecting' | 'webgl' | 'css'

// Lazy-load GPU implementation so three.js never ships with the initial bundle
// and never executes during SSR.
// Note: R3F doesn't support WebGPU yet, so we use WebGL for all GPU rendering.
const MeshGradientWebGL = dynamic(
  () => import('./MeshGradientWebGL').then(m => m.MeshGradientWebGL),
  { ssr: false, loading: () => null }
)

async function detectRenderer(): Promise<Exclude<RendererTier, 'detecting'>> {
  if (typeof window === 'undefined') return 'css'

  // Check for WebGPU support (future-proofing)
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu
  if (gpu && typeof gpu.requestAdapter === 'function') {
    try {
      const adapter = await gpu.requestAdapter()
      // WebGPU is available, but R3F doesn't support it yet, so fall back to WebGL
      if (adapter) return 'webgl'
    } catch {
      // fall through to WebGL probe
    }
  }

  // Probe WebGL2 / WebGL availability with a throwaway canvas.
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    if (ctx) return 'webgl'
  } catch {
    // ignore
  }

  return 'css'
}

/**
 * Animated Liquid Glass Mesh Gradient background.
 *
 * Renderer selection (best-effort, with safe fallbacks):
 *   1. WebGPU or WebGL2 / WebGL available → WebGL + GLSL shader via R3F
 *   2. Neither, or SSR                    → CSS-only animated radial gradients
 */
export function MeshGradient() {
  const [tier, setTier] = useState<RendererTier>('detecting')

  useEffect(() => {
    let cancelled = false
    detectRenderer().then(next => {
      if (!cancelled) setTier(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (tier === 'detecting') {
    // Render the CSS version while detecting so the page never flashes empty.
    return <MeshGradientCSS />
  }

  if (tier === 'webgl') {
    return <MeshGradientWebGL />
  }

  return <MeshGradientCSS />
}
