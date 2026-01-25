'use client'

import { App } from 'antd'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Hook for copying text to clipboard with success feedback
 */
export const useCopy = () => {
  const { message } = App.useApp()
  const { t } = useTranslation()

  const copy = useCallback(
    async (text: string | number) => {
      try {
        await navigator.clipboard.writeText(String(text))
        message.success(t('app.social.retires.copy_success'))
        return true
      } catch {
        message.error(t('public.error'))
        return false
      }
    },
    [message, t]
  )

  return { copy }
}
