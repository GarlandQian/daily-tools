import type { Metadata } from 'next'

import HMACSHAClient from '@/features/hash/components/HMACSHAClient'

export const metadata: Metadata = {
  title: 'HMAC-SHA - Daily Tools',
  description: 'Generate, batch export, and verify HMAC signatures across SHA algorithms locally'
}

export default function HmacSHA() {
  return <HMACSHAClient />
}
