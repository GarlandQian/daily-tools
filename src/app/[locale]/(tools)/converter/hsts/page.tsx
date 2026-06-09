import type { Metadata } from 'next'

import HstsClient from '@/features/converter/components/HstsClient'

export const metadata: Metadata = {
  title: 'HSTS Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Strict-Transport-Security headers with max-age, includeSubDomains, and preload readiness checks'
}

export default function HstsPage() {
  return <HstsClient />
}
