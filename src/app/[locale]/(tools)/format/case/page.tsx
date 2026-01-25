import type { Metadata } from 'next'

import CaseClient from '@/features/format/components/CaseClient'

export const metadata: Metadata = {
  title: 'Case Converter - Daily Tools',
  description: 'Convert text case (camelCase, snake_case, etc.)'
}

export default function CasePage() {
  return <CaseClient />
}
