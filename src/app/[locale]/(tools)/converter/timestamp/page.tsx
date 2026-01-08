import { Metadata } from 'next'

import TimestampClient from '@/features/converter/components/TimestampClient'

export const metadata: Metadata = {
  title: 'Timestamp Converter - Daily Tools',
  description: 'Convert between Unix timestamps and dates'
}

export default function TimestampPage() {
  return <TimestampClient />
}
