'use client'

import { Copy, FileText, Trash2, Type } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

interface StatItem {
  labelKey: string
  value: number
  color: string
  bg: string
}

const TextStatClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')

  const stats = useMemo<StatItem[]>(() => {
    const text = input

    const chars = text.length
    const charsNoSpaces = text.replace(/\s/g, '').length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0
    const paragraphs = text.trim() ? text.trim().split(/(\r\n|\r|\n){2,}/).length : 0
    const bytes = new Blob([text]).size

    return [
      {
        labelKey: 'app.format.text.characters',
        value: chars,
        color: 'var(--primary)',
        bg: 'var(--primary-subtle)'
      },
      {
        labelKey: 'app.format.text.words',
        value: words,
        color: 'var(--success)',
        bg: 'var(--success-subtle)'
      },
      {
        labelKey: 'app.format.text.lines',
        value: lines,
        color: 'var(--info, var(--primary))',
        bg: 'var(--info-subtle, var(--primary-subtle))'
      },
      {
        labelKey: 'app.format.text.paragraphs',
        value: paragraphs,
        color: 'var(--warning)',
        bg: 'var(--warning-subtle)'
      },
      {
        labelKey: 'app.format.text.bytes',
        value: bytes,
        color: 'var(--error)',
        bg: 'var(--error-subtle)'
      },
      {
        labelKey: 'app.format.text.chars_no_spaces',
        value: charsNoSpaces,
        color: 'var(--text-secondary)',
        bg: 'var(--bg-muted)'
      }
    ]
  }, [input])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Type className="w-5 h-5 text-[var(--primary)]" />
              {t('app.format.text.statistics')}
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="w-4 h-4" />}
                onClick={() => copy(input)}
                disabled={!input}
              >
                {t('public.copy')}
              </Button>
              <Button icon={<Trash2 className="w-4 h-4" />} onClick={() => setInput('')}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map(item => (
              <div
                key={item.labelKey}
                className={cn(
                  'glass-panel rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md relative overflow-hidden'
                )}
                style={{
                  borderColor: item.color,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  background: `linear-gradient(135deg, ${item.bg}, transparent)`
                }}
              >
                <div className="flex flex-col gap-1">
                  <span
                    className="font-mono text-3xl font-bold tabular-nums"
                    style={{ color: item.color }}
                  >
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">{t(item.labelKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-[300px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--text-secondary)]" />
            {t('app.format.text.input')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('app.format.text.placeholder')}
            className="h-full resize-none font-mono"
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default TextStatClient
