import type { Metadata } from 'next'

import CsvClient from '@/features/format/components/CsvClient'

export const metadata: Metadata = {
  title: 'CSV Converter - Daily Tools',
  description:
    'Parse, clean, profile, search, and convert CSV data to JSON, Markdown tables, TSV, and normalized CSV'
}

export default function CsvPage() {
  return <CsvClient />
}
