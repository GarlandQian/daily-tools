'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  Gauge,
  ListChecks,
  Search,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const HEADER_GROUPS = ['all', 'standard', 'legacy', 'retry', 'problem'] as const
const OUTPUT_TYPES = ['raw', 'next', 'express', 'nginx', 'cloudflare', 'json'] as const
const STATUS_VALUES = ['200', '202', '429', '503'] as const
const RATE_INPUT_LIMIT = 28000
const RATE_ROW_LIMIT = 140

type HeaderGroup = (typeof HEADER_GROUPS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type StatusValue = (typeof STATUS_VALUES)[number]
type PresetKey =
  | 'basic_api'
  | 'burst_api'
  | 'user_minute'
  | 'upload_quota'
  | 'throttled_429'
  | 'legacy_compat'
type FindingLevel = 'good' | 'warn' | 'danger'

interface RateDraft {
  includeLegacy: boolean
  partitionKey: string
  policyName: string
  quota: string
  quotaUnit: string
  remaining: string
  resetAfter: string
  retryAfter: string
  status: StatusValue
  window: string
}

interface HeaderInfo {
  example: string
  group: Exclude<HeaderGroup, 'all'>
  name: string
  noteKey: string
}

interface Preset {
  draft: RateDraft
  key: PresetKey
  workspace: string
}

interface ParsedHeader {
  group: Exclude<HeaderGroup, 'all'>
  name: string
  raw: string
  values: Record<string, string>
}

interface Finding {
  key: string
  level: FindingLevel
  target: string
}

const DEFAULT_DRAFT: RateDraft = {
  includeLegacy: true,
  partitionKey: '',
  policyName: 'api',
  quota: '100',
  quotaUnit: '',
  remaining: '72',
  resetAfter: '60',
  retryAfter: '',
  status: '200',
  window: '60'
}

const HEADER_REFERENCE: HeaderInfo[] = [
  {
    name: 'RateLimit-Policy',
    example: 'RateLimit-Policy: "api";q=100;w=60',
    group: 'standard',
    noteKey: 'app.converter.rate_limit.header.policy'
  },
  {
    name: 'RateLimit',
    example: 'RateLimit: "api";r=72;t=60',
    group: 'standard',
    noteKey: 'app.converter.rate_limit.header.ratelimit'
  },
  {
    name: 'Retry-After',
    example: 'Retry-After: 30',
    group: 'retry',
    noteKey: 'app.converter.rate_limit.header.retry_after'
  },
  {
    name: 'X-RateLimit-Limit',
    example: 'X-RateLimit-Limit: 100',
    group: 'legacy',
    noteKey: 'app.converter.rate_limit.header.x_limit'
  },
  {
    name: 'X-RateLimit-Remaining',
    example: 'X-RateLimit-Remaining: 72',
    group: 'legacy',
    noteKey: 'app.converter.rate_limit.header.x_remaining'
  },
  {
    name: 'X-RateLimit-Reset',
    example: 'X-RateLimit-Reset: 60',
    group: 'legacy',
    noteKey: 'app.converter.rate_limit.header.x_reset'
  },
  {
    name: 'application/problem+json',
    example: '{ "type": "quota-exceeded", "status": 429 }',
    group: 'problem',
    noteKey: 'app.converter.rate_limit.header.problem'
  }
]

const PRESETS: Preset[] = [
  {
    key: 'basic_api',
    draft: DEFAULT_DRAFT,
    workspace: [
      'RateLimit-Policy: "api";q=100;w=60',
      'RateLimit: "api";r=72;t=60',
      'X-RateLimit-Limit: 100',
      'X-RateLimit-Remaining: 72',
      'X-RateLimit-Reset: 60'
    ].join('\n')
  },
  {
    key: 'burst_api',
    draft: {
      ...DEFAULT_DRAFT,
      policyName: 'burst',
      quota: '1000',
      remaining: '125',
      resetAfter: '10',
      window: '10'
    },
    workspace: [
      'RateLimit-Policy: "burst";q=1000;w=10',
      'RateLimit: "burst";r=125;t=10',
      'X-RateLimit-Limit: 1000',
      'X-RateLimit-Remaining: 125',
      'X-RateLimit-Reset: 10'
    ].join('\n')
  },
  {
    key: 'user_minute',
    draft: {
      ...DEFAULT_DRAFT,
      partitionKey: 'user',
      policyName: 'peruser',
      quota: '60',
      remaining: '8',
      resetAfter: '43',
      window: '60'
    },
    workspace: [
      'RateLimit-Policy: "peruser";q=60;w=60;pk=:dXNlcg==:',
      'RateLimit: "peruser";r=8;t=43'
    ].join('\n')
  },
  {
    key: 'upload_quota',
    draft: {
      ...DEFAULT_DRAFT,
      policyName: 'upload',
      quota: '104857600',
      quotaUnit: 'content-bytes',
      remaining: '52428800',
      resetAfter: '3600',
      window: '3600'
    },
    workspace: [
      'RateLimit-Policy: "upload";q=104857600;qu="content-bytes";w=3600',
      'RateLimit: "upload";r=52428800;t=3600'
    ].join('\n')
  },
  {
    key: 'throttled_429',
    draft: {
      ...DEFAULT_DRAFT,
      policyName: 'dynamic',
      quota: '100',
      remaining: '0',
      resetAfter: '30',
      retryAfter: '30',
      status: '429',
      window: '60'
    },
    workspace: [
      'HTTP/1.1 429 Too Many Requests',
      'Retry-After: 30',
      'RateLimit-Policy: "dynamic";q=100;w=60',
      'RateLimit: "dynamic";r=0;t=30'
    ].join('\n')
  },
  {
    key: 'legacy_compat',
    draft: {
      ...DEFAULT_DRAFT,
      includeLegacy: true,
      policyName: 'legacy',
      quota: '5000',
      remaining: '4200',
      resetAfter: '86400',
      window: '86400'
    },
    workspace: [
      'X-RateLimit-Limit: 5000',
      'X-RateLimit-Remaining: 4200',
      'X-RateLimit-Reset: 86400'
    ].join('\n')
  }
]

const normalizeInteger = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return normalized

  return String(Math.max(0, Math.floor(numeric)))
}

const safePolicyName = (value: string) => value.trim().replace(/[^\w.-]/gu, '') || 'api'

const buildRateHeaders = (draft: RateDraft) => {
  const name = safePolicyName(draft.policyName)
  const quota = normalizeInteger(draft.quota) || '100'
  const window = normalizeInteger(draft.window) || '60'
  const remaining = normalizeInteger(draft.remaining) || '0'
  const resetAfter = normalizeInteger(draft.resetAfter) || window
  const retryAfter = normalizeInteger(draft.retryAfter)
  const quotaUnit = draft.quotaUnit.trim()
  const partitionKey = draft.partitionKey.trim()
  const policyParts = [`"${name}"`, `q=${quota}`]
  const rows: Array<[string, string]> = []

  if (quotaUnit) policyParts.push(`qu="${quotaUnit.replaceAll('"', '')}"`)
  policyParts.push(`w=${window}`)
  if (partitionKey) policyParts.push(`pk="${partitionKey.replaceAll('"', '')}"`)

  if (retryAfter) rows.push(['Retry-After', retryAfter])
  rows.push(['RateLimit-Policy', policyParts.join(';')])
  rows.push(['RateLimit', `"${name}";r=${remaining};t=${resetAfter}`])

  if (draft.includeLegacy) {
    rows.push(['X-RateLimit-Limit', quota])
    rows.push(['X-RateLimit-Remaining', remaining])
    rows.push(['X-RateLimit-Reset', resetAfter])
  }

  return rows
}

const parseStructuredParams = (value: string) => {
  const params: Record<string, string> = {}
  const parts = value
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
  const first = parts.shift()

  if (first) params.name = first.replace(/^"|"$/gu, '')

  for (const part of parts) {
    const separator = part.indexOf('=')
    if (separator === -1) {
      params[part.toLowerCase()] = 'true'
    } else {
      params[part.slice(0, separator).trim().toLowerCase()] = part
        .slice(separator + 1)
        .trim()
        .replace(/^"|"$/gu, '')
    }
  }

  return params
}

const parseRateWorkspace = (input: string) => {
  const rows: ParsedHeader[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, RATE_INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || /^http\/\d(?:\.\d)?\s+\d+/iu.test(trimmed)) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue
    const name = trimmed.slice(0, separator).trim()
    const lowerName = name.toLowerCase()
    const value = trimmed.slice(separator + 1).trim()
    let group: ParsedHeader['group'] | null = null
    let values: Record<string, string> = {}

    if (lowerName === 'ratelimit-policy') {
      group = 'standard'
      values = parseStructuredParams(value)
    } else if (lowerName === 'ratelimit') {
      group = 'standard'
      values = parseStructuredParams(value)
    } else if (lowerName === 'retry-after') {
      group = 'retry'
      values = { retryAfter: value }
    } else if (/^x-rate-?limit-/iu.test(lowerName)) {
      group = 'legacy'
      values = { value }
    }

    if (!group || !value) continue

    const key = `${lowerName}:${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ group, name, raw: value, values })
    if (rows.length >= RATE_ROW_LIMIT) break
  }

  return rows
}

const firstHeader = (headers: ParsedHeader[], name: string) =>
  headers.find(header => header.name.toLowerCase() === name)?.raw || ''

const numericValue = (value: string) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const auditRateHeaders = (headers: ParsedHeader[]): Finding[] => {
  const findings: Finding[] = []
  const policy = headers.find(header => header.name.toLowerCase() === 'ratelimit-policy')
  const limit = headers.find(header => header.name.toLowerCase() === 'ratelimit')
  const retryAfter = firstHeader(headers, 'retry-after')
  const legacyLimit =
    firstHeader(headers, 'x-ratelimit-limit') || firstHeader(headers, 'x-rate-limit-limit')
  const legacyRemaining =
    firstHeader(headers, 'x-ratelimit-remaining') || firstHeader(headers, 'x-rate-limit-remaining')
  const legacyReset =
    firstHeader(headers, 'x-ratelimit-reset') || firstHeader(headers, 'x-rate-limit-reset')

  if (!headers.length) return [{ key: 'empty', level: 'warn', target: '-' }]

  if (policy) findings.push({ key: 'policy_ok', level: 'good', target: 'RateLimit-Policy' })
  else findings.push({ key: 'policy_missing', level: 'warn', target: 'RateLimit-Policy' })

  if (limit) {
    findings.push({ key: 'ratelimit_ok', level: 'good', target: 'RateLimit' })

    const remaining = numericValue(limit.values.r || legacyRemaining)
    const quota = numericValue(policy?.values.q || legacyLimit)
    const reset = numericValue(limit.values.t || legacyReset)

    if (quota && remaining > quota)
      findings.push({ key: 'remaining_over_quota', level: 'danger', target: 'RateLimit' })
    if (remaining === 0 && !retryAfter)
      findings.push({ key: 'zero_without_retry', level: 'warn', target: 'Retry-After' })
    if (!reset) findings.push({ key: 'reset_missing', level: 'warn', target: 'RateLimit' })
  } else if (legacyLimit || legacyRemaining || legacyReset) {
    findings.push({ key: 'legacy_only', level: 'warn', target: 'X-RateLimit' })
  } else {
    findings.push({ key: 'ratelimit_missing', level: 'danger', target: 'RateLimit' })
  }

  if (retryAfter) findings.push({ key: 'retry_after_ok', level: 'good', target: 'Retry-After' })

  if (legacyLimit && legacyRemaining && legacyReset) {
    findings.push({ key: 'legacy_complete', level: 'good', target: 'X-RateLimit' })
  } else if (legacyLimit || legacyRemaining || legacyReset) {
    findings.push({ key: 'legacy_partial', level: 'warn', target: 'X-RateLimit' })
  }

  return findings
}

const buildProblemJson = (draft: RateDraft) =>
  JSON.stringify(
    {
      type: 'quota-exceeded',
      title: 'Too Many Requests',
      status: Number(draft.status),
      detail: 'Rate limit reached. Wait before retrying.',
      retryAfter: Number(normalizeInteger(draft.retryAfter || draft.resetAfter || draft.window))
    },
    null,
    2
  )

const buildOutput = (draft: RateDraft, outputType: OutputType) => {
  const rows = buildRateHeaders(draft)
  const status = Number(draft.status)
  const objectLines = rows
    .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    .join(',\n')
  const raw = rows.map(([name, value]) => `${name}: ${value}`).join('\n')

  switch (outputType) {
    case 'next':
      return `const rateHeaders = {
${objectLines}
}

return NextResponse.json(${status === 429 ? buildProblemJson(draft) : 'data'}, {
  status: ${status},
  headers: rateHeaders
})`
    case 'express':
      return `res.set({
${objectLines}
})

return res.status(${status}).json(${status === 429 ? buildProblemJson(draft) : '{ ok: true }'})`
    case 'nginx':
      return rows
        .map(([name, value]) => `add_header ${name} "${value.replaceAll('"', '\\"')}" always;`)
        .join('\n')
    case 'cloudflare':
      return `return new Response(${status === 429 ? JSON.stringify(buildProblemJson(draft)) : 'body'}, {
  status: ${status},
  headers: {
${objectLines}
  }
})`
    case 'json':
      return JSON.stringify(
        {
          status,
          headers: Object.fromEntries(rows),
          problem: status === 429 ? JSON.parse(buildProblemJson(draft)) : null
        },
        null,
        2
      )
    case 'raw':
    default:
      return raw
  }
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const findingColor = (level: FindingLevel) => {
  if (level === 'danger') return 'bg-red-400'
  if (level === 'warn') return 'bg-amber-300'
  return 'bg-emerald-300'
}

export default function RateLimitClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<RateDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [query, setQuery] = useState('limit')
  const [group, setGroup] = useState<HeaderGroup>('all')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredQuery = useDeferredValue(query)
  const deferredWorkspace = useDeferredValue(workspace)

  const headerRows = useMemo(() => buildRateHeaders(draft), [draft])
  const output = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedHeaders = useMemo(() => parseRateWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditRateHeaders(parsedHeaders), [parsedHeaders])
  const filteredHeaders = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return HEADER_REFERENCE.filter(header => {
      const matchesGroup = group === 'all' || header.group === group
      const matchesQuery =
        !normalized ||
        header.name.toLowerCase().includes(normalized) ||
        header.example.toLowerCase().includes(normalized) ||
        t(header.noteKey).toLowerCase().includes(normalized) ||
        header.group.includes(normalized)

      return matchesGroup && matchesQuery
    })
  }, [deferredQuery, group, t])
  const metrics = useMemo(() => {
    const standard = parsedHeaders.filter(header => header.group === 'standard').length
    const legacy = parsedHeaders.filter(header => header.group === 'legacy').length
    const retry = parsedHeaders.filter(header => header.group === 'retry').length
    const dangerous = findings.filter(finding => finding.level === 'danger').length

    return {
      dangerous,
      legacy,
      retry,
      standard,
      total: parsedHeaders.length
    }
  }, [findings, parsedHeaders])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          metrics,
          headers: parsedHeaders,
          findings
        },
        null,
        2
      ),
    [findings, metrics, parsedHeaders]
  )
  const exportCsv = useMemo(
    () =>
      [
        'name,value,group',
        ...parsedHeaders.map(header =>
          [header.name, header.raw, header.group].map(escapeCsv).join(',')
        )
      ].join('\n'),
    [parsedHeaders]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.rate_limit.summary_title'),
        `${t('app.converter.rate_limit.metric.total')}: ${metrics.total}`,
        `${t('app.converter.rate_limit.metric.standard')}: ${metrics.standard}`,
        `${t('app.converter.rate_limit.metric.legacy')}: ${metrics.legacy}`,
        `${t('app.converter.rate_limit.metric.issues')}: ${metrics.dangerous}`,
        headerRows.map(([name, value]) => `${name}: ${value}`).join('\n')
      ].join('\n'),
    [headerRows, metrics, t]
  )

  const loadPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setQuery(preset.key)
    setGroup('all')
  }

  const updateDraft = <Key extends keyof RateDraft>(key: Key, value: RateDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.rate_limit')}
              </CardTitle>
              <CardDescription>{t('app.converter.rate_limit.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.rate_limit.copy_summary')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(output)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <RateMetric
              label={t('app.converter.rate_limit.metric.total')}
              value={String(metrics.total)}
            />
            <RateMetric
              label={t('app.converter.rate_limit.metric.standard')}
              value={String(metrics.standard)}
            />
            <RateMetric
              label={t('app.converter.rate_limit.metric.legacy')}
              value={String(metrics.legacy)}
            />
            <RateMetric
              label={t('app.converter.rate_limit.metric.retry')}
              value={String(metrics.retry)}
            />
            <RateMetric
              label={t('app.converter.rate_limit.metric.issues')}
              value={String(metrics.dangerous)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FlaskConical className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.rate_limit.presets')}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.rate_limit.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.rate_limit.preset.${preset.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.rate_limit.builder')}</CardTitle>
            <CardDescription>{t('app.converter.rate_limit.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RateInput
                id="rate-policy-name"
                label={t('app.converter.rate_limit.policy_name')}
                value={draft.policyName}
                onChange={value => updateDraft('policyName', value)}
              />
              <RateInput
                id="rate-quota"
                label={t('app.converter.rate_limit.quota')}
                value={draft.quota}
                onChange={value => updateDraft('quota', value)}
              />
              <RateInput
                id="rate-window"
                label={t('app.converter.rate_limit.window')}
                value={draft.window}
                onChange={value => updateDraft('window', value)}
              />
              <RateInput
                id="rate-remaining"
                label={t('app.converter.rate_limit.remaining')}
                value={draft.remaining}
                onChange={value => updateDraft('remaining', value)}
              />
              <RateInput
                id="rate-reset-after"
                label={t('app.converter.rate_limit.reset_after')}
                value={draft.resetAfter}
                onChange={value => updateDraft('resetAfter', value)}
              />
              <RateInput
                id="rate-retry-after"
                label={t('app.converter.rate_limit.retry_after')}
                value={draft.retryAfter}
                onChange={value => updateDraft('retryAfter', value)}
              />
              <RateInput
                id="rate-quota-unit"
                label={t('app.converter.rate_limit.quota_unit')}
                value={draft.quotaUnit}
                onChange={value => updateDraft('quotaUnit', value)}
              />
              <RateInput
                id="rate-partition-key"
                label={t('app.converter.rate_limit.partition_key')}
                value={draft.partitionKey}
                onChange={value => updateDraft('partitionKey', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="rate-status">{t('app.converter.rate_limit.status')}</Label>
                <Select
                  id="rate-status"
                  value={draft.status}
                  onChange={event => updateDraft('status', event.target.value as StatusValue)}
                >
                  {STATUS_VALUES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <RateBoolean
                id="rate-include-legacy"
                label={t('app.converter.rate_limit.include_legacy')}
                value={draft.includeLegacy}
                onChange={value => updateDraft('includeLegacy', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="rate-output-type">
                  {t('app.converter.rate_limit.output_type')}
                </Label>
                <Select
                  id="rate-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.rate_limit.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.rate_limit.output_preview')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setWorkspace(headerRows.map(([name, value]) => `${name}: ${value}`).join('\n'))
                }
              >
                {t('app.converter.rate_limit.use_output')}
              </Button>
            </div>
            <Textarea
              value={output}
              readOnly
              rows={8}
              className="min-h-[190px] resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.rate_limit.workspace')}
                </CardTitle>
                <CardDescription>{t('app.converter.rate_limit.workspace_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, RATE_INPUT_LIMIT))}
              rows={10}
              placeholder={t('app.converter.rate_limit.workspace_placeholder')}
              className="min-h-[220px] resize-y font-mono"
            />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.rate_limit.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {findings.slice(0, 8).map((finding, index) => (
                  <div
                    key={`${finding.target}:${finding.key}:${index}`}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${findingColor(finding.level)}`}
                    />
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {finding.target}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">/</span>
                    {t(`app.converter.rate_limit.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.rate_limit.parsed')}
              </CardTitle>
              <CardDescription>{t('app.converter.rate_limit.parsed_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(exportJson)}
              >
                {t('app.converter.rate_limit.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(exportCsv, 'daily-tools-rate-limit.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.converter.rate_limit.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-3">
              <Label htmlFor="rate-search">{t('app.converter.rate_limit.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="rate-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={t('app.converter.rate_limit.search_placeholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="rate-group">{t('app.converter.rate_limit.group')}</Label>
              <Select
                id="rate-group"
                value={group}
                onChange={event => setGroup(event.target.value as HeaderGroup)}
              >
                {HEADER_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.rate_limit.group.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredHeaders.map(header => (
              <button
                key={header.name}
                type="button"
                onClick={() => setQuery(header.name)}
                className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {header.name}
                  </p>
                  <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                    {t(`app.converter.rate_limit.group.${header.group}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(header.noteKey)}
                </p>
                <p className="mt-2 break-all rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                  {header.example}
                </p>
              </button>
            ))}
          </div>

          {parsedHeaders.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedHeaders.map(header => (
                <div key={`${header.name}:${header.raw}`} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {header.name}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.rate_limit.group.${header.group}`)}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {header.raw}
                  </p>
                  {Object.keys(header.values).length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(header.values).map(([name, value]) => (
                        <span
                          key={name}
                          className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]"
                        >
                          {name}={value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.rate_limit.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const RateMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const RateInput = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
  </div>
)

const RateBoolean = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: boolean) => void
  value: boolean
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value ? 'yes' : 'no'}
        onChange={event => onChange(event.target.value === 'yes')}
      >
        <option value="yes">{t('public.yes')}</option>
        <option value="no">{t('public.no')}</option>
      </Select>
    </div>
  )
}
