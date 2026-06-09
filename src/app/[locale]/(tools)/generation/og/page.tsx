import type { Metadata } from 'next'

import OgMetaClient from '@/features/generation/components/OgMetaClient'

export const metadata: Metadata = {
  title: 'Open Graph Meta Builder - Daily Tools',
  description: 'Generate Open Graph, Twitter Card, JSON-LD, and Next metadata with share previews'
}

export default function OgPage() {
  return <OgMetaClient />
}
