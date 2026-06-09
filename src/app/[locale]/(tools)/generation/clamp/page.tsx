import type { Metadata } from 'next'

import ClampClient from '@/features/generation/components/ClampClient'

export const metadata: Metadata = {
  title: 'CSS Clamp Generator - Daily Tools',
  description:
    'Generate responsive CSS clamp values with declarations, variables, and sampled outputs'
}

export default function ClampPage() {
  return <ClampClient />
}
