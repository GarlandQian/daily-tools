import type { Metadata } from 'next'

import RobotsClient from '@/features/generation/components/RobotsClient'

export const metadata: Metadata = {
  title: 'Robots and Sitemap Generator - Daily Tools',
  description: 'Generate robots.txt rules and sitemap.xml entries for deployable websites'
}

export default function RobotsPage() {
  return <RobotsClient />
}
