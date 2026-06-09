import type { Metadata } from 'next'

import PriorityHintsClient from '@/features/converter/components/PriorityHintsClient'

export const metadata: Metadata = {
  title: 'Priority Hints Builder - Daily Tools',
  description:
    'Build, parse, audit, and export fetchpriority, loading, decoding, and resource priority snippets'
}

export default function PriorityHintsPage() {
  return <PriorityHintsClient />
}
