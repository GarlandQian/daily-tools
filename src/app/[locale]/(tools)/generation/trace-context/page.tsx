import type { Metadata } from 'next'

import TraceContextClient from '@/features/generation/components/TraceContextClient'

export const metadata: Metadata = {
  title: 'Trace Context Generator - Daily Tools',
  description: 'Generate, parse, audit, and export W3C traceparent, tracestate, and baggage headers'
}

export default function TraceContextPage() {
  return <TraceContextClient />
}
