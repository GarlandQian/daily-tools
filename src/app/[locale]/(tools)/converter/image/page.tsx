import { Metadata } from 'next'

import ImageBase64Client from '@/features/converter/components/ImageBase64Client'

export const metadata: Metadata = {
  title: 'Image to Base64 - Daily Tools',
  description: 'Convert images to Base64 encoded strings'
}

export default function ImageBase64Page() {
  return <ImageBase64Client />
}
