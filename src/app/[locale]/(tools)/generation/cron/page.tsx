import { Metadata } from 'next'

import CronClient from '@/features/generation/components/CronClient'

export const metadata: Metadata = {
  title: 'Cron Generator - Daily Tools',
  description: 'Generate cron expressions with visual builder'
}

export default function CronPage() {
  return <CronClient />
}
