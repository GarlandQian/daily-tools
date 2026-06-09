import type { Metadata } from 'next'

import CanonicalUrlClient from '@/features/converter/components/CanonicalUrlClient'

export const metadata: Metadata = {
  title: 'Canonical URL and Hreflang Builder - Daily Tools',
  description:
    'Build, parse, audit, and export canonical URL, hreflang alternates, HTTP Link headers, Next.js metadata, and sitemap snippets'
}

export default function CanonicalUrlPage() {
  return <CanonicalUrlClient />
}
