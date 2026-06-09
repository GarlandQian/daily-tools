import type { Metadata } from 'next'

import TripleDESClient from '@/features/encryption/components/TripleDESClient'

export const metadata: Metadata = {
  title: 'Triple DES Encrypt & Decrypt - Daily Tools',
  description: 'Inspect Triple DES payloads locally with key and IV validation'
}

const TripleDESPage = () => {
  return <TripleDESClient />
}

export default TripleDESPage
