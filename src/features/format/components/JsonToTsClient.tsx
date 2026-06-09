'use client'

import {
  Braces,
  Copy,
  Download,
  FileCode2,
  ListTree,
  RotateCcw,
  Sparkles,
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
import { useCopy } from '@/hooks/useCopy'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type OutputStyle = 'interface' | 'type'
type JsonSample = 'product' | 'api' | 'array' | 'settings'

interface GenerateOptions {
  optionalMissing: boolean
  outputStyle: OutputStyle
  readonlyProps: boolean
  nullableAsOptional: boolean
}

interface JsonPathItem {
  path: string
  type: string
  value: string
}

const SAMPLE_JSON = JSON.stringify(
  {
    id: 'tool_123',
    name: 'Daily Tools',
    published: true,
    tags: ['developer', 'utility'],
    owner: {
      name: 'Garland',
      url: 'https://example.com'
    },
    metrics: {
      users: 1200,
      rating: 4.8
    }
  },
  null,
  2
)

const API_SAMPLE_JSON = JSON.stringify(
  {
    page: 1,
    pageSize: 2,
    results: [
      {
        id: 'evt_001',
        type: 'deploy',
        actor: { id: 'user_1', name: 'Ada' },
        status: 'success',
        durationMs: 1280
      },
      {
        id: 'evt_002',
        type: 'build',
        actor: { id: 'user_2', name: 'Grace' },
        status: 'failed',
        error: null
      }
    ]
  },
  null,
  2
)

const ARRAY_SAMPLE_JSON = JSON.stringify(
  [
    { id: 1, title: 'Format YAML', tags: ['format', 'yaml'], pinned: true },
    { id: 2, title: 'Generate token', tags: ['security'], expiresAt: null },
    { id: 3, title: 'Preview PDF', tags: ['preview', 'file'], pinned: false }
  ],
  null,
  2
)

const SETTINGS_SAMPLE_JSON = JSON.stringify(
  {
    theme: 'system',
    locales: ['en', 'zh-CN'],
    featureFlags: {
      commandPalette: true,
      betaCharts: false
    },
    limits: {
      maxUploadMb: 50,
      maxRows: 1000
    }
  },
  null,
  2
)

const JSON_SAMPLES: Record<JsonSample, { input: string; rootName: string }> = {
  api: { input: API_SAMPLE_JSON, rootName: 'ApiResponse' },
  array: { input: ARRAY_SAMPLE_JSON, rootName: 'TaskList' },
  product: { input: SAMPLE_JSON, rootName: 'Tool' },
  settings: { input: SETTINGS_SAMPLE_JSON, rootName: 'AppSettings' }
}

const MAX_JSON2TS_INPUT_CHARS = 200000
const MAX_JSON2TS_PATH_ITEMS = 80
const MAX_JSON2TS_ENUM_VALUES = 8
const jsonToTsNumberFormatter = new Intl.NumberFormat()

const isRecord = (value: JsonValue): value is { [key: string]: JsonValue } =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const formatJsonToTsNumber = (value: number) => jsonToTsNumberFormatter.format(value)

const toPascalCase = (value: string) => {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const next = words.map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('')
  if (!next) return 'Generated'
  return /^\d/.test(next) ? `Type${next}` : next
}

const toSingularName = (value: string) => {
  const pascal = toPascalCase(value)
  if (pascal.endsWith('ies')) return `${pascal.slice(0, -3)}y`
  if (pascal.endsWith('s') && pascal.length > 1) return pascal.slice(0, -1)
  return `${pascal}Item`
}

const formatPropertyName = (key: string) =>
  /^[$A-Z_a-z][$\w]*$/.test(key) ? key : JSON.stringify(key)

const unionTypes = (types: string[]) => {
  const unique = [...new Set(types)]
  if (!unique.length) return 'unknown'
  if (unique.length === 1) return unique[0]
  return unique.sort().join(' | ')
}

const getJsonValueType = (value: JsonValue) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const formatJsonPathValue = (value: JsonValue) => {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${formatJsonToTsNumber(value.length)}]`
  return `{${formatJsonToTsNumber(Object.keys(value).length)}}`
}

const analyzeJson = (value: JsonValue) => {
  let objects = 0
  let arrays = 0
  let properties = 0
  let maxDepth = 0
  let nullable = 0
  const paths: JsonPathItem[] = []
  const enumCandidates = new Map<string, Set<string>>()
  const heterogeneousArrays = new Set<string>()

  const visit = (node: JsonValue, depth: number, path = '$') => {
    maxDepth = Math.max(maxDepth, depth)

    if (paths.length < MAX_JSON2TS_PATH_ITEMS) {
      paths.push({
        path,
        type: getJsonValueType(node),
        value: formatJsonPathValue(node)
      })
    }

    if (Array.isArray(node)) {
      arrays += 1
      const itemTypes = new Set(node.map(getJsonValueType))
      if (itemTypes.size > 1) heterogeneousArrays.add(path)
      node.forEach((item, index) => visit(item, depth + 1, `${path}[${index}]`))
      return
    }

    if (isRecord(node)) {
      objects += 1
      properties += Object.keys(node).length
      Object.entries(node).forEach(([key, item]) => {
        if (item === null) nullable += 1
        if (typeof item === 'string') {
          const values = enumCandidates.get(key) ?? new Set<string>()
          if (values.size < MAX_JSON2TS_ENUM_VALUES) values.add(item)
          enumCandidates.set(key, values)
        }
        visit(item, depth + 1, `${path}.${key}`)
      })
    }
  }

  visit(value, 1)

  return {
    arrays,
    enumCandidates: [...enumCandidates.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([key, values]) => ({ key, values: [...values] }))
      .slice(0, 8),
    heterogeneousArrays: [...heterogeneousArrays].slice(0, 8),
    maxDepth,
    nullable,
    objects,
    paths,
    properties
  }
}

const generateTypes = (value: JsonValue, rootName: string, options: GenerateOptions) => {
  const definitions: string[] = []
  const usedNames = new Map<string, number>()
  const optionalKeysByNode = new WeakMap<object, Set<string>>()
  const unionValuesByNode = new WeakMap<object, Map<string, JsonValue[]>>()

  const mergeObjectArray = (items: { [key: string]: JsonValue }[]) => {
    const keys = new Set(items.flatMap(item => Object.keys(item)))
    const merged: { [key: string]: JsonValue } = {}
    const optionalKeys = new Set<string>()
    const unionValues = new Map<string, JsonValue[]>()

    keys.forEach(key => {
      const values = items
        .map(item => item[key])
        .filter((item): item is JsonValue => item !== undefined)

      if (values.length < items.length) optionalKeys.add(key)
      unionValues.set(key, values)
      merged[key] = values[0] ?? null
    })

    optionalKeysByNode.set(merged, optionalKeys)
    unionValuesByNode.set(merged, unionValues)
    return merged
  }

  const reserveName = (rawName: string) => {
    const baseName = toPascalCase(rawName)
    const current = usedNames.get(baseName) ?? 0
    usedNames.set(baseName, current + 1)
    return current === 0 ? baseName : `${baseName}${current + 1}`
  }

  const infer = (node: JsonValue, nameHint: string): string => {
    if (node === null) return 'null'
    if (typeof node === 'string') return 'string'
    if (typeof node === 'number') return 'number'
    if (typeof node === 'boolean') return 'boolean'

    if (Array.isArray(node)) {
      if (!node.length) return 'unknown[]'
      const itemName = toSingularName(nameHint)
      const objectItems = node.filter(isRecord)
      const itemTypes =
        objectItems.length === node.length && objectItems.length > 1
          ? [infer(mergeObjectArray(objectItems), itemName)]
          : node.map(item => infer(item, itemName))
      return `Array<${unionTypes(itemTypes)}>`
    }

    const interfaceName = reserveName(nameHint)
    const optionalKeys = optionalKeysByNode.get(node)
    const unionValues = unionValuesByNode.get(node)
    const lines = Object.entries(node).map(([key, child]) => {
      const nullable = child === null
      const missingInMergedArray = options.optionalMissing && optionalKeys?.has(key)
      const optional = (options.nullableAsOptional && nullable) || missingInMergedArray ? '?' : ''
      const typeValues = unionValues?.get(key)
      const type =
        options.nullableAsOptional && nullable
          ? 'unknown'
          : typeValues
            ? unionTypes(typeValues.map(item => infer(item, key)))
            : infer(child, key)
      const readonly = options.readonlyProps ? 'readonly ' : ''

      return `  ${readonly}${formatPropertyName(key)}${optional}: ${type}`
    })

    definitions.push(
      options.outputStyle === 'type'
        ? `export type ${interfaceName} = {\n${lines.join('\n')}\n}`
        : `export interface ${interfaceName} {\n${lines.join('\n')}\n}`
    )
    return interfaceName
  }

  const sanitizedRootName = toPascalCase(rootName)
  const rootType = infer(value, sanitizedRootName)
  const output = [...definitions]

  if (!isRecord(value)) {
    output.push(`export type ${sanitizedRootName} = ${rootType}`)
  }

  return output.join('\n\n')
}

const parseJson = (input: string): { data: JsonValue | null; error: string | null } => {
  if (!input.trim()) return { data: null, error: null }

  try {
    return { data: JSON.parse(input) as JsonValue, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Invalid JSON' }
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

const JsonToTsClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_JSON)
  const [rootName, setRootName] = useState('Root')
  const [readonlyProps, setReadonlyProps] = useState(false)
  const [nullableAsOptional, setNullableAsOptional] = useState(false)
  const [optionalMissing, setOptionalMissing] = useState(true)
  const [outputStyle, setOutputStyle] = useState<OutputStyle>('interface')
  const deferredInput = useDeferredValue(input)
  const isInputTooLarge = deferredInput.length > MAX_JSON2TS_INPUT_CHARS

  const parsed = useMemo(
    () => (isInputTooLarge ? { data: null, error: null } : parseJson(deferredInput)),
    [deferredInput, isInputTooLarge]
  )
  const analysis = useMemo(
    () => (parsed.data === null ? null : analyzeJson(parsed.data)),
    [parsed.data]
  )
  const output = useMemo(() => {
    if (parsed.data === null) return ''
    return generateTypes(parsed.data, rootName, {
      nullableAsOptional,
      optionalMissing,
      outputStyle,
      readonlyProps
    })
  }, [nullableAsOptional, optionalMissing, outputStyle, parsed.data, readonlyProps, rootName])

  const handleReset = () => {
    setInput(SAMPLE_JSON)
    setRootName('Root')
    setReadonlyProps(false)
    setNullableAsOptional(false)
    setOptionalMissing(true)
    setOutputStyle('interface')
  }

  const handleSample = (sample: JsonSample) => {
    setInput(JSON_SAMPLES[sample].input)
    setRootName(JSON_SAMPLES[sample].rootName)
  }

  const handleDownload = () => {
    if (!output) return
    downloadText(output, 'daily-tools-types.ts', 'text/typescript;charset=utf-8')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.json2ts')}
              </CardTitle>
              <CardDescription>{t('app.format.json2ts.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('public.copy')}
              </Button>
              <Button
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={handleDownload}
                disabled={!output}
              >
                {t('app.format.json2ts.download')}
              </Button>
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['product', 'api', 'array', 'settings'] as const).map(sample => (
              <Button
                key={sample}
                type="button"
                size="sm"
                variant="outline"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleSample(sample)}
              >
                {t(`app.format.json2ts.sample.${sample}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="json2ts-root">{t('app.format.json2ts.root_name')}</Label>
              <Input
                id="json2ts-root"
                value={rootName}
                onChange={event => setRootName(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="json2ts-style">{t('app.format.json2ts.output_style')}</Label>
              <Select
                id="json2ts-style"
                value={outputStyle}
                onChange={event => setOutputStyle(event.target.value as OutputStyle)}
              >
                <option value="interface">{t('app.format.json2ts.output_style.interface')}</option>
                <option value="type">{t('app.format.json2ts.output_style.type')}</option>
              </Select>
            </div>
          </div>

          <div className="glass-input grid grid-cols-1 gap-2 rounded-xl p-3 md:grid-cols-3">
            <Checkbox
              checked={readonlyProps}
              onChange={event => setReadonlyProps(event.target.checked)}
              label={t('app.format.json2ts.readonly')}
            />
            <Checkbox
              checked={nullableAsOptional}
              onChange={event => setNullableAsOptional(event.target.checked)}
              label={t('app.format.json2ts.optional_null')}
            />
            <Checkbox
              checked={optionalMissing}
              onChange={event => setOptionalMissing(event.target.checked)}
              label={t('app.format.json2ts.optional_missing')}
            />
          </div>

          {analysis && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <Metric
                label={t('app.format.json2ts.objects')}
                value={formatJsonToTsNumber(analysis.objects)}
              />
              <Metric
                label={t('app.format.json2ts.arrays')}
                value={formatJsonToTsNumber(analysis.arrays)}
              />
              <Metric
                label={t('app.format.json2ts.properties')}
                value={formatJsonToTsNumber(analysis.properties)}
              />
              <Metric
                label={t('app.format.json2ts.depth')}
                value={formatJsonToTsNumber(analysis.maxDepth)}
              />
              <Metric
                label={t('app.format.json2ts.nullable')}
                value={formatJsonToTsNumber(analysis.nullable)}
              />
              <Metric
                label={t('app.format.json2ts.paths')}
                value={formatJsonToTsNumber(analysis.paths.length)}
              />
            </div>
          )}

          {isInputTooLarge && (
            <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.format.json2ts.warning.too_large', {
                limit: formatJsonToTsNumber(MAX_JSON2TS_INPUT_CHARS)
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Braces className="h-4 w-4 text-[var(--primary)]" />
                JSON
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setInput('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.json2ts.placeholder')}
              className="h-full min-h-[360px] resize-none font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              TypeScript
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {parsed.error ? (
              <div className="glass-input flex h-full min-h-[360px] items-center justify-center rounded-xl p-6 text-center">
                <p className="max-w-md text-sm leading-6 text-[var(--error)]">{parsed.error}</p>
              </div>
            ) : output ? (
              <pre className="glass-input h-full min-h-[360px] overflow-auto rounded-xl p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">
                {output}
              </pre>
            ) : (
              <div className="glass-input flex h-full min-h-[360px] items-center justify-center rounded-xl p-6 text-center">
                <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.format.json2ts.empty')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.json2ts.paths_panel')}
            </CardTitle>
            <CardDescription>{t('app.format.json2ts.paths_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis?.paths.length ? (
              <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
                {analysis.paths.map(item => (
                  <div
                    key={`${item.path}-${item.type}`}
                    className="glass-input grid min-w-0 gap-2 rounded-lg p-3 text-sm md:grid-cols-[minmax(0,1.4fr)_100px_minmax(0,1fr)]"
                  >
                    <div className="min-w-0 truncate font-mono text-[var(--text-primary)]">
                      {item.path}
                    </div>
                    <div className="font-mono text-xs text-[var(--text-secondary)]">
                      {item.type}
                    </div>
                    <div className="min-w-0 truncate font-mono text-xs text-[var(--text-tertiary)]">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel-static rounded-xl p-4 text-sm text-[var(--text-secondary)]">
                {t('app.format.json2ts.paths_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.json2ts.insights')}</CardTitle>
            <CardDescription>{t('app.format.json2ts.insights_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-[var(--text-tertiary)]">
                {t('app.format.json2ts.enum_candidates')}
              </div>
              {analysis?.enumCandidates.length ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.enumCandidates.map(item => (
                    <span
                      key={item.key}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1.5 text-sm"
                    >
                      <span className="truncate font-mono text-[var(--text-primary)]">
                        {item.key}
                      </span>
                      <span className="font-mono text-xs text-[var(--text-tertiary)]">
                        {item.values.join(' | ')}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('app.format.json2ts.enum_empty')}
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase text-[var(--text-tertiary)]">
                {t('app.format.json2ts.array_warnings')}
              </div>
              {analysis?.heterogeneousArrays.length ? (
                <div className="space-y-2">
                  {analysis.heterogeneousArrays.map(path => (
                    <div
                      key={path}
                      className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 font-mono text-xs text-[var(--warning)]"
                    >
                      {path}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('app.format.json2ts.array_warnings_empty')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-4">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default JsonToTsClient
