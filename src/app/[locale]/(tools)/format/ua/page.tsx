import type { Metadata } from 'next'

import UaClient from '@/features/format/components/UaClient'

export const metadata: Metadata = {
  title: 'User Agent Parser - Daily Tools',
  description: 'Parse User Agent strings to get browser, OS, and device info'
}

export default function UaPage() {
  return <UaClient />
}
