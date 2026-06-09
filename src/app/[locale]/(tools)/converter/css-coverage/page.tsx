import type { Metadata } from 'next'

import CssCoverageClient from '@/features/converter/components/CssCoverageClient'

export const metadata: Metadata = {
  title: 'CSS Coverage Auditor - Daily Tools',
  description:
    'Audit unused CSS, critical CSS extraction, stylesheet scope, duplicate selectors, Chrome Coverage, Lighthouse JSON, and CSV exports'
}

export default function CssCoveragePage() {
  return <CssCoverageClient />
}
