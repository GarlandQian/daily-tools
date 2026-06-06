import type { Metadata } from 'next'

import GridBuilderClient from '@/features/generation/components/GridBuilderClient'

export const metadata: Metadata = {
  title: 'CSS Grid Builder - Daily Tools',
  description: 'Design responsive CSS Grid tracks and copy production-ready CSS'
}

export default function GridPage() {
  return <GridBuilderClient />
}
