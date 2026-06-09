import type { Metadata } from 'next'

import RedirectRulesClient from '@/features/converter/components/RedirectRulesClient'

export const metadata: Metadata = {
  title: 'Redirect Rules Builder - Daily Tools',
  description:
    'Build, parse, audit, and export redirect rules for domain moves, HTTPS migration, slug cleanup, locale routing, and campaign launches'
}

export default function RedirectRulesPage() {
  return <RedirectRulesClient />
}
