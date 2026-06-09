import type { Metadata } from 'next'

import AESClient from '@/features/encryption/components/AESClient'

export const metadata: Metadata = {
  title: 'AES Encrypt & Decrypt - Daily Tools',
  description: 'Encrypt and decrypt AES locally with mode, padding, encoding, and output controls'
}

const AESPage = () => {
  return <AESClient />
}

export default AESPage
