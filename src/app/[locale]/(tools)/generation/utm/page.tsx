import type { Metadata } from 'next'

import UtmBuilderClient from '@/features/generation/components/UtmBuilderClient'

export const metadata: Metadata = {
  title: 'UTM Builder - Daily Tools',
  description: 'Build normalized campaign URLs, UTM variants, and JSON tracking summaries'
}

export default function UtmBuilderPage() {
  return <UtmBuilderClient />
}
