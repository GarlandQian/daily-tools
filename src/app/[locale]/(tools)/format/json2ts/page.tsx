import type { Metadata } from 'next'

import JsonToTsClient from '@/features/format/components/JsonToTsClient'

export const metadata: Metadata = {
  title: 'JSON to TypeScript - Daily Tools',
  description: 'Infer TypeScript interfaces from JSON objects and arrays'
}

export default function JsonToTsPage() {
  return <JsonToTsClient />
}
