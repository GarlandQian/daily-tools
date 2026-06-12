'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Globe,
  Layers2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

const COOP_VALUES = [
  'unsafe-none',
  'same-origin-allow-popups',
  'same-origin',
  'noopener-allow-popups'
] as const
const COEP_VALUES = ['unsafe-none', 'require-corp', 'credentialless'] as const
const CORP_VALUES = ['same-origin', 'same-site', 'cross-origin'] as const
const OUTPUT_TYPES = ['raw', 'next', 'nginx', 'apache', 'cloudflare', 'json'] as const
const WORKSPACE_LIMIT = 28000
const PARSED_ROW_LIMIT = 140
const PARSED_RENDER_LIMIT = 48

type CoopValue = (typeof COOP_VALUES)[number]
type CoepValue = (typeof COEP_VALUES)[number]
type CorpValue = (typeof CORP_VALUES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type HeaderName =
  | 'Cross-Origin-Opener-Policy'
  | 'Cross-Origin-Embedder-Policy'
  | 'Cross-Origin-Resource-Policy'
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey =
  | 'isolated_app'
  | 'credentialless'
  | 'oauth_popup'
  | 'public_assets'
  | 'same_site_assets'
  | 'migration'
type ReadinessKey = 'opener' | 'embedder' | 'resources'

interface IsolationDraft {
  coep: CoepValue
  coop: CoopValue
  corp: CorpValue
  includeCorp: boolean
}

interface Preset {
  draft: IsolationDraft
  key: PresetKey
  outputType: OutputType
  workspace: string
}

interface ParsedHeader {
  header: HeaderName
  raw: string
  source: string
  valid: boolean
  value: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const HEADER_NAMES: HeaderName[] = [
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Resource-Policy'
]
const HEADER_VALUE_MAP: Record<HeaderName, readonly string[]> = {
  'Cross-Origin-Opener-Policy': COOP_VALUES,
  'Cross-Origin-Embedder-Policy': COEP_VALUES,
  'Cross-Origin-Resource-Policy': CORP_VALUES
}
const DEFAULT_DRAFT: IsolationDraft = {
  coop: 'same-origin',
  coep: 'require-corp',
  corp: 'same-origin',
  includeCorp: true
}
const PRESETS: Preset[] = [
  {
    key: 'isolated_app',
    draft: DEFAULT_DRAFT,
    outputType: 'raw',
    workspace:
      'Cross-Origin-Opener-Policy: same-origin\nCross-Origin-Embedder-Policy: require-corp\nCross-Origin-Resource-Policy: same-origin'
  },
  {
    key: 'credentialless',
    draft: {
      coop: 'same-origin',
      coep: 'credentialless',
      corp: 'same-origin',
      includeCorp: true
    },
    outputType: 'raw',
    workspace:
      'Cross-Origin-Opener-Policy: same-origin\nCross-Origin-Embedder-Policy: credentialless\nCross-Origin-Resource-Policy: same-origin'
  },
  {
    key: 'oauth_popup',
    draft: {
      coop: 'same-origin-allow-popups',
      coep: 'require-corp',
      corp: 'same-site',
      includeCorp: true
    },
    outputType: 'next',
    workspace:
      'Cross-Origin-Opener-Policy: same-origin-allow-popups\nCross-Origin-Embedder-Policy: require-corp\nCross-Origin-Resource-Policy: same-site'
  },
  {
    key: 'public_assets',
    draft: {
      coop: 'unsafe-none',
      coep: 'unsafe-none',
      corp: 'cross-origin',
      includeCorp: true
    },
    outputType: 'nginx',
    workspace: 'add_header Cross-Origin-Resource-Policy "cross-origin" always;'
  },
  {
    key: 'same_site_assets',
    draft: {
      coop: 'unsafe-none',
      coep: 'unsafe-none',
      corp: 'same-site',
      includeCorp: true
    },
    outputType: 'raw',
    workspace: 'Cross-Origin-Resource-Policy: same-site'
  },
  {
    key: 'migration',
    draft: {
      coop: 'same-origin',
      coep: 'unsafe-none',
      corp: 'same-site',
      includeCorp: true
    },
    outputType: 'apache',
    workspace:
      'Header always set Cross-Origin-Opener-Policy "same-origin"\nHeader always set Cross-Origin-Resource-Policy "same-site"'
  }
]
const READINESS_KEYS: ReadinessKey[] = ['opener', 'embedder', 'resources']

const isIsolatedDraft = (draft: IsolationDraft) =>
  draft.coop === 'same-origin' && (draft.coep === 'require-corp' || draft.coep === 'credentialless')

const buildHeaderRows = (draft: IsolationDraft) => {
  const rows: Array<[HeaderName, string]> = [
    ['Cross-Origin-Opener-Policy', draft.coop],
    ['Cross-Origin-Embedder-Policy', draft.coep]
  ]

  if (draft.includeCorp) rows.push(['Cross-Origin-Resource-Policy', draft.corp])

  return rows
}

const buildOutput = (draft: IsolationDraft, outputType: OutputType) => {
  const rows = buildHeaderRows(draft)
  const jsonHeaders = Object.fromEntries(rows)

  switch (outputType) {
    case 'next':
      return `return NextResponse.next({
  headers: ${JSON.stringify(jsonHeaders, null, 4).replace(/\n/g, '\n  ')}
})`
    case 'nginx':
      return rows.map(([header, value]) => `add_header ${header} "${value}" always;`).join('\n')
    case 'apache':
      return rows.map(([header, value]) => `Header always set ${header} "${value}"`).join('\n')
    case 'cloudflare':
      return `return new Response(body, {
  headers: ${JSON.stringify(jsonHeaders, null, 4).replace(/\n/g, '\n  ')}
})`
    case 'json':
      return JSON.stringify(
        {
          isolated: isIsolatedDraft(draft),
          headers: jsonHeaders,
          coop: draft.coop,
          coep: draft.coep,
          corp: draft.includeCorp ? draft.corp : null
        },
        null,
        2
      )
    case 'raw':
    default:
      return rows.map(([header, value]) => `${header}: ${value}`).join('\n')
  }
}

const getQuotedValues = (value: string) =>
  Array.from(value.matchAll(/"([^"]+)"|'([^']+)'/gu)).map(match => match[1] || match[2] || '')

const normalizeHeaderName = (value: string): HeaderName | null => {
  const normalized = value.trim().toLowerCase()

  return HEADER_NAMES.find(header => header.toLowerCase() === normalized) ?? null
}

const extractHeaderLine = (line: string) => {
  const trimmed = line.trim()

  for (const header of HEADER_NAMES) {
    const directMatch = new RegExp(`^${header}\\s*:\\s*(.+)$`, 'iu').exec(trimmed)
    if (directMatch) return { header, source: 'header', value: directMatch[1] }

    const addHeaderMatch = new RegExp(`^add_header\\s+${header}\\b`, 'iu').exec(trimmed)
    if (addHeaderMatch) {
      const quotedValue = getQuotedValues(trimmed).find(value =>
        HEADER_VALUE_MAP[header].includes(value)
      )
      return {
        header,
        source: 'nginx',
        value: quotedValue || trimmed.split(/\s+/u).slice(2).join(' ')
      }
    }

    const apacheMatch = new RegExp(`^header\\s+always\\s+set\\s+${header}\\b`, 'iu').exec(trimmed)
    if (apacheMatch) {
      const quotedValue = getQuotedValues(trimmed).find(value =>
        HEADER_VALUE_MAP[header].includes(value)
      )
      return {
        header,
        source: 'apache',
        value: quotedValue || trimmed.split(/\s+/u).slice(4).join(' ')
      }
    }

    const objectMatch = new RegExp(`["']${header}["']\\s*:\\s*["']([^"']+)["']`, 'iu').exec(trimmed)
    if (objectMatch) return { header, source: 'snippet', value: objectMatch[1] }
  }

  return null
}

const parseWorkspace = (input: string): ParsedHeader[] => {
  const rows: ParsedHeader[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, WORKSPACE_LIMIT).split(/\r?\n/u)) {
    const extracted = extractHeaderLine(line)
    if (!extracted) continue

    const header = normalizeHeaderName(extracted.header)
    if (!header) continue

    const value = extracted.value.trim().replace(/[;"]/gu, '').toLowerCase()
    const key = `${header}:${value}:${extracted.source}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      header,
      raw: line.trim(),
      source: extracted.source,
      valid: HEADER_VALUE_MAP[header].includes(value),
      value
    })

    if (rows.length >= PARSED_ROW_LIMIT) break
  }

  return rows
}

const auditIsolation = (draft: IsolationDraft, parsedHeaders: ParsedHeader[]): Finding[] => {
  const findings: Finding[] = []

  if (isIsolatedDraft(draft)) {
    findings.push({ key: 'isolated_ready', level: 'good', subject: 'crossOriginIsolated' })
  } else {
    findings.push({ key: 'not_isolated', level: 'warn', subject: 'crossOriginIsolated' })
  }

  if (draft.coop === 'same-origin') {
    findings.push({ key: 'coop_same_origin', level: 'good', subject: 'COOP' })
  } else if (draft.coop === 'same-origin-allow-popups') {
    findings.push({ key: 'coop_popups', level: 'warn', subject: 'COOP' })
  } else if (draft.coop === 'noopener-allow-popups') {
    findings.push({ key: 'coop_noopener_popups', level: 'warn', subject: 'COOP' })
  } else {
    findings.push({ key: 'coop_unsafe', level: 'danger', subject: 'COOP' })
  }

  if (draft.coep === 'require-corp') {
    findings.push({ key: 'coep_require_corp', level: 'good', subject: 'COEP' })
  } else if (draft.coep === 'credentialless') {
    findings.push({ key: 'coep_credentialless', level: 'good', subject: 'COEP' })
  } else {
    findings.push({ key: 'coep_unsafe', level: 'danger', subject: 'COEP' })
  }

  if (!draft.includeCorp) {
    findings.push({
      key: 'corp_missing',
      level: draft.coep === 'require-corp' ? 'warn' : 'good',
      subject: 'CORP'
    })
  } else if (draft.corp === 'same-origin') {
    findings.push({ key: 'corp_same_origin', level: 'good', subject: 'CORP' })
  } else if (draft.corp === 'same-site') {
    findings.push({ key: 'corp_same_site', level: 'warn', subject: 'CORP' })
  } else {
    findings.push({ key: 'corp_cross_origin', level: 'warn', subject: 'CORP' })
  }

  const parsedByHeader = parsedHeaders.reduce<Record<HeaderName, ParsedHeader[]>>(
    (groups, row) => {
      groups[row.header].push(row)
      return groups
    },
    {
      'Cross-Origin-Opener-Policy': [],
      'Cross-Origin-Embedder-Policy': [],
      'Cross-Origin-Resource-Policy': []
    }
  )

  for (const row of parsedHeaders) {
    if (!row.valid) findings.push({ key: 'parsed_invalid', level: 'danger', subject: row.header })
  }

  for (const [header, rows] of Object.entries(parsedByHeader) as Array<
    [HeaderName, ParsedHeader[]]
  >) {
    const values = new Set(rows.map(row => row.value))
    if (values.size > 1) findings.push({ key: 'parsed_conflict', level: 'warn', subject: header })
  }

  const parsedCoop = parsedByHeader['Cross-Origin-Opener-Policy'].at(-1)?.value
  const parsedCoep = parsedByHeader['Cross-Origin-Embedder-Policy'].at(-1)?.value
  if (
    parsedCoop === 'same-origin' &&
    (parsedCoep === 'require-corp' || parsedCoep === 'credentialless')
  ) {
    findings.push({ key: 'parsed_isolated', level: 'good', subject: 'parsed headers' })
  } else if (parsedCoop || parsedCoep) {
    findings.push({ key: 'parsed_partial', level: 'warn', subject: 'parsed headers' })
  }

  return findings
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

const getFindingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'

  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const boolLabel = (value: boolean) => (value ? 'yes' : 'no')

function IsolationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function CrossOriginIsolationClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<IsolationDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredWorkspace = useDeferredValue(workspace)

  const outputPreviewSource = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedHeaders = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const visibleParsedHeaders = useMemo(
    () => parsedHeaders.slice(0, PARSED_RENDER_LIMIT),
    [parsedHeaders]
  )
  const parsedHeadersLimited = parsedHeaders.length > visibleParsedHeaders.length
  const findings = useMemo(() => auditIsolation(draft, parsedHeaders), [draft, parsedHeaders])
  const metrics = useMemo(() => {
    const risks = findings.filter(finding => finding.level !== 'good').length
    const validParsed = parsedHeaders.filter(row => row.valid).length

    return {
      isolated: isIsolatedDraft(draft) ? t('public.yes') : t('public.no'),
      coop: draft.coop,
      coep: draft.coep,
      parsed: String(parsedHeaders.length),
      validParsed: String(validParsed),
      risks: String(risks)
    }
  }, [draft, findings, parsedHeaders, t])
  const buildExportJson = useCallback(
    () =>
      JSON.stringify(
        {
          generated: {
            isolated: isIsolatedDraft(draft),
            headers: Object.fromEntries(buildHeaderRows(draft)),
            outputType
          },
          parsedHeaders,
          findings
        },
        null,
        2
      ),
    [draft, findings, outputType, parsedHeaders]
  )
  const buildExportCsv = useCallback(
    () =>
      [
        ['header', 'value', 'valid', 'source', 'raw'],
        ...parsedHeaders.map(row => [row.header, row.value, String(row.valid), row.source, row.raw])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [parsedHeaders]
  )

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setOutputType(preset.outputType)
    setWorkspace(preset.workspace)
  }

  const updateDraft = <Key extends keyof IsolationDraft>(key: Key, value: IsolationDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.cross_origin_isolation.summary_title'),
        `${t('app.converter.cross_origin_isolation.metric.isolated')}: ${metrics.isolated}`,
        `${t('app.converter.cross_origin_isolation.metric.parsed')}: ${metrics.parsed}`,
        `${t('app.converter.cross_origin_isolation.metric.risks')}: ${metrics.risks}`,
        buildOutput(draft, 'raw')
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
                {t('app.converter.cross-origin-isolation')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.cross-origin-isolation')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.cross_origin_isolation.description')}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.cross_origin_isolation.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <IsolationMetric
              label={t('app.converter.cross_origin_isolation.metric.isolated')}
              value={metrics.isolated}
            />
            <IsolationMetric label="COOP" value={metrics.coop} />
            <IsolationMetric label="COEP" value={metrics.coep} />
            <IsolationMetric
              label={t('app.converter.cross_origin_isolation.metric.parsed')}
              value={metrics.parsed}
            />
            <IsolationMetric
              label={t('app.converter.cross_origin_isolation.metric.valid')}
              value={metrics.validParsed}
            />
            <IsolationMetric
              label={t('app.converter.cross_origin_isolation.metric.risks')}
              value={metrics.risks}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.cross_origin_isolation.presets')}
            </CardTitle>
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
                {t(`app.converter.cross_origin_isolation.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.cross_origin_isolation.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">
              {t('app.converter.cross_origin_isolation.builder')}
            </CardTitle>
            <CardDescription>
              {t('app.converter.cross_origin_isolation.builder_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="isolation-coop">COOP</Label>
                <Select
                  id="isolation-coop"
                  value={draft.coop}
                  onChange={event => updateDraft('coop', event.target.value as CoopValue)}
                >
                  {COOP_VALUES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="isolation-coep">COEP</Label>
                <Select
                  id="isolation-coep"
                  value={draft.coep}
                  onChange={event => updateDraft('coep', event.target.value as CoepValue)}
                >
                  {COEP_VALUES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="isolation-include-corp">
                  {t('app.converter.cross_origin_isolation.include_corp')}
                </Label>
                <Select
                  id="isolation-include-corp"
                  value={boolLabel(draft.includeCorp)}
                  onChange={event => updateDraft('includeCorp', event.target.value === 'yes')}
                >
                  <option value="yes">{t('public.yes')}</option>
                  <option value="no">{t('public.no')}</option>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="isolation-corp">CORP</Label>
                <Select
                  id="isolation-corp"
                  value={draft.corp}
                  onChange={event => updateDraft('corp', event.target.value as CorpValue)}
                  disabled={!draft.includeCorp}
                >
                  {CORP_VALUES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="isolation-output-type">
                  {t('app.converter.cross_origin_isolation.output_type')}
                </Label>
                <Select
                  id="isolation-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.cross_origin_isolation.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cross_origin_isolation.readiness')}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {READINESS_KEYS.map(key => {
                  const ready =
                    key === 'opener'
                      ? draft.coop === 'same-origin'
                      : key === 'embedder'
                        ? draft.coep === 'require-corp' || draft.coep === 'credentialless'
                        : draft.includeCorp && draft.corp !== 'cross-origin'

                  return (
                    <div key={key} className="glass-input rounded-xl p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {t(`app.converter.cross_origin_isolation.readiness.${key}`)}
                      </p>
                      <p
                        className={`mt-2 rounded-lg px-2 py-1 text-center text-sm font-semibold ${
                          ready
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-amber-500/10 text-amber-700'
                        }`}
                      >
                        {ready
                          ? t('app.converter.cross_origin_isolation.ready')
                          : t('app.converter.cross_origin_isolation.needs_review')}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {t(`app.converter.cross_origin_isolation.readiness.${key}_hint`)}
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
              <CardTitle className="text-base">
                {t('app.converter.cross_origin_isolation.output_preview')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[240px] font-mono" />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button type="button" onClick={() => copy(buildCurrentOutput())}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWorkspace(buildCurrentOutput())}
              >
                <Search className="h-4 w-4" />
                {t('app.converter.cross_origin_isolation.use_output')}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cross_origin_isolation.audit')}
              </h3>
              <div className="space-y-2">
                {findings.slice(0, 10).map((finding, index) => (
                  <div
                    key={`${finding.key}:${finding.subject}:${index}`}
                    className={`min-w-0 break-all rounded-xl border px-3 py-2 text-xs leading-5 ${getFindingClass(finding.level)}`}
                  >
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2 inline-block">/</span>
                    {t(`app.converter.cross_origin_isolation.audit.${finding.key}`)}
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
              <CardTitle className="text-base">
                {t('app.converter.cross_origin_isolation.workspace')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.cross_origin_isolation.workspace_hint')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(buildExportJson())}>
                <Copy className="h-4 w-4" />
                {t('app.converter.cross_origin_isolation.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildExportCsv(),
                    'cross-origin-isolation.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.cross_origin_isolation.download_csv')}
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
            onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
            placeholder={t('app.converter.cross_origin_isolation.workspace_placeholder')}
            className="min-h-[180px] font-mono"
          />
          <InputCapNotice visible={workspace.length >= WORKSPACE_LIMIT} limit={WORKSPACE_LIMIT} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Layers2 className="h-3.5 w-3.5" />
                COOP
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.cross_origin_isolation.reference.coop')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                COEP
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.cross_origin_isolation.reference.coep')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Globe className="h-3.5 w-3.5" />
                CORP
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.converter.cross_origin_isolation.reference.corp')}
              </p>
            </div>
          </div>

          {parsedHeaders.length ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleParsedHeaders.map((row, index) => (
                  <div
                    key={`${row.header}:${row.value}:${index}`}
                    className="glass-input rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {row.header}
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
                        {row.valid
                          ? t('app.converter.cross_origin_isolation.valid')
                          : t('app.converter.cross_origin_isolation.invalid')}
                      </span>
                    </div>
                    <p className="mt-3 break-all font-mono text-sm text-[var(--text-primary)]">
                      {row.value}
                    </p>
                    <p className="mt-3 line-clamp-3 break-all font-mono text-xs text-[var(--text-tertiary)]">
                      {row.raw}
                    </p>
                  </div>
                ))}
              </div>
              {parsedHeadersLimited && (
                <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.output_preview_rows_limited', {
                    total: parsedHeaders.length.toLocaleString(),
                    visible: visibleParsedHeaders.length.toLocaleString()
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.cross_origin_isolation.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
