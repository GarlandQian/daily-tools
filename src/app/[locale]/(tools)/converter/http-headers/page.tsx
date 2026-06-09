import type { Metadata } from 'next'

import HttpHeadersClient from '@/features/converter/components/HttpHeadersClient'

export const metadata: Metadata = {
  title: 'HTTP Headers Builder - Daily Tools',
  description:
    'Build, audit, and copy HTTP response headers for security, cache, CORS, downloads, and compression'
}

export default function HttpHeadersPage() {
  return <HttpHeadersClient />
}
