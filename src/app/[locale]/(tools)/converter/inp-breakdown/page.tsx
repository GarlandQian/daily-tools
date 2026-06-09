import type { Metadata } from 'next'

import InpBreakdownClient from '@/features/converter/components/InpBreakdownClient'

export const metadata: Metadata = {
  title: 'INP Breakdown Analyzer - Daily Tools',
  description:
    'Break down Interaction to Next Paint into input delay, processing duration, and presentation delay with local audit exports'
}

export default function InpBreakdownPage() {
  return <InpBreakdownClient />
}
