import type { Metadata } from 'next'

import DESClient from '@/features/encryption/components/DESClient'

export const metadata: Metadata = {
  title: 'DES Encrypt & Decrypt - Daily Tools',
  description:
    'Inspect legacy DES encryption locally with validation, warnings, and copy-ready output'
}

const DESPage = () => {
  return <DESClient />
}

export default DESPage
