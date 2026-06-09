import type { Metadata } from 'next'

import RobotsMetaClient from '@/features/converter/components/RobotsMetaClient'

export const metadata: Metadata = {
  title: 'Robots Meta and X-Robots-Tag Builder - Daily Tools',
  description:
    'Build, parse, audit, and export robots meta tags, X-Robots-Tag headers, Next.js metadata, and server snippets'
}

export default function RobotsMetaPage() {
  return <RobotsMetaClient />
}
