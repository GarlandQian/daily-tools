import { Metadata } from 'next'

import DiffClient from '@/features/format/components/DiffClient'

export const metadata: Metadata = {
  title: 'Text Diff - Daily Tools',
  description: 'Compare text differences with character-level highlighting'
}

export default function DiffPage() {
  return <DiffClient />
}
