import type { Metadata } from 'next'

import CrossOriginIsolationClient from '@/features/converter/components/CrossOriginIsolationClient'

export const metadata: Metadata = {
  title: 'Cross-Origin Isolation Builder - Daily Tools',
  description:
    'Build, parse, audit, and export COOP, COEP, and CORP headers for cross-origin isolation and resource protection'
}

export default function CrossOriginIsolationPage() {
  return <CrossOriginIsolationClient />
}
