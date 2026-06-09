import type { Metadata } from 'next'

import RateLimitClient from '@/features/converter/components/RateLimitClient'

export const metadata: Metadata = {
  title: 'Rate Limit Headers - Daily Tools',
  description:
    'Build, parse, audit, and export RateLimit, RateLimit-Policy, Retry-After, and legacy X-RateLimit headers for API throttling'
}

export default function RateLimitPage() {
  return <RateLimitClient />
}
