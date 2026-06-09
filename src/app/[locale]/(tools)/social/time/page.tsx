import type { Metadata } from 'next'

import TimeClient from '@/features/social/components/TimeClient'

export const metadata: Metadata = {
  title: 'World Time - Daily Tools',
  description: 'Compare local time, UTC, Unix time, and world time zones'
}

export default function Time() {
  return <TimeClient />
}
