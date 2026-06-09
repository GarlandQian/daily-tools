import type { Metadata } from 'next'

import SpeculationRulesClient from '@/features/converter/components/SpeculationRulesClient'

export const metadata: Metadata = {
  title: 'Speculation Rules Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Speculation Rules JSON for prefetch and prerender flows'
}

export default function SpeculationRulesPage() {
  return <SpeculationRulesClient />
}
