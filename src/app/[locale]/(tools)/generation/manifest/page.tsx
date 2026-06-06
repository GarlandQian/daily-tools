import type { Metadata } from 'next'

import ManifestClient from '@/features/generation/components/ManifestClient'

export const metadata: Metadata = {
  title: 'PWA Manifest Builder - Daily Tools',
  description: 'Generate web app manifests, theme meta tags, and install metadata'
}

export default function ManifestPage() {
  return <ManifestClient />
}
