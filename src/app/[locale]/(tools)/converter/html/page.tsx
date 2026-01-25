import type { Metadata } from 'next'

import HtmlClient from '@/features/converter/components/HtmlClient'

export const metadata: Metadata = {
  title: 'HTML Entity Converter - Daily Tools',
  description: 'Encode and decode HTML entities'
}

export default function HtmlPage() {
  return <HtmlClient />
}
