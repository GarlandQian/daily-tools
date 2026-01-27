import type { Metadata } from 'next'

import UnitClient from '@/features/converter/components/UnitClient'

export const metadata: Metadata = {
  title: 'Unit Converter - Daily Tools',
  description: 'Convert between units of length, weight, temperature, and data storage'
}

export default function UnitPage() {
  return <UnitClient />
}
