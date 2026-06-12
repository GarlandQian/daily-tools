'use client'

import {
  camelCase,
  kebabCase,
  lowerCase,
  lowerFirst,
  snakeCase,
  startCase,
  toLower,
  toUpper,
  upperFirst
} from 'lodash-es'
import { Copy, Download, Filter, Sparkles, Trash2, Type, Wand2 } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { collectBoundedNonEmptyLines } from '@/utils/textScan'

interface Conversion {
  label: string
  value: string
  hintKey: string
}

type ExportFormat = 'text' | 'json' | 'csv' | 'typescript'
type SeparatorMode = 'auto' | 'space' | 'underscore' | 'dash' | 'dot' | 'slash'

const MAX_CASE_INPUT_CHARS = 50000
const MAX_BATCH_LINES = 160
const MAX_CASE_SEARCH_CHARS = 160
const MAX_CASE_AFFIX_CHARS = 80
const caseNumberFormatter = new Intl.NumberFormat()

const formatCaseNumber = (value: number) => caseNumberFormatter.format(value)
const toSentenceCase = (value: string) => upperFirst(lowerCase(value)).replace(/\s+([.!?])/g, '$1')
const toHeaderCase = (value: string) => startCase(camelCase(value)).replaceAll(' ', '-')
const toPathCase = (value: string) => lowerCase(value).replaceAll(' ', '/')
const toDotCase = (value: string) => lowerCase(value).replaceAll(' ', '.')
const toNoCase = (value: string) => lowerCase(value).replaceAll(' ', '')
const toCobolCase = (value: string) => toUpper(kebabCase(value))
const toAdaCase = (value: string) => startCase(camelCase(value)).replaceAll(' ', '_')
const toEnvKey = (value: string, prefix: string) =>
  [prefix, toUpper(snakeCase(value))].filter(Boolean).join('_')

const applySeparatorMode = (value: string, mode: SeparatorMode) => {
  if (mode === 'auto') return value
  const separatorByMode: Record<Exclude<SeparatorMode, 'auto'>, string> = {
    dash: '-',
    dot: '.',
    slash: '/',
    space: ' ',
    underscore: '_'
  }
  const separator = separatorByMode[mode]
  return value
    .trim()
    .split(/[\s._/-]+/)
    .filter(Boolean)
    .join(separator)
}

const buildConversions = (
  rawValue: string,
  prefix: string,
  suffix: string,
  separatorMode: SeparatorMode
) => {
  const text = applySeparatorMode(rawValue.trim(), separatorMode)
  const titleCase = startCase(camelCase(text))
  const kebab = kebabCase(text)
  const snake = snakeCase(text)
  const withAffix = (value: string) => `${prefix}${value}${suffix}`

  return [
    {
      label: 'camelCase',
      value: withAffix(camelCase(text)),
      hintKey: 'app.format.case.hint.camel'
    },
    {
      label: 'PascalCase',
      value: withAffix(upperFirst(camelCase(text))),
      hintKey: 'app.format.case.hint.pascal'
    },
    {
      label: 'lowerFirst',
      value: withAffix(lowerFirst(titleCase.replaceAll(' ', ''))),
      hintKey: 'app.format.case.hint.lower_first'
    },
    { label: 'snake_case', value: withAffix(snake), hintKey: 'app.format.case.hint.snake' },
    { label: 'kebab-case', value: withAffix(kebab), hintKey: 'app.format.case.hint.kebab' },
    {
      label: 'CONSTANT_CASE',
      value: withAffix(toUpper(snake)),
      hintKey: 'app.format.case.hint.constant'
    },
    {
      label: 'SCREAMING-KEBAB',
      value: withAffix(toUpper(kebab)),
      hintKey: 'app.format.case.hint.screaming_kebab'
    },
    {
      label: 'Train-Case',
      value: withAffix(toHeaderCase(text)),
      hintKey: 'app.format.case.hint.train'
    },
    { label: 'dot.case', value: withAffix(toDotCase(text)), hintKey: 'app.format.case.hint.dot' },
    {
      label: 'path/case',
      value: withAffix(toPathCase(text)),
      hintKey: 'app.format.case.hint.path'
    },
    { label: 'no case', value: withAffix(toNoCase(text)), hintKey: 'app.format.case.hint.no' },
    {
      label: 'COBOL-CASE',
      value: withAffix(toCobolCase(text)),
      hintKey: 'app.format.case.hint.cobol'
    },
    { label: 'Ada_Case', value: withAffix(toAdaCase(text)), hintKey: 'app.format.case.hint.ada' },
    { label: 'Title Case', value: withAffix(titleCase), hintKey: 'app.format.case.hint.title' },
    {
      label: 'Sentence case',
      value: withAffix(toSentenceCase(text)),
      hintKey: 'app.format.case.hint.sentence'
    },
    { label: 'UPPER CASE', value: withAffix(toUpper(text)), hintKey: 'app.format.case.hint.upper' },
    { label: 'lower case', value: withAffix(toLower(text)), hintKey: 'app.format.case.hint.lower' },
    { label: 'slug', value: withAffix(kebab), hintKey: 'app.format.case.hint.slug' },
    { label: 'ENV_KEY', value: toEnvKey(text, prefix), hintKey: 'app.format.case.hint.env' }
  ]
}

const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

const CASE_WORD_PATTERN = /[\p{L}\p{N}]+/gu

const scanCaseStats = (value: string, outputs: number) => {
  let lines = value ? 1 : 0

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]

    if (char === '\r') {
      lines += 1
      if (value[index + 1] === '\n') index += 1
    } else if (char === '\n') {
      lines += 1
    }
  }

  CASE_WORD_PATTERN.lastIndex = 0
  let words = 0

  while (CASE_WORD_PATTERN.exec(value)) {
    words += 1
  }

  return {
    characters: value.length,
    lines,
    outputs,
    words
  }
}

const buildExportText = (
  exportFormat: ExportFormat,
  conversions: Conversion[],
  input: string,
  prefix: string,
  separatorMode: SeparatorMode,
  suffix: string
) => {
  if (exportFormat === 'json') {
    return JSON.stringify(
      {
        conversions,
        input,
        options: { prefix, separatorMode, suffix }
      },
      null,
      2
    )
  }

  if (exportFormat === 'csv') {
    return [
      'label,value',
      ...conversions.map(item => [item.label, item.value].map(csvEscape).join(','))
    ].join('\n')
  }

  if (exportFormat === 'typescript') {
    return `export const names = {\n${conversions
      .map(item => `  ${camelCase(item.label)}: ${JSON.stringify(item.value)},`)
      .join('\n')}\n} as const`
  }

  return conversions.map(item => `${item.label}: ${item.value}`).join('\n')
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const CaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [isInputCapped, setIsInputCapped] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [search, setSearch] = useState('')
  const [separatorMode, setSeparatorMode] = useState<SeparatorMode>('auto')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('text')
  const deferredInput = useDeferredValue(input)
  const deferredSearch = useDeferredValue(search)
  const isInputTruncated = isInputCapped || deferredInput.length > MAX_CASE_INPUT_CHARS
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_CASE_INPUT_CHARS
        ? deferredInput.slice(0, MAX_CASE_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )

  const updateInput = (value: string) => {
    const capped = value.length > MAX_CASE_INPUT_CHARS
    setIsInputCapped(capped)
    setInput(capped ? value.slice(0, MAX_CASE_INPUT_CHARS) : value)
  }

  const conversions = useMemo<Conversion[]>(() => {
    if (!safeInput.trim()) return []
    return buildConversions(safeInput, prefix, suffix, separatorMode)
  }, [prefix, safeInput, separatorMode, suffix])

  const visibleConversions = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    if (!keyword) return conversions
    return conversions.filter(
      item =>
        item.label.toLowerCase().includes(keyword) ||
        item.value.toLowerCase().includes(keyword) ||
        t(item.hintKey).toLowerCase().includes(keyword)
    )
  }, [conversions, deferredSearch, t])

  const batchRows = useMemo(() => {
    const lines = collectBoundedNonEmptyLines(safeInput, MAX_BATCH_LINES).lines

    return lines.map(line => ({
      input: line,
      values: buildConversions(line, prefix, suffix, separatorMode)
    }))
  }, [prefix, safeInput, separatorMode, suffix])

  const stats = useMemo(() => {
    return scanCaseStats(safeInput, conversions.length)
  }, [conversions.length, safeInput])

  const copyAll = () => {
    void copy(buildExportText(exportFormat, conversions, safeInput, prefix, separatorMode, suffix))
  }

  const handleClear = () => {
    updateInput('')
    setSearch('')
    setPrefix('')
    setSuffix('')
    setSeparatorMode('auto')
    setExportFormat('text')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.case')}
              </CardTitle>
              <CardDescription>{t('app.format.case.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={copyAll}
                disabled={!conversions.length}
              >
                {t('app.format.case.copy_all')}
              </Button>
              <Button
                icon={<Download className="h-4 w-4" />}
                disabled={!conversions.length}
                onClick={() =>
                  downloadText(
                    buildExportText(
                      exportFormat,
                      conversions,
                      safeInput,
                      prefix,
                      separatorMode,
                      suffix
                    ),
                    `case-conversions.${exportFormat === 'json' ? 'json' : exportFormat === 'csv' ? 'csv' : exportFormat === 'typescript' ? 'ts' : 'txt'}`,
                    exportFormat === 'json'
                      ? 'application/json;charset=utf-8'
                      : 'text/plain;charset=utf-8'
                  )
                }
              >
                {t('app.format.case.download')}
              </Button>
              <Button icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <CaseMetric
              label={t('app.format.case.metric.characters')}
              value={formatCaseNumber(stats.characters)}
            />
            <CaseMetric
              label={t('app.format.case.metric.words')}
              value={formatCaseNumber(stats.words)}
            />
            <CaseMetric
              label={t('app.format.case.metric.lines')}
              value={formatCaseNumber(stats.lines)}
            />
            <CaseMetric
              label={t('app.format.case.metric.outputs')}
              value={formatCaseNumber(stats.outputs)}
            />
          </div>
          <Textarea
            value={input}
            onChange={event => updateInput(event.target.value)}
            placeholder={t('app.format.case.placeholder')}
            rows={4}
            className="font-mono"
          />
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div className="space-y-2">
              <Label htmlFor="case-search" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('app.format.case.search')}
              </Label>
              <Input
                id="case-search"
                value={search}
                onChange={event => setSearch(event.target.value.slice(0, MAX_CASE_SEARCH_CHARS))}
                placeholder={t('app.format.case.search_placeholder')}
                maxLength={MAX_CASE_SEARCH_CHARS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-export">{t('app.format.case.export')}</Label>
              <Select
                id="case-export"
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="text">{t('app.format.case.export.text')}</option>
                <option value="json">{t('app.format.case.export.json')}</option>
                <option value="csv">{t('app.format.case.export.csv')}</option>
                <option value="typescript">{t('app.format.case.export.typescript')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-separator">{t('app.format.case.separator')}</Label>
              <Select
                id="case-separator"
                value={separatorMode}
                onChange={event => setSeparatorMode(event.target.value as SeparatorMode)}
              >
                <option value="auto">{t('app.format.case.separator.auto')}</option>
                <option value="space">{t('app.format.case.separator.space')}</option>
                <option value="underscore">{t('app.format.case.separator.underscore')}</option>
                <option value="dash">{t('app.format.case.separator.dash')}</option>
                <option value="dot">{t('app.format.case.separator.dot')}</option>
                <option value="slash">{t('app.format.case.separator.slash')}</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case-prefix">{t('app.format.case.prefix')}</Label>
              <Input
                id="case-prefix"
                value={prefix}
                onChange={event => setPrefix(event.target.value.slice(0, MAX_CASE_AFFIX_CHARS))}
                placeholder="APP_"
                maxLength={MAX_CASE_AFFIX_CHARS}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-suffix">{t('app.format.case.suffix')}</Label>
              <Input
                id="case-suffix"
                value={suffix}
                onChange={event => setSuffix(event.target.value.slice(0, MAX_CASE_AFFIX_CHARS))}
                placeholder="_ID"
                maxLength={MAX_CASE_AFFIX_CHARS}
                className="font-mono"
              />
            </div>
          </div>
          {isInputTruncated && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.case.warning.truncated', {
                limit: formatCaseNumber(MAX_CASE_INPUT_CHARS)
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {conversions.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleConversions.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={() => copy(item.value)}
              className="glass-panel glass-clip group min-h-32 rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:glass-panel-strong"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                    {item.label}
                  </span>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">{t(item.hintKey)}</p>
                </div>
                <Copy className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="break-all font-mono text-sm leading-6 text-[var(--text-primary)]">
                {item.value}
              </p>
            </button>
          ))}
          {!visibleConversions.length && (
            <Card className="glass-panel-static sm:col-span-2 xl:col-span-3 2xl:col-span-4">
              <CardContent className="flex min-h-32 items-center justify-center p-6 text-sm text-[var(--text-secondary)]">
                {t('app.format.case.no_match')}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="glass-panel-static">
          <CardContent className="flex min-h-44 items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <Sparkles className="mx-auto h-8 w-8 text-[var(--primary)]" />
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.format.case.empty')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {batchRows.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.case.batch')}
            </CardTitle>
            <CardDescription>
              {t('app.format.case.batch_hint', { limit: formatCaseNumber(MAX_BATCH_LINES) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {batchRows.map(row => (
                <div
                  key={row.input}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3"
                >
                  <p className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {row.input}
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {row.values.slice(0, 6).map(item => (
                      <button
                        key={`${row.input}-${item.label}`}
                        type="button"
                        onClick={() => copy(item.value)}
                        className="min-w-0 rounded-xl bg-[var(--glass-input-bg)] px-3 py-2 text-left"
                      >
                        <span className="text-xs text-[var(--text-tertiary)]">{item.label}</span>
                        <span className="mt-1 block truncate font-mono text-xs text-[var(--text-primary)]">
                          {item.value}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const CaseMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default CaseClient
