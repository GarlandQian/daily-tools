import type { Metadata } from 'next'

import GradientClient from '@/features/generation/components/GradientClient'

export const metadata: Metadata = {
  title: 'Gradient Generator - Daily Tools',
  description: 'Generate linear, radial, and conic CSS gradients visually'
}

export default function GradientPage() {
  return <GradientClient />
}
