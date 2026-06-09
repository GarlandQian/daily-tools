import type { Metadata } from 'next'

import WebVitalsClient from '@/features/converter/components/WebVitalsClient'

export const metadata: Metadata = {
  title: 'Web Vitals Inspector - Daily Tools',
  description:
    'Parse, audit, and export Core Web Vitals field attribution for LCP, INP, and CLS diagnostics'
}

export default function WebVitalsPage() {
  return <WebVitalsClient />
}
