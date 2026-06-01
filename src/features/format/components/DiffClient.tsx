'use client'

import * as Diff from 'diff'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface DiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

const DiffClient = () => {
  const { t } = useTranslation()

  const [oldText, setOldText] = useState('')
  const [newText, setNewText] = useState('')

  const diffResult = useMemo(() => {
    if (!oldText && !newText) return []
    return Diff.diffChars(oldText, newText) as DiffPart[]
  }, [oldText, newText])

  const handleSwap = useCallback(() => {
    setOldText(newText)
    setNewText(oldText)
  }, [oldText, newText])

  const handleClear = useCallback(() => {
    setOldText('')
    setNewText('')
  }, [])

  const stats = useMemo(() => {
    let added = 0
    let removed = 0
    diffResult.forEach(part => {
      if (part.added) added += part.value.length
      if (part.removed) removed += part.value.length
    })
    return { added, removed }
  }, [diffResult])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.format.diff')}</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button icon={<ArrowLeftRight className="w-4 h-4" />} onClick={handleSwap}>
                {t('app.format.diff.swap')}
              </Button>
              <Button icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
                {t('app.format.json.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {t('app.format.diff.original')}
              </span>
              <Textarea
                value={oldText}
                onChange={e => setOldText(e.target.value)}
                placeholder={t('app.format.diff.original_placeholder')}
                rows={8}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {t('app.format.diff.modified')}
              </span>
              <Textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder={t('app.format.diff.modified_placeholder')}
                rows={8}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('app.format.diff.result')}</CardTitle>
            <span className="text-[var(--text-secondary)] text-sm">
              <span className="text-[var(--success)]">+{stats.added}</span>
              {' / '}
              <span className="text-[var(--error)]">-{stats.removed}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="font-mono text-sm whitespace-pre-wrap break-all leading-relaxed">
            {diffResult.map((part, index) => {
              let className = ''
              if (part.added) {
                className = 'bg-[var(--success-subtle)] text-[var(--success)]'
              } else if (part.removed) {
                className = 'bg-[var(--error-subtle)] text-[var(--error)] line-through'
              }
              return (
                <span key={index} className={className}>
                  {part.value}
                </span>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DiffClient
