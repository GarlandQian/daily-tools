import type { Metadata } from 'next'

import HMACMD5Client from '@/features/hash/components/HMACMD5Client'

export const metadata: Metadata = {
  title: 'HMAC-MD5 - Daily Tools',
  description: 'Generate, batch export, and verify HMAC-MD5 signatures locally'
}

export default function HAMCMD5() {
  return <HMACMD5Client />
}
