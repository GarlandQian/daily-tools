import type { Metadata } from 'next'

import UrlClient from '@/features/format/components/UrlClient'

export const metadata: Metadata = {
  title: 'URL Parser - Daily Tools',
  description: 'Parse, edit and build URLs easily'
}

export default function UrlPage() {
  return <UrlClient />
}
