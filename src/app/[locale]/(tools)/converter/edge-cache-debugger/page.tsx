import type { Metadata } from 'next'

import EdgeCacheDebuggerClient from '@/features/converter/components/EdgeCacheDebuggerClient'

export const metadata: Metadata = {
  title: 'Edge Cache Debugger - Daily Tools',
  description: 'Diagnose CDN cache hits, misses, Vary keys, Age, cookies, and edge response headers'
}

export default function EdgeCacheDebuggerPage() {
  return <EdgeCacheDebuggerClient />
}
