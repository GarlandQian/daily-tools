import { Metadata } from 'next'

import JwtClient from '@/features/encryption/components/JwtClient'

export const metadata: Metadata = {
  title: 'JWT Decoder - Daily Tools',
  description: 'Decode and inspect JWT tokens'
}

export default function JwtPage() {
  return <JwtClient />
}
