import type { Metadata } from 'next'

import CompressionHeadersClient from '@/features/converter/components/CompressionHeadersClient'

export const metadata: Metadata = {
  title: 'Compression Headers Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Accept-Encoding, Content-Encoding, and Vary compression headers'
}

export default function CompressionHeadersPage() {
  return <CompressionHeadersClient />
}
