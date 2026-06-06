import type { Metadata } from 'next'

import CidrClient from '@/features/converter/components/CidrClient'

export const metadata: Metadata = {
  title: 'CIDR Calculator - Daily Tools',
  description: 'Calculate IPv4 network ranges, masks, usable hosts, and address membership'
}

export default function CidrPage() {
  return <CidrClient />
}
