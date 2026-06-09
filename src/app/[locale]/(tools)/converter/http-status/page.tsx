import type { Metadata } from 'next'

import HttpStatusClient from '@/features/converter/components/HttpStatusClient'

export const metadata: Metadata = {
  title: 'HTTP Status Lookup - Daily Tools',
  description:
    'Search HTTP status codes, compare API responses, parse log batches, and copy JSON, curl, Next.js, or Express examples'
}

export default function HttpStatusPage() {
  return <HttpStatusClient />
}
