import type { Metadata } from 'next'

import KeyCodeClient from '@/features/social/components/KeyCodeClient'

export const metadata: Metadata = {
  title: 'Keyboard Event Inspector - Daily Tools',
  description:
    'Inspect keyboard events, shortcuts, history, JSON payloads, and JavaScript listener snippets'
}

export default function KeyCodePage() {
  return <KeyCodeClient />
}
