import type { Metadata } from 'next'

import EnvBuilderClient from '@/features/generation/components/EnvBuilderClient'

export const metadata: Metadata = {
  title: '.env Builder - Daily Tools',
  description:
    'Parse environment variables and generate .env files, Zod schemas, ProcessEnv declarations, Docker snippets, and audit summaries'
}

export default function EnvPage() {
  return <EnvBuilderClient />
}
