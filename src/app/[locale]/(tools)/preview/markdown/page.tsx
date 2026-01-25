import type { Metadata } from 'next'

import MarkdownClient from '@/features/preview/components/MarkdownClient'

export const metadata: Metadata = {
  title: 'Markdown Preview - Daily Tools',
  description: 'Real-time Markdown editor and previewer'
}

export default function MarkdownPage() {
  return <MarkdownClient />
}
