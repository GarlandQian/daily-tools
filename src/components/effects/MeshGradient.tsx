'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { MeshGradientCSS } from './MeshGradientCSS'

type RendererTier = 'detecting' | 'webgpu' | 'webgl' | 'css'

// Lazy-load GPU implementations so three.js never ships with the initial bundle
// and never executes during SSR.
const MeshGradientWebGPU = dynamic(
  () => import('./MeshGradientWebGPU').then(m => m.MeshGradientWebGPU),
  { ssr: false, loading: () => null }
)

const MeshGradientWebGL = dynamic(
  () => import('./MeshGradientWebGL').then(m => m.MeshGradientWebGL),
  { ssr: false, loading: () => null }
)

async function detectRenderer(): Promise<Exclude<RendererTier, 'detecting'>> {
  if (typeof window === 'undefined') return 'css'

  // Try WebGPU first — only treat it as available once we successfully request
  // an adapter. This mirrors what three's WebGPURenderer needs at init time.
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu
  if (gpu && typeof gpu.requestAdapter === 'function') {
    try {
      const adapter = await gpu.requestAdapter()
      if (adapter) return 'webgpu'
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
 *   1. WebGPU adapter available → WebGPU + TSL shader (premium)
 *   2. WebGL2 / WebGL available → WebGL + GLSL shader via R3F (standard)
 *   3. Neither, or SSR          → CSS-only animated radial gradients
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

  if (tier === 'webgpu') {
    return <MeshGradientWebGPU />
  }

  if (tier === 'webgl') {
    return <MeshGradientWebGL />
  }

  return <MeshGradientCSS />
}
