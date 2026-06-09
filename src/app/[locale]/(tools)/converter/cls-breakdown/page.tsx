import type { Metadata } from 'next'

import ClsBreakdownClient from '@/features/converter/components/ClsBreakdownClient'

export const metadata: Metadata = {
  title: 'CLS Breakdown Analyzer - Daily Tools',
  description:
    'Break down Cumulative Layout Shift by target, shift value, load state, reservation, and source attribution with local audit exports'
}

export default function ClsBreakdownPage() {
  return <ClsBreakdownClient />
}
