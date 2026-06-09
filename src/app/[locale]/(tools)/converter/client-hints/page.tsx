import type { Metadata } from 'next'

import ClientHintsClient from '@/features/converter/components/ClientHintsClient'

export const metadata: Metadata = {
  title: 'Client Hints Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Accept-CH, Critical-CH, Vary, and Permissions-Policy headers'
}

export default function ClientHintsPage() {
  return <ClientHintsClient />
}
