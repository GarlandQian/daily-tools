import { Metadata } from 'next'

import BaseClient from '@/features/converter/components/BaseClient'

export const metadata: Metadata = {
  title: 'Number Base Converter - Daily Tools',
  description: 'Convert numbers between Binary, Octal, Decimal, and Hexadecimal'
}

export default function BasePage() {
  return <BaseClient />
}
