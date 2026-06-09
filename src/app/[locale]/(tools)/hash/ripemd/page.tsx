import type { Metadata } from 'next'

import RIPEMDClient from '@/features/hash/components/RIPEMDClient'

export const metadata: Metadata = {
  title: 'RIPEMD Hash - Daily Tools',
  description: 'Generate, batch export, and look up RIPEMD-160 digests locally'
}

export default function RIPEMD() {
  return <RIPEMDClient />
}
