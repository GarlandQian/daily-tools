import type { Metadata } from 'next'

import KubernetesClient from '@/features/generation/components/KubernetesClient'

export const metadata: Metadata = {
  title: 'Kubernetes Manifest Builder - Daily Tools',
  description:
    'Generate, parse, audit, and export Kubernetes manifests for deployments, services, ingress, config maps, secrets, autoscaling, and policies'
}

export default function KubernetesPage() {
  return <KubernetesClient />
}
