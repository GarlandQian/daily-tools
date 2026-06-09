import type { Metadata } from 'next'

import UnitClient from '@/features/converter/components/UnitClient'

export const metadata: Metadata = {
  title: 'Unit Converter - Daily Tools',
  description: 'Convert common units with presets, precision controls, and all-unit result tables'
}

export default function UnitPage() {
  return <UnitClient />
}
