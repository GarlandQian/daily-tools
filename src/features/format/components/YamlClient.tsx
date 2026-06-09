'use client'

import {
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  ListTree,
  Minimize2,
  Sparkles
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import YAML from 'yaml'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type YamlAction = 'format' | 'minify' | 'yamlToJson' | 'jsonToYaml'
type YamlSample = 'yaml' | 'json' | 'docker' | 'github'

interface ParsedOutput {
  output: string
  error: string
  mode: YamlAction
  value: unknown
}

interface YamlMetrics {
  arrays: number
  booleans: number
  depth: number
  keys: number
  nulls: number
  numbers: number
  objects: number
  strings: number
}

interface YamlPathItem {
  path: string
  type: string
  value: string
}

const YAML_SAMPLE = `name: Daily Tools
version: 1
features:
  - YAML formatting
  - JSON conversion
  - validation
deploy:
  provider: Vercel
  runtime: static
`

const JSON_SAMPLE = `{
  "name": "Daily Tools",
  "features": ["YAML formatting", "JSON conversion", "validation"],
  "deploy": {
    "provider": "Vercel",
    "runtime": "static"
  }
}`

const DOCKER_SAMPLE = `version: "3.9"
services:
  web:
    image: daily-tools:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: "1"
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
volumes:
  redis-data:
`

const GITHUB_SAMPLE = `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
`

const YAML_SAMPLES: Record<YamlSample, string> = {
  docker: DOCKER_SAMPLE,
  github: GITHUB_SAMPLE,
  json: JSON_SAMPLE,
  yaml: YAML_SAMPLE
}

const MAX_YAML_INPUT_CHARS = 200000
const MAX_YAML_PATH_ITEMS = 80
const MAX_YAML_KEY_FREQUENCIES = 16
const yamlNumberFormatter = new Intl.NumberFormat()

const formatYamlNumber = (value: number) => yamlNumberFormatter.format(value)

const parseYaml = (input: string) => YAML.parse(input)

const stringifyYaml = (value: unknown, minify = false, indent = 2, sortMapEntries = false) =>
  YAML.stringify(value, {
    indent: minify ? 0 : indent,
    lineWidth: minify ? 0 : 100,
    sortMapEntries
  }).trim()

const getValueType = (value: unknown) => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const formatPathValue = (value: unknown) => {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${formatYamlNumber(value.length)}]`
  if (typeof value === 'object') return `{${formatYamlNumber(Object.keys(value).length)}}`
  return ''
}

const walkYamlValue = (
  value: unknown,
  path: string,
  metrics: YamlMetrics,
  paths: YamlPathItem[],
  keyCounts: Map<string, number>,
  depth = 0
) => {
  metrics.depth = Math.max(metrics.depth, depth)
  const type = getValueType(value)

  if (paths.length < MAX_YAML_PATH_ITEMS) {
    paths.push({
      path: path || '$',
      type,
      value: formatPathValue(value)
    })
  }

  if (value === null) {
    metrics.nulls += 1
    return
  }

  if (Array.isArray(value)) {
    metrics.arrays += 1
    value.forEach((item, index) =>
      walkYamlValue(item, `${path || '$'}[${index}]`, metrics, paths, keyCounts, depth + 1)
    )
    return
  }

  if (typeof value === 'object') {
    metrics.objects += 1
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      metrics.keys += 1
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
      walkYamlValue(child, `${path || '$'}.${key}`, metrics, paths, keyCounts, depth + 1)
    })
    return
  }

  if (typeof value === 'string') metrics.strings += 1
  if (typeof value === 'number') metrics.numbers += 1
  if (typeof value === 'boolean') metrics.booleans += 1
}

const analyzeYamlValue = (value: unknown) => {
  const metrics: YamlMetrics = {
    arrays: 0,
    booleans: 0,
    depth: 0,
    keys: 0,
    nulls: 0,
    numbers: 0,
    objects: 0,
    strings: 0
  }
  const paths: YamlPathItem[] = []
  const keyCounts = new Map<string, number>()

  walkYamlValue(value, '$', metrics, paths, keyCounts)

  return {
    keyFrequencies: [...keyCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, MAX_YAML_KEY_FREQUENCIES),
    metrics,
    paths
  }
}

const runAction = (
  input: string,
  action: YamlAction,
  indent: number,
  sortKeys: boolean
): ParsedOutput => {
  const trimmed = input.trim()
  if (!trimmed) {
    return {
      value: null,
      output: '',
      error: '',
      mode: action
    }
  }

  try {
    if (action === 'jsonToYaml') {
      const parsed = JSON.parse(trimmed) as unknown
      return {
        value: parsed,
        output: stringifyYaml(parsed, false, indent, sortKeys),
        error: '',
        mode: action
      }
    }

    const parsed = parseYaml(trimmed)

    if (action === 'yamlToJson') {
      return {
        value: parsed,
        output: JSON.stringify(parsed, null, 2),
        error: '',
        mode: action
      }
    }

    return {
      value: parsed,
      output: stringifyYaml(parsed, action === 'minify', indent, sortKeys),
      error: '',
      mode: action
    }
  } catch (error) {
    return {
      value: null,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      mode: action
    }
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

const YamlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [input, setInput] = useState(YAML_SAMPLE)
  const [action, setAction] = useState<YamlAction>('format')
  const [indent, setIndent] = useState(2)
  const [sortKeys, setSortKeys] = useState(false)
  const deferredInput = useDeferredValue(input)
  const isInputTooLarge = deferredInput.length > MAX_YAML_INPUT_CHARS
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_YAML_INPUT_CHARS
        ? deferredInput.slice(0, MAX_YAML_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )

  const parsed = useMemo(
    () =>
      isInputTooLarge
        ? { error: '', mode: action, output: '', value: null }
        : runAction(safeInput, action, indent, sortKeys),
    [action, indent, isInputTooLarge, safeInput, sortKeys]
  )
  const hasInput = input.trim().length > 0
  const lineCount = useMemo(() => safeInput.split(/\r\n|\r|\n/).length, [safeInput])
  const outputLineCount = useMemo(
    () => (parsed.output ? parsed.output.split(/\r\n|\r|\n/).length : 0),
    [parsed.output]
  )
  const analysis = useMemo(() => {
    if (parsed.error || !hasInput || parsed.value === null) return null
    return analyzeYamlValue(parsed.value)
  }, [hasInput, parsed.error, parsed.value])
  const outputExtension = parsed.mode === 'yamlToJson' ? 'json' : 'yaml'
  const outputMime =
    parsed.mode === 'yamlToJson' ? 'application/json;charset=utf-8' : 'text/yaml;charset=utf-8'

  const handleCopy = useCallback(async () => {
    if (!parsed.output) return

    try {
      await navigator.clipboard.writeText(parsed.output)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [parsed.output, toast, t])

  const handleDownload = useCallback(() => {
    if (!parsed.output) return
    downloadText(parsed.output, `daily-tools.${outputExtension}`, outputMime)
  }, [outputExtension, outputMime, parsed.output])

  const handleUseSample = useCallback((sample: YamlSample) => {
    setInput(YAML_SAMPLES[sample])
    setAction(sample === 'json' ? 'jsonToYaml' : 'format')
  }, [])

  const handleApplyOutput = useCallback(() => {
    if (!parsed.output) return
    setInput(parsed.output)
    setAction(parsed.mode === 'yamlToJson' ? 'jsonToYaml' : 'format')
  }, [parsed.mode, parsed.output])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle>{t('app.format.yaml')}</CardTitle>
            <CardDescription>{t('app.format.yaml.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={action === 'format' ? 'primary' : 'default'}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => setAction('format')}
            >
              {t('app.format.yaml.format')}
            </Button>
            <Button
              type="button"
              variant={action === 'minify' ? 'primary' : 'default'}
              icon={<Minimize2 className="h-4 w-4" />}
              onClick={() => setAction('minify')}
            >
              {t('app.format.yaml.minify')}
            </Button>
            <Button
              type="button"
              variant={action === 'yamlToJson' ? 'primary' : 'default'}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              onClick={() => setAction('yamlToJson')}
            >
              {t('app.format.yaml.to_json')}
            </Button>
            <Button
              type="button"
              variant={action === 'jsonToYaml' ? 'primary' : 'default'}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              onClick={() => setAction('jsonToYaml')}
            >
              {t('app.format.yaml.to_yaml')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['yaml', 'json', 'docker', 'github'] as const).map(sample => (
              <Button
                key={sample}
                type="button"
                size="sm"
                variant="default"
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                onClick={() => handleUseSample(sample)}
              >
                {t(`app.format.yaml.sample.${sample}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="yaml-indent">{t('app.format.yaml.indent')}</Label>
              <Select
                id="yaml-indent"
                value={String(indent)}
                onChange={event => setIndent(Number(event.target.value))}
              >
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="6">6</option>
              </Select>
            </div>
            <div className="glass-input flex min-h-12 items-center rounded-xl px-3">
              <Checkbox
                checked={sortKeys}
                onChange={event => setSortKeys(event.target.checked)}
                label={t('app.format.yaml.sort_keys')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <YamlMetric label={t('app.format.yaml.metric.lines')} value={formatYamlNumber(lineCount)} />
        <YamlMetric
          label={t('app.format.yaml.metric.output_lines')}
          value={formatYamlNumber(outputLineCount)}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.keys')}
          value={formatYamlNumber(analysis?.metrics.keys ?? 0)}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.depth')}
          value={formatYamlNumber(analysis?.metrics.depth ?? 0)}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.objects')}
          value={formatYamlNumber(analysis?.metrics.objects ?? 0)}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.arrays')}
          value={formatYamlNumber(analysis?.metrics.arrays ?? 0)}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.scalars')}
          value={formatYamlNumber(
            (analysis?.metrics.strings ?? 0) +
              (analysis?.metrics.numbers ?? 0) +
              (analysis?.metrics.booleans ?? 0) +
              (analysis?.metrics.nulls ?? 0)
          )}
        />
        <YamlMetric
          label={t('app.format.yaml.metric.chars')}
          value={formatYamlNumber(safeInput.length)}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.yaml.input')}</CardTitle>
              <CardDescription>
                {t('app.format.yaml.stats', {
                  lines: lineCount,
                  chars: input.length
                })}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" onClick={() => setInput('')}>
              {t('public.clear')}
            </Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            {isInputTooLarge && (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t('app.format.yaml.warning.too_large', {
                  limit: formatYamlNumber(MAX_YAML_INPUT_CHARS)
                })}
              </p>
            )}
            <Label htmlFor="yaml-input" className="sr-only">
              {t('app.format.yaml.input')}
            </Label>
            <Textarea
              id="yaml-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.yaml.placeholder')}
              spellCheck={false}
              className="min-h-[320px] flex-1 resize-none font-mono text-sm leading-6"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.yaml.output')}</CardTitle>
              <CardDescription>
                {parsed.error
                  ? t('app.format.yaml.invalid')
                  : hasInput
                    ? t('app.format.yaml.valid')
                    : t('app.format.yaml.empty')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                disabled={!parsed.output}
                onClick={handleCopy}
              >
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<Download className="h-4 w-4" />}
                disabled={!parsed.output}
                onClick={handleDownload}
              >
                {t('app.format.yaml.download')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                disabled={!parsed.output}
                onClick={handleApplyOutput}
              >
                {t('app.format.yaml.use_output')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            {parsed.error ? (
              <div className="rounded-2xl border border-[var(--error)] bg-[var(--error-subtle)] p-4 font-mono text-sm leading-6 text-[var(--text-primary)]">
                {parsed.error}
              </div>
            ) : parsed.output ? (
              <pre className="glass-input min-h-[320px] flex-1 overflow-auto rounded-lg p-4 text-sm leading-6">
                <code className="font-mono text-[var(--text-primary)]">{parsed.output}</code>
              </pre>
            ) : (
              <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-center">
                <div className="max-w-sm space-y-3">
                  <div className="glass-panel glass-shimmer glass-clip mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                    <CheckCircle2 className="h-7 w-7 text-[var(--text-secondary)]" />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {t('app.format.yaml.empty_description')}
                  </p>
                </div>
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
              {t('app.format.yaml.outline')}
            </CardTitle>
            <CardDescription>{t('app.format.yaml.outline_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis?.paths.length ? (
              <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
                {analysis.paths.map(item => (
                  <div
                    key={`${item.path}-${item.type}`}
                    className="glass-input grid min-w-0 gap-2 rounded-lg p-3 text-sm md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)]"
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
                {t('app.format.yaml.outline_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.yaml.key_frequency')}</CardTitle>
            <CardDescription>{t('app.format.yaml.key_frequency_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis?.keyFrequencies.length ? (
              <div className="flex flex-wrap gap-2">
                {analysis.keyFrequencies.map(item => (
                  <span
                    key={item.key}
                    className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-1.5 text-sm"
                  >
                    <span className="truncate font-mono text-[var(--text-primary)]">
                      {item.key}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {formatYamlNumber(item.count)}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="glass-panel-static rounded-xl p-4 text-sm text-[var(--text-secondary)]">
                {t('app.format.yaml.key_frequency_empty')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const YamlMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

export default YamlClient
