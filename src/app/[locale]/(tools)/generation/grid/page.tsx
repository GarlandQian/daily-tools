import type { Metadata } from 'next'

import GridBuilderClient from '@/features/generation/components/GridBuilderClient'

export const metadata: Metadata = {
  title: 'CSS Grid Builder - Daily Tools',
  description: 'Design CSS Grid tracks, named areas, container-query fallbacks, and copy-ready code'
}

export default function GridPage() {
  return <GridBuilderClient />
}
