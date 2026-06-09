import { Metadata } from 'next'

import BaseClient from '@/features/converter/components/BaseClient'

export const metadata: Metadata = {
  title: 'Number Base Converter - Daily Tools',
  description:
    "Convert precise BigInt values across binary, octal, decimal, hexadecimal, custom bases, batches, grouped digits, and two's complement"
}

export default function BasePage() {
  return <BaseClient />
}
