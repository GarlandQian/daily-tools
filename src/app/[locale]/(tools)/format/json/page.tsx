import { Metadata } from 'next'

import JsonClient from '@/features/format/components/JsonClient'

export const metadata: Metadata = {
  title: 'JSON Formatter - Daily Tools',
  description: 'Format, minify, and validate JSON data'
}

export default function JsonPage() {
  return <JsonClient />
}
