import { Metadata } from 'next'

import PasswordClient from '@/features/generation/components/PasswordClient'

export const metadata: Metadata = {
  title: 'Password Generator - Daily Tools',
  description: 'Generate secure passwords with customizable options'
}

export default function PasswordPage() {
  return <PasswordClient />
}
