import type { Metadata } from 'next'

import RetiresClient from '@/features/social/components/RetiresClient'

export const metadata: Metadata = {
  title: 'Retirement Date Calculator - Daily Tools',
  description: 'Estimate retirement date and delayed retirement months from birthday and gender'
}

export default function Retires() {
  return <RetiresClient />
}
