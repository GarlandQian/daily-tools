import type { Metadata } from 'next'

import DnsRecordsClient from '@/features/converter/components/DnsRecordsClient'

export const metadata: Metadata = {
  title: 'DNS Records Builder - Daily Tools',
  description:
    'Build, parse, audit, and export DNS zone records for websites, email authentication, CDN aliases, and verification tokens'
}

export default function DnsRecordsPage() {
  return <DnsRecordsClient />
}
