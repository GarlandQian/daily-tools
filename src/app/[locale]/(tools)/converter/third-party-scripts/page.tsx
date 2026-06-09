import type { Metadata } from 'next'

import ThirdPartyScriptsClient from '@/features/converter/components/ThirdPartyScriptsClient'

export const metadata: Metadata = {
  title: 'Third-Party Script Planner - Daily Tools',
  description:
    'Audit vendor scripts, loading strategies, consent gates, ownership, and main-thread impact'
}

export default function ThirdPartyScriptsPage() {
  return <ThirdPartyScriptsClient />
}
