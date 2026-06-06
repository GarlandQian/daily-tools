import type { Metadata } from 'next'

import EnvBuilderClient from '@/features/generation/components/EnvBuilderClient'

export const metadata: Metadata = {
  title: '.env Builder - Daily Tools',
  description:
    'Parse environment variables and generate .env.example, Zod schema, and TypeScript types'
}

export default function EnvPage() {
  return <EnvBuilderClient />
}
