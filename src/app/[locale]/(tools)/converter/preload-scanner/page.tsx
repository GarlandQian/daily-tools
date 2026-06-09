import type { Metadata } from 'next'

import PreloadScannerClient from '@/features/converter/components/PreloadScannerClient'

export const metadata: Metadata = {
  title: 'Preload Scanner - Daily Tools',
  description:
    'Scan HTML, Link headers, HAR rows, and resource reports for preload discovery, LCP timing, hint budget, JSON, and CSV exports'
}

export default function PreloadScannerPage() {
  return <PreloadScannerClient />
}
