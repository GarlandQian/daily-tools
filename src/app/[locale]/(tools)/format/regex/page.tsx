import { Metadata } from 'next'

import RegexClient from '@/features/format/components/RegexClient'

export const metadata: Metadata = {
  title: 'Regex Tester - Daily Tools',
  description: 'Test regular expressions with real-time matching'
}

export default function RegexPage() {
  return <RegexClient />
}
