import type { Metadata } from 'next'

import TextStatClient from '@/features/format/components/TextStatClient'

export const metadata: Metadata = {
  title: 'Text Statistics - Daily Tools',
  description: 'Count characters, words, lines, and more'
}

export default function TextStatPage() {
  return <TextStatClient />
}
