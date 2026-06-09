import type { Metadata } from 'next'

import CaseClient from '@/features/format/components/CaseClient'

export const metadata: Metadata = {
  title: 'Case Converter - Daily Tools',
  description:
    'Convert names in batch across camelCase, snake_case, ENV keys, slugs, prefixes, suffixes, separators, and export formats.'
}

export default function CasePage() {
  return <CaseClient />
}
