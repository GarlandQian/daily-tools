import { Metadata } from 'next'

import LoremClient from '@/features/generation/components/LoremClient'

export const metadata: Metadata = {
  title: 'Lorem Ipsum Generator - Daily Tools',
  description: 'Generate placeholder text for your designs'
}

export default function LoremPage() {
  return <LoremClient />
}
