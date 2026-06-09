import type { Metadata } from 'next'

import TokenClient from '@/features/generation/components/TokenClient'

export const metadata: Metadata = {
  title: 'Token Generator - Daily Tools',
  description:
    'Generate secure random tokens with presets, expiration metadata, and copy-ready snippets'
}

export default function TokenPage() {
  return <TokenClient />
}
