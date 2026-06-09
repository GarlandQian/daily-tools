import type { Metadata } from 'next'

import MD5Form from '@/features/hash/components/MD5Form'

export const metadata: Metadata = {
  title: 'MD5 Hash - Daily Tools',
  description: 'Generate, batch export, and look up MD5 digests locally'
}

export default function MD5Page() {
  return <MD5Form />
}
