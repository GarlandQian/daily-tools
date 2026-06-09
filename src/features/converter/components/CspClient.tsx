'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
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

const DIRECTIVE_GROUPS = ['all', 'fetch', 'document', 'navigation', 'reporting', 'upgrade'] as const
const OUTPUT_TYPES = ['header', 'report_only', 'meta', 'nginx', 'next', 'json'] as const
const POLICY_LIMIT = 32000
const REPORT_LIMIT = 32000
const REPORT_ROW_LIMIT = 80

type DirectiveGroup = (typeof DIRECTIVE_GROUPS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey = 'strict' | 'spa' | 'analytics' | 'media' | 'embed' | 'report_only'
type FindingLevel = 'good' | 'warn' | 'danger'

interface DirectiveInfo {
  example: string
  group: Exclude<DirectiveGroup, 'all'>
  name: string
  note: string
  priority: 'standard' | 'recommended' | 'critical'
}

interface Preset {
  key: PresetKey
  policy: string
  query: string
}

interface DirectiveRow {
  name: string
  values: string[]
}

interface Finding {
  key: string
  level: FindingLevel
}

interface ReportRow {
  blocked: string
  count: number
  directive: string
  document: string
  original: string
}

const DIRECTIVES: DirectiveInfo[] = [
  {
    name: 'default-src',
    example: "'self'",
    group: 'fetch',
    priority: 'critical',
    note: 'Fallback source list for fetch directives that are not declared.'
  },
  {
    name: 'script-src',
    example: "'self'",
    group: 'fetch',
    priority: 'critical',
    note: 'Controls JavaScript sources and inline script execution.'
  },
  {
    name: 'style-src',
    example: "'self'",
    group: 'fetch',
    priority: 'recommended',
    note: 'Controls CSS sources and inline style execution.'
  },
  {
    name: 'img-src',
    example: "'self' data: https:",
    group: 'fetch',
    priority: 'recommended',
    note: 'Controls image sources including data URLs and remote images.'
  },
  {
    name: 'connect-src',
    example: "'self' https://api.example.com",
    group: 'fetch',
    priority: 'recommended',
    note: 'Controls fetch, WebSocket, EventSource, and beacon destinations.'
  },
  {
    name: 'font-src',
    example: "'self' data:",
    group: 'fetch',
    priority: 'standard',
    note: 'Controls web font loading.'
  },
  {
    name: 'media-src',
    example: "'self' https://media.example.com",
    group: 'fetch',
    priority: 'standard',
    note: 'Controls audio and video sources.'
  },
  {
    name: 'object-src',
    example: "'none'",
    group: 'fetch',
    priority: 'critical',
    note: 'Blocks plugin content such as object, embed, and applet.'
  },
  {
    name: 'base-uri',
    example: "'self'",
    group: 'document',
    priority: 'critical',
    note: 'Restricts which URLs can be used in a base element.'
  },
  {
    name: 'frame-ancestors',
    example: "'none'",
    group: 'navigation',
    priority: 'critical',
    note: 'Controls which pages may embed this document in a frame.'
  },
  {
    name: 'frame-src',
    example: "'self' https://www.youtube.com",
    group: 'fetch',
    priority: 'standard',
    note: 'Controls nested browsing contexts such as iframe sources.'
  },
  {
    name: 'form-action',
    example: "'self'",
    group: 'navigation',
    priority: 'recommended',
    note: 'Restricts where forms can submit data.'
  },
  {
    name: 'worker-src',
    example: "'self' blob:",
    group: 'fetch',
    priority: 'standard',
    note: 'Controls Worker, SharedWorker, and Service Worker scripts.'
  },
  {
    name: 'manifest-src',
    example: "'self'",
    group: 'fetch',
    priority: 'standard',
    note: 'Controls web app manifest loading.'
  },
  {
    name: 'upgrade-insecure-requests',
    example: '',
    group: 'upgrade',
    priority: 'recommended',
    note: 'Asks browsers to upgrade HTTP subresource requests to HTTPS.'
  },
  {
    name: 'block-all-mixed-content',
    example: '',
    group: 'upgrade',
    priority: 'standard',
    note: 'Blocks mixed HTTP content on HTTPS pages.'
  },
  {
    name: 'report-uri',
    example: 'https://reports.example.com/csp',
    group: 'reporting',
    priority: 'standard',
    note: 'Legacy endpoint for CSP violation reports.'
  },
  {
    name: 'report-to',
    example: 'csp-endpoint',
    group: 'reporting',
    priority: 'standard',
    note: 'Reporting API group name for CSP violation reports.'
  }
]

const PRESETS: Preset[] = [
  {
    key: 'strict',
    query: 'strict none self',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; upgrade-insecure-requests"
  },
  {
    key: 'spa',
    query: 'spa api worker',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.example.com; worker-src 'self' blob:"
  },
  {
    key: 'analytics',
    query: 'analytics report',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' https://analytics.example.com; connect-src 'self' https://analytics.example.com; img-src 'self' data: https:; report-uri https://reports.example.com/csp"
  },
  {
    key: 'media',
    query: 'media video image',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; media-src 'self' https://media.example.com; connect-src 'self'; upgrade-insecure-requests"
  },
  {
    key: 'embed',
    query: 'iframe frame youtube',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; frame-src 'self' https://www.youtube.com; script-src 'self'; style-src 'self'; img-src 'self' data: https:"
  },
  {
    key: 'report_only',
    query: 'report only collect',
    policy:
      "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; report-uri https://reports.example.com/csp"
  }
]

const SAMPLE_REPORT = `{
  "csp-report": {
    "document-uri": "https://app.example.com/dashboard",
    "violated-directive": "script-src-elem",
    "effective-directive": "script-src",
    "blocked-uri": "https://cdn.example.net/widget.js",
    "original-policy": "default-src 'self'; script-src 'self'; report-uri /csp-report"
  }
}`

const parsePolicy = (policy: string): DirectiveRow[] => {
  const rows: DirectiveRow[] = []
  const seen = new Set<string>()

  for (const segment of policy.slice(0, POLICY_LIMIT).split(';')) {
    const parts = segment.trim().split(/\s+/u).filter(Boolean)
    const [name, ...values] = parts
    if (!name) continue

    const normalized = name.toLowerCase()
    if (seen.has(normalized)) {
      rows.push({ name: `${normalized}#duplicate`, values })
      continue
    }

    seen.add(normalized)
    rows.push({ name: normalized, values })
  }

  return rows
}

const stringifyPolicy = (rows: DirectiveRow[]) =>
  rows
    .map(row => {
      const name = row.name.replace(/#duplicate$/u, '')
      return [name, ...row.values].join(' ').trim()
    })
    .join('; ')

const valuesContain = (rows: DirectiveRow[], directive: string, value: string) =>
  rows
    .find(row => row.name === directive)
    ?.values.some(item => item.toLowerCase() === value.toLowerCase()) ?? false

const hasDirective = (rows: DirectiveRow[], directive: string) =>
  rows.some(row => row.name === directive)

const auditPolicy = (rows: DirectiveRow[]): Finding[] => {
  const findings: Finding[] = []
  const hasUnsafeInline = rows.some(row => row.values.includes("'unsafe-inline'"))
  const hasUnsafeEval = rows.some(row => row.values.includes("'unsafe-eval'"))
  const hasWildcard = rows.some(row => row.values.includes('*'))
  const duplicateCount = rows.filter(row => row.name.endsWith('#duplicate')).length

  if (hasDirective(rows, 'default-src')) findings.push({ key: 'default_ok', level: 'good' })
  else findings.push({ key: 'default_missing', level: 'danger' })

  if (valuesContain(rows, 'object-src', "'none'"))
    findings.push({ key: 'object_none', level: 'good' })
  else findings.push({ key: 'object_not_blocked', level: 'danger' })

  if (hasDirective(rows, 'base-uri')) findings.push({ key: 'base_uri_ok', level: 'good' })
  else findings.push({ key: 'base_uri_missing', level: 'warn' })

  if (hasDirective(rows, 'frame-ancestors'))
    findings.push({ key: 'frame_ancestors_ok', level: 'good' })
  else findings.push({ key: 'frame_ancestors_missing', level: 'warn' })

  if (hasUnsafeInline) findings.push({ key: 'unsafe_inline', level: 'warn' })
  if (hasUnsafeEval) findings.push({ key: 'unsafe_eval', level: 'danger' })
  if (hasWildcard) findings.push({ key: 'wildcard', level: 'danger' })
  if (duplicateCount) findings.push({ key: 'duplicate', level: 'warn' })

  if (hasDirective(rows, 'report-uri') || hasDirective(rows, 'report-to')) {
    findings.push({ key: 'reporting_ok', level: 'good' })
  } else {
    findings.push({ key: 'reporting_missing', level: 'warn' })
  }

  if (hasDirective(rows, 'upgrade-insecure-requests')) {
    findings.push({ key: 'upgrade_ok', level: 'good' })
  }

  return findings
}

const parseReports = (input: string): ReportRow[] => {
  const limited = input.slice(0, REPORT_LIMIT)
  const candidates: unknown[] = []

  try {
    const parsed = JSON.parse(limited)
    if (Array.isArray(parsed)) candidates.push(...parsed)
    else candidates.push(parsed)
  } catch {
    for (const line of limited.split(/\r?\n/u)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        candidates.push(JSON.parse(trimmed))
      } catch {
        // Ignore non-JSON log lines.
      }
    }
  }

  const grouped = new Map<string, ReportRow>()

  for (const candidate of candidates.slice(0, REPORT_ROW_LIMIT)) {
    if (!candidate || typeof candidate !== 'object') continue
    const root = candidate as Record<string, unknown>
    const report =
      root['csp-report'] && typeof root['csp-report'] === 'object'
        ? (root['csp-report'] as Record<string, unknown>)
        : root
    const directive = String(
      report['effective-directive'] ?? report['violated-directive'] ?? report.directive ?? '-'
    )
    const blocked = String(report['blocked-uri'] ?? report.blocked ?? '-')
    const document = String(report['document-uri'] ?? report.document ?? '-')
    const original = String(report['original-policy'] ?? report.policy ?? '-')
    const key = `${directive}|${blocked}|${document}`
    const existing = grouped.get(key)

    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { blocked, count: 1, directive, document, original })
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count)
}

const buildOutput = (policy: string, rows: DirectiveRow[], type: OutputType) => {
  const normalized = stringifyPolicy(rows)

  switch (type) {
    case 'json':
      return JSON.stringify(
        Object.fromEntries(rows.map(row => [row.name.replace(/#duplicate$/u, ''), row.values])),
        null,
        2
      )
    case 'meta':
      return `<meta http-equiv="Content-Security-Policy" content="${normalized.replaceAll('"', '&quot;')}">`
    case 'next':
      return `return new Response(body, {
  headers: {
    'Content-Security-Policy': '${normalized.replaceAll("'", "\\'")}'
  }
})`
    case 'nginx':
      return `add_header Content-Security-Policy "${normalized.replaceAll('"', '\\"')}" always;`
    case 'report_only':
      return `Content-Security-Policy-Report-Only: ${normalized}`
    case 'header':
    default:
      return `Content-Security-Policy: ${policy.trim() ? normalized : ''}`
  }
}

const escapeCsv = (value: number | string) => `"${String(value).replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function CspClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [query, setQuery] = useState('strict')
  const [group, setGroup] = useState<DirectiveGroup>('all')
  const [outputType, setOutputType] = useState<OutputType>('header')
  const [policy, setPolicy] = useState(PRESETS[0].policy)
  const [reportInput, setReportInput] = useState(SAMPLE_REPORT)
  const deferredQuery = useDeferredValue(query)
  const deferredPolicy = useDeferredValue(policy)
  const deferredReportInput = useDeferredValue(reportInput)

  const rows = useMemo(() => parsePolicy(deferredPolicy), [deferredPolicy])
  const findings = useMemo(() => auditPolicy(rows), [rows])
  const output = useMemo(
    () => buildOutput(deferredPolicy, rows, outputType),
    [deferredPolicy, outputType, rows]
  )
  const reports = useMemo(() => parseReports(deferredReportInput), [deferredReportInput])
  const filteredDirectives = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return DIRECTIVES.filter(directive => {
      const matchesGroup = group === 'all' || directive.group === group
      const matchesQuery =
        !normalized ||
        directive.name.includes(normalized) ||
        directive.example.toLowerCase().includes(normalized) ||
        directive.note.toLowerCase().includes(normalized) ||
        directive.group.includes(normalized)

      return matchesGroup && matchesQuery
    })
  }, [deferredQuery, group])
  const groupCounts = useMemo(
    () =>
      DIRECTIVE_GROUPS.filter(item => item !== 'all').map(item => ({
        count: DIRECTIVES.filter(directive => directive.group === item).length,
        group: item
      })),
    []
  )
  const reportCsv = useMemo(
    () =>
      [
        'directive,blocked,document,count,original',
        ...reports.map(row =>
          [row.directive, row.blocked, row.document, row.count, row.original]
            .map(escapeCsv)
            .join(',')
        )
      ].join('\n'),
    [reports]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.csp.summary_title'),
        `${t('app.converter.csp.metric.directives')}: ${rows.length}`,
        `${t('app.converter.csp.metric.findings')}: ${findings.length}`,
        stringifyPolicy(rows)
      ].join('\n'),
    [findings.length, rows, t]
  )

  const loadPreset = (preset: Preset) => {
    setQuery(preset.query)
    setGroup('all')
    setPolicy(preset.policy)
  }

  const addDirective = (directive: DirectiveInfo) => {
    const currentRows = parsePolicy(policy).filter(row => row.name !== directive.name)
    const nextRows = [
      ...currentRows,
      {
        name: directive.name,
        values: directive.example ? directive.example.split(/\s+/u).filter(Boolean) : []
      }
    ]

    setPolicy(stringifyPolicy(nextRows))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.csp')}
              </CardTitle>
              <CardDescription>{t('app.converter.csp.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.csp.copy_summary')}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CspMetric
              label={t('app.converter.csp.metric.directives')}
              value={String(rows.length)}
            />
            <CspMetric
              label={t('app.converter.csp.metric.findings')}
              value={String(findings.length)}
            />
            <CspMetric
              label={t('app.converter.csp.metric.reports')}
              value={String(reports.length)}
            />
            <CspMetric
              label={t('app.converter.csp.metric.length')}
              value={String(stringifyPolicy(rows).length)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.csp.presets')}
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
                    {t(`app.converter.csp.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.csp.preset.${preset.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_200px]">
            <div className="space-y-3">
              <Label htmlFor="csp-search">{t('app.converter.csp.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="csp-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="script, frame, report"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="csp-group">{t('app.converter.csp.group')}</Label>
              <Select
                id="csp-group"
                value={group}
                onChange={event => setGroup(event.target.value as DirectiveGroup)}
              >
                {DIRECTIVE_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.csp.group.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="csp-output">{t('app.converter.csp.output_type')}</Label>
              <Select
                id="csp-output"
                value={outputType}
                onChange={event => setOutputType(event.target.value as OutputType)}
              >
                {OUTPUT_TYPES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.csp.output.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.converter.csp.reference')}</CardTitle>
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.converter.csp.result_count', { count: filteredDirectives.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {groupCounts.map(item => (
                <button
                  key={item.group}
                  type="button"
                  onClick={() => setGroup(item.group)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t(`app.converter.csp.group.${item.group}`)}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                    {item.count}
                  </p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredDirectives.map(directive => (
                <button
                  key={directive.name}
                  type="button"
                  onClick={() => addDirective(directive)}
                  className="glass-input rounded-xl p-4 text-left transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {directive.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.csp.group.${directive.group}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {directive.note}
                  </p>
                  <p className="mt-3 break-all rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                    {directive.example || t('app.converter.csp.no_value')}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">{t('app.converter.csp.workspace')}</CardTitle>
                <CardDescription>{t('app.converter.csp.workspace_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setPolicy('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <Textarea
              value={policy}
              onChange={event => setPolicy(event.target.value.slice(0, POLICY_LIMIT))}
              rows={10}
              className="min-h-[210px] resize-y font-mono"
            />

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {t('app.converter.csp.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {findings.map(item => (
                  <div
                    key={item.key}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${findingColor(item.level)}`}
                    />
                    {t(`app.converter.csp.audit.${item.key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.csp.output_preview')}
            </div>
            <Textarea
              value={output}
              readOnly
              rows={8}
              className="min-h-[180px] resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.csp.reports')}
              </CardTitle>
              <CardDescription>{t('app.converter.csp.reports_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => setReportInput(SAMPLE_REPORT)}
              >
                {t('app.converter.csp.sample_report')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(JSON.stringify(reports, null, 2))}
              >
                {t('app.converter.csp.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(reportCsv, 'daily-tools-csp-reports.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.converter.csp.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="csp-report">{t('app.converter.csp.report_input')}</Label>
              <Textarea
                id="csp-report"
                value={reportInput}
                onChange={event => setReportInput(event.target.value.slice(0, REPORT_LIMIT))}
                rows={9}
                className="min-h-[220px] resize-y font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 self-start">
              <CspMetric
                label={t('app.converter.csp.metric.reports')}
                value={String(reports.length)}
              />
              <CspMetric
                label={t('app.converter.csp.metric.blocked')}
                value={String(new Set(reports.map(row => row.blocked)).size)}
              />
            </div>
          </div>

          {reports.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reports.map(row => (
                <div
                  key={`${row.directive}:${row.blocked}:${row.document}`}
                  className="glass-input rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {row.directive}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      x{row.count}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {row.blocked}
                  </p>
                  <p className="mt-2 break-all text-xs leading-5 text-[var(--text-tertiary)]">
                    {row.document}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.csp.reports_empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const CspMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const findingColor = (level: FindingLevel) => {
  if (level === 'danger') return 'bg-red-400'
  if (level === 'warn') return 'bg-amber-300'
  return 'bg-emerald-300'
}
