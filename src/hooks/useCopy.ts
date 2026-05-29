'use client'

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/components/ui/toast'

/**
 * Hook for copying text to clipboard with success feedback
 */
export const useCopy = () => {
  const toast = useToast()
  const { t } = useTranslation()

  const copy = useCallback(
    async (text: string | number) => {
      try {
        await navigator.clipboard.writeText(String(text))
        toast.success(t('app.social.retires.copy_success'))
        return true
      } catch {
        toast.error(t('public.error'))
        return false
      }
    },
    [toast, t]
  )

  return { copy }
}
