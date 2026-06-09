import type { Metadata } from 'next'

import SecurityTxtClient from '@/features/generation/components/SecurityTxtClient'

export const metadata: Metadata = {
  title: 'security.txt Generator - Daily Tools',
  description:
    'Build, parse, audit, and export RFC 9116 security.txt files for vulnerability disclosure contacts'
}

export default function SecurityTxtPage() {
  return <SecurityTxtClient />
}
