import type { Metadata } from 'next'

import UuidInspectorClient from '@/features/converter/components/UuidInspectorClient'

export const metadata: Metadata = {
  title: 'UUID Inspector - Daily Tools',
  description: 'Inspect UUID version, variant, timestamp, namespace style, and byte layout'
}

export default function UuidPage() {
  return <UuidInspectorClient />
}
