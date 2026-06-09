import type { Metadata } from 'next'

import LcpBreakdownClient from '@/features/converter/components/LcpBreakdownClient'

export const metadata: Metadata = {
  title: 'LCP Breakdown Analyzer - Daily Tools',
  description:
    'Break down Largest Contentful Paint into TTFB, resource delay, resource duration, and render delay with local audit exports'
}

export default function LcpBreakdownPage() {
  return <LcpBreakdownClient />
}
