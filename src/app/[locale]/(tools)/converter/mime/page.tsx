import type { Metadata } from 'next'

import MimeClient from '@/features/converter/components/MimeClient'

export const metadata: Metadata = {
  title: 'MIME Type Lookup - Daily Tools',
  description:
    'Search MIME types and file extensions, generate HTTP headers, and parse filenames or Content-Type logs in batch'
}

export default function MimePage() {
  return <MimeClient />
}
