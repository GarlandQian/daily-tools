import type { Metadata } from 'next'

import YamlClient from '@/features/format/components/YamlClient'

export const metadata: Metadata = {
  title: 'YAML Formatter - Daily Tools',
  description: 'Format, minify, validate, and convert YAML and JSON'
}

export default function YamlPage() {
  return <YamlClient />
}
