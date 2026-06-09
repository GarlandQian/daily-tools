'use client'

import {
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  FileCode2,
  Globe,
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

const OUTPUT_TYPES = ['raw', 'next', 'nginx', 'apache', 'cloudflare', 'json'] as const
const HSTS_INPUT_LIMIT = 28000
const HSTS_ROW_LIMIT = 140
const ONE_YEAR_SECONDS = 31536000

type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey = 'production' | 'preload_ready' | 'staging' | 'subdomain' | 'rollback' | 'legacy'
type FindingLevel = 'good' | 'warn' | 'danger'
type DirectiveKey = 'max_age' | 'include_subdomains' | 'preload'

interface HstsDraft {
  domain: string
  includeSubDomains: boolean
  maxAge: string
  preload: boolean
}

interface Preset {
  draft: HstsDraft
  key: PresetKey
  outputType: OutputType
  workspace: string
}

interface ParsedHsts {
  duplicateDirectives: string[]
  includeSubDomains: boolean
  maxAge: number | null
  preload: boolean
  raw: string
  source: string
  unknownDirectives: string[]
  valid: boolean
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: HstsDraft = {
  domain: 'app.example.com',
  includeSubDomains: true,
  maxAge: String(ONE_YEAR_SECONDS),
  preload: false
}

const MAX_AGE_PRESETS = [
  { label: '5m', value: '300' },
  { label: '1d', value: '86400' },
  { label: '30d', value: '2592000' },
  { label: '180d', value: '15552000' },
  { label: '1y', value: String(ONE_YEAR_SECONDS) },
  { label: '2y', value: '63072000' },
  { label: '0', value: '0' }
] as const

const DIRECTIVES: DirectiveKey[] = ['max_age', 'include_subdomains', 'preload']

const PRESETS: Preset[] = [
  {
    key: 'production',
    draft: DEFAULT_DRAFT,
    outputType: 'raw',
    workspace: 'Strict-Transport-Security: max-age=31536000; includeSubDomains'
  },
  {
    key: 'preload_ready',
    draft: {
      domain: 'example.com',
      includeSubDomains: true,
      maxAge: '63072000',
      preload: true
    },
    outputType: 'raw',
    workspace: 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'staging',
    draft: {
      domain: 'staging.example.com',
      includeSubDomains: false,
      maxAge: '300',
      preload: false
    },
    outputType: 'raw',
    workspace: 'Strict-Transport-Security: max-age=300'
  },
  {
    key: 'subdomain',
    draft: {
      domain: 'shop.example.com',
      includeSubDomains: false,
      maxAge: '15552000',
      preload: false
    },
    outputType: 'nginx',
    workspace: 'add_header Strict-Transport-Security "max-age=15552000" always;'
  },
  {
    key: 'rollback',
    draft: {
      domain: 'example.com',
      includeSubDomains: false,
      maxAge: '0',
      preload: false
    },
    outputType: 'raw',
    workspace: 'Strict-Transport-Security: max-age=0'
  },
  {
    key: 'legacy',
    draft: {
      domain: 'legacy.example.com',
      includeSubDomains: false,
      maxAge: '86400',
      preload: false
    },
    outputType: 'apache',
    workspace: 'Header always set Strict-Transport-Security "max-age=86400"'
  }
]

const normalizeMaxAge = (value: string) => {
  const normalized = value.trim()

  if (!/^\d+$/u.test(normalized)) return null

  return Number(normalized)
}

const formatDays = (seconds: number | null) => {
  if (seconds === null) return '-'
  if (seconds === 0) return '0'

  return `${Math.round((seconds / 86400) * 10) / 10}`
}

const buildHstsValue = (draft: HstsDraft) => {
  const maxAge = normalizeMaxAge(draft.maxAge) ?? ONE_YEAR_SECONDS
  const directives = [`max-age=${maxAge}`]

  if (draft.includeSubDomains) directives.push('includeSubDomains')
  if (draft.preload) directives.push('preload')

  return directives.join('; ')
}

const buildOutput = (draft: HstsDraft, outputType: OutputType) => {
  const headerValue = buildHstsValue(draft)
  const domain = draft.domain.trim() || 'example.com'

  switch (outputType) {
    case 'next':
      return `return NextResponse.next({
  headers: {
    "Strict-Transport-Security": "${headerValue}"
  }
})`
    case 'nginx':
      return `add_header Strict-Transport-Security "${headerValue}" always;`
    case 'apache':
      return `Header always set Strict-Transport-Security "${headerValue}"`
    case 'cloudflare':
      return `return new Response(body, {
  headers: {
    "Strict-Transport-Security": "${headerValue}"
  }
})`
    case 'json':
      return JSON.stringify(
        {
          domain,
          header: 'Strict-Transport-Security',
          value: headerValue,
          maxAge: normalizeMaxAge(draft.maxAge),
          includeSubDomains: draft.includeSubDomains,
          preload: draft.preload,
          preloadReady:
            draft.preload &&
            draft.includeSubDomains &&
            (normalizeMaxAge(draft.maxAge) ?? 0) >= ONE_YEAR_SECONDS
        },
        null,
        2
      )
    case 'raw':
    default:
      return `Strict-Transport-Security: ${headerValue}`
  }
}

const getQuotedValue = (value: string) => {
  const match = /"([^"]+)"|'([^']+)'/u.exec(value)

  return match?.[1] || match?.[2] || ''
}

const getQuotedValues = (value: string) =>
  Array.from(value.matchAll(/"([^"]+)"|'([^']+)'/gu)).map(match => match[1] || match[2] || '')

const parseHstsValue = (value: string) => {
  const directives = value
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const duplicateDirectives: string[] = []
  const unknownDirectives: string[] = []
  let maxAge: number | null = null
  let includeSubDomains = false
  let preload = false

  for (const directive of directives) {
    const [rawName, rawValue = ''] = directive.split('=')
    const name = rawName.trim().toLowerCase()

    if (seen.has(name)) duplicateDirectives.push(name)
    seen.add(name)

    if (name === 'max-age') {
      const parsed = normalizeMaxAge(rawValue)
      maxAge = parsed
      continue
    }

    if (name === 'includesubdomains') {
      includeSubDomains = true
      continue
    }

    if (name === 'preload') {
      preload = true
      continue
    }

    unknownDirectives.push(rawName.trim())
  }

  return {
    duplicateDirectives,
    includeSubDomains,
    maxAge,
    preload,
    unknownDirectives,
    valid: maxAge !== null
  }
}

const extractHeaderValue = (line: string) => {
  const trimmed = line.trim()
  const directMatch = /^strict-transport-security\s*:\s*(.+)$/iu.exec(trimmed)

  if (directMatch) return { source: 'header', value: directMatch[1] }

  if (/^add_header\s+strict-transport-security\b/iu.test(trimmed)) {
    return {
      source: 'nginx',
      value: getQuotedValue(trimmed) || trimmed.split(/\s+/u).slice(2).join(' ')
    }
  }

  if (/^header\s+always\s+set\s+strict-transport-security\b/iu.test(trimmed)) {
    return {
      source: 'apache',
      value: getQuotedValue(trimmed) || trimmed.split(/\s+/u).slice(4).join(' ')
    }
  }

  if (/strict-transport-security/iu.test(trimmed) && /max-age/iu.test(trimmed)) {
    const headerPair = /["']strict-transport-security["']\s*:\s*["']([^"']+)["']/iu.exec(trimmed)
    const quotedHeaderValue = getQuotedValues(trimmed).find(value => /max-age\s*=/iu.test(value))

    return {
      source: 'snippet',
      value:
        headerPair?.[1] ||
        quotedHeaderValue ||
        trimmed.replace(/^.*strict-transport-security["']?\s*[:,]\s*/iu, '')
    }
  }

  if (/max-age\s*=/iu.test(trimmed))
    return { source: 'directives', value: trimmed.replace(/^["']|["']$/gu, '') }

  return null
}

const parseWorkspace = (input: string): ParsedHsts[] => {
  const rows: ParsedHsts[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, HSTS_INPUT_LIMIT).split(/\r?\n/u)) {
    const extracted = extractHeaderValue(line)
    if (!extracted) continue

    const parsed = parseHstsValue(
      extracted.value.replace(/[";]/gu, match => (match === ';' ? ';' : ''))
    )
    const key = `${extracted.source}:${extracted.value}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      ...parsed,
      raw: line.trim(),
      source: extracted.source
    })

    if (rows.length >= HSTS_ROW_LIMIT) break
  }

  return rows
}

const auditDraft = (draft: HstsDraft, parsedRows: ParsedHsts[]): Finding[] => {
  const findings: Finding[] = []
  const maxAge = normalizeMaxAge(draft.maxAge)

  if (maxAge === null) {
    findings.push({ key: 'invalid_max_age', level: 'danger', subject: draft.maxAge || 'max-age' })
  } else if (maxAge === 0) {
    findings.push({ key: 'disabled', level: 'warn', subject: 'max-age=0' })
  } else if (maxAge < 2592000) {
    findings.push({ key: 'short_max_age', level: 'warn', subject: `max-age=${maxAge}` })
  } else if (maxAge >= ONE_YEAR_SECONDS) {
    findings.push({ key: 'long_max_age', level: 'good', subject: `max-age=${maxAge}` })
  }

  if (draft.includeSubDomains) {
    findings.push({ key: 'subdomains_enabled', level: 'good', subject: 'includeSubDomains' })
  } else {
    findings.push({
      key: 'subdomains_missing',
      level: draft.preload ? 'danger' : 'warn',
      subject: 'includeSubDomains'
    })
  }

  if (draft.preload) {
    if (maxAge !== null && maxAge >= ONE_YEAR_SECONDS && draft.includeSubDomains) {
      findings.push({ key: 'preload_ready', level: 'good', subject: 'preload' })
    } else {
      findings.push({ key: 'preload_not_ready', level: 'danger', subject: 'preload' })
    }
  } else {
    findings.push({ key: 'preload_optional', level: 'warn', subject: 'preload' })
  }

  for (const parsed of parsedRows) {
    if (!parsed.valid) {
      findings.push({ key: 'parsed_missing_max_age', level: 'danger', subject: parsed.source })
    }

    for (const directive of parsed.unknownDirectives) {
      findings.push({ key: 'parsed_unknown', level: 'warn', subject: directive })
    }

    for (const directive of parsed.duplicateDirectives) {
      findings.push({ key: 'parsed_duplicate', level: 'warn', subject: directive })
    }

    if (parsed.preload && (!parsed.includeSubDomains || (parsed.maxAge ?? 0) < ONE_YEAR_SECONDS)) {
      findings.push({ key: 'parsed_preload_not_ready', level: 'danger', subject: parsed.source })
    }
  }

  return findings
}

const escapeCsv = (value: boolean | number | string | null) =>
  `"${String(value ?? '').replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getFindingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'

  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const boolLabel = (value: boolean) => (value ? 'yes' : 'no')

function HstsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function HstsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<HstsDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredWorkspace = useDeferredValue(workspace)

  const maxAge = useMemo(() => normalizeMaxAge(draft.maxAge), [draft.maxAge])
  const output = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedRows = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditDraft(draft, parsedRows), [draft, parsedRows])
  const metrics = useMemo(() => {
    const riskCount = findings.filter(finding => finding.level !== 'good').length
    const preloadReady = Boolean(
      draft.preload && draft.includeSubDomains && (maxAge ?? 0) >= ONE_YEAR_SECONDS
    )
    const parsedReady = parsedRows.filter(
      row => row.preload && row.includeSubDomains && (row.maxAge ?? 0) >= ONE_YEAR_SECONDS
    ).length

    return {
      days: formatDays(maxAge),
      parsed: String(parsedRows.length),
      preloadReady: preloadReady ? t('public.yes') : t('public.no'),
      parsedReady: String(parsedReady),
      risks: String(riskCount)
    }
  }, [draft.includeSubDomains, draft.preload, findings, maxAge, parsedRows, t])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          generated: {
            domain: draft.domain,
            value: buildHstsValue(draft),
            outputType,
            maxAge,
            includeSubDomains: draft.includeSubDomains,
            preload: draft.preload
          },
          parsed: parsedRows,
          findings
        },
        null,
        2
      ),
    [draft, findings, maxAge, outputType, parsedRows]
  )
  const exportCsv = useMemo(
    () =>
      [
        ['source', 'maxAge', 'includeSubDomains', 'preload', 'valid', 'unknownDirectives', 'raw'],
        ...parsedRows.map(row => [
          row.source,
          String(row.maxAge ?? ''),
          String(row.includeSubDomains),
          String(row.preload),
          String(row.valid),
          row.unknownDirectives.join('|'),
          row.raw
        ])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [parsedRows]
  )

  const updateDraft = <Key extends keyof HstsDraft>(key: Key, value: HstsDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setOutputType(preset.outputType)
    setWorkspace(preset.workspace)
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.hsts.summary_title'),
        `${t('app.converter.hsts.metric.days')}: ${metrics.days}`,
        `${t('app.converter.hsts.metric.preload_ready')}: ${metrics.preloadReady}`,
        `${t('app.converter.hsts.metric.parsed')}: ${metrics.parsed}`,
        `${t('app.converter.hsts.metric.risks')}: ${metrics.risks}`,
        `Strict-Transport-Security: ${buildHstsValue(draft)}`
      ].join('\n')
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="glass-panel glass-clip">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <ShieldCheck className="h-4 w-4" />
                {t('app.converter.hsts')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.hsts')}</CardTitle>
              <CardDescription>{t('app.converter.hsts.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.hsts.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <HstsMetric label={t('app.converter.hsts.metric.days')} value={metrics.days} />
            <HstsMetric
              label={t('app.converter.hsts.metric.preload_ready')}
              value={metrics.preloadReady}
            />
            <HstsMetric label={t('app.converter.hsts.metric.parsed')} value={metrics.parsed} />
            <HstsMetric
              label={t('app.converter.hsts.metric.parsed_ready')}
              value={metrics.parsedReady}
            />
            <HstsMetric label={t('app.converter.hsts.metric.risks')} value={metrics.risks} />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.hsts.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.hsts.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.hsts.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.hsts.builder')}</CardTitle>
            <CardDescription>{t('app.converter.hsts.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="hsts-domain">{t('app.converter.hsts.domain')}</Label>
                <Input
                  id="hsts-domain"
                  value={draft.domain}
                  onChange={event => updateDraft('domain', event.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="hsts-output-type">{t('app.converter.hsts.output_type')}</Label>
                <Select
                  id="hsts-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.hsts.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="hsts-max-age">{t('app.converter.hsts.max_age')}</Label>
                <Input
                  id="hsts-max-age"
                  inputMode="numeric"
                  value={draft.maxAge}
                  onChange={event =>
                    updateDraft('maxAge', event.target.value.replace(/[^\d]/gu, '').slice(0, 12))
                  }
                  placeholder="31536000"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="hsts-max-age-preset">
                  {t('app.converter.hsts.max_age_preset')}
                </Label>
                <Select
                  id="hsts-max-age-preset"
                  value={
                    MAX_AGE_PRESETS.some(option => option.value === draft.maxAge)
                      ? draft.maxAge
                      : 'custom'
                  }
                  onChange={event => {
                    if (event.target.value !== 'custom') updateDraft('maxAge', event.target.value)
                  }}
                >
                  <option value="custom">{t('app.converter.hsts.max_age_custom')}</option>
                  {MAX_AGE_PRESETS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} / {option.value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="hsts-include-subdomains">
                  {t('app.converter.hsts.include_subdomains')}
                </Label>
                <Select
                  id="hsts-include-subdomains"
                  value={boolLabel(draft.includeSubDomains)}
                  onChange={event => updateDraft('includeSubDomains', event.target.value === 'yes')}
                >
                  <option value="yes">{t('public.yes')}</option>
                  <option value="no">{t('public.no')}</option>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="hsts-preload">{t('app.converter.hsts.preload')}</Label>
                <Select
                  id="hsts-preload"
                  value={boolLabel(draft.preload)}
                  onChange={event => updateDraft('preload', event.target.value === 'yes')}
                >
                  <option value="yes">{t('public.yes')}</option>
                  <option value="no">{t('public.no')}</option>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.hsts.readiness')}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {DIRECTIVES.map(directive => {
                  const ready =
                    directive === 'max_age'
                      ? (maxAge ?? 0) >= ONE_YEAR_SECONDS
                      : directive === 'include_subdomains'
                        ? draft.includeSubDomains
                        : draft.preload

                  return (
                    <div key={directive} className="glass-input rounded-xl p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {t(`app.converter.hsts.directive.${directive}`)}
                      </p>
                      <p
                        className={`mt-2 rounded-lg px-2 py-1 text-center text-sm font-semibold ${
                          ready
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-amber-500/10 text-amber-700'
                        }`}
                      >
                        {ready
                          ? t('app.converter.hsts.ready')
                          : t('app.converter.hsts.needs_review')}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {t(`app.converter.hsts.directive.${directive}_hint`)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.hsts.output_preview')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[240px] font-mono" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button type="button" onClick={() => copy(output)}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace(output)}>
                <Search className="h-4 w-4" />
                {t('app.converter.hsts.use_output')}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.hsts.audit')}
              </h3>
              <div className="space-y-2">
                {findings.slice(0, 10).map((finding, index) => (
                  <div
                    key={`${finding.key}:${finding.subject}:${index}`}
                    className={`rounded-xl border px-3 py-2 text-xs ${getFindingClass(finding.level)}`}
                  >
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2">/</span>
                    {t(`app.converter.hsts.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">{t('app.converter.hsts.workspace')}</CardTitle>
              <CardDescription>{t('app.converter.hsts.workspace_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(exportJson)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.hsts.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(exportCsv, 'hsts-headers.csv', 'text/csv;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.hsts.download_csv')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={workspace}
            onChange={event => setWorkspace(event.target.value.slice(0, HSTS_INPUT_LIMIT))}
            placeholder={t('app.converter.hsts.workspace_placeholder')}
            className="min-h-[180px] font-mono"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Clock className="h-3.5 w-3.5" />
                {t('app.converter.hsts.reference.max_age')}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.hsts.reference.max_age_hint')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Globe className="h-3.5 w-3.5" />
                {t('app.converter.hsts.reference.subdomains')}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.hsts.reference.subdomains_hint')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('app.converter.hsts.reference.preload')}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.hsts.reference.preload_hint')}
              </p>
            </div>
          </div>

          {parsedRows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedRows.map((row, index) => (
                <div
                  key={`${row.source}:${row.raw}:${index}`}
                  className="glass-input rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        max-age={row.maxAge ?? '-'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{row.source}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.valid
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      {row.valid ? t('app.converter.hsts.valid') : t('app.converter.hsts.invalid')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.includeSubDomains ? (
                      <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                        includeSubDomains
                      </span>
                    ) : null}
                    {row.preload ? (
                      <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                        preload
                      </span>
                    ) : null}
                    {row.unknownDirectives.map(directive => (
                      <span
                        key={directive}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700"
                      >
                        {directive}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 line-clamp-3 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {row.raw}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.hsts.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
