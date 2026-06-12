'use client'

import {
  ArrowRightLeft,
  Copy,
  Download,
  FlaskConical,
  Link2,
  ListFilter,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

type EncodeScope = 'component' | 'url'
type Mode = 'encode' | 'decode'

interface QueryParamRow {
  key: string
  value: string
}

interface QueryParamResult {
  limited: boolean
  rows: QueryParamRow[]
  total: number
}

const MAX_URL_INPUT_CHARS = 120000
const MAX_URL_LIVE_CONVERSION_CHARS = 30000
const MAX_QUERY_PARSE_CHARS = 60000
const MAX_QUERY_COLLECT_ROWS = 160
const MAX_QUERY_ROWS = 24

const URL_SAMPLE = 'https://daily-tools.dev/search?q=hello world&tag=ui/glass&redirect=/tools?a=1'

const countPercentEscapes = (value: string) => value.match(/%[\da-f]{2}/giu)?.length ?? 0

const formatRatio = (inputLength: number, outputLength: number) => {
  if (inputLength === 0) return '0%'
  return `${Math.round((outputLength / inputLength) * 100)}%`
}

const transformUrlText = (
  value: string,
  mode: Mode,
  scope: EncodeScope,
  plusForSpaces: boolean
) => {
  if (mode === 'encode') {
    const encoded = scope === 'url' ? encodeURI(value) : encodeURIComponent(value)
    return plusForSpaces ? encoded.replace(/%20/gu, '+') : encoded
  }

  const decodeTarget = plusForSpaces ? value.replace(/\+/gu, '%20') : value
  return scope === 'url' ? decodeURI(decodeTarget) : decodeURIComponent(decodeTarget)
}

const transformInput = (
  value: string,
  mode: Mode,
  scope: EncodeScope,
  plusForSpaces: boolean,
  lineByLine: boolean
) => {
  if (!lineByLine) return transformUrlText(value, mode, scope, plusForSpaces)
  return value
    .split('\n')
    .map(line => transformUrlText(line, mode, scope, plusForSpaces))
    .join('\n')
}

const getLiveUrlInput = (value: string, mode: Mode) => {
  const preview = value.slice(0, MAX_URL_LIVE_CONVERSION_CHARS)
  if (mode !== 'decode' || preview.length === value.length) return preview

  const lastPercent = preview.lastIndexOf('%')
  if (lastPercent >= 0 && preview.length - lastPercent < 3) return preview.slice(0, lastPercent)
  return preview
}

const convertUrl = (
  value: string,
  mode: Mode,
  scope: EncodeScope,
  plusForSpaces: boolean,
  lineByLine: boolean
) => {
  try {
    return {
      errorKey: null as string | null,
      output: transformInput(value, mode, scope, plusForSpaces, lineByLine),
      success: true
    }
  } catch {
    return {
      errorKey: 'app.encryption.urlEncode.error.decode_failed',
      output: '',
      success: false
    }
  }
}

const emptyQueryResult = (): QueryParamResult => ({ limited: false, rows: [], total: 0 })

const collectQueryParams = (value: string): QueryParamResult => {
  const source =
    value.length > MAX_QUERY_PARSE_CHARS ? value.slice(0, MAX_QUERY_PARSE_CHARS) : value
  const trimmed = source.trim()
  if (!trimmed) return emptyQueryResult()

  let search = ''
  try {
    search = new URL(trimmed).search
  } catch {
    const questionIndex = trimmed.indexOf('?')
    search = questionIndex >= 0 ? trimmed.slice(questionIndex + 1) : trimmed
  }

  const hashIndex = search.indexOf('#')
  const queryText = (hashIndex >= 0 ? search.slice(0, hashIndex) : search).replace(/^\?/u, '')
  if (!/[=&]/u.test(queryText)) return emptyQueryResult()

  const params = new URLSearchParams(queryText)
  const rows: QueryParamRow[] = []
  let total = 0
  for (const [key, value] of params.entries()) {
    total += 1
    if (rows.length < MAX_QUERY_COLLECT_ROWS) rows.push({ key, value })
  }

  return {
    limited: value.length > MAX_QUERY_PARSE_CHARS || total > rows.length,
    rows,
    total
  }
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

export default function URLEncodeClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()

  const [mode, setMode] = useState<Mode>('encode')
  const [scope, setScope] = useState<EncodeScope>('component')
  const [plusForSpaces, setPlusForSpaces] = useState(false)
  const [lineByLine, setLineByLine] = useState(false)
  const [text, setText] = useState('')
  const [isInputCapped, setIsInputCapped] = useState(false)

  const deferredText = useDeferredValue(text)
  const deferredMode = useDeferredValue(mode)
  const deferredScope = useDeferredValue(scope)
  const deferredPlusForSpaces = useDeferredValue(plusForSpaces)
  const deferredLineByLine = useDeferredValue(lineByLine)

  const safeInput = useMemo(() => deferredText.slice(0, MAX_URL_INPUT_CHARS), [deferredText])
  const liveConversionDeferred = safeInput.length > MAX_URL_LIVE_CONVERSION_CHARS
  const liveInput = useMemo(
    () => getLiveUrlInput(safeInput, deferredMode),
    [deferredMode, safeInput]
  )

  const conversion = useMemo(() => {
    if (!liveInput) {
      return {
        error: null as string | null,
        errorKey: null as string | null,
        output: '',
        success: true
      }
    }

    const result = convertUrl(
      liveInput,
      deferredMode,
      deferredScope,
      deferredPlusForSpaces,
      deferredLineByLine
    )

    return {
      error: result.errorKey ? t(result.errorKey) : null,
      errorKey: result.errorKey,
      output: result.output,
      success: result.success
    }
  }, [deferredLineByLine, deferredMode, deferredPlusForSpaces, deferredScope, liveInput, t])
  const outputPreview = useMemo(() => createOutputPreview(conversion.output), [conversion.output])
  const outputPreviewLimited = isOutputPreviewLimited(conversion.output)

  const queryResult = useMemo(() => collectQueryParams(safeInput), [safeInput])
  const queryRows = queryResult.rows
  const visibleQueryRows = queryRows.slice(0, MAX_QUERY_ROWS)
  const percentEscapes = useMemo(
    () => countPercentEscapes(deferredMode === 'encode' ? conversion.output : safeInput),
    [conversion.output, deferredMode, safeInput]
  )

  const stats = useMemo(
    () => [
      { label: t('app.encryption.urlEncode.stats.input_chars'), value: safeInput.length },
      {
        label: t('app.encryption.urlEncode.stats.output_chars'),
        value: liveConversionDeferred ? `${conversion.output.length}+` : conversion.output.length
      },
      { label: t('app.encryption.urlEncode.stats.escapes'), value: percentEscapes },
      {
        label: t('app.encryption.urlEncode.stats.query'),
        value: queryResult.limited ? `${queryResult.total}+` : queryResult.total
      },
      {
        label: t('app.encryption.urlEncode.stats.ratio'),
        value: formatRatio(safeInput.length, conversion.output.length)
      }
    ],
    [
      conversion.output.length,
      liveConversionDeferred,
      percentEscapes,
      queryResult.limited,
      queryResult.total,
      safeInput.length,
      t
    ]
  )

  const warnings = useMemo(() => {
    const messages: string[] = []
    if (isInputCapped || deferredText.length > MAX_URL_INPUT_CHARS) {
      messages.push(t('app.encryption.urlEncode.warning.truncated', { count: MAX_URL_INPUT_CHARS }))
    }
    if (liveConversionDeferred) {
      messages.push(
        t('app.encryption.urlEncode.warning.live_output_deferred', {
          total: safeInput.length.toLocaleString(),
          visible: liveInput.length.toLocaleString()
        })
      )
    }
    return messages
  }, [
    deferredText.length,
    isInputCapped,
    liveConversionDeferred,
    liveInput.length,
    safeInput.length,
    t
  ])

  const updateText = useCallback((value: string) => {
    const isCapped = value.length > MAX_URL_INPUT_CHARS
    setIsInputCapped(isCapped)
    setText(isCapped ? value.slice(0, MAX_URL_INPUT_CHARS) : value)
  }, [])

  const loadSample = useCallback(() => {
    setMode('encode')
    setScope('url')
    setPlusForSpaces(false)
    setLineByLine(false)
    setIsInputCapped(false)
    setText(URL_SAMPLE)
  }, [])

  const buildCurrentOutput = useCallback(
    () => convertUrl(safeInput, mode, scope, plusForSpaces, lineByLine),
    [lineByLine, mode, plusForSpaces, safeInput, scope]
  )

  const handleUseOutput = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    updateText(result.output)
    setMode(current => (current === 'encode' ? 'decode' : 'encode'))
  }

  const handleCopyOutput = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    void copy(result.output)
  }

  const handleDownload = () => {
    const result = buildCurrentOutput()
    if (!result.success) {
      toast.error(t(result.errorKey ?? 'public.error'))
      return
    }
    downloadText(result.output, 'daily-tools-url-encoded.txt', 'text/plain;charset=utf-8')
  }

  const queryJson = useMemo(() => JSON.stringify(queryRows, null, 2), [queryRows])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.encryption.urlEncode')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.encryption.urlEncode.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={loadSample}
              >
                {t('app.encryption.urlEncode.sample')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => updateText('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {stats.map(item => (
              <div key={item.label} className="glass-input rounded-xl p-3">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Label>{t('app.encryption.urlEncode.mode')}</Label>
              <RadioGroup
                value={mode}
                onValueChange={value => setMode(value as Mode)}
                className="grid grid-cols-2 gap-2"
              >
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="encode" id="url-encode" />
                  <span className="text-sm font-medium">
                    {t('app.encryption.urlEncode.encode')}
                  </span>
                </label>
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="decode" id="url-decode" />
                  <span className="text-sm font-medium">
                    {t('app.encryption.urlEncode.decode')}
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="glass-input space-y-3 rounded-xl p-3">
              <div className="space-y-2">
                <Label htmlFor="url-scope">{t('app.encryption.urlEncode.scope')}</Label>
                <Select
                  id="url-scope"
                  value={scope}
                  onChange={event => setScope(event.target.value as EncodeScope)}
                >
                  <option value="component">{t('app.encryption.urlEncode.scope.component')}</option>
                  <option value="url">{t('app.encryption.urlEncode.scope.url')}</option>
                </Select>
              </div>
              <Checkbox
                checked={plusForSpaces}
                onChange={event => setPlusForSpaces(event.target.checked)}
                label={t('app.encryption.urlEncode.plus_for_spaces')}
              />
              <Checkbox
                checked={lineByLine}
                onChange={event => setLineByLine(event.target.checked)}
                label={t('app.encryption.urlEncode.line_by_line')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="url-input">{t('app.encryption.urlEncode.input')}</Label>
              <Textarea
                id="url-input"
                rows={11}
                value={text}
                onChange={event => updateText(event.target.value)}
                placeholder={
                  mode === 'encode'
                    ? t('app.encryption.urlEncode.encode_placeholder')
                    : t('app.encryption.urlEncode.decode_placeholder')
                }
                className="resize-none font-mono"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="url-output">{t('app.encryption.urlEncode.output')}</Label>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<ArrowRightLeft className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleUseOutput}
                  >
                    {t('app.encryption.urlEncode.use_output')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Download className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleDownload}
                  >
                    {t('app.encryption.urlEncode.download')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    disabled={!conversion.success || !safeInput}
                    onClick={handleCopyOutput}
                  >
                    {t('public.copy')}
                  </Button>
                </div>
              </div>
              <Textarea
                id="url-output"
                rows={11}
                value={outputPreview}
                readOnly
                placeholder={t('app.encryption.urlEncode.output_placeholder')}
                className="resize-none font-mono"
              />
              {outputPreviewLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_action_limited', {
                    total: conversion.output.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
            </div>
          </div>

          {warnings.map(message => (
            <p
              key={message}
              className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]"
            >
              {message}
            </p>
          ))}

          {conversion.error && (
            <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
              {conversion.error}
            </p>
          )}
        </CardContent>
      </Card>

      {queryRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListFilter className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.encryption.urlEncode.query_params')}
                </CardTitle>
                <CardDescription className="mt-2">
                  {t('app.encryption.urlEncode.query_params_hint', {
                    count: queryResult.total,
                    limit: MAX_QUERY_ROWS
                  })}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(queryJson)}
              >
                {t('app.encryption.urlEncode.copy_query_json')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--glass-panel-bg)]">
                  <tr>
                    <th className="px-3 py-2">{t('app.encryption.urlEncode.query_key')}</th>
                    <th className="px-3 py-2">{t('app.encryption.urlEncode.query_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleQueryRows.map((row, index) => (
                    <tr
                      key={`${row.key}-${index}`}
                      className="border-t border-[var(--border-base)]"
                    >
                      <td className="max-w-[240px] break-all px-3 py-2 font-mono">{row.key}</td>
                      <td className="break-all px-3 py-2 font-mono">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
