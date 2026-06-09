import type { Metadata } from 'next'

import ResourceHintsClient from '@/features/converter/components/ResourceHintsClient'

export const metadata: Metadata = {
  title: 'Resource Hints Builder - Daily Tools',
  description:
    'Build, parse, audit, and export preload, preconnect, prefetch, dns-prefetch, modulepreload, and HTTP Link resource hints'
}

export default function ResourceHintsPage() {
  return <ResourceHintsClient />
}
