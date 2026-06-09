import type { Metadata } from 'next'

import ReferrerPolicyClient from '@/features/converter/components/ReferrerPolicyClient'

export const metadata: Metadata = {
  title: 'Referrer-Policy Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Referrer-Policy headers, meta tags, and referrerpolicy attributes'
}

export default function ReferrerPolicyPage() {
  return <ReferrerPolicyClient />
}
