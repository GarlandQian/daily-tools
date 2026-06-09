import type { Metadata } from 'next'

import FileHashClient from '@/features/hash/components/FileHashClient'

export const metadata: Metadata = {
  title: 'File Hash - Daily Tools',
  description:
    'Calculate, search, copy, and export MD5, SHA1, SHA256, and SHA512 checksums for local files'
}

export default function FileHashPage() {
  return <FileHashClient />
}
