import type { Metadata } from 'next'

import YamlClient from '@/features/format/components/YamlClient'

export const metadata: Metadata = {
  title: 'YAML Formatter - Daily Tools',
  description: 'Format, minify, validate, analyze, download, and convert YAML and JSON locally'
}

export default function YamlPage() {
  return <YamlClient />
}
