import type { Metadata } from 'next'

import EarlyHintsClient from '@/features/converter/components/EarlyHintsClient'

export const metadata: Metadata = {
  title: 'Early Hints Builder - Daily Tools',
  description: 'Build, parse, audit, and export 103 Early Hints and final Link response headers'
}

export default function EarlyHintsPage() {
  return <EarlyHintsClient />
}
