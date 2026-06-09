import type { Metadata } from 'next'

import NginxClient from '@/features/generation/components/NginxClient'

export const metadata: Metadata = {
  title: 'Nginx Config Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export Nginx server blocks for static sites, reverse proxies, TLS, caching, compression, and security headers'
}

export default function NginxPage() {
  return <NginxClient />
}
