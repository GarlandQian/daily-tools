import type { Metadata } from 'next'

import NetworkWaterfallClient from '@/features/converter/components/NetworkWaterfallClient'

export const metadata: Metadata = {
  title: 'Network Waterfall Inspector - Daily Tools',
  description:
    'Parse, audit, and export HAR, Lighthouse, JSON, and text network waterfall timing plans'
}

export default function NetworkWaterfallPage() {
  return <NetworkWaterfallClient />
}
