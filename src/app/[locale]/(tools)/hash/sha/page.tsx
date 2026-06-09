import type { Metadata } from 'next'

import SHAForm from '@/features/hash/components/SHAForm'

export const metadata: Metadata = {
  title: 'SHA Hash - Daily Tools',
  description: 'Generate SHA1, SHA224, SHA256, SHA3, SHA384, and SHA512 digests locally'
}

export default function SHAPage() {
  return <SHAForm />
}
