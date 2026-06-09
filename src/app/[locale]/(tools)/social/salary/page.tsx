import type { Metadata } from 'next'

import SalaryClient from '@/features/social/components/SalaryClient'

export const metadata: Metadata = {
  title: 'Net Salary Calculator - Daily Tools',
  description:
    'Estimate net salary, social contributions, housing fund, income tax, and employer cost'
}

export default function SalaryPage() {
  return <SalaryClient />
}
