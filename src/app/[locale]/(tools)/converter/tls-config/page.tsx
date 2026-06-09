import type { Metadata } from 'next'

import TlsConfigClient from '@/features/converter/components/TlsConfigClient'

export const metadata: Metadata = {
  title: 'TLS Config Auditor - Daily Tools',
  description:
    'Build, audit, and export TLS protocol, cipher suite, curve, ALPN, OCSP, HSTS, and server configuration profiles'
}

export default function TlsConfigPage() {
  return <TlsConfigClient />
}
