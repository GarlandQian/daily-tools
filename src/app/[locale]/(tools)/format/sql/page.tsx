import { Metadata } from 'next'

import SqlClient from '@/features/format/components/SqlClient'

export const metadata: Metadata = {
  title: 'SQL Formatter - Daily Tools',
  description: 'Format and beautify SQL statements'
}

export default function SqlPage() {
  return <SqlClient />
}
