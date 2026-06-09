import type { Metadata } from 'next'

import CacheControlClient from '@/features/converter/components/CacheControlClient'

export const metadata: Metadata = {
  title: 'Cache-Control Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Cache-Control headers for APIs, static assets, HTML, CDNs, and private user responses'
}

export default function CacheControlPage() {
  return <CacheControlClient />
}
