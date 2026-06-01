'use client'

import { useTheme } from '@/components/ThemeProvider'

const LIGHT_BLOBS = [
  {
    color: 'rgba(120, 119, 198, 0.35)',
    x: '25%',
    y: '25%',
    size: '45%',
    delay: '0s',
    duration: '35s'
  },
  {
    color: 'rgba(255, 119, 115, 0.2)',
    x: '70%',
    y: '15%',
    size: '40%',
    delay: '-8s',
    duration: '40s'
  },
  {
    color: 'rgba(78, 205, 196, 0.25)',
    x: '55%',
    y: '75%',
    size: '50%',
    delay: '-15s',
    duration: '45s'
  },
  {
    color: 'rgba(99, 179, 237, 0.25)',
    x: '35%',
    y: '70%',
    size: '42%',
    delay: '-22s',
    duration: '38s'
  },
  {
    color: 'rgba(183, 148, 244, 0.2)',
    x: '80%',
    y: '50%',
    size: '38%',
    delay: '-30s',
    duration: '42s'
  }
]

const DARK_BLOBS = [
  {
    color: 'rgba(88, 86, 214, 0.4)',
    x: '20%',
    y: '30%',
    size: '45%',
    delay: '0s',
    duration: '35s'
  },
  {
    color: 'rgba(255, 55, 95, 0.2)',
    x: '75%',
    y: '20%',
    size: '40%',
    delay: '-8s',
    duration: '40s'
  },
  {
    color: 'rgba(48, 209, 88, 0.15)',
    x: '60%',
    y: '70%',
    size: '50%',
    delay: '-15s',
    duration: '45s'
  },
  {
    color: 'rgba(94, 158, 255, 0.3)',
    x: '30%',
    y: '75%',
    size: '42%',
    delay: '-22s',
    duration: '38s'
  },
  {
    color: 'rgba(191, 90, 242, 0.25)',
    x: '80%',
    y: '55%',
    size: '38%',
    delay: '-30s',
    duration: '42s'
  }
]

const MeshLayer = ({ blobs, visible }: { blobs: typeof LIGHT_BLOBS; visible: boolean }) => (
  <div
    className="mesh-gradient-theme-layer absolute inset-0"
    style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 900ms cubic-bezier(0.22, 1, 0.36, 1)'
    }}
  >
    {blobs.map((blob, i) => (
      <div
        key={i}
        className="absolute rounded-full"
        style={{
          left: blob.x,
          top: blob.y,
          width: blob.size,
          height: blob.size,
          background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          animation: `meshFloat ${blob.duration} ease-in-out infinite`,
          animationDelay: blob.delay,
          willChange: 'transform'
        }}
      />
    ))}
  </div>
)

/**
 * CSS-only Mesh Gradient fallback.
 * Used when WebGPU and WebGL are both unavailable, or when prefers-reduced-motion is set.
 */
export function MeshGradientCSS() {
  const { isDarkMode } = useTheme()

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-base)',
        transition: 'background-color 900ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
      aria-hidden="true"
    >
      <MeshLayer blobs={LIGHT_BLOBS} visible={!isDarkMode} />
      <MeshLayer blobs={DARK_BLOBS} visible={isDarkMode} />
    </div>
  )
}
