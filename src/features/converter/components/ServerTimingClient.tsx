'use client'

import {
  Activity,
  Copy,
  Download,
  FileJson,
  Gauge,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type AuditSeverity = 'error' | 'ok' | 'warn'
type OutputFormat = 'cloudflare' | 'csv' | 'headers' | 'json' | 'next' | 'nginx'

interface TimingMetric {
  desc: string
  dur: string
  name: string
}

interface ServerTimingDraft {
  includeTao: boolean
  metrics: TimingMetric[]
  routePattern: string
  tao: string
}

interface TimingPreset {
  key: string
  value: ServerTimingDraft
  workspace: string
}

interface ParsedMetric extends TimingMetric {
  raw: string
}

interface ParsedHeaders {
  errors: string[]
  metrics: ParsedMetric[]
  raw: Array<{ name: string; value: string }>
  tao: string
}

interface AuditItem {
  detail?: string
  key: string
  severity: AuditSeverity
  title: string
}

const MAX_WORKSPACE_LENGTH = 12000
const OUTPUT_FORMATS: OutputFormat[] = ['headers', 'next', 'nginx', 'cloudflare', 'json', 'csv']
const METRIC_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

const DEFAULT_DRAFT: ServerTimingDraft = {
  includeTao: true,
  metrics: [
    { desc: 'Application total', dur: '83.2', name: 'app' },
    { desc: 'Database query', dur: '24.7', name: 'db' },
    { desc: 'Cache lookup', dur: '3.1', name: 'cache' }
  ],
  routePattern: '/api/:path*',
  tao: 'https://app.example.com'
}

const PRESETS: TimingPreset[] = [
  {
    key: 'api',
    value: DEFAULT_DRAFT,
    workspace:
      'Server-Timing: app;dur=83.2;desc="Application total", db;dur=24.7;desc="Database query", cache;dur=3.1;desc="Cache lookup"\nTiming-Allow-Origin: https://app.example.com'
  },
  {
    key: 'edge',
    value: {
      includeTao: true,
      metrics: [
        { desc: 'Edge worker', dur: '12.4', name: 'edge' },
        { desc: 'Origin fetch', dur: '58.9', name: 'origin' },
        { desc: 'CDN cache', dur: '1.6', name: 'cdn' }
      ],
      routePattern: '/:path*',
      tao: 'https://www.example.com'
    },
    workspace:
      'Server-Timing: edge;dur=12.4;desc="Edge worker", origin;dur=58.9;desc="Origin fetch", cdn;dur=1.6;desc="CDN cache"\nTiming-Allow-Origin: https://www.example.com'
  },
  {
    key: 'database',
    value: {
      includeTao: false,
      metrics: [
        { desc: 'SQL prepare', dur: '5.7', name: 'sql_prepare' },
        { desc: 'SQL execute', dur: '42.1', name: 'sql_exec' },
        { desc: 'Serialize JSON', dur: '8.8', name: 'serialize' }
      ],
      routePattern: '/api/reports',
      tao: ''
    },
    workspace:
      'Server-Timing: sql_prepare;dur=5.7;desc="SQL prepare", sql_exec;dur=42.1;desc="SQL execute", serialize;dur=8.8;desc="Serialize JSON"'
  },
  {
    key: 'risk',
    value: {
      includeTao: true,
      metrics: [
        { desc: 'Private user lookup, contains comma', dur: '-5', name: 'db' },
        { desc: 'Duplicate metric', dur: '2000', name: 'db' },
        { desc: 'Bad name', dur: 'abc', name: '1bad' }
      ],
      routePattern: '/account/*',
      tao: '*'
    },
    workspace:
      'Server-Timing: db;dur=-5;desc="Private user lookup, contains comma", db;dur=2000;desc="Duplicate metric", 1bad;dur=abc;desc="Bad name"\nTiming-Allow-Origin: *'
  }
]

const splitHeaderEntries = (value: string) => {
  const entries: string[] = []
  let current = ''
  let quote = ''
  let escaped = false

  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char
      current += char
      continue
    }

    if (char === quote) {
      quote = ''
      current += char
      continue
    }

    if (char === ',' && !quote) {
      if (current.trim()) entries.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) entries.push(current.trim())
  return entries
}

const unquote = (value: string) =>
  value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\"/g, '"')
const quoteDesc = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const formatMetric = (metric: TimingMetric) => {
  const parts = [metric.name.trim()]
  if (metric.dur.trim()) parts.push(`dur=${metric.dur.trim()}`)
  if (metric.desc.trim()) parts.push(`desc=${quoteDesc(metric.desc.trim())}`)
  return parts.join(';')
}

const buildHeaders = (draft: ServerTimingDraft) => {
  const lines = [`Server-Timing: ${draft.metrics.map(formatMetric).join(', ')}`]
  if (draft.includeTao && draft.tao.trim()) lines.push(`Timing-Allow-Origin: ${draft.tao.trim()}`)
  return lines
}

const buildOutput = (draft: ServerTimingDraft, format: OutputFormat) => {
  const lines = buildHeaders(draft)
  const headerObjects = lines.map(line => {
    const [name, ...valueParts] = line.split(':')
    return { key: name.trim(), value: valueParts.join(':').trim() }
  })

  if (format === 'next') {
    return [
      'export async function headers() {',
      '  return [',
      '    {',
      `      source: ${JSON.stringify(draft.routePattern || '/:path*')},`,
      `      headers: ${JSON.stringify(headerObjects, null, 8).replace(/\n/g, '\n      ')}`,
      '    }',
      '  ]',
      '}'
    ].join('\n')
  }

  if (format === 'nginx') {
    return headerObjects
      .map(header => `add_header ${header.key} ${JSON.stringify(header.value)} always;`)
      .join('\n')
  }

  if (format === 'cloudflare') {
    return [
      'export default {',
      '  async fetch(request, env, ctx) {',
      '    const started = Date.now()',
      '    const response = await env.ASSETS.fetch(request)',
      '    const next = new Response(response.body, response)',
      `    next.headers.set('Server-Timing', ${JSON.stringify(draft.metrics.map(formatMetric).join(', '))})`,
      `    next.headers.set('Timing-Allow-Origin', ${JSON.stringify(draft.tao || '*')})`,
      "    next.headers.append('Server-Timing', `worker;dur=${Date.now() - started}`)",
      '    return next',
      '  }',
      '}'
    ].join('\n')
  }

  if (format === 'json') {
    return JSON.stringify(
      {
        headers: Object.fromEntries(headerObjects.map(header => [header.key, header.value])),
        metrics: draft.metrics,
        routePattern: draft.routePattern
      },
      null,
      2
    )
  }

  if (format === 'csv') {
    return [
      'name,dur,desc',
      ...draft.metrics.map(metric =>
        [metric.name, metric.dur, metric.desc]
          .map(value => `"${value.replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n')
  }

  return lines.join('\n')
}

const parseServerTimingValue = (value: string) =>
  splitHeaderEntries(value).map(entry => {
    const [rawName = '', ...paramParts] = entry.split(';')
    const metric: ParsedMetric = {
      desc: '',
      dur: '',
      name: rawName.trim(),
      raw: entry
    }

    paramParts.forEach(part => {
      const [rawKey = '', ...valueParts] = part.split('=')
      const key = rawKey.trim().toLowerCase()
      const nextValue = valueParts.join('=').trim()
      if (key === 'dur') metric.dur = nextValue
      if (key === 'desc') metric.desc = unquote(nextValue)
    })

    return metric
  })

const parseHeaders = (workspace: string): ParsedHeaders => {
  const raw: ParsedHeaders['raw'] = []
  const errors: string[] = []
  const metrics: ParsedMetric[] = []
  let tao = ''

  workspace.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([^:#]+)\s*:\s*(.+)\s*$/)
    if (!match?.[1] || !match[2]) return
    const name = match[1].trim()
    const value = match[2].trim()
    raw.push({ name, value })

    if (name.toLowerCase() === 'server-timing') {
      try {
        metrics.push(...parseServerTimingValue(value))
      } catch {
        errors.push(value)
      }
    }

    if (name.toLowerCase() === 'timing-allow-origin') tao = value
  })

  return { errors, metrics, raw, tao }
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const ServerTimingClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ServerTimingDraft>(DEFAULT_DRAFT)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('headers')
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const deferredWorkspace = useDeferredValue(workspace)

  const output = useMemo(() => buildOutput(draft, outputFormat), [draft, outputFormat])
  const parsed = useMemo(() => parseHeaders(deferredWorkspace), [deferredWorkspace])
  const workspaceTruncated = workspace.length >= MAX_WORKSPACE_LENGTH

  const audits = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = []
    const names = draft.metrics.map(metric => metric.name.trim()).filter(Boolean)
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index)

    draft.metrics.forEach((metric, index) => {
      if (!METRIC_NAME_PATTERN.test(metric.name.trim())) {
        items.push({
          key: `name_${index}`,
          severity: 'error',
          title: t('app.converter.server_timing.audit.bad_name'),
          detail: metric.name || `${index + 1}`
        })
      }

      const duration = Number(metric.dur)
      if (metric.dur.trim() && (!Number.isFinite(duration) || duration < 0)) {
        items.push({
          key: `dur_${index}`,
          severity: 'error',
          title: t('app.converter.server_timing.audit.bad_duration'),
          detail: metric.dur
        })
      }

      if (duration > 1000) {
        items.push({
          key: `slow_${index}`,
          severity: 'warn',
          title: t('app.converter.server_timing.audit.slow_duration'),
          detail: `${metric.name}: ${metric.dur}ms`
        })
      }

      if (/user|email|token|account|private/i.test(metric.desc)) {
        items.push({
          key: `sensitive_${index}`,
          severity: 'warn',
          title: t('app.converter.server_timing.audit.sensitive_desc'),
          detail: metric.desc
        })
      }
    })

    if (duplicateNames.length) {
      items.push({
        key: 'duplicates',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.duplicate_names'),
        detail: Array.from(new Set(duplicateNames)).join(', ')
      })
    }

    if (draft.metrics.length > 8) {
      items.push({
        key: 'too_many',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.too_many')
      })
    }

    if (draft.includeTao && draft.tao.trim() === '*') {
      items.push({
        key: 'tao_wildcard',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.tao_wildcard')
      })
    }

    if (parsed.errors.length) {
      items.push({
        key: 'parse_error',
        severity: 'error',
        title: t('app.converter.server_timing.audit.parse_error'),
        detail: parsed.errors.join(', ')
      })
    }

    if (!parsed.metrics.length) {
      items.push({
        key: 'parse_missing',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.parse_missing')
      })
    } else {
      const parsedDuplicates = parsed.metrics
        .map(metric => metric.name)
        .filter((name, index, all) => name && all.indexOf(name) !== index)
      items.push({
        key: 'parse_ok',
        severity: 'ok',
        title: t('app.converter.server_timing.audit.parse_ok'),
        detail: `${parsed.metrics.length}`
      })
      if (parsedDuplicates.length) {
        items.push({
          key: 'parsed_duplicates',
          severity: 'warn',
          title: t('app.converter.server_timing.audit.parsed_duplicates'),
          detail: Array.from(new Set(parsedDuplicates)).join(', ')
        })
      }
    }

    if (parsed.tao === '*') {
      items.push({
        key: 'parsed_tao_wildcard',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.parsed_tao_wildcard')
      })
    }

    if (workspaceTruncated) {
      items.push({
        key: 'workspace_truncated',
        severity: 'warn',
        title: t('app.converter.server_timing.audit.workspace_truncated'),
        detail: `${MAX_WORKSPACE_LENGTH}`
      })
    }

    if (!items.some(item => item.severity !== 'ok')) {
      items.push({
        key: 'baseline',
        severity: 'ok',
        title: t('app.converter.server_timing.audit.baseline_ok')
      })
    }

    return items
  }, [draft, parsed.errors, parsed.metrics, parsed.tao, t, workspaceTruncated])

  const counts = useMemo(
    () => ({
      error: audits.filter(item => item.severity === 'error').length,
      metrics: draft.metrics.length,
      parsed: parsed.metrics.length,
      warn: audits.filter(item => item.severity === 'warn').length
    }),
    [audits, draft.metrics.length, parsed.metrics.length]
  )

  const updateMetric = useCallback((index: number, next: Partial<TimingMetric>) => {
    setDraft(prev => ({
      ...prev,
      metrics: prev.metrics.map((metric, metricIndex) =>
        metricIndex === index ? { ...metric, ...next } : metric
      )
    }))
  }, [])

  const removeMetric = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, metricIndex) => metricIndex !== index)
    }))
  }, [])

  const addMetric = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      metrics: [
        ...prev.metrics,
        { desc: 'New metric', dur: '10', name: `m${prev.metrics.length + 1}` }
      ]
    }))
  }, [])

  const applyPreset = useCallback((preset: TimingPreset) => {
    setDraft(preset.value)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setOutputFormat('headers')
    setWorkspace(PRESETS[0]?.workspace ?? '')
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.server_timing')}
              </CardTitle>
              <CardDescription>{t('app.converter.server_timing.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={reset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              icon={<Gauge className="h-4 w-4" />}
              label={t('app.converter.server_timing.metric.status')}
              value={
                counts.error
                  ? t('app.converter.server_timing.status.error')
                  : counts.warn
                    ? t('app.converter.server_timing.status.warn')
                    : t('app.converter.server_timing.status.ok')
              }
            />
            <Metric
              label={t('app.converter.server_timing.metric.metrics')}
              value={counts.metrics}
            />
            <Metric label={t('app.converter.server_timing.metric.parsed')} value={counts.parsed} />
            <Metric label={t('app.converter.server_timing.metric.warnings')} value={counts.warn} />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => applyPreset(preset)}
              >
                {t(`app.converter.server_timing.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.server_timing.builder')}</CardTitle>
            <CardDescription>{t('app.converter.server_timing.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="server-timing-route">
                  {t('app.converter.server_timing.route_pattern')}
                </Label>
                <Input
                  id="server-timing-route"
                  value={draft.routePattern}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, routePattern: event.target.value.slice(0, 120) }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="server-timing-tao">{t('app.converter.server_timing.tao')}</Label>
                <Input
                  id="server-timing-tao"
                  value={draft.tao}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, tao: event.target.value.slice(0, 200) }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>

            <Checkbox
              checked={draft.includeTao}
              onChange={event => setDraft(prev => ({ ...prev, includeTao: event.target.checked }))}
              label={t('app.converter.server_timing.include_tao')}
            />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label>{t('app.converter.server_timing.metrics')}</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={addMetric}
                >
                  {t('public.add')}
                </Button>
              </div>

              <div className="space-y-3">
                {draft.metrics.map((metric, index) => (
                  <div
                    key={`${metric.name}-${index}`}
                    className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,0.35fr)_minmax(0,0.25fr)_minmax(0,1fr)_auto]">
                      <Input
                        value={metric.name}
                        onChange={event =>
                          updateMetric(index, { name: event.target.value.slice(0, 64) })
                        }
                        aria-label={t('app.converter.server_timing.name')}
                        className="font-mono"
                        spellCheck={false}
                      />
                      <Input
                        value={metric.dur}
                        onChange={event =>
                          updateMetric(index, { dur: event.target.value.slice(0, 24) })
                        }
                        aria-label={t('app.converter.server_timing.duration')}
                        className="font-mono"
                        spellCheck={false}
                      />
                      <Input
                        value={metric.desc}
                        onChange={event =>
                          updateMetric(index, { desc: event.target.value.slice(0, 160) })
                        }
                        aria-label={t('app.converter.server_timing.description_field')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => removeMetric(index)}
                        aria-label={t('public.delete')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.server_timing.workspace')}</CardTitle>
            <CardDescription>{t('app.converter.server_timing.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, MAX_WORKSPACE_LENGTH))}
              className="min-h-[300px] font-mono"
              spellCheck={false}
              placeholder={t('app.converter.server_timing.workspace_placeholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => setWorkspace(buildOutput(draft, 'headers'))}
              >
                {t('app.converter.server_timing.use_output')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setWorkspace('')}>
                {t('public.clear')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {parsed.metrics.slice(0, 8).map((metric, index) => (
                <div
                  key={`${metric.raw}-${index}`}
                  className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3"
                >
                  <div className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {metric.name}
                  </div>
                  <div className="mt-1 break-all text-xs text-[var(--text-secondary)]">
                    {metric.dur ? `${metric.dur}ms` : '-'} ·{' '}
                    {metric.desc || t('app.converter.server_timing.no_desc')}
                  </div>
                </div>
              ))}
              {!parsed.metrics.length ? (
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3 text-sm text-[var(--text-secondary)]">
                  {t('app.converter.server_timing.no_parsed')}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.server_timing.audit')}</CardTitle>
            <CardDescription>{t('app.converter.server_timing.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {audits.map(item => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      item.severity === 'error'
                        ? 'rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-500'
                        : item.severity === 'warn'
                          ? 'rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600'
                          : 'rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-600'
                    }
                  >
                    {t(`app.converter.server_timing.severity.${item.severity}`)}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                </div>
                {item.detail ? (
                  <p className="mt-2 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.server_timing.output')}</CardTitle>
            <CardDescription>{t('app.converter.server_timing.output_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-3">
                <Label htmlFor="server-timing-output">
                  {t('app.converter.server_timing.output_format')}
                </Label>
                <Select
                  id="server-timing-output"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  {OUTPUT_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.converter.server_timing.output.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(output)}
                className="self-end"
              >
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    output,
                    outputFormat === 'csv' ? 'server-timing.csv' : 'server-timing.txt',
                    outputFormat === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'
                  )
                }
                className="self-end"
              >
                {t('app.converter.server_timing.download')}
              </Button>
            </div>

            <div className="glass-input min-h-[320px] rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <FileJson className="h-4 w-4" />
                {t(`app.converter.server_timing.output.${outputFormat}`)}
              </div>
              <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {output}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 break-all font-mono text-xl font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default ServerTimingClient
