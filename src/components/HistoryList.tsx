
'use client'

import { Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  content: string
  result: string
  options?: Record<string, unknown>
  createdAt: Date | string
}

interface HistoryListProps {
  data: HistoryItem[]
  onClear: () => void
  loading?: boolean
}

export const HistoryList = ({ data, onClear, loading }: HistoryListProps) => {
  const { t } = useTranslation()
  const [showConfirm, setShowConfirm] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  if (!data?.length && !loading) {
    return null
  }

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('app.history.title')}</CardTitle>
          {data.length > 0 && (
            <div className="relative">
              {showConfirm ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClear()
                      setShowConfirm(false)
                    }}
                  >
                    {t('public.confirm')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setShowConfirm(true)}
                  className="text-[var(--error)]"
                >
                  {t('app.history.clear')}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
        ) : (
          <div className="space-y-4">
            {data.map((item) => {
              const isExpanded = expandedItems.has(item.id)
              return (
                <div
                  key={item.id}
                  className="glass-input rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[400px]">
                        {item.content}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy className="w-4 h-4" />}
                      onClick={() => navigator.clipboard.writeText(item.result)}
                    >
                      {t('app.social.retires.copy')}
                    </Button>
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-sm text-[var(--text-secondary)] break-all',
                        !isExpanded && 'line-clamp-2'
                      )}
                    >
                      {item.result}
                    </p>
                    {item.result.length > 100 && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline mt-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            More
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
