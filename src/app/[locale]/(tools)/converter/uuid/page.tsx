import type { Metadata } from 'next'

import UuidInspectorClient from '@/features/converter/components/UuidInspectorClient'

export const metadata: Metadata = {
  title: 'UUID Inspector - Daily Tools',
  description: 'Inspect, normalize, batch validate, convert, and export UUID metadata'
}

export default function UuidPage() {
  return <UuidInspectorClient />
}
