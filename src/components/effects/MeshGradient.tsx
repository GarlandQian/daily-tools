'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { MeshGradientCSS } from './MeshGradientCSS'

type RendererTier = 'detecting' | 'gpu' | 'css'

// Lazy-load the GPU implementation so three.js / R3F never ships with the
// initial bundle and never executes during SSR.
const MeshGradientGL = dynamic(() => import('./MeshGradientGL').then(m => m.MeshGradientGL), {
  ssr: false,
  loading: () => null
})

async function detectRenderer(): Promise<Exclude<RendererTier, 'detecting'>> {
  if (typeof window === 'undefined') return 'css'

  // Try WebGPU first — only treat it as available once we successfully request
  // an adapter. This mirrors what three's WebGPURenderer needs at init time.
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu
  if (gpu && typeof gpu.requestAdapter === 'function') {
    try {
      const adapter = await gpu.requestAdapter()
      if (adapter) return 'gpu'
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
    if (ctx) return 'gpu'
  } catch {
    // ignore
  }

  return 'css'
}

/**
 * Animated Liquid Glass Mesh Gradient background.
 *
 * Renderer selection (best-effort, with safe fallbacks):
 *   1. WebGPU adapter available → GPU shader path (premium)
 *   2. WebGL2 / WebGL available → GPU shader path (standard)
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

  if (tier === 'gpu') {
    return <MeshGradientGL />
  }

  return <MeshGradientCSS />
}
