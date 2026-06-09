import type { Metadata } from 'next'

import FontLoadingClient from '@/features/converter/components/FontLoadingClient'

export const metadata: Metadata = {
  title: 'Font Loading Planner - Daily Tools',
  description:
    'Build, parse, audit, and export font-face, preload, next/font, fallback, JSON, and CSV font-loading plans'
}

export default function FontLoadingPage() {
  return <FontLoadingClient />
}
