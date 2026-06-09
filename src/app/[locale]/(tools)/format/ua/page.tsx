import type { Metadata } from 'next'

import UaClient from '@/features/format/components/UaClient'

export const metadata: Metadata = {
  title: 'User Agent Parser - Daily Tools',
  description:
    'Parse, diagnose, batch compare, and export User Agent strings with browser, OS, device, and client-signal details'
}

export default function UaPage() {
  return <UaClient />
}
