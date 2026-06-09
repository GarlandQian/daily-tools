import type { Metadata } from 'next'

import EtagRevalidationClient from '@/features/converter/components/EtagRevalidationClient'

export const metadata: Metadata = {
  title: 'ETag Revalidation Debugger - Daily Tools',
  description:
    'Debug ETag, Last-Modified, If-None-Match, 304, Vary, and conditional request behavior'
}

export default function EtagRevalidationPage() {
  return <EtagRevalidationClient />
}
