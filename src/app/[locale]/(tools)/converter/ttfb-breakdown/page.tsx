import type { Metadata } from 'next'

import TtfbBreakdownClient from '@/features/converter/components/TtfbBreakdownClient'

export const metadata: Metadata = {
  title: 'TTFB Breakdown Analyzer - Daily Tools',
  description:
    'Break down TTFB across DNS, TCP, TLS, edge, origin, cache, redirects, Navigation Timing, Server-Timing, JSON, and CSV exports'
}

export default function TtfbBreakdownPage() {
  return <TtfbBreakdownClient />
}
