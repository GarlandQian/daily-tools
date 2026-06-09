import type { Metadata } from 'next'

import HydrationBoundaryClient from '@/features/converter/components/HydrationBoundaryClient'

export const metadata: Metadata = {
  title: 'Hydration Boundary Planner - Daily Tools',
  description:
    'Audit client component boundaries, hydration cost, serialized props, and RSC payload risks'
}

export default function HydrationBoundaryPage() {
  return <HydrationBoundaryClient />
}
