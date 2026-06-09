import type { Metadata } from 'next'

import VercelConfigClient from '@/features/generation/components/VercelConfigClient'

export const metadata: Metadata = {
  title: 'Vercel Config Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export vercel.json files for builds, functions, rewrites, redirects, headers, cron jobs, images, and deployment guardrails'
}

export default function VercelPage() {
  return <VercelConfigClient />
}
