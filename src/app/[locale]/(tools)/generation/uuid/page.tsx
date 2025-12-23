import { Metadata } from 'next'

import UuidClient from '@/features/generation/components/UuidClient'

export const metadata: Metadata = {
  title: 'UUID Generator - Daily Tools',
  description: 'Generate UUID v1, v3, v4, v5'
}

export default function UuidPage() {
  return <UuidClient />
}
