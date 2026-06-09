import type { Metadata } from 'next'

import DockerComposeClient from '@/features/generation/components/DockerComposeClient'

export const metadata: Metadata = {
  title: 'Docker Compose Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export Docker Compose stacks with env files, services, healthchecks, networks, volumes, Dockerfiles, and deployment checklists'
}

export default function DockerComposePage() {
  return <DockerComposeClient />
}
