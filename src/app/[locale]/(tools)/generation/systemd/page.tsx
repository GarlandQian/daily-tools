import type { Metadata } from 'next'

import SystemdClient from '@/features/generation/components/SystemdClient'

export const metadata: Metadata = {
  title: 'systemd Unit Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export systemd service and timer units with restart policies, environment files, hardening flags, and install commands'
}

export default function SystemdPage() {
  return <SystemdClient />
}
