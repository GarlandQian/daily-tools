import type { Metadata } from 'next'

import JsonToTsClient from '@/features/format/components/JsonToTsClient'

export const metadata: Metadata = {
  title: 'JSON to TypeScript - Daily Tools',
  description:
    'Infer, inspect, and export TypeScript interfaces or type aliases from JSON objects and arrays'
}

export default function JsonToTsPage() {
  return <JsonToTsClient />
}
