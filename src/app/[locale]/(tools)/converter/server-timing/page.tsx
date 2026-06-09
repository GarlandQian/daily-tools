import type { Metadata } from 'next'

import ServerTimingClient from '@/features/converter/components/ServerTimingClient'

export const metadata: Metadata = {
  title: 'Server-Timing Builder - Daily Tools',
  description: 'Build, parse, audit, and export Server-Timing and Timing-Allow-Origin headers'
}

export default function ServerTimingPage() {
  return <ServerTimingClient />
}
