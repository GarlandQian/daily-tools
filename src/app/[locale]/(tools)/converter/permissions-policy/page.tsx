import type { Metadata } from 'next'

import PermissionsPolicyClient from '@/features/converter/components/PermissionsPolicyClient'

export const metadata: Metadata = {
  title: 'Permissions-Policy Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Permissions-Policy headers for browser features, embedded frames, and reporting workflows'
}

export default function PermissionsPolicyPage() {
  return <PermissionsPolicyClient />
}
