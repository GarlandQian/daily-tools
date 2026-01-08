import { Metadata } from 'next'

import ShadowClient from '@/features/generation/components/ShadowClient'

export const metadata: Metadata = {
  title: 'CSS Box Shadow Generator - Daily Tools',
  description: 'Generate CSS box-shadow with visual controls'
}

export default function ShadowPage() {
  return <ShadowClient />
}
