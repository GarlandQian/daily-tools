import type { Metadata } from 'next'

import MarkdownClient from '@/features/preview/components/MarkdownClient'

export const metadata: Metadata = {
  title: 'Markdown Preview - Daily Tools',
  description:
    'Preview Markdown, inspect document stats, outline headings, and export reusable content'
}

export default function MarkdownPage() {
  return <MarkdownClient />
}
