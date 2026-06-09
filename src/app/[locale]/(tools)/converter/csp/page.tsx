import type { Metadata } from 'next'

import CspClient from '@/features/converter/components/CspClient'

export const metadata: Metadata = {
  title: 'CSP Builder - Daily Tools',
  description:
    'Build, audit, and export Content-Security-Policy headers with presets, directive references, and violation report parsing'
}

export default function CspPage() {
  return <CspClient />
}
