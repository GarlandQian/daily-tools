import { Metadata } from 'next'

import ColorClient from '@/features/converter/components/ColorClient'

export const metadata: Metadata = {
  title: 'Color Converter - Daily Tools',
  description: 'Convert colors between HEX, RGB, and HSL formats'
}

export default function ColorPage() {
  return <ColorClient />
}
