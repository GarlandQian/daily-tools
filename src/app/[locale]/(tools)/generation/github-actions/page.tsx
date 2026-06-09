import type { Metadata } from 'next'

import GitHubActionsClient from '@/features/generation/components/GitHubActionsClient'

export const metadata: Metadata = {
  title: 'GitHub Actions Generator - Daily Tools',
  description:
    'Generate, parse, audit, and export GitHub Actions workflows with matrix builds, cache, permissions, schedules, secrets, and deploy snippets'
}

export default function GitHubActionsPage() {
  return <GitHubActionsClient />
}
