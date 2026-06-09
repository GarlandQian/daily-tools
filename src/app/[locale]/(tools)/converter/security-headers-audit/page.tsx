import type { Metadata } from 'next'

import SecurityHeadersAuditClient from '@/features/converter/components/SecurityHeadersAuditClient'

export const metadata: Metadata = {
  title: 'Security Headers Auditor - Daily Tools',
  description:
    'Paste HTTP response headers to score security posture, detect risky values, and jump to focused header builders'
}

export default function SecurityHeadersAuditPage() {
  return <SecurityHeadersAuditClient />
}
