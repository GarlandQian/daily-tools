import type { Metadata } from 'next'

import CookieClient from '@/features/converter/components/CookieClient'

export const metadata: Metadata = {
  title: 'Cookie Builder - Daily Tools',
  description:
    'Build, parse, audit, and export Set-Cookie headers for sessions, auth, CSRF, preferences, and deletion flows'
}

export default function CookiePage() {
  return <CookieClient />
}
