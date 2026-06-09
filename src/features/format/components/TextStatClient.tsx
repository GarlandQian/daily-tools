'use client'

import {
  BarChart3,
  Clock3,
  Copy,
  FileJson,
  FileText,
  FlaskConical,
  Hash,
  Trash2,
  Type
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

interface StatItem {
  bg: string
  color: string
  labelKey: string
  value: number | string
}

interface Keyword {
  count: number
  word: string
}

const SAMPLE_TEXT = `Daily Tools is a local-first toolbox for fast everyday work.

It formats text, generates developer assets, inspects browser strings, and keeps sensitive data inside the browser. Clear feedback, quick copy actions, and responsive layouts make repeated tasks feel lighter.`

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu
const SENTENCE_PATTERN = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g
const MAX_TEXT_STAT_CHARS = 200000
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
  'inside',
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

const numberFormatter = new Intl.NumberFormat()
const percentFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0
})

const formatNumber = (value: number | string) =>
  typeof value === 'number' ? numberFormatter.format(value) : value

const formatDecimal = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(2)).toString()
}

const getMinutes = (wordCount: number, wordsPerMinute: number) => {
  if (!wordCount) return '0'
  return String(Math.max(1, Math.ceil(wordCount / wordsPerMinute)))
}

const getTopKeywords = (counts: Map<string, number>): Keyword[] => {
  const keywords: Keyword[] = []

  counts.forEach((count, word) => {
    const insertAt = keywords.findIndex(
      item => count > item.count || (count === item.count && word.localeCompare(item.word) < 0)
    )
    const keyword = { count, word }

    if (insertAt === -1) {
      if (keywords.length < 12) keywords.push(keyword)
      return
    }

    keywords.splice(insertAt, 0, keyword)
    if (keywords.length > 12) keywords.pop()
  })

  return keywords
}

const getWordSummary = (words: string[]) => {
  const keywordCounts = new Map<string, number>()
  const uniqueWords = new Set<string>()
  let longestWord = ''
  let totalWordLength = 0

  words.forEach(word => {
    const normalized = word.toLowerCase()

    uniqueWords.add(normalized)
    totalWordLength += word.length
    if (word.length > longestWord.length) longestWord = word

    if (normalized.length <= 2 || STOP_WORDS.has(normalized)) return
    keywordCounts.set(normalized, (keywordCounts.get(normalized) ?? 0) + 1)
  })

  return {
    averageWordLength: words.length ? totalWordLength / words.length : 0,
    keywords: getTopKeywords(keywordCounts),
    longestWord,
    uniqueWords: uniqueWords.size
  }
}

const toCsv = (items: Keyword[]) =>
  ['word,count', ...items.map(item => `"${item.word.replaceAll('"', '""')}",${item.count}`)].join(
    '\n'
  )

const TextStatClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [readingWpm, setReadingWpm] = useState(225)
  const [speakingWpm, setSpeakingWpm] = useState(150)
  const deferredInput = useDeferredValue(input)

  const analysis = useMemo(() => {
    const isTruncated = deferredInput.length > MAX_TEXT_STAT_CHARS
    const text = isTruncated ? deferredInput.slice(0, MAX_TEXT_STAT_CHARS) : deferredInput
    const words = text.match(WORD_PATTERN) ?? []
    const chars = text.length
    const charsNoSpaces = text.replace(/\s/g, '').length
    const whitespace = chars - charsNoSpaces
    const lines = text ? text.split(/\r\n|\r|\n/).length : 0
    const paragraphs = text.trim()
      ? text
          .trim()
          .split(/\r?\n\s*\r?\n/)
          .filter(Boolean).length
      : 0
    const sentences = text.trim() ? (text.match(SENTENCE_PATTERN) ?? []).length : 0
    const bytes = new Blob([text]).size
    const wordSummary = getWordSummary(words)
    const lexicalDensity = words.length ? (wordSummary.uniqueWords / words.length) * 100 : 0
    const whitespaceRatio = chars ? (whitespace / chars) * 100 : 0
    const averageSentenceWords = sentences ? words.length / sentences : 0

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
        value: wordSummary.uniqueWords,
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
      averageSentenceWords,
      averageWordLength: wordSummary.averageWordLength,
      bytes,
      chars,
      charsNoSpaces,
      isTruncated,
      keywords: wordSummary.keywords,
      lexicalDensity,
      lines,
      longestWord: wordSummary.longestWord,
      paragraphs,
      readingMinutes: getMinutes(words.length, readingWpm),
      sentences,
      speakingMinutes: getMinutes(words.length, speakingWpm),
      uniqueWords: wordSummary.uniqueWords,
      whitespace,
      whitespaceRatio,
      words: words.length
    }
  }, [deferredInput, readingWpm, speakingWpm])

  const jsonSummary = useMemo(
    () =>
      JSON.stringify(
        {
          characters: analysis.chars,
          charactersWithoutSpaces: analysis.charsNoSpaces,
          words: analysis.words,
          uniqueWords: analysis.uniqueWords,
          sentences: analysis.sentences,
          paragraphs: analysis.paragraphs,
          lines: analysis.lines,
          bytes: analysis.bytes,
          readingMinutes: analysis.readingMinutes,
          speakingMinutes: analysis.speakingMinutes,
          longestWord: analysis.longestWord,
          averageWordLength: Number(formatDecimal(analysis.averageWordLength)),
          averageSentenceWords: Number(formatDecimal(analysis.averageSentenceWords)),
          lexicalDensity: Number(formatDecimal(analysis.lexicalDensity)),
          whitespaceRatio: Number(formatDecimal(analysis.whitespaceRatio)),
          keywords: analysis.keywords
        },
        null,
        2
      ),
    [analysis]
  )

  const copySummary = () => {
    const summary = [
      ...analysis.stats.map(item => `${t(item.labelKey)}: ${formatNumber(item.value)}`),
      `${t('app.format.text.reading_time')}: ${analysis.readingMinutes} ${t('app.format.text.minutes')}`,
      `${t('app.format.text.speaking_time')}: ${analysis.speakingMinutes} ${t('app.format.text.minutes')}`,
      `${t('app.format.text.longest_word')}: ${analysis.longestWord || '-'}`,
      `${t('app.format.text.lexical_density')}: ${percentFormatter.format(analysis.lexicalDensity)}%`
    ].join('\n')

    void copy(summary)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.text.statistics')}
              </CardTitle>
              <CardDescription className="mt-2">{t('app.format.text.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => setInput(SAMPLE_TEXT)}
              >
                {t('app.format.text.sample')}
              </Button>
              <Button
                type="button"
                icon={<Copy className="h-4 w-4" />}
                onClick={copySummary}
                disabled={!input}
              >
                {t('app.format.text.copy_summary')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setInput('')}
              >
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
                  background: `linear-gradient(135deg, ${item.bg}, transparent)`,
                  borderColor: item.color,
                  borderStyle: 'solid',
                  borderWidth: 1
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

          {analysis.isTruncated && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.text.warning.truncated', {
                limit: formatNumber(MAX_TEXT_STAT_CHARS)
              })}
            </p>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                label={t('app.format.text.average_word_length')}
                value={formatDecimal(analysis.averageWordLength)}
              />
              <Metric
                icon={<BarChart3 className="h-4 w-4" />}
                label={t('app.format.text.lexical_density')}
                value={`${percentFormatter.format(analysis.lexicalDensity)}%`}
              />
            </div>

            <div className="glass-input rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  id="text-reading-wpm"
                  label={t('app.format.text.reading_wpm')}
                  value={readingWpm}
                  onChange={setReadingWpm}
                />
                <NumberInput
                  id="text-speaking-wpm"
                  label={t('app.format.text.speaking_wpm')}
                  value={speakingWpm}
                  onChange={setSpeakingWpm}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                icon={<Hash className="h-4 w-4" />}
                label={t('app.format.text.longest_word')}
                value={analysis.longestWord || '-'}
              />
              <Metric
                icon={<BarChart3 className="h-4 w-4" />}
                label={t('app.format.text.average_sentence_words')}
                value={formatDecimal(analysis.averageSentenceWords)}
              />
              <Metric
                icon={<Hash className="h-4 w-4" />}
                label={t('app.format.text.whitespace_ratio')}
                value={`${percentFormatter.format(analysis.whitespaceRatio)}%`}
              />
            </div>

            <div className="glass-panel glass-clip rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.format.text.top_keywords')}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<FileText className="h-4 w-4" />}
                  disabled={!analysis.keywords.length}
                  onClick={() => copy(toCsv(analysis.keywords))}
                >
                  CSV
                </Button>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
                {t('app.format.text.input')}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(input)}
                disabled={!input}
              >
                {t('public.copy')}
              </Button>
            </div>
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

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.text.json')}
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                disabled={!input}
                onClick={() => copy(jsonSummary)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={jsonSummary}
              readOnly
              rows={14}
              className="min-h-[280px] flex-1 resize-none font-mono text-xs"
            />
          </CardContent>
        </Card>
      </div>
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

const NumberInput = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: number) => void
  value: number
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      min={60}
      max={500}
      value={value}
      onChange={event => onChange(Math.min(500, Math.max(60, Number(event.target.value) || 60)))}
      className="font-mono"
    />
  </div>
)

export default TextStatClient
