'use client'

import { Copy, FlaskConical, Regex, Replace, Trash2 } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface MatchResult {
  captures: string[]
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
const MAX_REGEX_REPLACEMENT_CHARS = 2000
const MAX_REGEX_MATCHES = 500
const MAX_REGEX_RENDERED_MATCHES = 120
const SUSPICIOUS_REGEX_INPUT_CHARS = 1000
const SUSPICIOUS_NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*?{]/

const regexFlagOptions = [
  { label: 'g (global)', value: 'g' },
  { label: 'i (ignore case)', value: 'i' },
  { label: 'm (multiline)', value: 'm' },
  { label: 's (dot all)', value: 's' },
  { label: 'u (unicode)', value: 'u' },
  { label: 'y (sticky)', value: 'y' }
]

const regexSamples = [
  {
    id: 'email',
    flags: ['g', 'i'],
    pattern: String.raw`[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}`,
    replacement: '[email]',
    text: 'Contact ops@example.com or support@daily.tools before Friday.'
  },
  {
    id: 'url',
    flags: ['g'],
    pattern: String.raw`https?:\/\/[^\s)]+`,
    replacement: '<a href="$&">$&</a>',
    text: 'Docs: https://daily-tools.local/docs and status: http://status.example.com'
  },
  {
    id: 'date',
    flags: ['g'],
    pattern: String.raw`(\d{4})-(\d{2})-(\d{2})`,
    replacement: '$2/$3/$1',
    text: 'Release windows: 2026-06-08, 2026-07-01, and 2026-12-31.'
  },
  {
    id: 'hex',
    flags: ['g', 'i'],
    pattern: String.raw`#(?:[0-9a-f]{3}){1,2}\b`,
    replacement: 'var(--color)',
    text: 'Palette: #1677ff, #0b1020, #fff, and #FF9F0A.'
  }
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

const formatMatchesJson = (matches: MatchResult[]) =>
  JSON.stringify(
    matches.map(match => ({
      index: match.index,
      match: match.match,
      captures: match.captures
    })),
    null,
    2
  )

const formatMatchesCsv = (matches: MatchResult[]) => {
  const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  return [
    ['index', 'match', 'captures'].map(escapeCell).join(','),
    ...matches.map(match =>
      [match.index, match.match, match.captures.join('|')].map(escapeCell).join(',')
    )
  ].join('\n')
}

const RegexClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState<string[]>(['g'])
  const [testText, setTestText] = useState('')
  const [isPatternCapped, setIsPatternCapped] = useState(false)
  const [isTestTextCapped, setIsTestTextCapped] = useState(false)
  const [replacement, setReplacement] = useState('')
  const deferredPattern = useDeferredValue(pattern)
  const deferredFlags = useDeferredValue(flags)
  const deferredTestText = useDeferredValue(testText)
  const deferredReplacement = useDeferredValue(replacement)

  const { evaluatedText, matches, highlightedSegments, error, replacementPreview, warning } =
    useMemo(() => {
      const inputWarnings: string[] = []

      if (isPatternCapped || deferredPattern.length > MAX_REGEX_PATTERN_CHARS) {
        inputWarnings.push(
          t('app.format.regex.warning.pattern_too_long', {
            count: MAX_REGEX_PATTERN_CHARS
          })
        )
      }

      if (isTestTextCapped || deferredTestText.length > MAX_REGEX_INPUT_CHARS) {
        inputWarnings.push(
          t('app.format.regex.warning.input_truncated', {
            count: MAX_REGEX_INPUT_CHARS
          })
        )
      }

      if (!deferredPattern || !deferredTestText) {
        return {
          evaluatedText: deferredTestText,
          matches: [] as MatchResult[],
          highlightedSegments: buildHighlightSegments(deferredTestText, []),
          error: null as string | null,
          replacementPreview: deferredTestText,
          warning: inputWarnings.length ? inputWarnings.join(' ') : null
        }
      }

      if (
        inputWarnings.length &&
        (isPatternCapped || deferredPattern.length > MAX_REGEX_PATTERN_CHARS)
      ) {
        return {
          evaluatedText: deferredTestText,
          matches: [] as MatchResult[],
          highlightedSegments: buildHighlightSegments(deferredTestText, []),
          error: null,
          replacementPreview: deferredTestText,
          warning: inputWarnings.join(' ')
        }
      }

      try {
        const hasSuspiciousPattern = SUSPICIOUS_NESTED_QUANTIFIER.test(deferredPattern)
        const safeInputLimit = hasSuspiciousPattern
          ? SUSPICIOUS_REGEX_INPUT_CHARS
          : MAX_REGEX_INPUT_CHARS
        const safeTestText = deferredTestText.slice(0, safeInputLimit)
        const warnings: string[] = []

        if (
          (isTestTextCapped || deferredTestText.length > safeInputLimit) &&
          safeInputLimit !== MAX_REGEX_INPUT_CHARS
        ) {
          warnings.push(
            t('app.format.regex.warning.input_truncated', {
              count: safeInputLimit
            })
          )
        }

        if (inputWarnings.length) {
          warnings.unshift(...inputWarnings)
        }

        if (hasSuspiciousPattern && deferredTestText.length > SUSPICIOUS_REGEX_INPUT_CHARS) {
          warnings.push(t('app.format.regex.warning.backtracking'))
        }

        const flagStr = deferredFlags.join('')
        const regex = new RegExp(deferredPattern, flagStr)
        const replaceRegex = new RegExp(deferredPattern, flagStr)
        const matchResults: MatchResult[] = []
        const ranges: Array<{ index: number; value: string }> = []
        let match: RegExpExecArray | null
        let key = 0

        if (flagStr.includes('g')) {
          while ((match = regex.exec(safeTestText)) !== null) {
            ranges.push({ index: match.index, value: match[0] })
            matchResults.push({
              captures: match.slice(1),
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
              captures: match.slice(1),
              key: 0,
              index: match.index,
              match: match[0],
              groups: match.slice(1).join(', ') || '-'
            })
          }
        }

        return {
          evaluatedText: safeTestText,
          matches: matchResults,
          highlightedSegments: buildHighlightSegments(safeTestText, ranges),
          error: null,
          replacementPreview: safeTestText.replace(replaceRegex, deferredReplacement),
          warning: warnings.length ? warnings.join(' ') : null
        }
      } catch (e) {
        const err = e as Error
        return {
          evaluatedText: deferredTestText,
          matches: [] as MatchResult[],
          highlightedSegments: buildHighlightSegments(deferredTestText, []),
          error: err.message,
          replacementPreview: deferredTestText,
          warning: null
        }
      }
    }, [
      deferredFlags,
      deferredPattern,
      deferredReplacement,
      deferredTestText,
      isPatternCapped,
      isTestTextCapped,
      t
    ])

  const visibleMatches = useMemo(() => matches.slice(0, MAX_REGEX_RENDERED_MATCHES), [matches])
  const isMatchTableLimited = matches.length > visibleMatches.length
  const stats = useMemo(() => {
    const uniqueMatches = new Set(matches.map(match => match.match)).size
    const captureCount = matches.reduce((total, match) => total + match.captures.length, 0)
    const matchedChars = matches.reduce((total, match) => total + match.match.length, 0)
    const coverage = evaluatedText.length
      ? Math.round((matchedChars / evaluatedText.length) * 100)
      : 0

    return {
      captures: captureCount,
      coverage,
      matches: matches.length,
      unique: uniqueMatches
    }
  }, [evaluatedText.length, matches])

  const updatePattern = useCallback((value: string) => {
    const capped = value.length > MAX_REGEX_PATTERN_CHARS
    setIsPatternCapped(capped)
    setPattern(capped ? value.slice(0, MAX_REGEX_PATTERN_CHARS) : value)
  }, [])

  const updateTestText = useCallback((value: string) => {
    const capped = value.length > MAX_REGEX_INPUT_CHARS
    setIsTestTextCapped(capped)
    setTestText(capped ? value.slice(0, MAX_REGEX_INPUT_CHARS) : value)
  }, [])

  const updateReplacement = useCallback((value: string) => {
    setReplacement(value.slice(0, MAX_REGEX_REPLACEMENT_CHARS))
  }, [])

  const handleClear = useCallback(() => {
    setIsPatternCapped(false)
    setIsTestTextCapped(false)
    setPattern('')
    setFlags(['g'])
    setTestText('')
    setReplacement('')
  }, [])

  const toggleFlag = (value: string, checked: boolean) => {
    setFlags(current => {
      if (checked) {
        return current.includes(value) ? current : [...current, value].sort()
      }
      return current.filter(flag => flag !== value)
    })
  }

  const loadSample = (sampleId: string) => {
    const sample = regexSamples.find(item => item.id === sampleId)
    if (!sample) return
    setIsPatternCapped(false)
    setIsTestTextCapped(false)
    setPattern(sample.pattern)
    setFlags(sample.flags)
    setTestText(sample.text)
    setReplacement(sample.replacement)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Regex className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.regex')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {regexSamples.map(sample => (
                <Button
                  key={sample.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<FlaskConical className="h-4 w-4" />}
                  onClick={() => loadSample(sample.id)}
                >
                  {t(`app.format.regex.sample.${sample.id}`)}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleClear}
              >
                {t('app.format.json.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RegexStat label={t('app.format.regex.stats.matches')} value={stats.matches} />
            <RegexStat label={t('app.format.regex.stats.unique')} value={stats.unique} />
            <RegexStat label={t('app.format.regex.stats.captures')} value={stats.captures} />
            <RegexStat label={t('app.format.regex.stats.coverage')} value={`${stats.coverage}%`} />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <Label htmlFor="regex-pattern">{t('app.format.regex.pattern')}</Label>
              <div className="glass-input flex h-11 items-center rounded-lg px-3.5 text-sm focus-within:ring-2 focus-within:ring-[var(--primary)]">
                <span className="font-mono text-[var(--text-tertiary)]">/</span>
                <input
                  id="regex-pattern"
                  value={pattern}
                  onChange={event => updatePattern(event.target.value)}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="regex-test">{t('app.format.regex.test')}</Label>
              <Textarea
                id="regex-test"
                value={testText}
                onChange={event => updateTestText(event.target.value)}
                placeholder={t('app.format.regex.test_placeholder')}
                rows={5}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="regex-replacement">{t('app.format.regex.replacement')}</Label>
              <Input
                id="regex-replacement"
                value={replacement}
                onChange={event => updateReplacement(event.target.value)}
                placeholder="$1"
                maxLength={MAX_REGEX_REPLACEMENT_CHARS}
                className="font-mono"
              />
              <p className="text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.format.regex.replacement_hint')}
              </p>
              <InputCapNotice
                visible={replacement.length >= MAX_REGEX_REPLACEMENT_CHARS}
                limit={MAX_REGEX_REPLACEMENT_CHARS}
              />
            </div>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
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

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Replace className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.regex.replace_preview')}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(replacementPreview)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[72px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3 font-mono text-sm leading-7 text-[var(--text-primary)] whitespace-pre-wrap break-all">
              {replacementPreview}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t('app.format.regex.matches')}</CardTitle>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(matches.map(match => match.match).join('\n'))}
              >
                {t('app.format.regex.copy_matches')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(formatMatchesJson(matches))}
              >
                JSON
              </Button>
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(formatMatchesCsv(matches))}
              >
                CSV
              </Button>
            </div>
          </div>
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
                {visibleMatches.length > 0 ? (
                  visibleMatches.map(match => (
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
          {isMatchTableLimited && (
            <p className="mt-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.regex.warning.rows_limited', {
                total: matches.length,
                visible: visibleMatches.length
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const RegexStat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="glass-input rounded-xl p-3">
    <div className="text-xs text-[var(--text-secondary)]">{label}</div>
    <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default RegexClient
