import type { Metadata } from 'next'

import PxRemClient from '@/features/converter/components/PxRemClient'

export const metadata: Metadata = {
  title: 'PX REM Converter - Daily Tools',
  description: 'Convert CSS px, rem, em, and percentage values with spacing scale output'
}

export default function PxRemPage() {
  return <PxRemClient />
}
