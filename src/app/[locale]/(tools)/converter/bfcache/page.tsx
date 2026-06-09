import type { Metadata } from 'next'

import BfcacheAuditClient from '@/features/converter/components/BfcacheAuditClient'

export const metadata: Metadata = {
  title: 'BFCache Eligibility Auditor - Daily Tools',
  description:
    'Parse, audit, and export BFCache eligibility diagnostics, blockers, probes, headers, JSON, and CSV reports'
}

export default function BfcachePage() {
  return <BfcacheAuditClient />
}
