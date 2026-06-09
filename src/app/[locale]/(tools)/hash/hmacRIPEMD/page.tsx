import type { Metadata } from 'next'

import HMACRIPEMDClient from '@/features/hash/components/HMACRIPEMDClient'

export const metadata: Metadata = {
  title: 'HMAC-RIPEMD - Daily Tools',
  description: 'Generate, batch export, and verify HMAC-RIPEMD160 signatures locally'
}

export default function HAMCRIPEMD() {
  return <HMACRIPEMDClient />
}
