'use client'

import { ArrowRightLeft, Copy, FlaskConical, Link2, ListFilter, Trash2 } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type EncodeScope = 'component' | 'url'
type Mode = 'encode' | 'decode'

interface QueryParamRow {
  key: string
  value: string
}

const MAX_URL_INPUT_CHARS = 120000
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

const collectQueryParams = (value: string): QueryParamRow[] => {
  const trimmed = value.trim()
  if (!trimmed) return []

  let search = ''
  try {
    search = new URL(trimmed).search
  } catch {
    const questionIndex = trimmed.indexOf('?')
    search = questionIndex >= 0 ? trimmed.slice(questionIndex + 1) : trimmed
  }

  const hashIndex = search.indexOf('#')
  const queryText = (hashIndex >= 0 ? search.slice(0, hashIndex) : search).replace(/^\?/u, '')
  if (!/[=&]/u.test(queryText)) return []

  const params = new URLSearchParams(queryText)
  return Array.from(params.entries()).map(([key, value]) => ({ key, value }))
}

export default function URLEncodeClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [mode, setMode] = useState<Mode>('encode')
  const [scope, setScope] = useState<EncodeScope>('component')
  const [plusForSpaces, setPlusForSpaces] = useState(false)
  const [lineByLine, setLineByLine] = useState(false)
  const [text, setText] = useState('')

  const deferredText = useDeferredValue(text)
  const deferredMode = useDeferredValue(mode)
  const deferredScope = useDeferredValue(scope)
  const deferredPlusForSpaces = useDeferredValue(plusForSpaces)
  const deferredLineByLine = useDeferredValue(lineByLine)

  const safeInput = useMemo(() => deferredText.slice(0, MAX_URL_INPUT_CHARS), [deferredText])

  const conversion = useMemo(() => {
    if (!safeInput) {
      return { error: null as string | null, output: '', success: true }
    }

    try {
      return {
        error: null,
        output: transformInput(
          safeInput,
          deferredMode,
          deferredScope,
          deferredPlusForSpaces,
          deferredLineByLine
        ),
        success: true
      }
    } catch {
      return {
        error: t('app.encryption.urlEncode.error.decode_failed'),
        output: '',
        success: false
      }
    }
  }, [deferredLineByLine, deferredMode, deferredPlusForSpaces, deferredScope, safeInput, t])

  const queryRows = useMemo(() => collectQueryParams(safeInput), [safeInput])
  const visibleQueryRows = queryRows.slice(0, MAX_QUERY_ROWS)
  const percentEscapes = useMemo(
    () => countPercentEscapes(deferredMode === 'encode' ? conversion.output : safeInput),
    [conversion.output, deferredMode, safeInput]
  )

  const stats = useMemo(
    () => [
      { label: t('app.encryption.urlEncode.stats.input_chars'), value: safeInput.length },
      { label: t('app.encryption.urlEncode.stats.output_chars'), value: conversion.output.length },
      { label: t('app.encryption.urlEncode.stats.escapes'), value: percentEscapes },
      { label: t('app.encryption.urlEncode.stats.query'), value: queryRows.length },
      {
        label: t('app.encryption.urlEncode.stats.ratio'),
        value: formatRatio(safeInput.length, conversion.output.length)
      }
    ],
    [conversion.output.length, percentEscapes, queryRows.length, safeInput.length, t]
  )

  const warning =
    deferredText.length > MAX_URL_INPUT_CHARS
      ? t('app.encryption.urlEncode.warning.truncated', { count: MAX_URL_INPUT_CHARS })
      : null

  const loadSample = useCallback(() => {
    setMode('encode')
    setScope('url')
    setPlusForSpaces(false)
    setLineByLine(false)
    setText(URL_SAMPLE)
  }, [])

  const handleUseOutput = () => {
    setText(conversion.output)
    setMode(current => (current === 'encode' ? 'decode' : 'encode'))
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
                onClick={() => setText('')}
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
                onChange={event => setText(event.target.value)}
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
                    disabled={!conversion.success || !conversion.output}
                    onClick={handleUseOutput}
                  >
                    {t('app.encryption.urlEncode.use_output')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    disabled={!conversion.success || !conversion.output}
                    onClick={() => copy(conversion.output)}
                  >
                    {t('public.copy')}
                  </Button>
                </div>
              </div>
              <Textarea
                id="url-output"
                rows={11}
                value={conversion.output}
                readOnly
                placeholder={t('app.encryption.urlEncode.output_placeholder')}
                className="resize-none font-mono"
              />
            </div>
          </div>

          {warning && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {warning}
            </p>
          )}

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
                    count: queryRows.length,
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
