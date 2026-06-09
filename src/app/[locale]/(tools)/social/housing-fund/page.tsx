import type { Metadata } from 'next'

import HousingFundClient from '@/features/social/components/HousingFundClient'

export const metadata: Metadata = {
  title: 'Housing Fund Calculator - Daily Tools',
  description: 'Calculate monthly housing fund deposits and projected balance'
}

export default function HousingFundPage() {
  return <HousingFundClient />
}
