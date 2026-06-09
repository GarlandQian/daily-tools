import type { Metadata } from 'next'

import PensionClient from '@/features/social/components/PensionClient'

export const metadata: Metadata = {
  title: 'Pension Estimate - Daily Tools',
  description: 'Estimate basic pension and personal account pension with adjustable assumptions'
}

export default function PensionPage() {
  return <PensionClient />
}
