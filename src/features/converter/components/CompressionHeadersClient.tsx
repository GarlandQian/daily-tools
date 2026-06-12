'use client'

import {
  AlertTriangle,
  Archive,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react'
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
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

const ALGORITHMS = ['br', 'gzip', 'zstd', 'deflate', 'identity'] as const
const CONTENT_TYPES = [
  'text_html',
  'json',
  'css',
  'js',
  'svg',
  'font',
  'image',
  'wasm',
  'binary'
] as const
const CACHE_SCOPES = ['cdn', 'origin', 'browser', 'private'] as const
const OUTPUT_TYPES = ['headers', 'nginx', 'apache', 'cloudflare', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 50000
const HEADER_LIMIT = 160
const ROUTE_PATTERN_FIELD_LIMIT = 240

type Algorithm = (typeof ALGORITHMS)[number]
type ContentType = (typeof CONTENT_TYPES)[number]
type CacheScope = (typeof CACHE_SCOPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface CompressionDraft {
  acceptEncoding: Algorithm[]
  cacheScope: CacheScope
  compressedBytes: string
  contentEncoding: Algorithm
  contentType: ContentType
  enableVary: boolean
  routePattern: string
  streaming: boolean
  uncompressedBytes: string
}

interface ParsedHeaders {
  acceptEncoding: string[]
  contentEncoding: string[]
  contentLength: string
  contentType: string
  errors: string[]
  raw: Array<{ name: string; value: string }>
  vary: string[]
}

interface Preset {
  draft: CompressionDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: CompressionDraft = {
  acceptEncoding: ['br', 'gzip', 'zstd'],
  cacheScope: 'cdn',
  compressedBytes: '42000',
  contentEncoding: 'br',
  contentType: 'json',
  enableVary: true,
  routePattern: '/api/:path*',
  streaming: false,
  uncompressedBytes: '168000'
}

const PRESETS: Preset[] = [
  {
    key: 'json_api',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Accept-Encoding: br, gzip, zstd',
      'Content-Type: application/json; charset=utf-8',
      'Content-Encoding: br',
      'Content-Length: 42000',
      'Vary: Accept-Encoding'
    ].join('\n')
  },
  {
    key: 'static_assets',
    draft: {
      ...DEFAULT_DRAFT,
      cacheScope: 'cdn',
      compressedBytes: '18600',
      contentEncoding: 'br',
      contentType: 'css',
      routePattern: '/assets/:path*',
      uncompressedBytes: '82000'
    },
    workspace: [
      'Accept-Encoding: br, gzip',
      'Content-Type: text/css',
      'Content-Encoding: br',
      'Content-Length: 18600',
      'Vary: Accept-Encoding'
    ].join('\n')
  },
  {
    key: 'streaming_html',
    draft: {
      ...DEFAULT_DRAFT,
      cacheScope: 'origin',
      compressedBytes: '0',
      contentEncoding: 'gzip',
      contentType: 'text_html',
      routePattern: '/:path*',
      streaming: true,
      uncompressedBytes: '96000'
    },
    workspace: [
      'Accept-Encoding: gzip, br',
      'Content-Type: text/html; charset=utf-8',
      'Content-Encoding: gzip',
      'Vary: Accept-Encoding'
    ].join('\n')
  },
  {
    key: 'zstd_edge',
    draft: {
      ...DEFAULT_DRAFT,
      acceptEncoding: ['zstd', 'br', 'gzip'],
      compressedBytes: '31000',
      contentEncoding: 'zstd',
      contentType: 'wasm',
      routePattern: '/runtime/:path*',
      uncompressedBytes: '120000'
    },
    workspace: [
      'Accept-Encoding: zstd, br, gzip',
      'Content-Type: application/wasm',
      'Content-Encoding: zstd',
      'Content-Length: 31000',
      'Vary: Accept-Encoding'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      acceptEncoding: ['identity'],
      cacheScope: 'cdn',
      compressedBytes: '76000',
      contentEncoding: 'gzip',
      contentType: 'image',
      enableVary: false,
      routePattern: '/media/:path*',
      streaming: false,
      uncompressedBytes: '79000'
    },
    workspace: [
      'Accept-Encoding: identity',
      'Content-Type: image/jpeg',
      'Content-Encoding: gzip',
      'Content-Encoding: br',
      'Content-Length: 76000',
      'Vary: Origin'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['vary', 'types', 'fallback', 'measure'] as const

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const CONTENT_TYPE_MAP: Record<ContentType, string> = {
  binary: 'application/octet-stream',
  css: 'text/css',
  font: 'font/woff2',
  image: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  text_html: 'text/html',
  wasm: 'application/wasm'
}

const COMPRESSIBLE_TYPES = new Set<ContentType>(['css', 'js', 'json', 'svg', 'text_html', 'wasm'])
const ALREADY_COMPRESSED_TYPES = new Set<ContentType>(['font', 'image', 'binary'])

const parseBytes = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const compressionRatio = (draft: CompressionDraft) => {
  const uncompressed = parseBytes(draft.uncompressedBytes)
  const compressed = parseBytes(draft.compressedBytes)
  if (!uncompressed || !compressed || compressed > uncompressed) return 0
  return Math.round((1 - compressed / uncompressed) * 100)
}

const splitTokens = (value: string) =>
  value
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)

const normalizeAlgorithm = (value: string): Algorithm | null => {
  const token = value.trim().toLowerCase()
  return ALGORITHMS.includes(token as Algorithm) ? (token as Algorithm) : null
}

const parseHeaders = (input: string): ParsedHeaders => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedHeaders = {
    acceptEncoding: [],
    contentEncoding: [],
    contentLength: '',
    contentType: '',
    errors: [],
    raw: [],
    vary: []
  }

  source.split(/\r?\n/u).forEach(line => {
    if (parsed.raw.length >= HEADER_LIMIT) return
    const match = line.match(/^\s*([^:#]+)\s*:\s*(.+?)\s*$/u)
    if (!match?.[1] || !match[2]) return
    const name = match[1].trim()
    const value = match[2].trim()
    parsed.raw.push({ name, value })
    const lower = name.toLowerCase()

    if (lower === 'accept-encoding')
      parsed.acceptEncoding.push(
        ...splitTokens(value).map(token => token.split(';')[0]?.trim() ?? '')
      )
    if (lower === 'content-encoding') parsed.contentEncoding.push(...splitTokens(value))
    if (lower === 'content-type') parsed.contentType = value
    if (lower === 'content-length') parsed.contentLength = value
    if (lower === 'vary') parsed.vary.push(...splitTokens(value))
  })

  if (input.length >= WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const buildRequestHeaders = (draft: CompressionDraft) => [
  `Accept-Encoding: ${draft.acceptEncoding.join(', ')}`
]

const buildResponseHeaders = (draft: CompressionDraft) => {
  const lines = [
    `Content-Type: ${CONTENT_TYPE_MAP[draft.contentType]}`,
    `Content-Encoding: ${draft.contentEncoding}`
  ]
  const compressed = parseBytes(draft.compressedBytes)
  if (compressed > 0) lines.push(`Content-Length: ${compressed}`)
  if (draft.enableVary) lines.push('Vary: Accept-Encoding')
  return lines
}

const buildHeaderPreview = (draft: CompressionDraft) => [
  '# Request negotiation sample',
  ...buildRequestHeaders(draft),
  '',
  '# Response headers',
  ...buildResponseHeaders(draft)
]

const buildOutput = (draft: CompressionDraft, outputType: OutputType) => {
  const requestLines = buildRequestHeaders(draft)
  const responseLines = buildResponseHeaders(draft)
  const lines = buildHeaderPreview(draft)

  if (outputType === 'nginx') {
    return [
      'gzip on;',
      'gzip_vary on;',
      'gzip_types text/plain text/css application/json application/javascript image/svg+xml application/wasm;',
      'brotli on;',
      'brotli_types text/plain text/css application/json application/javascript image/svg+xml application/wasm;',
      `# Route: ${draft.routePattern}`
    ].join('\n')
  }

  if (outputType === 'apache') {
    return [
      'AddOutputFilterByType BROTLI_COMPRESS text/html text/css application/json text/javascript image/svg+xml',
      'AddOutputFilterByType DEFLATE text/html text/css application/json text/javascript image/svg+xml',
      'Header append Vary Accept-Encoding',
      `# Route: ${draft.routePattern}`
    ].join('\n')
  }

  if (outputType === 'cloudflare') {
    return [
      'export default {',
      '  async fetch(request, env, ctx) {',
      '    const response = await env.ASSETS.fetch(request)',
      '    const next = new Response(response.body, response)',
      `    next.headers.set('Content-Type', ${JSON.stringify(CONTENT_TYPE_MAP[draft.contentType])})`,
      `    next.headers.set('Vary', 'Accept-Encoding')`,
      '    return next',
      '  }',
      '}'
    ].join('\n')
  }

  if (outputType === 'json') {
    return JSON.stringify(
      {
        compressionRatio: compressionRatio(draft),
        request: Object.fromEntries(
          requestLines.map(line => {
            const [name = '', ...valueParts] = line.split(':')
            return [name.trim(), valueParts.join(':').trim()]
          })
        ),
        response: Object.fromEntries(
          responseLines.map(line => {
            const [name = '', ...valueParts] = line.split(':')
            return [name.trim(), valueParts.join(':').trim()]
          })
        ),
        routePattern: draft.routePattern
      },
      null,
      2
    )
  }

  if (outputType === 'csv') {
    return [
      'route,contentType,contentEncoding,acceptEncoding,uncompressedBytes,compressedBytes,ratio,vary',
      [
        draft.routePattern,
        CONTENT_TYPE_MAP[draft.contentType],
        draft.contentEncoding,
        draft.acceptEncoding.join(' '),
        draft.uncompressedBytes,
        draft.compressedBytes,
        String(compressionRatio(draft)),
        String(draft.enableVary)
      ]
        .map(escapeCsv)
        .join(',')
    ].join('\n')
  }

  return lines.join('\n')
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditCompression = (draft: CompressionDraft, parsed: ParsedHeaders): Finding[] => {
  const findings: Finding[] = []
  const ratio = compressionRatio(draft)
  const uncompressed = parseBytes(draft.uncompressedBytes)
  const compressed = parseBytes(draft.compressedBytes)
  const parsedEncodings = parsed.contentEncoding.map(token => token.toLowerCase())
  const parsedAccept = parsed.acceptEncoding
    .map(token => token.toLowerCase())
    .map(token => token.split('=')[0] ?? token)
  const parsedVary = parsed.vary.map(token => token.toLowerCase())

  if (!draft.enableVary && draft.cacheScope !== 'private')
    addFinding(findings, 'danger', 'missing_vary', draft.routePattern)
  if (draft.acceptEncoding.includes('identity') && draft.acceptEncoding.length === 1) {
    addFinding(findings, 'warn', 'identity_only', 'Accept-Encoding')
  }
  if (
    !draft.acceptEncoding.includes(draft.contentEncoding) &&
    draft.contentEncoding !== 'identity'
  ) {
    addFinding(findings, 'danger', 'unsupported_encoding', draft.contentEncoding)
  }
  if (draft.contentEncoding === 'deflate')
    addFinding(findings, 'warn', 'deflate_legacy', draft.contentEncoding)
  if (draft.contentEncoding === 'gzip' && !draft.acceptEncoding.includes('br'))
    addFinding(findings, 'warn', 'gzip_only', draft.contentEncoding)
  if (ALREADY_COMPRESSED_TYPES.has(draft.contentType) && draft.contentEncoding !== 'identity') {
    addFinding(findings, 'warn', 'already_compressed', CONTENT_TYPE_MAP[draft.contentType])
  }
  if (COMPRESSIBLE_TYPES.has(draft.contentType) && draft.contentEncoding === 'identity') {
    addFinding(findings, 'warn', 'missed_compression', CONTENT_TYPE_MAP[draft.contentType])
  }
  if (uncompressed > 0 && uncompressed < 1024 && draft.contentEncoding !== 'identity') {
    addFinding(findings, 'warn', 'tiny_payload', `${uncompressed}`)
  }
  if (compressed > uncompressed && uncompressed > 0)
    addFinding(findings, 'danger', 'negative_savings', `${compressed}/${uncompressed}`)
  if (ratio > 0 && ratio < 10 && draft.contentEncoding !== 'identity')
    addFinding(findings, 'warn', 'low_savings', `${ratio}%`)
  if (ratio >= 45) addFinding(findings, 'good', 'ratio_good', `${ratio}%`)
  if (draft.streaming && draft.contentEncoding === 'br')
    addFinding(findings, 'warn', 'brotli_streaming', draft.routePattern)
  if (
    draft.contentType === 'wasm' &&
    draft.contentEncoding === 'gzip' &&
    draft.acceptEncoding.includes('br')
  ) {
    addFinding(findings, 'warn', 'wasm_brotli', 'application/wasm')
  }

  if (parsed.raw.length) {
    if (parsedEncodings.length > 1)
      addFinding(findings, 'danger', 'double_encoding', parsedEncodings.join(', '))
    if (parsedEncodings.some(token => !normalizeAlgorithm(token)))
      addFinding(findings, 'warn', 'unknown_encoding', parsedEncodings.join(', '))
    if (
      !parsedVary.includes('accept-encoding') &&
      parsedEncodings.length &&
      draft.cacheScope !== 'private'
    ) {
      addFinding(findings, 'danger', 'parsed_missing_vary', 'Vary')
    }
    if (parsedAccept.includes('identity') && parsedAccept.length === 1)
      addFinding(findings, 'warn', 'parsed_identity_only', 'Accept-Encoding')
    if (
      parsed.contentType &&
      /image\/|font\/|zip|br|gzip|zstd/i.test(parsed.contentType) &&
      parsedEncodings.length
    ) {
      addFinding(findings, 'warn', 'parsed_precompressed', parsed.contentType)
    }
    addFinding(findings, 'good', 'parse_ok', String(parsed.raw.length))
  } else {
    addFinding(findings, 'warn', 'parse_missing', '-')
  }

  if (parsed.errors.includes('truncated'))
    addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', draft.routePattern)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length
  return Math.max(0, Math.min(100, 88 + good * 3 - warn * 6 - danger * 20))
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-input min-w-0 rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function CompressionHeadersClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CompressionDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('headers')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const parsed = useMemo(() => parseHeaders(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditCompression(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const ratio = useMemo(() => compressionRatio(draft), [draft])
  const outputPreviewSource = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(() => buildOutput(draft, outputType), [draft, outputType])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.compression_headers.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredHeaders = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return parsed.raw
    return parsed.raw.filter(header =>
      `${header.name} ${header.value}`.toLowerCase().includes(query)
    )
  }, [deferredParsedQuery, parsed.raw])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      encodings: draft.acceptEncoding.length,
      ratio,
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.acceptEncoding.length, findings, ratio, score]
  )

  const updateDraft = <Key extends keyof CompressionDraft>(
    key: Key,
    value: CompressionDraft[Key]
  ) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const toggleAcceptEncoding = (algorithm: Algorithm, checked: boolean) => {
    setDraft(current => ({
      ...current,
      acceptEncoding: checked
        ? Array.from(new Set([...current.acceptEncoding, algorithm]))
        : current.acceptEncoding.filter(item => item !== algorithm)
    }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('headers')
    setAuditQuery('')
    setParsedQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.compression_headers.summary_title'),
        `${t('app.converter.compression_headers.metric.score')}: ${metrics.score}`,
        `${t('app.converter.compression_headers.metric.ratio')}: ${metrics.ratio}%`,
        `${t('app.converter.compression_headers.metric.encodings')}: ${metrics.encodings}`,
        `${t('app.converter.compression_headers.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.compression_headers.metric.critical')}: ${metrics.critical}`
      ].join('\n')
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="glass-panel glass-clip">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <Archive className="h-4 w-4" />
                {t('app.converter.compression-headers')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.compression-headers')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.compression_headers.description')}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.compression_headers.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <Metric
              label={t('app.converter.compression_headers.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.compression_headers.metric.ratio')}
              value={`${metrics.ratio}%`}
            />
            <Metric
              label={t('app.converter.compression_headers.metric.encodings')}
              value={metrics.encodings}
            />
            <Metric
              label={t('app.converter.compression_headers.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.compression_headers.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.compression_headers.presets')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input min-w-0 rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.compression_headers.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.compression_headers.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.04fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.compression_headers.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.compression_headers.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="compression-route">
                  {t('app.converter.compression_headers.route_pattern')}
                </Label>
                <Input
                  id="compression-route"
                  value={draft.routePattern}
                  onChange={event =>
                    updateDraft(
                      'routePattern',
                      event.target.value.slice(0, ROUTE_PATTERN_FIELD_LIMIT)
                    )
                  }
                  maxLength={ROUTE_PATTERN_FIELD_LIMIT}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-type">
                  {t('app.converter.compression_headers.content_type')}
                </Label>
                <Select
                  id="compression-type"
                  value={draft.contentType}
                  onChange={event => updateDraft('contentType', event.target.value as ContentType)}
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.compression_headers.content_type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-encoding">
                  {t('app.converter.compression_headers.content_encoding')}
                </Label>
                <Select
                  id="compression-encoding"
                  value={draft.contentEncoding}
                  onChange={event =>
                    updateDraft('contentEncoding', event.target.value as Algorithm)
                  }
                >
                  {ALGORITHMS.map(algorithm => (
                    <option key={algorithm} value={algorithm}>
                      {t(`app.converter.compression_headers.algorithm.${algorithm}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-cache">
                  {t('app.converter.compression_headers.cache_scope')}
                </Label>
                <Select
                  id="compression-cache"
                  value={draft.cacheScope}
                  onChange={event => updateDraft('cacheScope', event.target.value as CacheScope)}
                >
                  {CACHE_SCOPES.map(scope => (
                    <option key={scope} value={scope}>
                      {t(`app.converter.compression_headers.cache_scope.${scope}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-uncompressed">
                  {t('app.converter.compression_headers.uncompressed_bytes')}
                </Label>
                <Input
                  id="compression-uncompressed"
                  value={draft.uncompressedBytes}
                  onChange={event =>
                    updateDraft('uncompressedBytes', event.target.value.slice(0, 14))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-compressed">
                  {t('app.converter.compression_headers.compressed_bytes')}
                </Label>
                <Input
                  id="compression-compressed"
                  value={draft.compressedBytes}
                  onChange={event =>
                    updateDraft('compressedBytes', event.target.value.slice(0, 14))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('app.converter.compression_headers.accept_encoding')}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {ALGORITHMS.map(algorithm => (
                  <div key={algorithm} className="glass-input rounded-xl px-3">
                    <Checkbox
                      checked={draft.acceptEncoding.includes(algorithm)}
                      onChange={event => toggleAcceptEncoding(algorithm, event.target.checked)}
                      label={t(`app.converter.compression_headers.algorithm.${algorithm}`)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.enableVary}
                  onChange={event => updateDraft('enableVary', event.target.checked)}
                  label={t('app.converter.compression_headers.enable_vary')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.streaming}
                  onChange={event => updateDraft('streaming', event.target.checked)}
                  label={t('app.converter.compression_headers.streaming')}
                />
              </div>
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.compression_headers.preview')}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-all font-mono text-sm text-[var(--text-primary)]">
                {buildHeaderPreview(draft).join('\n')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.compression_headers.workspace')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.compression_headers.workspace_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.compression_headers.workspace_placeholder')}
              className="min-h-[390px] font-mono"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(workspace)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWorkspace('')}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.compression_headers.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.compression_headers.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 24).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.compression_headers.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.compression_headers.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.compression_headers.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.compression_headers.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="compression-output-type">
                  {t('app.converter.compression_headers.output_type')}
                </Label>
                <Select
                  id="compression-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.compression_headers.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[320px] font-mono" />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildCurrentOutput())}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.compression_headers.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'compression-headers.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.compression_headers.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildOutput(draft, 'csv'),
                    'compression-headers.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.compression_headers.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.compression_headers.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.compression_headers.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredHeaders.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredHeaders.slice(0, 42).map((header, index) => (
                  <div
                    key={`${header.name}:${index}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {header.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {header.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.compression_headers.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.compression_headers.reference')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.compression_headers.reference_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALGORITHMS.map(algorithm => (
              <div key={algorithm} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {algorithm}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.compression_headers.reference.${algorithm}`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.compression_headers.checklist')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {item === 'measure' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.compression_headers.checklist.${item}.title`)}
              </div>
              {t(`app.converter.compression_headers.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
