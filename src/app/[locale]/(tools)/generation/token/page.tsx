import type { Metadata } from 'next'

import TokenClient from '@/features/generation/components/TokenClient'

export const metadata: Metadata = {
  title: 'Token Generator - Daily Tools',
  description: 'Generate secure random tokens in hex, Base64, Base64URL, and alphanumeric formats'
}

export default function TokenPage() {
  return <TokenClient />
}
