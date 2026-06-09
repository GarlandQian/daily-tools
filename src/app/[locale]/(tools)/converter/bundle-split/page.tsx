import type { Metadata } from 'next'

import BundleSplitClient from '@/features/converter/components/BundleSplitClient'

export const metadata: Metadata = {
  title: 'Bundle Split Planner - Daily Tools',
  description:
    'Parse build output, audit first-load JavaScript, and plan route-level bundle split actions'
}

export default function BundleSplitPage() {
  return <BundleSplitClient />
}
