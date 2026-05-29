import { DecryptionHistory } from '@prisma/client'
import { useRequest } from 'ahooks'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clearHistory, findHistoryByResult, getHistory, saveHistory } from '@/actions/history'
import { useToast } from '@/components/ui/toast'

export function useHistory(tool: string) {
  const { t } = useTranslation()
  const toast = useToast()
  const [history, setHistory] = useState<DecryptionHistory[]>([])

  const { run: refresh, loading } = useRequest(
    async () => {
      const res = await getHistory(tool)
      if (res.success) {
        setHistory(res.data || [])
      } else {
        toast.error(res.error)
      }
    },
    {
      manual: false, // load on mount
    }
  )

  const addHistory = useCallback(
    async (data: { content: string; result: string; options?: Record<string, unknown>; status?: string }) => {
      // Don't save if content or result is empty
      if (!data.content || !data.result) return

      const res = await saveHistory({ tool, ...data })
      if (res.success) {
        refresh()
      } else {
        toast.error(res.error)
      }
    },
    [tool, refresh, toast]
  )

  const removeHistory = useCallback(async () => {
    const res = await clearHistory(tool)
    if (res.success) {
      setHistory([])
      toast.success(t('app.history.cleared'))
    } else {
      toast.error(res.error)
    }
  }, [tool, t, toast])

  const lookupHistory = useCallback(
    async (result: string) => {
      if (!result) return null
      const res = await findHistoryByResult(tool, result)
      if (res.success && res.data) {
        return res.data
      }
      return null
    },
    [tool]
  )

  return {
    history,
    loading,
    addHistory,
    clearHistory: removeHistory,
    lookupHistory,
  }
}
