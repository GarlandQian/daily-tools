import type { Metadata } from 'next'

import MarkdownTocClient from '@/features/format/components/MarkdownTocClient'

export const metadata: Metadata = {
  title: 'Markdown TOC Generator - Daily Tools',
  description:
    'Extract Markdown headings, diagnose outline levels, and generate downloadable GitHub-compatible tables of contents'
}

export default function MarkdownTocPage() {
  return <MarkdownTocClient />
}
