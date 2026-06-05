'use client'

import { BarChart3, Clock3, Copy, FileText, Hash, Trash2, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

interface StatItem {
  labelKey: string
  value: number | string
  color: string
  bg: string
}

interface Keyword {
  word: string
  count: number
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu
const SENTENCE_PATTERN = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'with'
])

const formatNumber = (value: number | string) =>
  typeof value === 'number' ? value.toLocaleString() : value

const getMinutes = (wordCount: number, wordsPerMinute: number) => {
  if (!wordCount) return '0'
  return String(Math.max(1, Math.ceil(wordCount / wordsPerMinute)))
}

const getTopKeywords = (words: string[]): Keyword[] => {
  const counts = new Map<string, number>()

  words.forEach(word => {
    const normalized = word.toLowerCase()
    if (normalized.length <= 2 || STOP_WORDS.has(normalized)) return
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  })

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 10)
}

const TextStatClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')

  const analysis = useMemo(() => {
    const text = input
    const words = text.match(WORD_PATTERN) ?? []
    const chars = text.length
    const charsNoSpaces = text.replace(/\s/g, '').length
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0
    const paragraphs = text.trim()
      ? text
          .trim()
          .split(/\r?\n\s*\r?\n/)
          .filter(Boolean).length
      : 0
    const sentences = text.trim() ? (text.match(SENTENCE_PATTERN) ?? []).length : 0
    const bytes = new Blob([text]).size
    const uniqueWords = new Set(words.map(word => word.toLowerCase())).size
    const longestWord = words.reduce(
      (longest, word) => (word.length > longest.length ? word : longest),
      ''
    )
    const keywords = getTopKeywords(words)

    const stats: StatItem[] = [
      {
        labelKey: 'app.format.text.characters',
        value: chars,
        color: 'var(--primary)',
        bg: 'var(--primary-subtle)'
      },
      {
        labelKey: 'app.format.text.words',
        value: words.length,
        color: 'var(--success)',
        bg: 'var(--success-subtle)'
      },
      {
        labelKey: 'app.format.text.sentences',
        value: sentences,
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
        labelKey: 'app.format.text.lines',
        value: lines,
        color: 'var(--primary)',
        bg: 'var(--primary-subtle)'
      },
      {
        labelKey: 'app.format.text.chars_no_spaces',
        value: charsNoSpaces,
        color: 'var(--text-secondary)',
        bg: 'var(--bg-muted)'
      },
      {
        labelKey: 'app.format.text.unique_words',
        value: uniqueWords,
        color: 'var(--success)',
        bg: 'var(--success-subtle)'
      },
      {
        labelKey: 'app.format.text.bytes',
        value: bytes,
        color: 'var(--error)',
        bg: 'var(--error-subtle)'
      }
    ]

    return {
      stats,
      keywords,
      longestWord,
      readingMinutes: getMinutes(words.length, 225),
      speakingMinutes: getMinutes(words.length, 150)
    }
  }, [input])

  const copySummary = () => {
    const summary = [
      ...analysis.stats.map(item => `${t(item.labelKey)}: ${formatNumber(item.value)}`),
      `${t('app.format.text.reading_time')}: ${analysis.readingMinutes} ${t('app.format.text.minutes')}`,
      `${t('app.format.text.speaking_time')}: ${analysis.speakingMinutes} ${t('app.format.text.minutes')}`,
      `${t('app.format.text.longest_word')}: ${analysis.longestWord || '-'}`
    ].join('\n')

    void copy(summary)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.text.statistics')}
            </CardTitle>
            <div className="flex flex-wrap gap-3">
              <Button icon={<Copy className="h-4 w-4" />} onClick={copySummary} disabled={!input}>
                {t('app.format.text.copy_summary')}
              </Button>
              <Button
                icon={<FileText className="h-4 w-4" />}
                onClick={() => copy(input)}
                disabled={!input}
              >
                {t('public.copy')}
              </Button>
              <Button icon={<Trash2 className="h-4 w-4" />} onClick={() => setInput('')}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {analysis.stats.map(item => (
              <div
                key={item.labelKey}
                className={cn(
                  'glass-panel glass-clip relative overflow-hidden rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:glass-panel-strong'
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
                    className="font-mono text-2xl font-bold tabular-nums"
                    style={{ color: item.color }}
                  >
                    {formatNumber(item.value)}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">{t(item.labelKey)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                icon={<Clock3 className="h-4 w-4" />}
                label={t('app.format.text.reading_time')}
                value={`${analysis.readingMinutes} ${t('app.format.text.minutes')}`}
              />
              <Metric
                icon={<Clock3 className="h-4 w-4" />}
                label={t('app.format.text.speaking_time')}
                value={`${analysis.speakingMinutes} ${t('app.format.text.minutes')}`}
              />
              <Metric
                icon={<Hash className="h-4 w-4" />}
                label={t('app.format.text.longest_word')}
                value={analysis.longestWord || '-'}
              />
            </div>

            <div className="glass-panel glass-clip rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.text.top_keywords')}
              </div>
              {analysis.keywords.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.keywords.map(keyword => (
                    <button
                      key={keyword.word}
                      type="button"
                      onClick={() => void copy(keyword.word)}
                      className="rounded-full border border-[var(--glass-border)] bg-[var(--glass-input-bg)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-all hover:-translate-y-0.5 hover:glass-panel-strong"
                    >
                      {keyword.word}
                      <span className="ml-2 font-mono text-[var(--text-tertiary)]">
                        {keyword.count}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  {t('app.format.text.no_keywords')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[320px] flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
            {t('app.format.text.input')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder={t('app.format.text.placeholder')}
            className="h-full resize-none font-mono"
          />
        </CardContent>
      </Card>
    </div>
  )
}

const Metric = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default TextStatClient
