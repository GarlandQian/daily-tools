'use client'

import { Trash2 } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface MatchResult {
  key: number
  index: number
  match: string
  groups: string
}

interface HighlightSegment {
  key: string
  text: string
  highlighted: boolean
}

const MAX_REGEX_INPUT_CHARS = 5000
const MAX_REGEX_PATTERN_CHARS = 500
const MAX_REGEX_MATCHES = 500
const SUSPICIOUS_REGEX_INPUT_CHARS = 1000
const SUSPICIOUS_NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*?{]/

const regexFlagOptions = [
  { label: 'g (global)', value: 'g' },
  { label: 'i (ignore case)', value: 'i' },
  { label: 'm (multiline)', value: 'm' }
]

const buildHighlightSegments = (
  source: string,
  ranges: Array<{ index: number; value: string }>
): HighlightSegment[] => {
  if (!ranges.length) {
    return [{ key: 'plain', text: source, highlighted: false }]
  }

  const segments: HighlightSegment[] = []
  let lastIndex = 0

  ranges.forEach((range, index) => {
    if (range.index > lastIndex) {
      segments.push({
        key: `plain-${index}`,
        text: source.slice(lastIndex, range.index),
        highlighted: false
      })
    }

    if (range.value.length > 0) {
      segments.push({
        key: `match-${index}`,
        text: range.value,
        highlighted: true
      })
    }

    lastIndex = range.index + range.value.length
  })

  if (lastIndex < source.length) {
    segments.push({ key: 'plain-tail', text: source.slice(lastIndex), highlighted: false })
  }

  return segments.length ? segments : [{ key: 'empty', text: source, highlighted: false }]
}

const RegexClient = () => {
  const { t } = useTranslation()
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<string[]>(['g'])
  const [testText, setTestText] = useState('')
  const deferredPattern = useDeferredValue(pattern)
  const deferredFlags = useDeferredValue(flags)
  const deferredTestText = useDeferredValue(testText)

  const { matches, highlightedSegments, error, warning } = useMemo(() => {
    if (!deferredPattern || !deferredTestText) {
      return {
        matches: [] as MatchResult[],
        highlightedSegments: buildHighlightSegments(deferredTestText, []),
        error: null as string | null,
        warning: null as string | null
      }
    }

    if (deferredPattern.length > MAX_REGEX_PATTERN_CHARS) {
      return {
        matches: [] as MatchResult[],
        highlightedSegments: buildHighlightSegments(deferredTestText, []),
        error: null,
        warning: t('app.format.regex.warning.pattern_too_long', {
          count: MAX_REGEX_PATTERN_CHARS
        })
      }
    }

    try {
      const hasSuspiciousPattern = SUSPICIOUS_NESTED_QUANTIFIER.test(deferredPattern)
      const safeInputLimit = hasSuspiciousPattern
        ? SUSPICIOUS_REGEX_INPUT_CHARS
        : MAX_REGEX_INPUT_CHARS
      const safeTestText = deferredTestText.slice(0, safeInputLimit)
      const warnings: string[] = []

      if (deferredTestText.length > safeInputLimit) {
        warnings.push(
          t('app.format.regex.warning.input_truncated', {
            count: safeInputLimit
          })
        )
      }

      if (hasSuspiciousPattern && deferredTestText.length > SUSPICIOUS_REGEX_INPUT_CHARS) {
        warnings.push(t('app.format.regex.warning.backtracking'))
      }

      const flagStr = deferredFlags.join('')
      const regex = new RegExp(deferredPattern, flagStr)
      const matchResults: MatchResult[] = []
      const ranges: Array<{ index: number; value: string }> = []
      let match: RegExpExecArray | null
      let key = 0

      if (flagStr.includes('g')) {
        while ((match = regex.exec(safeTestText)) !== null) {
          ranges.push({ index: match.index, value: match[0] })
          matchResults.push({
            key: key++,
            index: match.index,
            match: match[0],
            groups: match.slice(1).join(', ') || '-'
          })

          if (matchResults.length >= MAX_REGEX_MATCHES) {
            warnings.push(
              t('app.format.regex.warning.match_cap', {
                count: MAX_REGEX_MATCHES
              })
            )
            break
          }

          if (match[0].length === 0) {
            regex.lastIndex += 1
          }
        }
      } else {
        match = regex.exec(safeTestText)
        if (match) {
          ranges.push({ index: match.index, value: match[0] })
          matchResults.push({
            key: 0,
            index: match.index,
            match: match[0],
            groups: match.slice(1).join(', ') || '-'
          })
        }
      }

      return {
        matches: matchResults,
        highlightedSegments: buildHighlightSegments(safeTestText, ranges),
        error: null,
        warning: warnings.length ? warnings.join(' ') : null
      }
    } catch (e) {
      const err = e as Error
      return {
        matches: [] as MatchResult[],
        highlightedSegments: buildHighlightSegments(deferredTestText, []),
        error: err.message,
        warning: null
      }
    }
  }, [deferredFlags, deferredPattern, deferredTestText, t])

  const handleClear = useCallback(() => {
    setPattern('')
    setFlags(['g'])
    setTestText('')
  }, [])

  const toggleFlag = (value: string, checked: boolean) => {
    setFlags(current => {
      if (checked) {
        return current.includes(value) ? current : [...current, value].sort()
      }
      return current.filter(flag => flag !== value)
    })
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('app.format.regex')}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={handleClear}
          >
            {t('app.format.json.clear')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <Label htmlFor="regex-pattern">{t('app.format.regex.pattern')}</Label>
              <div className="glass-input flex h-11 items-center rounded-lg px-3.5 text-sm focus-within:ring-2 focus-within:ring-[var(--primary)]">
                <span className="font-mono text-[var(--text-tertiary)]">/</span>
                <input
                  id="regex-pattern"
                  value={pattern}
                  onChange={event => setPattern(event.target.value)}
                  placeholder={t('app.format.regex.pattern_placeholder')}
                  className="min-w-0 flex-1 bg-transparent px-1 font-mono text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
                <span className="font-mono text-[var(--text-tertiary)]">/{flags.join('')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.format.regex.flags')}</Label>
              <div className="flex flex-wrap gap-3 pt-2 md:flex-col md:gap-2 md:pt-0">
                {regexFlagOptions.map(option => (
                  <Checkbox
                    key={option.value}
                    checked={flags.includes(option.value)}
                    onChange={event => toggleFlag(option.value, event.target.checked)}
                    label={option.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="regex-test">{t('app.format.regex.test')}</Label>
            <Textarea
              id="regex-test"
              value={testText}
              onChange={event => setTestText(event.target.value)}
              placeholder={t('app.format.regex.test_placeholder')}
              rows={4}
              className="font-mono"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
              {t('app.format.json.error')}: {error}
            </p>
          )}

          {warning && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('app.format.regex.result')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[72px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3 font-mono text-sm leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-all">
            {highlightedSegments.map(segment =>
              segment.highlighted ? (
                <mark
                  key={segment.key}
                  className="rounded bg-[var(--warning-subtle)] px-1 text-[var(--warning)]"
                >
                  {segment.text}
                </mark>
              ) : (
                <span key={segment.key}>{segment.text}</span>
              )
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('app.format.regex.matches')}</CardTitle>
          <span className="text-sm text-[var(--text-secondary)]">
            {matches.length} {t('app.format.regex.matches_count')}
          </span>
        </CardHeader>
        <CardContent className="min-h-0 overflow-auto">
          <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-[var(--text-secondary)]">
                <tr>
                  <th className="w-24 px-3 py-2 font-medium">{t('app.format.regex.index')}</th>
                  <th className="px-3 py-2 font-medium">{t('app.format.regex.match')}</th>
                  <th className="px-3 py-2 font-medium">{t('app.format.regex.groups')}</th>
                </tr>
              </thead>
              <tbody>
                {matches.length > 0 ? (
                  matches.map(match => (
                    <tr key={match.key} className="border-t border-[var(--border-subtle)]">
                      <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">
                        {match.index}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">
                        {match.match}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">
                        {match.groups}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-center text-[var(--text-tertiary)]" colSpan={3}>
                      0 {t('app.format.regex.matches_count')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegexClient
