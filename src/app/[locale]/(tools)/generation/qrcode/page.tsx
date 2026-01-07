import { Metadata } from 'next'

import QrcodeClient from '@/features/generation/components/QrcodeClient'

export const metadata: Metadata = {
  title: 'QR Code Generator - Daily Tools',
  description: 'Generate QR codes with custom colors and sizes'
}

export default function QrcodePage() {
  return <QrcodeClient />
}
