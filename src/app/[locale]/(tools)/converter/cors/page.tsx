import type { Metadata } from 'next'

import CorsClient from '@/features/converter/components/CorsClient'

export const metadata: Metadata = {
  title: 'CORS Builder - Daily Tools',
  description:
    'Build, parse, audit, and export CORS response headers for public APIs, credentialed apps, uploads, preflight requests, and private network access'
}

export default function CorsPage() {
  return <CorsClient />
}
