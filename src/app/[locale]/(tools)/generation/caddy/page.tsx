import type { Metadata } from 'next'

import CaddyClient from '@/features/generation/components/CaddyClient'

export const metadata: Metadata = {
  title: 'Caddy Config Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export Caddyfiles for automatic HTTPS, reverse proxies, static sites, security headers, compression, and Docker deployment'
}

export default function CaddyPage() {
  return <CaddyClient />
}
