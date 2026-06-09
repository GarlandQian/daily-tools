import type { Metadata } from 'next'

import XmlClient from '@/features/format/components/XmlClient'

export const metadata: Metadata = {
  title: 'XML Formatter - Daily Tools',
  description:
    'Format, minify, validate, inspect tags and attributes, preview node paths, and download local XML output.'
}

export default function XmlPage() {
  return <XmlClient />
}
