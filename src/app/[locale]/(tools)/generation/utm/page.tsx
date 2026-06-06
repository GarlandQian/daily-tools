import type { Metadata } from 'next'

import UtmBuilderClient from '@/features/generation/components/UtmBuilderClient'

export const metadata: Metadata = {
  title: 'UTM Builder - Daily Tools',
  description: 'Build campaign URLs with UTM source, medium, campaign, term, and content parameters'
}

export default function UtmBuilderPage() {
  return <UtmBuilderClient />
}
