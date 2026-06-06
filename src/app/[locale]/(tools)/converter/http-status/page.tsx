import type { Metadata } from 'next'

import HttpStatusClient from '@/features/converter/components/HttpStatusClient'

export const metadata: Metadata = {
  title: 'HTTP Status Lookup - Daily Tools',
  description: 'Search HTTP status codes, response classes, and practical API guidance'
}

export default function HttpStatusPage() {
  return <HttpStatusClient />
}
