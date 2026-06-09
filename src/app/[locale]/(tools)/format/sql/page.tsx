import { Metadata } from 'next'

import SqlClient from '@/features/format/components/SqlClient'

export const metadata: Metadata = {
  title: 'SQL Formatter - Daily Tools',
  description:
    'Format SQL across common dialects, tune indentation, scan tables and parameters, copy or download local output.'
}

export default function SqlPage() {
  return <SqlClient />
}
