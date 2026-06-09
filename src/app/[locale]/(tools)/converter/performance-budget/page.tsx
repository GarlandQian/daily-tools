import type { Metadata } from 'next'

import PerformanceBudgetClient from '@/features/converter/components/PerformanceBudgetClient'

export const metadata: Metadata = {
  title: 'Performance Budget Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Core Web Vitals, Lighthouse, and resource performance budgets'
}

export default function PerformanceBudgetPage() {
  return <PerformanceBudgetClient />
}
