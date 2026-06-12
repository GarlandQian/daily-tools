'use client'

import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface InputCapNoticeProps {
  className?: string
  limit: number
  visible: boolean
}

export function InputCapNotice({ className, limit, visible }: InputCapNoticeProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <p
      className={cn(
        'rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]',
        className
      )}
    >
      {t('public.input_capped_notice', { limit: limit.toLocaleString() })}
    </p>
  )
}
