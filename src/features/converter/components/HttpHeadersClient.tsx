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

const HEADER_CATEGORIES = [
  'all',
  'security',
  'cache',
  'cors',
  'content',
  'download',
  'network'
] as const
const OUTPUT_TYPES = ['raw', 'next', 'nginx', 'curl', 'json'] as const
const BATCH_INPUT_LIMIT = 28000
const CUSTOM_HEADER_LIMIT = 80

type HeaderCategory = (typeof HEADER_CATEGORIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey = 'secure_api' | 'static_asset' | 'cors_api' | 'download' | 'html_page' | 'sse'
type AuditLevel = 'good' | 'warn' | 'danger'

interface HeaderInfo {
  category: Exclude<HeaderCategory, 'all'>
  example: string
  name: string
  note: string
  priority: 'standard' | 'recommended' | 'critical'
}

interface Preset {
  headers: Array<[string, string]>
  key: PresetKey
  query: string
}

interface HeaderRow {
  category: string
  known: boolean
  name: string
  value: string
}

interface AuditItem {
  key: string
  level: AuditLevel
}

const HEADER_REFERENCE: HeaderInfo[] = [
  {
    name: 'Content-Type',
    example: 'application/json; charset=utf-8',
    category: 'content',
    priority: 'critical',
    note: 'Declares the media type and charset for the response body.'
  },
  {
    name: 'Content-Length',
    example: '1024',
    category: 'content',
    priority: 'standard',
    note: 'Advertises response body byte length when it is known.'
  },
  {
    name: 'Content-Disposition',
    example: 'attachment; filename="report.pdf"',
    category: 'download',
    priority: 'recommended',
    note: 'Controls inline display or file download naming.'
  },
  {
    name: 'Cache-Control',
    example: 'public, max-age=31536000, immutable',
    category: 'cache',
    priority: 'critical',
    note: 'Defines browser and shared-cache storage behavior.'
  },
  {
    name: 'ETag',
    example: '"asset-v1"',
    category: 'cache',
    priority: 'recommended',
    note: 'Enables conditional requests and 304 responses.'
  },
  {
    name: 'Last-Modified',
    example: 'Tue, 09 Jun 2026 12:00:00 GMT',
    category: 'cache',
    priority: 'standard',
    note: 'Enables date-based conditional requests.'
  },
  {
    name: 'Vary',
    example: 'Accept-Encoding, Origin',
    category: 'cache',
    priority: 'recommended',
    note: 'Tells caches which request headers affect the response.'
  },
  {
    name: 'Strict-Transport-Security',
    example: 'max-age=31536000; includeSubDomains; preload',
    category: 'security',
    priority: 'critical',
    note: 'Forces HTTPS for future requests after the first secure response.'
  },
  {
    name: 'Content-Security-Policy',
    example: "default-src 'self'; frame-ancestors 'none'",
    category: 'security',
    priority: 'critical',
    note: 'Restricts where resources can load from and where the page can be framed.'
  },
  {
    name: 'X-Content-Type-Options',
    example: 'nosniff',
    category: 'security',
    priority: 'critical',
    note: 'Prevents MIME sniffing for scripts and styles.'
  },
  {
    name: 'Referrer-Policy',
    example: 'strict-origin-when-cross-origin',
    category: 'security',
    priority: 'recommended',
    note: 'Controls how much referrer information is sent to other origins.'
  },
  {
    name: 'Permissions-Policy',
    example: 'camera=(), microphone=(), geolocation=()',
    category: 'security',
    priority: 'recommended',
    note: 'Disables or scopes browser features for the page.'
  },
  {
    name: 'Access-Control-Allow-Origin',
    example: 'https://app.example.com',
    category: 'cors',
    priority: 'critical',
    note: 'Controls which origins can read the response in browsers.'
  },
  {
    name: 'Access-Control-Allow-Methods',
    example: 'GET, POST, OPTIONS',
    category: 'cors',
    priority: 'recommended',
    note: 'Lists methods allowed by a CORS preflight response.'
  },
  {
    name: 'Access-Control-Allow-Headers',
    example: 'Content-Type, Authorization',
    category: 'cors',
    priority: 'recommended',
    note: 'Lists request headers allowed by a CORS preflight response.'
  },
  {
    name: 'Access-Control-Allow-Credentials',
    example: 'true',
    category: 'cors',
    priority: 'recommended',
    note: 'Allows browsers to expose credentialed cross-origin responses.'
  },
  {
    name: 'Retry-After',
    example: '120',
    category: 'network',
    priority: 'recommended',
    note: 'Tells clients when to retry rate-limited or unavailable responses.'
  },
  {
    name: 'Location',
    example: 'https://example.com/new-path',
    category: 'network',
    priority: 'standard',
    note: 'Redirect or async-job target URL.'
  },
  {
    name: 'Accept-Ranges',
    example: 'bytes',
    category: 'download',
    priority: 'standard',
    note: 'Advertises support for byte-range requests.'
  },
  {
    name: 'Content-Encoding',
    example: 'br',
    category: 'network',
    priority: 'standard',
    note: 'Declares response compression encoding.'
  }
]

const PRESETS: Preset[] = [
  {
    key: 'secure_api',
    query: 'security json cache',
    headers: [
      ['Content-Type', 'application/json; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['X-Content-Type-Options', 'nosniff'],
      ['Referrer-Policy', 'strict-origin-when-cross-origin'],
      ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()']
    ]
  },
  {
    key: 'static_asset',
    query: 'cache immutable etag',
    headers: [
      ['Content-Type', 'text/css; charset=utf-8'],
      ['Cache-Control', 'public, max-age=31536000, immutable'],
      ['ETag', '"styles-v42"'],
      ['Vary', 'Accept-Encoding'],
      ['Content-Encoding', 'br']
    ]
  },
  {
    key: 'cors_api',
    query: 'cors origin credentials',
    headers: [
      ['Access-Control-Allow-Origin', 'https://app.example.com'],
      ['Access-Control-Allow-Methods', 'GET, POST, OPTIONS'],
      ['Access-Control-Allow-Headers', 'Content-Type, Authorization'],
      ['Access-Control-Allow-Credentials', 'true'],
      ['Vary', 'Origin']
    ]
  },
  {
    key: 'download',
    query: 'download attachment ranges',
    headers: [
      ['Content-Type', 'application/pdf'],
      ['Content-Disposition', 'attachment; filename="report.pdf"'],
      ['Cache-Control', 'private, max-age=600'],
      ['Accept-Ranges', 'bytes'],
      ['X-Content-Type-Options', 'nosniff']
    ]
  },
  {
    key: 'html_page',
    query: 'html csp hsts',
    headers: [
      ['Content-Type', 'text/html; charset=utf-8'],
      ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'],
      ['Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'"],
      ['Referrer-Policy', 'strict-origin-when-cross-origin'],
      ['X-Content-Type-Options', 'nosniff']
    ]
  },
  {
    key: 'sse',
    query: 'event stream no buffer',
    headers: [
      ['Content-Type', 'text/event-stream; charset=utf-8'],
      ['Cache-Control', 'no-cache, no-transform'],
      ['Connection', 'keep-alive'],
      ['X-Accel-Buffering', 'no'],
      ['Vary', 'Origin']
    ]
  }
]

const HEADER_MAP = new Map(HEADER_REFERENCE.map(header => [header.name.toLowerCase(), header]))

const normalizeHeaderName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('-')

const parseHeaderLines = (value: string): HeaderRow[] => {
  const rows: HeaderRow[] = []
  const seen = new Set<string>()

  for (const rawLine of value.slice(0, BATCH_INPUT_LIMIT).split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator <= 0) continue

    const name = normalizeHeaderName(line.slice(0, separator))
    const normalized = name.toLowerCase()
    const info = HEADER_MAP.get(normalized)
    const valuePart = line.slice(separator + 1).trim()
    const key = `${normalized}:${valuePart}`

    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      category: info?.category ?? 'custom',
      known: Boolean(info),
      name,
      value: valuePart
    })

    if (rows.length >= CUSTOM_HEADER_LIMIT) break
  }

  return rows
}

const stringifyHeaders = (rows: HeaderRow[]) =>
  rows.map(row => `${row.name}: ${row.value}`).join('\n')

const createCategoryCounts = () => ({
  cache: 0,
  content: 0,
  cors: 0,
  download: 0,
  network: 0,
  security: 0
})

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const buildOutput = (rows: HeaderRow[], outputType: OutputType) => {
  const raw = stringifyHeaders(rows)
  const headerObject = Object.fromEntries(rows.map(row => [row.name, row.value]))

  switch (outputType) {
    case 'curl':
      return `curl -I https://example.com \\\n${rows
        .map(row => `  -H "${row.name}: ${row.value}"`)
        .join(' \\\n')}`
    case 'json':
      return JSON.stringify(headerObject, null, 2)
    case 'nginx':
      return rows.map(row => `add_header ${row.name} "${row.value}" always;`).join('\n')
    case 'next':
      return `return new Response(body, {
  headers: {
${rows.map(row => `    '${row.name}': '${row.value.replaceAll("'", "\\'")}'`).join(',\n')}
  }
})`
    case 'raw':
    default:
      return raw
  }
}

const auditHeaders = (rows: HeaderRow[]): AuditItem[] => {
  const valueByName = new Map(rows.map(row => [row.name.toLowerCase(), row.value.toLowerCase()]))
  const items: AuditItem[] = []
  const contentType = valueByName.get('content-type') ?? ''
  const cacheControl = valueByName.get('cache-control') ?? ''
  const allowOrigin = valueByName.get('access-control-allow-origin') ?? ''
  const allowCredentials = valueByName.get('access-control-allow-credentials') ?? ''

  if (valueByName.get('x-content-type-options') === 'nosniff') {
    items.push({ key: 'nosniff_ok', level: 'good' })
  } else {
    items.push({ key: 'nosniff_missing', level: 'warn' })
  }

  if (contentType.includes('text/html') && valueByName.has('content-security-policy')) {
    items.push({ key: 'csp_ok', level: 'good' })
  } else if (contentType.includes('text/html')) {
    items.push({ key: 'csp_missing', level: 'danger' })
  }

  if (contentType.includes('text/html') && valueByName.has('strict-transport-security')) {
    items.push({ key: 'hsts_ok', level: 'good' })
  }

  if (cacheControl.includes('no-store')) {
    items.push({ key: 'private_cache_ok', level: 'good' })
  } else if (contentType.includes('application/json') && !cacheControl) {
    items.push({ key: 'cache_missing', level: 'warn' })
  }

  if (allowOrigin === '*' && allowCredentials === 'true') {
    items.push({ key: 'cors_wildcard_credentials', level: 'danger' })
  } else if (allowOrigin && allowCredentials === 'true') {
    items.push({ key: 'cors_credentials_scoped', level: 'good' })
  } else if (allowOrigin === '*') {
    items.push({ key: 'cors_public', level: 'warn' })
  }

  if (valueByName.has('content-disposition') && !valueByName.has('content-type')) {
    items.push({ key: 'download_missing_type', level: 'warn' })
  }

  if (valueByName.has('vary')) {
    items.push({ key: 'vary_present', level: 'good' })
  }

  return items.length ? items : [{ key: 'baseline_ok', level: 'good' }]
}

const analyzeRows = (rows: HeaderRow[]) => {
  const categoryCounts = createCategoryCounts()
  let known = 0

  for (const row of rows) {
    if (row.known) known += 1
    if (row.category in categoryCounts) {
      categoryCounts[row.category as keyof typeof categoryCounts] += 1
    }
  }

  const exportCsv = [
    'name,value,category,known',
    ...rows.map(row => [row.name, row.value, row.category, row.known].map(escapeCsv).join(','))
  ].join('\n')

  return {
    categoryCounts,
    exportCsv,
    exportJson: JSON.stringify(
      {
        total: rows.length,
        known,
        custom: rows.length - known,
        categories: categoryCounts,
        rows
      },
      null,
      2
    ),
    known,
    total: rows.length,
    custom: rows.length - known
  }
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

export default function HttpHeadersClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [query, setQuery] = useState('security')
  const [category, setCategory] = useState<HeaderCategory>('all')
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [headerText, setHeaderText] = useState(() =>
    stringifyHeaders(
      PRESETS[0].headers.map(([name, value]) => ({ category: 'custom', known: false, name, value }))
    )
  )
  const deferredQuery = useDeferredValue(query)
  const deferredHeaderText = useDeferredValue(headerText)

  const parsedRows = useMemo(() => parseHeaderLines(deferredHeaderText), [deferredHeaderText])
  const analysis = useMemo(() => analyzeRows(parsedRows), [parsedRows])
  const auditItems = useMemo(() => auditHeaders(parsedRows), [parsedRows])
  const output = useMemo(() => buildOutput(parsedRows, outputType), [outputType, parsedRows])
  const filteredReference = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return HEADER_REFERENCE.filter(header => {
      const matchesCategory = category === 'all' || header.category === category
      const matchesQuery =
        !normalized ||
        header.name.toLowerCase().includes(normalized) ||
        header.example.toLowerCase().includes(normalized) ||
        header.note.toLowerCase().includes(normalized) ||
        header.category.includes(normalized)

      return matchesCategory && matchesQuery
    })
  }, [category, deferredQuery])
  const categoryCounts = useMemo(
    () =>
      HEADER_CATEGORIES.filter(item => item !== 'all').map(item => ({
        category: item,
        count: HEADER_REFERENCE.filter(header => header.category === item).length
      })),
    []
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.http_headers.summary_title'),
        `${t('app.converter.http_headers.metric.total')}: ${analysis.total}`,
        `${t('app.converter.http_headers.metric.known')}: ${analysis.known}`,
        `${t('app.converter.http_headers.metric.custom')}: ${analysis.custom}`,
        stringifyHeaders(parsedRows)
      ].join('\n'),
    [analysis.custom, analysis.known, analysis.total, parsedRows, t]
  )

  const loadPreset = (preset: Preset) => {
    setQuery(preset.query)
    setCategory('all')
    setHeaderText(
      stringifyHeaders(
        preset.headers.map(([name, value]) => ({
          category: 'custom',
          known: false,
          name,
          value
        }))
      )
    )
  }

  const addHeader = (header: HeaderInfo) => {
    const rows = parseHeaderLines(headerText)
    const exists = rows.some(row => row.name.toLowerCase() === header.name.toLowerCase())
    const nextRows = exists
      ? rows.map(row =>
          row.name.toLowerCase() === header.name.toLowerCase()
            ? { ...row, value: header.example }
            : row
        )
      : [
          ...rows,
          {
            category: header.category,
            known: true,
            name: header.name,
            value: header.example
          }
        ]

    setHeaderText(stringifyHeaders(nextRows))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.http_headers')}
              </CardTitle>
              <CardDescription>{t('app.converter.http_headers.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.http_headers.copy_summary')}
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
            <HeaderMetric
              label={t('app.converter.http_headers.metric.total')}
              value={String(analysis.total)}
            />
            <HeaderMetric
              label={t('app.converter.http_headers.metric.known')}
              value={String(analysis.known)}
            />
            <HeaderMetric
              label={t('app.converter.http_headers.metric.custom')}
              value={String(analysis.custom)}
            />
            <HeaderMetric
              label={t('app.converter.http_headers.metric.audit')}
              value={String(auditItems.length)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.http_headers.presets')}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {t(`app.converter.http_headers.preset.${preset.key}`)}
                    </span>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {preset.headers.length}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.http_headers.preset.${preset.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_190px]">
            <div className="space-y-3">
              <Label htmlFor="header-search">{t('app.converter.http_headers.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="header-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="CSP, cache, cors"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="header-category">{t('app.converter.http_headers.category')}</Label>
              <Select
                id="header-category"
                value={category}
                onChange={event => setCategory(event.target.value as HeaderCategory)}
              >
                {HEADER_CATEGORIES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.http_headers.category.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="header-output">{t('app.converter.http_headers.output_type')}</Label>
              <Select
                id="header-output"
                value={outputType}
                onChange={event => setOutputType(event.target.value as OutputType)}
              >
                {OUTPUT_TYPES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.http_headers.output.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">
                {t('app.converter.http_headers.reference')}
              </CardTitle>
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.converter.http_headers.result_count', { count: filteredReference.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredReference.length ? (
              filteredReference.map(header => (
                <button
                  key={header.name}
                  type="button"
                  onClick={() => addHeader(header)}
                  className="glass-input rounded-xl p-4 text-left transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {header.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.http_headers.category.${header.category}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {header.note}
                  </p>
                  <p className="mt-3 break-all rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                    {header.example}
                  </p>
                </button>
              ))
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)] md:col-span-2">
                {t('app.converter.http_headers.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.http_headers.workspace')}
                </CardTitle>
                <CardDescription>{t('app.converter.http_headers.workspace_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setHeaderText('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <Textarea
              value={headerText}
              onChange={event => setHeaderText(event.target.value.slice(0, BATCH_INPUT_LIMIT))}
              rows={12}
              className="min-h-[250px] resize-y font-mono"
            />

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {t('app.converter.http_headers.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {auditItems.map(item => (
                  <div
                    key={item.key}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${auditColor(item.level)}`}
                    />
                    {t(`app.converter.http_headers.audit.${item.key}`)}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.http_headers.output_preview')}
            </div>
            <Textarea
              value={output}
              readOnly
              rows={8}
              className="min-h-[190px] resize-none font-mono"
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
                {t('app.converter.http_headers.batch')}
              </CardTitle>
              <CardDescription>{t('app.converter.http_headers.batch_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => loadPreset(PRESETS[4])}
              >
                {t('app.converter.http_headers.sample')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(analysis.exportJson)}
              >
                {t('app.converter.http_headers.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    analysis.exportCsv,
                    'daily-tools-http-headers.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.converter.http_headers.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {categoryCounts.map(item => (
              <div key={item.category} className="glass-input rounded-xl p-3">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t(`app.converter.http_headers.category.${item.category}`)}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {analysis.categoryCounts[item.category]}
                </p>
              </div>
            ))}
          </div>

          {parsedRows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedRows.map(row => (
                <div key={`${row.name}:${row.value}`} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {row.name}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {row.known
                        ? t(`app.converter.http_headers.category.${row.category}`)
                        : t('app.converter.http_headers.custom')}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.http_headers.batch_empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const HeaderMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const auditColor = (level: AuditLevel) => {
  if (level === 'danger') return 'bg-red-400'
  if (level === 'warn') return 'bg-amber-300'
  return 'bg-emerald-300'
}
