import { Metadata } from 'next'

import JsonClient from '@/features/format/components/JsonClient'

export const metadata: Metadata = {
  title: 'JSON Formatter - Daily Tools',
  description:
    'Format, minify, validate, sort keys, inspect structure, extract JSON paths, and download local JSON output.'
}

export default function JsonPage() {
  return <JsonClient />
}
