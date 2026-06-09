import { Metadata } from 'next'

import ShadowClient from '@/features/generation/components/ShadowClient'

export const metadata: Metadata = {
  title: 'CSS Box Shadow Generator - Daily Tools',
  description: 'Generate layered CSS box shadows with visual controls and code snippets'
}

export default function ShadowPage() {
  return <ShadowClient />
}
