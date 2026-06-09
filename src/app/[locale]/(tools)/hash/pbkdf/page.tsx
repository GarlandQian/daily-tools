import type { Metadata } from 'next'

import PBKDFClient from '@/features/hash/components/PBKDFClient'

export const metadata: Metadata = {
  title: 'PBKDF2 - Daily Tools',
  description:
    'Derive PBKDF2 keys locally with PRF, length, iteration, export, and verification controls'
}

export default function PBKDF() {
  return <PBKDFClient />
}
