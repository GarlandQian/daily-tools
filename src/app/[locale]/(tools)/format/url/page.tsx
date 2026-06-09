import type { Metadata } from 'next'

import UrlClient from '@/features/format/components/UrlClient'

export const metadata: Metadata = {
  title: 'URL Parser - Daily Tools',
  description:
    'Parse, edit, diagnose, batch-check, export, and rebuild URLs with UTM, query, host, and decoded previews.'
}

export default function UrlPage() {
  return <UrlClient />
}
