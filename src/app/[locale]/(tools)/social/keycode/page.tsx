import type { Metadata } from 'next'

import KeyCodeClient from '@/features/social/components/KeyCodeClient'

export const metadata: Metadata = {
  title: 'KeyCode Info - Daily Tools',
  description: 'View keyboard event codes and key values'
}

export default function KeyCodePage() {
  return <KeyCodeClient />
}
