import type { Metadata } from 'next'

import RenderBlockingClient from '@/features/converter/components/RenderBlockingClient'

export const metadata: Metadata = {
  title: 'Render Blocking Auditor - Daily Tools',
  description:
    'Audit render-blocking CSS, scripts, fonts, and third-party resources with local parsers, fix snippets, and CSV exports'
}

export default function RenderBlockingPage() {
  return <RenderBlockingClient />
}
