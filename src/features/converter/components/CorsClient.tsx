'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  ListChecks,
  RadioTower,
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

const HEADER_GROUPS = ['all', 'response', 'preflight', 'request', 'security'] as const
const OUTPUT_TYPES = ['raw', 'next', 'express', 'nginx', 'cloudflare', 'json'] as const
const CORS_INPUT_LIMIT = 28000
const CORS_ROW_LIMIT = 120

type HeaderGroup = (typeof HEADER_GROUPS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey =
  | 'public_read'
  | 'credentialed_app'
  | 'upload_api'
  | 'preflight'
  | 'private_network'
  | 'font_asset'
type FindingLevel = 'good' | 'warn' | 'danger'

interface CorsDraft {
  allowHeaders: string
  allowMethods: string
  credentials: boolean
  exposeHeaders: string
  maxAge: string
  origin: string
  privateNetwork: boolean
  varyOrigin: boolean
}

interface HeaderInfo {
  example: string
  group: Exclude<HeaderGroup, 'all'>
  name: string
  noteKey: string
}

interface Preset {
  draft: CorsDraft
  key: PresetKey
  workspace: string
}

interface ParsedHeader {
  group: string
  name: string
  value: string
}

interface Finding {
  key: string
  level: FindingLevel
  target: string
}

const DEFAULT_DRAFT: CorsDraft = {
  allowHeaders: 'Content-Type, Authorization',
  allowMethods: 'GET, POST, OPTIONS',
  credentials: false,
  exposeHeaders: 'Content-Length, ETag',
  maxAge: '600',
  origin: 'https://app.example.com',
  privateNetwork: false,
  varyOrigin: true
}

const HEADER_REFERENCE: HeaderInfo[] = [
  {
    name: 'Access-Control-Allow-Origin',
    example: 'Access-Control-Allow-Origin: https://app.example.com',
    group: 'response',
    noteKey: 'app.converter.cors.header.allow_origin'
  },
  {
    name: 'Access-Control-Allow-Credentials',
    example: 'Access-Control-Allow-Credentials: true',
    group: 'security',
    noteKey: 'app.converter.cors.header.allow_credentials'
  },
  {
    name: 'Access-Control-Allow-Methods',
    example: 'Access-Control-Allow-Methods: GET, POST, OPTIONS',
    group: 'preflight',
    noteKey: 'app.converter.cors.header.allow_methods'
  },
  {
    name: 'Access-Control-Allow-Headers',
    example: 'Access-Control-Allow-Headers: Content-Type, Authorization',
    group: 'preflight',
    noteKey: 'app.converter.cors.header.allow_headers'
  },
  {
    name: 'Access-Control-Expose-Headers',
    example: 'Access-Control-Expose-Headers: Content-Length, ETag',
    group: 'response',
    noteKey: 'app.converter.cors.header.expose_headers'
  },
  {
    name: 'Access-Control-Max-Age',
    example: 'Access-Control-Max-Age: 600',
    group: 'preflight',
    noteKey: 'app.converter.cors.header.max_age'
  },
  {
    name: 'Access-Control-Request-Method',
    example: 'Access-Control-Request-Method: PUT',
    group: 'request',
    noteKey: 'app.converter.cors.header.request_method'
  },
  {
    name: 'Access-Control-Request-Headers',
    example: 'Access-Control-Request-Headers: authorization, content-type',
    group: 'request',
    noteKey: 'app.converter.cors.header.request_headers'
  },
  {
    name: 'Access-Control-Allow-Private-Network',
    example: 'Access-Control-Allow-Private-Network: true',
    group: 'security',
    noteKey: 'app.converter.cors.header.private_network'
  },
  {
    name: 'Vary',
    example: 'Vary: Origin',
    group: 'security',
    noteKey: 'app.converter.cors.header.vary'
  }
]

const PRESETS: Preset[] = [
  {
    key: 'public_read',
    draft: {
      ...DEFAULT_DRAFT,
      allowHeaders: 'Content-Type',
      allowMethods: 'GET, HEAD, OPTIONS',
      credentials: false,
      exposeHeaders: 'Content-Length, ETag',
      maxAge: '3600',
      origin: '*',
      varyOrigin: false
    },
    workspace: [
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Methods: GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type',
      'Access-Control-Expose-Headers: Content-Length, ETag',
      'Access-Control-Max-Age: 3600'
    ].join('\n')
  },
  {
    key: 'credentialed_app',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Access-Control-Allow-Origin: https://app.example.com',
      'Access-Control-Allow-Credentials: true',
      'Access-Control-Allow-Methods: GET, POST, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type, Authorization',
      'Access-Control-Expose-Headers: Content-Length, ETag',
      'Access-Control-Max-Age: 600',
      'Vary: Origin'
    ].join('\n')
  },
  {
    key: 'upload_api',
    draft: {
      ...DEFAULT_DRAFT,
      allowHeaders: 'Content-Type, Authorization, X-Upload-Token',
      allowMethods: 'POST, PUT, OPTIONS',
      exposeHeaders: 'Location, ETag',
      maxAge: '300'
    },
    workspace: [
      'Access-Control-Allow-Origin: https://app.example.com',
      'Access-Control-Allow-Credentials: true',
      'Access-Control-Allow-Methods: POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type, Authorization, X-Upload-Token',
      'Access-Control-Expose-Headers: Location, ETag',
      'Access-Control-Max-Age: 300',
      'Vary: Origin'
    ].join('\n')
  },
  {
    key: 'preflight',
    draft: {
      ...DEFAULT_DRAFT,
      allowHeaders: 'Authorization, Content-Type, X-Request-ID',
      allowMethods: 'GET, POST, PATCH, DELETE, OPTIONS',
      maxAge: '86400'
    },
    workspace: [
      'Access-Control-Allow-Origin: https://app.example.com',
      'Access-Control-Allow-Credentials: true',
      'Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers: Authorization, Content-Type, X-Request-ID',
      'Access-Control-Max-Age: 86400',
      'Vary: Origin'
    ].join('\n')
  },
  {
    key: 'private_network',
    draft: {
      ...DEFAULT_DRAFT,
      allowHeaders: 'Content-Type, Authorization',
      allowMethods: 'GET, POST, OPTIONS',
      maxAge: '600',
      origin: 'https://admin.example.com',
      privateNetwork: true
    },
    workspace: [
      'Access-Control-Allow-Origin: https://admin.example.com',
      'Access-Control-Allow-Credentials: true',
      'Access-Control-Allow-Methods: GET, POST, OPTIONS',
      'Access-Control-Allow-Headers: Content-Type, Authorization',
      'Access-Control-Allow-Private-Network: true',
      'Access-Control-Max-Age: 600',
      'Vary: Origin'
    ].join('\n')
  },
  {
    key: 'font_asset',
    draft: {
      ...DEFAULT_DRAFT,
      allowHeaders: '',
      allowMethods: 'GET, OPTIONS',
      credentials: false,
      exposeHeaders: '',
      maxAge: '86400',
      origin: '*',
      varyOrigin: false
    },
    workspace: [
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Methods: GET, OPTIONS',
      'Access-Control-Max-Age: 86400'
    ].join('\n')
  }
]

const normalizeList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .join(', ')

const normalizeSeconds = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return normalized

  return String(Math.max(0, Math.floor(numeric)))
}

const buildCorsHeaders = (draft: CorsDraft) => {
  const rows: Array<[string, string]> = [
    ['Access-Control-Allow-Origin', draft.origin.trim() || '*']
  ]
  const methods = normalizeList(draft.allowMethods)
  const allowHeaders = normalizeList(draft.allowHeaders)
  const exposeHeaders = normalizeList(draft.exposeHeaders)
  const maxAge = normalizeSeconds(draft.maxAge)

  if (draft.credentials) rows.push(['Access-Control-Allow-Credentials', 'true'])
  if (methods) rows.push(['Access-Control-Allow-Methods', methods])
  if (allowHeaders) rows.push(['Access-Control-Allow-Headers', allowHeaders])
  if (exposeHeaders) rows.push(['Access-Control-Expose-Headers', exposeHeaders])
  if (maxAge) rows.push(['Access-Control-Max-Age', maxAge])
  if (draft.privateNetwork) rows.push(['Access-Control-Allow-Private-Network', 'true'])
  if (draft.varyOrigin && draft.origin.trim() !== '*') rows.push(['Vary', 'Origin'])

  return rows
}

const parseHeaderWorkspace = (input: string) => {
  const rows: ParsedHeader[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, CORS_INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue
    const name = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    const lower = name.toLowerCase()
    const known = lower.startsWith('access-control-') || lower === 'vary' || lower === 'origin'

    if (!known || !value) continue

    const key = `${lower}:${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      group: lower.startsWith('access-control-request-')
        ? 'request'
        : lower.includes('credentials') || lower.includes('private-network') || lower === 'vary'
          ? 'security'
          : lower.includes('methods') || lower.includes('headers') || lower.includes('max-age')
            ? 'preflight'
            : 'response',
      name,
      value
    })
    if (rows.length >= CORS_ROW_LIMIT) break
  }

  return rows
}

const firstHeader = (headers: ParsedHeader[], name: string) =>
  headers.find(header => header.name.toLowerCase() === name)?.value || ''

const hasHeader = (headers: ParsedHeader[], name: string) =>
  headers.some(header => header.name.toLowerCase() === name)

const hasVaryOrigin = (headers: ParsedHeader[]) =>
  headers.some(header => header.name.toLowerCase() === 'vary' && /\borigin\b/iu.test(header.value))

const auditHeaders = (headers: ParsedHeader[]): Finding[] => {
  const findings: Finding[] = []
  const origin = firstHeader(headers, 'access-control-allow-origin')
  const credentials =
    firstHeader(headers, 'access-control-allow-credentials').toLowerCase() === 'true'
  const maxAge = Number(firstHeader(headers, 'access-control-max-age'))
  const allowHeaders = firstHeader(headers, 'access-control-allow-headers')
  const exposeHeaders = firstHeader(headers, 'access-control-expose-headers')
  const privateNetwork =
    firstHeader(headers, 'access-control-allow-private-network').toLowerCase() === 'true'

  if (!headers.length) return [{ key: 'empty', level: 'warn', target: '-' }]

  if (!origin) {
    findings.push({ key: 'origin_missing', level: 'danger', target: 'Access-Control-Allow-Origin' })
  } else if (origin === '*') {
    findings.push({ key: 'public_origin', level: 'good', target: origin })
  } else if (origin.toLowerCase() === 'null') {
    findings.push({ key: 'null_origin', level: 'danger', target: origin })
  } else {
    findings.push({ key: 'scoped_origin', level: 'good', target: origin })
  }

  if (origin === '*' && credentials) {
    findings.push({ key: 'wildcard_credentials', level: 'danger', target: 'credentials' })
  } else if (credentials) {
    findings.push({ key: 'credentials_scoped', level: 'good', target: 'credentials' })
  }

  if (origin && origin !== '*' && !hasVaryOrigin(headers)) {
    findings.push({ key: 'vary_missing', level: 'warn', target: 'Vary' })
  } else if (hasVaryOrigin(headers)) {
    findings.push({ key: 'vary_ok', level: 'good', target: 'Vary' })
  }

  if (
    !hasHeader(headers, 'access-control-allow-methods') &&
    !hasHeader(headers, 'access-control-request-method')
  ) {
    findings.push({ key: 'methods_missing', level: 'warn', target: 'Access-Control-Allow-Methods' })
  }

  if (credentials && (allowHeaders.includes('*') || exposeHeaders.includes('*'))) {
    findings.push({ key: 'wildcard_headers_credentials', level: 'warn', target: 'headers' })
  }

  if (Number.isFinite(maxAge) && maxAge > 86400) {
    findings.push({ key: 'max_age_high', level: 'warn', target: 'Access-Control-Max-Age' })
  } else if (Number.isFinite(maxAge) && maxAge > 0) {
    findings.push({ key: 'max_age_ok', level: 'good', target: 'Access-Control-Max-Age' })
  }

  if (privateNetwork && origin === '*') {
    findings.push({ key: 'private_network_public', level: 'warn', target: 'Private Network' })
  } else if (privateNetwork) {
    findings.push({ key: 'private_network_scoped', level: 'good', target: 'Private Network' })
  }

  return findings
}

const buildOutput = (draft: CorsDraft, outputType: OutputType) => {
  const rows = buildCorsHeaders(draft)
  const objectLines = rows
    .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    .join(',\n')
  const raw = rows.map(([name, value]) => `${name}: ${value}`).join('\n')

  switch (outputType) {
    case 'next':
      return `const corsHeaders = {
${objectLines}
}

if (request.method === 'OPTIONS') {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

return NextResponse.json(data, { headers: corsHeaders })`
    case 'express':
      return `res.set({
${objectLines}
})

if (req.method === 'OPTIONS') {
  return res.sendStatus(204)
}`
    case 'nginx':
      return `${rows.map(([name, value]) => `add_header ${name} "${value.replaceAll('"', '\\"')}" always;`).join('\n')}

if ($request_method = OPTIONS) {
  return 204;
}`
    case 'cloudflare':
      return `const corsHeaders = {
${objectLines}
}

if (request.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders })
}

return new Response(body, { headers: corsHeaders })`
    case 'json':
      return JSON.stringify(Object.fromEntries(rows), null, 2)
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

export default function CorsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CorsDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [query, setQuery] = useState('origin')
  const [group, setGroup] = useState<HeaderGroup>('all')
  const [workspace, setWorkspace] = useState(PRESETS[1].workspace)
  const deferredQuery = useDeferredValue(query)
  const deferredWorkspace = useDeferredValue(workspace)

  const headerRows = useMemo(() => buildCorsHeaders(draft), [draft])
  const output = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedHeaders = useMemo(() => parseHeaderWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditHeaders(parsedHeaders), [parsedHeaders])
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
    const corsHeaders = parsedHeaders.filter(header =>
      header.name.toLowerCase().startsWith('access-control-')
    ).length
    const credentialed =
      firstHeader(parsedHeaders, 'access-control-allow-credentials').toLowerCase() === 'true'
    const preflight = parsedHeaders.filter(header => header.group === 'preflight').length
    const dangerous = findings.filter(finding => finding.level === 'danger').length

    return {
      corsHeaders,
      credentialed,
      dangerous,
      preflight,
      total: parsedHeaders.length,
      varyOrigin: hasVaryOrigin(parsedHeaders)
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
          [header.name, header.value, header.group].map(escapeCsv).join(',')
        )
      ].join('\n'),
    [parsedHeaders]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.cors.summary_title'),
        `${t('app.converter.cors.metric.total')}: ${metrics.total}`,
        `${t('app.converter.cors.metric.cors')}: ${metrics.corsHeaders}`,
        `${t('app.converter.cors.metric.preflight')}: ${metrics.preflight}`,
        `${t('app.converter.cors.metric.issues')}: ${metrics.dangerous}`,
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

  const updateDraft = <Key extends keyof CorsDraft>(key: Key, value: CorsDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <RadioTower className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.cors')}
              </CardTitle>
              <CardDescription>{t('app.converter.cors.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.cors.copy_summary')}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <CorsMetric
              label={t('app.converter.cors.metric.total')}
              value={String(metrics.total)}
            />
            <CorsMetric
              label={t('app.converter.cors.metric.cors')}
              value={String(metrics.corsHeaders)}
            />
            <CorsMetric
              label={t('app.converter.cors.metric.preflight')}
              value={String(metrics.preflight)}
            />
            <CorsMetric
              label={t('app.converter.cors.metric.credentials')}
              value={metrics.credentialed ? t('public.yes') : t('public.no')}
            />
            <CorsMetric
              label={t('app.converter.cors.metric.vary')}
              value={metrics.varyOrigin ? t('public.yes') : t('public.no')}
            />
            <CorsMetric
              label={t('app.converter.cors.metric.issues')}
              value={String(metrics.dangerous)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FlaskConical className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.cors.presets')}
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
                    {t(`app.converter.cors.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.cors.preset.${preset.key}_hint`)}
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
            <CardTitle className="text-base">{t('app.converter.cors.builder')}</CardTitle>
            <CardDescription>{t('app.converter.cors.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CorsInput
                id="cors-origin"
                label={t('app.converter.cors.origin')}
                value={draft.origin}
                onChange={value => updateDraft('origin', value)}
              />
              <CorsInput
                id="cors-methods"
                label={t('app.converter.cors.methods')}
                value={draft.allowMethods}
                onChange={value => updateDraft('allowMethods', value)}
              />
              <CorsInput
                id="cors-allow-headers"
                label={t('app.converter.cors.allow_headers')}
                value={draft.allowHeaders}
                onChange={value => updateDraft('allowHeaders', value)}
              />
              <CorsInput
                id="cors-expose-headers"
                label={t('app.converter.cors.expose_headers')}
                value={draft.exposeHeaders}
                onChange={value => updateDraft('exposeHeaders', value)}
              />
              <CorsInput
                id="cors-max-age"
                label={t('app.converter.cors.max_age')}
                value={draft.maxAge}
                onChange={value => updateDraft('maxAge', value)}
              />
              <CorsBoolean
                id="cors-credentials"
                label={t('app.converter.cors.credentials')}
                value={draft.credentials}
                onChange={value => updateDraft('credentials', value)}
              />
              <CorsBoolean
                id="cors-private-network"
                label={t('app.converter.cors.private_network')}
                value={draft.privateNetwork}
                onChange={value => updateDraft('privateNetwork', value)}
              />
              <CorsBoolean
                id="cors-vary-origin"
                label={t('app.converter.cors.vary_origin')}
                value={draft.varyOrigin}
                onChange={value => updateDraft('varyOrigin', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="cors-output-type">{t('app.converter.cors.output_type')}</Label>
                <Select
                  id="cors-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.cors.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cors.output_preview')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setWorkspace(headerRows.map(([name, value]) => `${name}: ${value}`).join('\n'))
                }
              >
                {t('app.converter.cors.use_output')}
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
                <CardTitle className="text-base">{t('app.converter.cors.workspace')}</CardTitle>
                <CardDescription>{t('app.converter.cors.workspace_hint')}</CardDescription>
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
              onChange={event => setWorkspace(event.target.value.slice(0, CORS_INPUT_LIMIT))}
              rows={10}
              placeholder={t('app.converter.cors.workspace_placeholder')}
              className="min-h-[220px] resize-y font-mono"
            />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cors.audit')}
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
                    {t(`app.converter.cors.audit.${finding.key}`)}
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
                {t('app.converter.cors.parsed')}
              </CardTitle>
              <CardDescription>{t('app.converter.cors.parsed_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(exportJson)}
              >
                {t('app.converter.cors.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(exportCsv, 'daily-tools-cors.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.converter.cors.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-3">
              <Label htmlFor="cors-search">{t('app.converter.cors.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="cors-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={t('app.converter.cors.search_placeholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="cors-group">{t('app.converter.cors.group')}</Label>
              <Select
                id="cors-group"
                value={group}
                onChange={event => setGroup(event.target.value as HeaderGroup)}
              >
                {HEADER_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.cors.group.${value}`)}
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
                    {t(`app.converter.cors.group.${header.group}`)}
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
                <div key={`${header.name}:${header.value}`} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {header.name}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.cors.group.${header.group}`)}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {header.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.cors.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const CorsMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const CorsInput = ({
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

const CorsBoolean = ({
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
