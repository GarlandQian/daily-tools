import type { Metadata } from 'next'

import MainThreadClient from '@/features/converter/components/MainThreadClient'

export const metadata: Metadata = {
  title: 'Main Thread Inspector - Daily Tools',
  description:
    'Parse, audit, and export long task and Long Animation Frame diagnostics for faster interactions'
}

export default function MainThreadPage() {
  return <MainThreadClient />
}
