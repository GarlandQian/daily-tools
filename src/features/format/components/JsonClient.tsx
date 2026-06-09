'use client'

import {
  ArrowDownAZ,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  ListTree,
  Minimize2,
  Paintbrush,
  SearchCode,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonMode = 'format' | 'minify'
type IndentSize = '2' | '4' | 'tab'

interface JsonStats {
  arrays: number
  booleans: number
  bytes: number
  characters: number
  depth: number
  keys: number
  lines: number
  nulls: number
  numbers: number
  objects: number
  strings: number
}

interface JsonPathEntry {
  path: string
  preview: string
  type: string
}

const JSON_SAMPLE = JSON.stringify(
  {
    app: 'Daily Tools',
    locale: 'en',
    features: ['format', 'inspect', 'export'],
    release: {
      version: '2.4.0',
      stable: true,
      channels: [
        { name: 'web', enabled: true },
        { name: 'desktop', enabled: false }
      ]
    },
    metrics: {
      tools: 122,
      latencyMs: 38,
      score: null
    }
  },
  null,
  2
)

const MAX_JSON_FORMAT_INPUT_CHARS = 200000
const MAX_JSON_PATH_ROWS = 80
const jsonNumberFormatter = new Intl.NumberFormat()

const formatJsonNumber = (value: number) => jsonNumberFormatter.format(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getIndent = (indentSize: IndentSize) => {
  if (indentSize === 'tab') return '\t'
  return Number(indentSize)
}

const sortJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => sortJsonKeys(item))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => [key, sortJsonKeys(item)])
  )
}

const getJsonType = (value: unknown) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const previewJsonValue = (value: unknown) => {
  const next = typeof value === 'string' ? value : JSON.stringify(value)
  if (!next) return ''
  return next.length > 96 ? `${next.slice(0, 96)}...` : next
}

const appendJsonPath = (basePath: string, key: string | number) => {
  if (typeof key === 'number') return `${basePath}[${key}]`
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${basePath}.${key}`
    : `${basePath}[${JSON.stringify(key)}]`
}

const analyzeJson = (value: JsonValue, source: string): JsonStats => {
  const stats: JsonStats = {
    arrays: 0,
    booleans: 0,
    bytes: new TextEncoder().encode(source).length,
    characters: source.length,
    depth: 0,
    keys: 0,
    lines: source ? source.split(/\r?\n/).length : 0,
    nulls: 0,
    numbers: 0,
    objects: 0,
    strings: 0
  }

  const stack: Array<{ depth: number; value: JsonValue }> = [{ depth: 1, value }]

  while (stack.length) {
    const current = stack.pop()
    if (!current) continue

    stats.depth = Math.max(stats.depth, current.depth)

    if (Array.isArray(current.value)) {
      stats.arrays += 1
      for (const item of current.value) stack.push({ depth: current.depth + 1, value: item })
      continue
    }

    if (isRecord(current.value)) {
      const values = Object.values(current.value) as JsonValue[]
      stats.objects += 1
      stats.keys += values.length
      for (const item of values) stack.push({ depth: current.depth + 1, value: item })
      continue
    }

    if (current.value === null) {
      stats.nulls += 1
    } else if (typeof current.value === 'string') {
      stats.strings += 1
    } else if (typeof current.value === 'number') {
      stats.numbers += 1
    } else if (typeof current.value === 'boolean') {
      stats.booleans += 1
    }
  }

  return stats
}

const collectPaths = (value: JsonValue) => {
  const paths: JsonPathEntry[] = []
  const stack: Array<{ path: string; value: JsonValue }> = [{ path: '$', value }]

  while (stack.length && paths.length < MAX_JSON_PATH_ROWS) {
    const current = stack.pop()
    if (!current) continue

    paths.push({
      path: current.path,
      preview: previewJsonValue(current.value),
      type: getJsonType(current.value)
    })

    if (Array.isArray(current.value)) {
      for (let index = Math.min(current.value.length - 1, 40); index >= 0; index -= 1) {
        stack.push({ path: appendJsonPath(current.path, index), value: current.value[index] })
      }
    } else if (isRecord(current.value)) {
      const entries = Object.entries(current.value).slice(0, 80)
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, item] = entries[index]
        stack.push({ path: appendJsonPath(current.path, key), value: item as JsonValue })
      }
    }
  }

  return paths
}

const parsePathSegments = (path: string) => {
  const source = path.trim()
  if (!source || source === '$') return []
  const normalized = source.startsWith('$') ? source.slice(1) : source
  const segments: Array<string | number> = []
  let index = 0

  while (index < normalized.length) {
    const char = normalized[index]

    if (char === '.') {
      index += 1
      const start = index
      while (index < normalized.length && /[A-Za-z0-9_$-]/.test(normalized[index])) index += 1
      if (start === index) return null
      segments.push(normalized.slice(start, index))
      continue
    }

    if (char === '[') {
      const close = normalized.indexOf(']', index)
      if (close === -1) return null
      const raw = normalized.slice(index + 1, close).trim()

      if (/^\d+$/.test(raw)) {
        segments.push(Number(raw))
      } else {
        try {
          const parsed = JSON.parse(raw) as unknown
          if (typeof parsed !== 'string') return null
          segments.push(parsed)
        } catch {
          return null
        }
      }

      index = close + 1
      continue
    }

    const start = index
    while (index < normalized.length && /[A-Za-z0-9_$-]/.test(normalized[index])) index += 1
    if (start === index) return null
    segments.push(normalized.slice(start, index))
  }

  return segments
}

const getPathValue = (value: JsonValue, path: string) => {
  const segments = parsePathSegments(path)
  if (!segments) return { error: 'invalid', value: undefined }

  let current: unknown = value

  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current) || segment >= current.length)
        return { error: 'missing', value: undefined }
      current = current[segment]
      continue
    }

    if (!isRecord(current) || !(segment in current)) return { error: 'missing', value: undefined }
    current = current[segment]
  }

  return { error: '', value: current as JsonValue }
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

const JsonClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<JsonMode>('format')
  const [indentSize, setIndentSize] = useState<IndentSize>('2')
  const [sortKeys, setSortKeys] = useState(false)
  const [jsonPath, setJsonPath] = useState('$.release.channels[0].name')
  const deferredInput = useDeferredValue(input)
  const deferredPath = useDeferredValue(jsonPath)
  const isInputTooLarge = deferredInput.length > MAX_JSON_FORMAT_INPUT_CHARS
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_JSON_FORMAT_INPUT_CHARS
        ? deferredInput.slice(0, MAX_JSON_FORMAT_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )

  const parsed = useMemo(() => {
    const trimmed = safeInput.trim()
    if (!trimmed || isInputTooLarge) {
      return { data: undefined as JsonValue | undefined, error: '', valid: false }
    }

    try {
      return { data: JSON.parse(trimmed) as JsonValue, error: '', valid: true }
    } catch (error) {
      return {
        data: undefined,
        error: error instanceof Error ? error.message : String(error),
        valid: false
      }
    }
  }, [isInputTooLarge, safeInput])

  const normalizedJson = useMemo<JsonValue | undefined>(() => {
    if (!parsed.valid || parsed.data === undefined) return undefined
    return (sortKeys ? sortJsonKeys(parsed.data) : parsed.data) as JsonValue
  }, [parsed.data, parsed.valid, sortKeys])

  const output = useMemo(() => {
    if (!parsed.valid || normalizedJson === undefined) return ''
    return JSON.stringify(normalizedJson, null, mode === 'minify' ? 0 : getIndent(indentSize))
  }, [indentSize, mode, normalizedJson, parsed.valid])

  const stats = useMemo(
    () => (parsed.valid && parsed.data !== undefined ? analyzeJson(parsed.data, safeInput) : null),
    [parsed.data, parsed.valid, safeInput]
  )

  const pathRows = useMemo(
    () => (parsed.valid && parsed.data !== undefined ? collectPaths(parsed.data) : []),
    [parsed.data, parsed.valid]
  )

  const extracted = useMemo(() => {
    if (!parsed.valid || parsed.data === undefined || !deferredPath.trim()) {
      return { error: '', output: '' }
    }

    const result = getPathValue(parsed.data, deferredPath)
    if (result.error) return { error: result.error, output: '' }
    return { error: '', output: JSON.stringify(result.value, null, 2) }
  }, [deferredPath, parsed.data, parsed.valid])

  const hasInput = input.trim().length > 0
  const canUseOutput = Boolean(output)

  const handleCopyOutput = () => {
    if (output) void copy(output)
  }

  const handleCopyExtracted = () => {
    if (extracted.output) void copy(extracted.output)
  }

  const handleValidate = () => {
    if (!hasInput) {
      toast.warning(t('app.format.json.empty'))
      return
    }

    if (isInputTooLarge) {
      toast.warning(
        t('app.format.json.warning.too_large', {
          limit: formatJsonNumber(MAX_JSON_FORMAT_INPUT_CHARS)
        })
      )
      return
    }

    if (parsed.valid) {
      toast.success(t('app.format.json.valid'))
    } else if (parsed.error) {
      toast.error(`${t('app.format.json.error')}: ${parsed.error}`)
    }
  }

  const handleDownload = () => {
    if (!output) return
    downloadText(
      output,
      `daily-tools-json.${mode === 'minify' ? 'min.json' : 'json'}`,
      'application/json;charset=utf-8'
    )
  }

  const handleUseSample = () => {
    setInput(JSON_SAMPLE)
    setMode('format')
    setIndentSize('2')
    setSortKeys(false)
    setJsonPath('$.release.channels[0].name')
  }

  const handleUseOutput = () => {
    if (!output) return
    setInput(output)
  }

  const handleClear = () => {
    setInput('')
    setMode('format')
    setIndentSize('2')
    setSortKeys(false)
    setJsonPath('$.release.channels[0].name')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.json')}
            </CardTitle>
            <CardDescription>{t('app.format.json.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === 'format' ? 'primary' : 'default'}
              icon={<Paintbrush className="h-4 w-4" />}
              onClick={() => setMode('format')}
            >
              {t('app.format.json.format')}
            </Button>
            <Button
              type="button"
              variant={mode === 'minify' ? 'primary' : 'default'}
              icon={<Minimize2 className="h-4 w-4" />}
              onClick={() => setMode('minify')}
            >
              {t('app.format.json.minify')}
            </Button>
            <Button
              type="button"
              icon={<CheckCircle2 className="h-4 w-4" />}
              disabled={!hasInput}
              onClick={handleValidate}
            >
              {t('app.format.json.validate')}
            </Button>
            <Button
              type="button"
              icon={<Copy className="h-4 w-4" />}
              onClick={handleCopyOutput}
              disabled={!output}
            >
              {t('public.copy')}
            </Button>
            <Button
              type="button"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownload}
              disabled={!output}
            >
              {t('app.format.json.download')}
            </Button>
            <Button type="button" icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
              {t('public.clear')}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="json-indent">{t('app.format.json.indent')}</Label>
              <Select
                id="json-indent"
                value={indentSize}
                disabled={mode === 'minify'}
                onChange={event => setIndentSize(event.target.value as IndentSize)}
              >
                <option value="2">{t('app.format.json.indent.2')}</option>
                <option value="4">{t('app.format.json.indent.4')}</option>
                <option value="tab">{t('app.format.json.indent.tab')}</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Checkbox
                checked={sortKeys}
                onChange={event => setSortKeys(event.target.checked)}
                label={
                  <span className="inline-flex items-center gap-2">
                    <ArrowDownAZ className="h-4 w-4 text-[var(--primary)]" />
                    {t('app.format.json.sort_keys')}
                  </span>
                }
              />
              <Button
                type="button"
                size="sm"
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                onClick={handleUseSample}
              >
                {t('app.format.json.sample')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Paintbrush className="h-3.5 w-3.5" />}
                onClick={handleUseOutput}
                disabled={!canUseOutput}
              >
                {t('app.format.json.use_output')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <JsonMetric
            label={t('app.format.json.metric.characters')}
            value={formatJsonNumber(stats.characters)}
          />
          <JsonMetric
            label={t('app.format.json.metric.bytes')}
            value={formatJsonNumber(stats.bytes)}
          />
          <JsonMetric
            label={t('app.format.json.metric.lines')}
            value={formatJsonNumber(stats.lines)}
          />
          <JsonMetric
            label={t('app.format.json.metric.keys')}
            value={formatJsonNumber(stats.keys)}
          />
          <JsonMetric
            label={t('app.format.json.metric.objects')}
            value={formatJsonNumber(stats.objects)}
          />
          <JsonMetric
            label={t('app.format.json.metric.arrays')}
            value={formatJsonNumber(stats.arrays)}
          />
          <JsonMetric
            label={t('app.format.json.metric.values')}
            value={formatJsonNumber(stats.strings + stats.numbers + stats.booleans + stats.nulls)}
          />
          <JsonMetric
            label={t('app.format.json.metric.depth')}
            value={formatJsonNumber(stats.depth)}
          />
        </div>
      )}

      {isInputTooLarge && (
        <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
          {t('app.format.json.warning.too_large', {
            limit: formatJsonNumber(MAX_JSON_FORMAT_INPUT_CHARS)
          })}
        </p>
      )}

      {parsed.error && (
        <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
          {t('app.format.json.error')}: {parsed.error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.json.input')}</CardTitle>
              <CardDescription>
                {hasInput
                  ? t('app.format.json.input_hint', { count: input.length })
                  : t('app.format.json.empty')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.json.input_placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.json.output')}</CardTitle>
              <CardDescription>
                {parsed.valid ? t('app.format.json.valid') : t('app.format.json.output_hint')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={output}
              readOnly
              placeholder={t('app.format.json.output_placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchCode className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.json.path_extract')}
            </CardTitle>
            <CardDescription>{t('app.format.json.path_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="json-path">{t('app.format.json.path')}</Label>
              <Input
                id="json-path"
                value={jsonPath}
                onChange={event => setJsonPath(event.target.value)}
                placeholder="$.release.channels[0].name"
                className="font-mono"
              />
            </div>
            {extracted.error ? (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t(`app.format.json.path_${extracted.error}`)}
              </p>
            ) : (
              <Textarea
                value={extracted.output}
                readOnly
                placeholder={t('app.format.json.path_empty')}
                className="min-h-32 resize-none font-mono"
              />
            )}
            <Button
              type="button"
              size="sm"
              icon={<Copy className="h-3.5 w-3.5" />}
              disabled={!extracted.output}
              onClick={handleCopyExtracted}
            >
              {t('app.format.json.copy_path')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.json.path_preview')}
            </CardTitle>
            <CardDescription>
              {t('app.format.json.path_preview_hint', {
                limit: formatJsonNumber(MAX_JSON_PATH_ROWS)
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pathRows.length ? (
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {pathRows.map(row => (
                  <button
                    key={row.path}
                    type="button"
                    onClick={() => setJsonPath(row.path)}
                    className="grid w-full min-w-0 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2 text-left md:grid-cols-[minmax(0,0.55fr)_92px_minmax(0,0.45fr)] md:items-center"
                  >
                    <span className="truncate font-mono text-xs text-[var(--text-primary)]">
                      {row.path}
                    </span>
                    <span className="w-fit rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                      {row.type}
                    </span>
                    <span className="truncate font-mono text-xs text-[var(--text-tertiary)]">
                      {row.preview}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4 text-sm text-[var(--text-secondary)]">
                {t('app.format.json.path_preview_empty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const JsonMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default JsonClient
