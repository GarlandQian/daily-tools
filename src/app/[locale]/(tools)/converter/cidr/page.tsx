import type { Metadata } from 'next'

import CidrClient from '@/features/converter/components/CidrClient'

export const metadata: Metadata = {
  title: 'CIDR Calculator - Daily Tools',
  description:
    'Calculate IPv4 network ranges, subnet splits, batch membership checks, range-to-CIDR summaries, and exports'
}

export default function CidrPage() {
  return <CidrClient />
}
