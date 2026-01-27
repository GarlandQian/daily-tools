import type { Metadata } from 'next'

import XmlClient from '@/features/format/components/XmlClient'

export const metadata: Metadata = {
  title: 'XML Formatter - Daily Tools',
  description: 'Format and minify XML'
}

export default function XmlPage() {
  return <XmlClient />
}
