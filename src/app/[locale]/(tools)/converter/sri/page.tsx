import type { Metadata } from 'next'

import SriClient from '@/features/converter/components/SriClient'

export const metadata: Metadata = {
  title: 'SRI Generator - Daily Tools',
  description:
    'Generate, parse, audit, and export Subresource Integrity hashes for scripts, styles, preloads, and CSP hash workflows'
}

export default function SriPage() {
  return <SriClient />
}
