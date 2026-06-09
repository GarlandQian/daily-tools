'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  GitCompareArrows,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  Trash2
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

const METHODS = ['GET', 'HEAD', 'POST'] as const
const VALIDATOR_STRENGTHS = ['strong', 'weak', 'last_modified', 'missing'] as const
const CACHE_STATES = ['revalidated', 'fresh', 'miss', 'stale', 'unknown'] as const
const OUTPUT_TYPES = [
  'curl',
  'headers',
  'next',
  'nginx',
  'cloudflare',
  'markdown',
  'json',
  'csv'
] as const
const WORKSPACE_LIMIT = 70000
const OBSERVATION_LIMIT = 160

type Method = (typeof METHODS)[number]
type ValidatorStrength = (typeof VALIDATOR_STRENGTHS)[number]
type CacheState = (typeof CACHE_STATES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ObservationSource = 'header' | 'json' | 'manual' | 'text'

interface EtagDraft {
  bodyBytes: string
  cacheControl: string
  contentLength: string
  etag: string
  gzipVariant: boolean
  hasSetCookie: boolean
  ifModifiedSince: string
  ifNoneMatch: string
  lastModified: string
  method: Method
  personalized: boolean
  previousEtag: string
  responseStatus: string
  routePattern: string
  sampleCount: string
  state: CacheState
  url: string
  validatorStrength: ValidatorStrength
  varyHeader: string
}

interface RevalidationObservation {
  bodyBytes: number
  cacheControl: string
  contentLength: number
  etag: string
  headers: Record<string, string>
  id: string
  ifModifiedSince: string
  ifNoneMatch: string
  lastModified: string
  method: Method
  responseStatus: number
  route: string
  source: ObservationSource
  url: string
  validUrl: boolean
  vary: string
}

interface ParsedWorkspace {
  errors: string[]
  observations: RevalidationObservation[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: EtagDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: EtagDraft = {
  bodyBytes: '0',
  cacheControl: 'public, max-age=0, must-revalidate',
  contentLength: '0',
  etag: '"product-v42-5f2a.br"',
  gzipVariant: true,
  hasSetCookie: false,
  ifModifiedSince: 'Tue, 09 Jun 2026 04:00:00 GMT',
  ifNoneMatch: '"product-v42-5f2a.br"',
  lastModified: 'Tue, 09 Jun 2026 03:42:00 GMT',
  method: 'GET',
  personalized: false,
  previousEtag: '"product-v41-aa19.br"',
  responseStatus: '304',
  routePattern: '/products/:slug',
  sampleCount: '1800',
  state: 'revalidated',
  url: 'https://www.example.com/products/wool-jacket',
  validatorStrength: 'strong',
  varyHeader: 'Accept-Encoding'
}

const PRESETS: Preset[] = [
  {
    key: 'static_asset',
    draft: {
      ...DEFAULT_DRAFT,
      cacheControl: 'public, max-age=31536000, immutable',
      etag: '"app.abc123.br"',
      ifNoneMatch: '"app.abc123.br"',
      lastModified: 'Mon, 01 Jun 2026 10:00:00 GMT',
      routePattern: '/_next/static/*',
      url: 'https://www.example.com/_next/static/chunks/app.abc123.js'
    },
    workspace: [
      'GET /_next/static/chunks/app.abc123.js HTTP/2',
      'if-none-match: "app.abc123.br"',
      '',
      'HTTP/2 304',
      'etag: "app.abc123.br"',
      'cache-control: public, max-age=31536000, immutable',
      'last-modified: Mon, 01 Jun 2026 10:00:00 GMT',
      'vary: Accept-Encoding',
      'content-length: 0'
    ].join('\n')
  },
  {
    key: 'html_revalidate',
    draft: DEFAULT_DRAFT,
    workspace: [
      'GET /products/wool-jacket HTTP/2',
      'if-none-match: "product-v42-5f2a.br"',
      'if-modified-since: Tue, 09 Jun 2026 04:00:00 GMT',
      '',
      'HTTP/2 304',
      'etag: "product-v42-5f2a.br"',
      'cache-control: public, max-age=0, must-revalidate',
      'last-modified: Tue, 09 Jun 2026 03:42:00 GMT',
      'vary: Accept-Encoding',
      'content-length: 0'
    ].join('\n')
  },
  {
    key: 'api_private',
    draft: {
      ...DEFAULT_DRAFT,
      cacheControl: 'private, max-age=60, must-revalidate',
      etag: 'W/"account-17"',
      hasSetCookie: true,
      ifNoneMatch: 'W/"account-17"',
      personalized: true,
      routePattern: '/api/account',
      url: 'https://www.example.com/api/account',
      validatorStrength: 'weak',
      varyHeader: 'Authorization, Cookie'
    },
    workspace: [
      'HTTP/2 200',
      'etag: W/"account-17"',
      'cache-control: private, max-age=60, must-revalidate',
      'set-cookie: session=redacted; HttpOnly; Secure',
      'vary: Authorization, Cookie',
      'content-length: 812'
    ].join('\n')
  },
  {
    key: 'weak_variant',
    draft: {
      ...DEFAULT_DRAFT,
      etag: 'W/"article-884"',
      ifNoneMatch: 'W/"article-884"',
      previousEtag: 'W/"article-883"',
      routePattern: '/blog/:slug',
      url: 'https://www.example.com/blog/revalidation',
      validatorStrength: 'weak',
      varyHeader: 'Accept-Encoding, Accept-Language'
    },
    workspace: [
      'revalidate url=https://www.example.com/blog/revalidation status=304 etag=W/"article-884" inm=W/"article-884" lastModified="Tue, 09 Jun 2026 02:14:00 GMT" vary="Accept-Encoding, Accept-Language" cacheControl="public, max-age=0, must-revalidate"'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      bodyBytes: '512',
      cacheControl: 'public, max-age=0',
      contentLength: '512',
      etag: 'checkout-42',
      gzipVariant: true,
      hasSetCookie: true,
      ifModifiedSince: 'Tue, 09 Jun 2026 05:00:00 GMT',
      ifNoneMatch: '"checkout-41"',
      lastModified: 'Tue, 09 Jun 2026 07:00:00 GMT',
      method: 'POST',
      personalized: true,
      previousEtag: '"checkout-41"',
      responseStatus: '304',
      routePattern: '/checkout',
      sampleCount: '24',
      state: 'revalidated',
      url: 'http://www.example.com/checkout?token=abc&email=buyer@example.com',
      validatorStrength: 'strong',
      varyHeader: 'Accept-Encoding, Cookie'
    },
    workspace: [
      '{"url":"http://www.example.com/checkout?token=abc&email=buyer@example.com","method":"POST","status":304,"etag":"checkout-42","ifNoneMatch":"\\"checkout-41\\"","lastModified":"Tue, 09 Jun 2026 07:00:00 GMT","headers":{"cache-control":"public, max-age=0","etag":"checkout-42","if-none-match":"\\"checkout-41\\"","last-modified":"Tue, 09 Jun 2026 07:00:00 GMT","set-cookie":"session=abc","vary":"Accept-Encoding, Cookie","content-length":"512"}}',
      'revalidate url=http://www.example.com/checkout?token=abc&email=buyer@example.com status=304 etag=checkout-42 inm="checkout-41" method=POST body=512 vary="Accept-Encoding, Cookie" cacheControl="public, max-age=0"'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['etag', 'weak', 'last_modified', '304', 'vary', 'private'] as const
const CHECKLIST_ITEMS = ['capture', 'compare', 'variants', 'privacy'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const normalizeMethod = (value: unknown): Method => {
  const token = String(value ?? '')
    .trim()
    .toUpperCase()
  return METHODS.includes(token as Method) ? (token as Method) : 'GET'
}

const isPrivateQuery = (url: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=/iu.test(url)
const isQuotedEtag = (value: string) => /^(W\/)?"[^"]*"$/u.test(value.trim())
const stripWeak = (value: string) => value.trim().replace(/^W\//iu, '')
const matchesValidator = (etag: string, candidate: string) => {
  const cleanEtag = stripWeak(etag)
  return candidate
    .split(',')
    .map(item => stripWeak(item.trim()))
    .some(item => item === '*' || item === cleanEtag)
}

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const getRecordString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

const headerString = (headers: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const value = headers[key.toLowerCase()]
    if (value) return value
  }
  return ''
}

const parseHeaderLines = (input: string) => {
  const headers: Record<string, string> = {}
  let status = 0
  let method: Method = 'GET'
  let route = ''

  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    const statusMatch = trimmed.match(/^HTTP\/\S+\s+(\d{3})/iu)
    if (statusMatch) status = Number(statusMatch[1])
    const requestMatch = trimmed.match(/^(GET|HEAD|POST)\s+(\S+)/iu)
    if (requestMatch) {
      method = normalizeMethod(requestMatch[1])
      route = requestMatch[2] ?? ''
    }
    const headerMatch = trimmed.match(/^([a-z0-9-]+)\s*:\s*(.*)$/iu)
    if (!headerMatch) return
    headers[(headerMatch[1] ?? '').toLowerCase()] = headerMatch[2] ?? ''
  })

  return { headers, method, route, status }
}

const addObservation = (
  observations: RevalidationObservation[],
  observation: Omit<RevalidationObservation, 'id'>
) => {
  if (
    !observation.etag &&
    !observation.lastModified &&
    !Object.keys(observation.headers).length &&
    !observation.url
  )
    return
  observations.push({
    ...observation,
    id: `${observation.source}-${observations.length}-${observation.url || observation.etag || observation.responseStatus}`
  })
}

const parseHeaderObservation = (input: string): RevalidationObservation[] => {
  const { headers, method, route, status } = parseHeaderLines(input)
  if (!Object.keys(headers).length) return []
  return [
    {
      bodyBytes: numberFromInput(headers['x-body-bytes'] ?? headers['content-length'] ?? ''),
      cacheControl: headerString(headers, ['cache-control']),
      contentLength: numberFromInput(headers['content-length'] ?? ''),
      etag: headerString(headers, ['etag']),
      headers,
      id: 'header-0',
      ifModifiedSince: headerString(headers, ['if-modified-since']),
      ifNoneMatch: headerString(headers, ['if-none-match']),
      lastModified: headerString(headers, ['last-modified']),
      method,
      responseStatus: status,
      route,
      source: 'header',
      url: '',
      validUrl: true,
      vary: headerString(headers, ['vary'])
    }
  ]
}

const collectJsonObservations = (value: unknown, observations: RevalidationObservation[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonObservations(item, observations))
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const rawHeaders =
    typeof record.headers === 'object' && record.headers
      ? (record.headers as Record<string, unknown>)
      : {}
  const headers = Object.fromEntries(
    Object.entries(rawHeaders).map(([key, val]) => [key.toLowerCase(), String(val)])
  )
  const url = getRecordString(record, ['url', 'href', 'requestUrl'])
  const etag = getRecordString(record, ['etag']) || headerString(headers, ['etag'])
  const lastModified =
    getRecordString(record, ['lastModified', 'last-modified']) ||
    headerString(headers, ['last-modified'])

  if (url || etag || lastModified || Object.keys(headers).length) {
    addObservation(observations, {
      bodyBytes: numberFromInput(
        getRecordString(record, ['bodyBytes', 'body']) ||
          headerString(headers, ['x-body-bytes', 'content-length'])
      ),
      cacheControl:
        getRecordString(record, ['cacheControl', 'cache-control']) ||
        headerString(headers, ['cache-control']),
      contentLength: numberFromInput(
        getRecordString(record, ['contentLength']) || headerString(headers, ['content-length'])
      ),
      etag,
      headers,
      ifModifiedSince:
        getRecordString(record, ['ifModifiedSince', 'if-modified-since']) ||
        headerString(headers, ['if-modified-since']),
      ifNoneMatch:
        getRecordString(record, ['ifNoneMatch', 'if-none-match']) ||
        headerString(headers, ['if-none-match']),
      lastModified,
      method: normalizeMethod(getRecordString(record, ['method'])),
      responseStatus: numberFromInput(getRecordString(record, ['status', 'statusCode'])),
      route: getRecordString(record, ['route', 'path', 'routePattern']),
      source: 'json',
      url,
      validUrl: !url || Boolean(safeUrl(url)),
      vary: getRecordString(record, ['vary']) || headerString(headers, ['vary'])
    })
  }

  ;['items', 'entries', 'requests', 'responses', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonObservations(record[key], observations)
  })
}

const parseJsonObservations = (
  input: string
): { errors: string[]; observations: RevalidationObservation[] } => {
  const errors: string[] = []
  const observations: RevalidationObservation[] = []
  const trimmedInput = input.trim()

  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonObservations(JSON.parse(trimmedInput) as unknown, observations)
      return { errors, observations }
    } catch {
      // Mixed workspaces can still contain useful JSONL rows.
    }
  }

  input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))
    .forEach((row, index) => {
      try {
        collectJsonObservations(JSON.parse(row) as unknown, observations)
      } catch {
        errors.push(`json:${index + 1}`)
      }
    })

  return { errors, observations }
}

const parseTextObservations = (input: string): RevalidationObservation[] => {
  const observations: RevalidationObservation[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      /^[a-z0-9-]+\s*:/iu.test(trimmed) ||
      /^HTTP\/\S+/iu.test(trimmed)
    )
      return
    const url = tokenValue(trimmed, 'url') || tokenValue(trimmed, 'href')
    const etag = tokenValue(trimmed, 'etag')
    if (!url && !etag && !tokenValue(trimmed, 'lastModified')) return
    addObservation(observations, {
      bodyBytes: numberFromInput(tokenValue(trimmed, 'body') || tokenValue(trimmed, 'bodyBytes')),
      cacheControl: tokenValue(trimmed, 'cacheControl'),
      contentLength: numberFromInput(tokenValue(trimmed, 'contentLength')),
      etag,
      headers: {},
      ifModifiedSince: tokenValue(trimmed, 'ims') || tokenValue(trimmed, 'ifModifiedSince'),
      ifNoneMatch: tokenValue(trimmed, 'inm') || tokenValue(trimmed, 'ifNoneMatch'),
      lastModified: tokenValue(trimmed, 'lastModified'),
      method: normalizeMethod(tokenValue(trimmed, 'method')),
      responseStatus: numberFromInput(tokenValue(trimmed, 'status')),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      source: 'text',
      url,
      validUrl: !url || Boolean(safeUrl(url)),
      vary: tokenValue(trimmed, 'vary')
    })
  })
  return observations
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonObservations(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    observations: [
      ...parseHeaderObservation(source),
      ...json.observations,
      ...parseTextObservations(source)
    ].slice(0, OBSERVATION_LIMIT)
  }
}

const draftObservation = (draft: EtagDraft): RevalidationObservation => ({
  bodyBytes: numberFromInput(draft.bodyBytes),
  cacheControl: draft.cacheControl,
  contentLength: numberFromInput(draft.contentLength),
  etag: draft.etag,
  headers: {
    'cache-control': draft.cacheControl,
    etag: draft.etag,
    'if-modified-since': draft.ifModifiedSince,
    'if-none-match': draft.ifNoneMatch,
    'last-modified': draft.lastModified,
    vary: draft.varyHeader
  },
  id: 'manual-draft',
  ifModifiedSince: draft.ifModifiedSince,
  ifNoneMatch: draft.ifNoneMatch,
  lastModified: draft.lastModified,
  method: draft.method,
  responseStatus: numberFromInput(draft.responseStatus),
  route: draft.routePattern,
  source: 'manual',
  url: draft.url,
  validUrl: Boolean(safeUrl(draft.url)),
  vary: draft.varyHeader
})

const auditObservation = (
  item: RevalidationObservation,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  if (!item.validUrl) add('danger', `${prefix}invalid_url`, item.url)
  if (/^http:/iu.test(item.url)) add('danger', `${prefix}http_url`, item.url)
  if (isPrivateQuery(item.url)) add('warn', `${prefix}private_query`, item.url)
  if (!item.etag && !item.lastModified)
    add('warn', `${prefix}missing_validator`, item.url || item.route || item.source)
  if (item.etag && !isQuotedEtag(item.etag)) add('danger', `${prefix}unquoted_etag`, item.etag)
  if (/^W\//iu.test(item.etag)) add('warn', `${prefix}weak_etag`, item.etag)
  if (
    item.ifNoneMatch &&
    item.etag &&
    item.responseStatus === 304 &&
    !matchesValidator(item.etag, item.ifNoneMatch)
  )
    add('danger', `${prefix}mismatched_304`, item.etag)
  if (item.responseStatus === 304 && (item.contentLength > 0 || item.bodyBytes > 0))
    add('danger', `${prefix}body_on_304`, `${item.contentLength || item.bodyBytes} bytes`)
  if (
    item.responseStatus === 200 &&
    item.ifNoneMatch &&
    item.etag &&
    matchesValidator(item.etag, item.ifNoneMatch)
  )
    add('warn', `${prefix}missed_304`, item.etag)
  if (item.headers['set-cookie'] && item.responseStatus === 304)
    add('warn', `${prefix}set_cookie_304`, item.url || item.route || item.source)
  if (/cookie|authorization|user-agent/iu.test(item.vary))
    add('warn', `${prefix}vary_high_cardinality`, item.vary)
  if (
    item.lastModified &&
    item.ifModifiedSince &&
    Date.parse(item.lastModified) > Date.parse(item.ifModifiedSince) &&
    item.responseStatus === 304
  )
    add('warn', `${prefix}last_modified_newer_than_request`, item.lastModified)
  if (item.lastModified && Date.parse(item.lastModified) > Date.now() + 60000)
    add('warn', `${prefix}future_last_modified`, item.lastModified)
}

const auditRevalidation = (draft: EtagDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftObservation(draft)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  if (draft.validatorStrength === 'missing') add('danger', 'missing_strategy', draft.routePattern)
  if (draft.validatorStrength === 'last_modified' && !draft.lastModified.trim())
    add('warn', 'last_modified_missing', draft.routePattern)
  if (draft.validatorStrength === 'strong' && /^W\//iu.test(draft.etag))
    add('warn', 'strength_mismatch', draft.etag)
  if (
    draft.gzipVariant &&
    draft.validatorStrength === 'strong' &&
    /accept-encoding/iu.test(draft.varyHeader) &&
    !/[.-](br|gz|gzip|identity)|encoding/iu.test(draft.etag)
  )
    add('warn', 'strong_variant_unclear', draft.etag)
  if (draft.personalized && /public|s-maxage/iu.test(draft.cacheControl))
    add('danger', 'personalized_public', draft.cacheControl)
  if (draft.hasSetCookie && /public|s-maxage/iu.test(draft.cacheControl))
    add('danger', 'set_cookie_public', draft.routePattern)
  if (
    /max-age=0/iu.test(draft.cacheControl) &&
    !/must-revalidate|no-cache|s-maxage|stale-while-revalidate/iu.test(draft.cacheControl)
  )
    add('warn', 'ambiguous_revalidate', draft.cacheControl)
  if (draft.method !== 'GET' && draft.method !== 'HEAD') add('warn', 'unsafe_method', draft.method)
  auditObservation(manual, add)

  parsed.observations.forEach(item => auditObservation(item, add, true))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.observations.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'etag_match_ok', draft.etag || draft.lastModified)
    add('good', 'body_304_ok', draft.responseStatus)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 14 : finding.level === 'warn' ? 5 : 0),
    0
  )
  return Math.max(0, 100 - penalty)
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-400/35 bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'warn')
    return 'border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

const buildCurl = (draft: EtagDraft) =>
  [
    `curl -I '${draft.url || 'https://www.example.com/'}' \\`,
    draft.ifNoneMatch ? `  -H 'If-None-Match: ${draft.ifNoneMatch}' \\` : '',
    draft.ifModifiedSince ? `  -H 'If-Modified-Since: ${draft.ifModifiedSince}'` : '',
    '',
    '# Compare status, ETag, Last-Modified, Cache-Control, Vary, Set-Cookie, and Content-Length.'
  ]
    .filter(Boolean)
    .join('\n')

const buildHeaders = (draft: EtagDraft) =>
  [
    draft.etag ? `ETag: ${draft.etag}` : '',
    draft.lastModified ? `Last-Modified: ${draft.lastModified}` : '',
    draft.cacheControl ? `Cache-Control: ${draft.cacheControl}` : '',
    draft.varyHeader ? `Vary: ${draft.varyHeader}` : '',
    draft.contentLength ? `Content-Length: ${draft.contentLength}` : ''
  ]
    .filter(Boolean)
    .join('\n')

const buildNext = (draft: EtagDraft) =>
  [
    'import { NextResponse } from "next/server"',
    '',
    'export function GET() {',
    '  const response = NextResponse.json({ ok: true })',
    draft.etag ? `  response.headers.set('ETag', '${escapeJs(draft.etag)}')` : '',
    draft.lastModified
      ? `  response.headers.set('Last-Modified', '${escapeJs(draft.lastModified)}')`
      : '',
    draft.cacheControl
      ? `  response.headers.set('Cache-Control', '${escapeJs(draft.cacheControl)}')`
      : '',
    draft.varyHeader ? `  response.headers.set('Vary', '${escapeJs(draft.varyHeader)}')` : '',
    '  return response',
    '}'
  ]
    .filter(Boolean)
    .join('\n')

const buildNginx = (draft: EtagDraft) =>
  [
    `location ${draft.routePattern || '/'} {`,
    '  etag on;',
    draft.lastModified ? '  if_modified_since exact;' : '',
    draft.cacheControl
      ? `  add_header Cache-Control "${escapeJs(draft.cacheControl)}" always;`
      : '',
    draft.varyHeader ? `  add_header Vary "${escapeJs(draft.varyHeader)}" always;` : '',
    '}'
  ]
    .filter(Boolean)
    .join('\n')

const buildCloudflare = (draft: EtagDraft) =>
  [
    'export default {',
    '  async fetch(request) {',
    '    const response = await fetch(request)',
    '    const next = new Response(response.body, response)',
    draft.etag ? `    next.headers.set('ETag', '${escapeJs(draft.etag)}')` : '',
    draft.cacheControl
      ? `    next.headers.set('Cache-Control', '${escapeJs(draft.cacheControl)}')`
      : '',
    draft.varyHeader ? `    next.headers.set('Vary', '${escapeJs(draft.varyHeader)}')` : '',
    '    return next',
    '  }',
    '}'
  ]
    .filter(Boolean)
    .join('\n')

const buildCsv = (draft: EtagDraft, parsed: ParsedWorkspace) => {
  const rows = [draftObservation(draft), ...parsed.observations]
  return [
    [
      'source',
      'method',
      'status',
      'url',
      'route',
      'etag',
      'if_none_match',
      'last_modified',
      'if_modified_since',
      'cache_control',
      'vary',
      'content_length',
      'body_bytes'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(item =>
      [
        item.source,
        item.method,
        item.responseStatus,
        item.url,
        item.route,
        item.etag,
        item.ifNoneMatch,
        item.lastModified,
        item.ifModifiedSince,
        item.cacheControl,
        item.vary,
        item.contentLength,
        item.bodyBytes
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildMarkdown = (draft: EtagDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# ETag revalidation: ${draft.routePattern}`,
    '',
    `- URL: ${draft.url || '-'}`,
    `- Status: ${draft.responseStatus}`,
    `- ETag: ${draft.etag || '-'}`,
    `- If-None-Match: ${draft.ifNoneMatch || '-'}`,
    `- Last-Modified: ${draft.lastModified || '-'}`,
    `- Cache-Control: ${draft.cacheControl || '-'}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Observations',
    ...parsed.observations
      .slice(0, 24)
      .map(
        item =>
          `- ${item.source} / ${item.responseStatus || '-'} / ${item.etag || '-'} / ${item.url || item.route || '-'}`
      )
  ].join('\n')

const buildOutput = (
  draft: EtagDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  type: OutputType
) => {
  if (type === 'curl') return buildCurl(draft)
  if (type === 'headers') return buildHeaders(draft)
  if (type === 'next') return buildNext(draft)
  if (type === 'nginx') return buildNginx(draft)
  if (type === 'cloudflare') return buildCloudflare(draft)
  if (type === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (type === 'json')
    return JSON.stringify({ draft, findings, observations: parsed.observations }, null, 2)
  return buildCsv(draft, parsed)
}

const downloadText = (text: string, filename: string, type: string) => {
  const blob = new Blob([text], { type })
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

export default function EtagRevalidationClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<EtagDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('curl')
  const [auditQuery, setAuditQuery] = useState('')
  const [observationQuery, setObservationQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredObservationQuery = useDeferredValue(observationQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditRevalidation(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const rows = useMemo(
    () => [draftObservation(draft), ...parsed.observations],
    [draft, parsed.observations]
  )
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.etag_revalidation.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredObservationQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(item =>
      `${item.url} ${item.route} ${item.etag} ${item.ifNoneMatch} ${item.cacheControl} ${item.vary}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredObservationQuery, rows])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      observations: rows.length,
      score,
      state: t(`app.converter.etag_revalidation.state.${draft.state}`),
      validators: rows.filter(item => item.etag || item.lastModified).length,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.state, findings, rows, score, t]
  )

  const updateDraft = <Key extends keyof EtagDraft>(key: Key, value: EtagDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('curl')
    setAuditQuery('')
    setObservationQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.etag_revalidation.summary_title'),
        `${t('app.converter.etag_revalidation.metric.score')}: ${metrics.score}`,
        `${t('app.converter.etag_revalidation.metric.state')}: ${metrics.state}`,
        `${t('app.converter.etag_revalidation.metric.validators')}: ${metrics.validators}`,
        `${t('app.converter.etag_revalidation.metric.observations')}: ${metrics.observations}`,
        `${t('app.converter.etag_revalidation.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.etag_revalidation.metric.critical')}: ${metrics.critical}`
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
                <Tags className="h-4 w-4" />
                {t('app.converter.etag-revalidation')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.etag-revalidation')}
              </CardTitle>
              <CardDescription>{t('app.converter.etag_revalidation.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.etag_revalidation.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.etag_revalidation.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.etag_revalidation.metric.state')}
              value={metrics.state}
            />
            <Metric
              label={t('app.converter.etag_revalidation.metric.validators')}
              value={metrics.validators}
            />
            <Metric
              label={t('app.converter.etag_revalidation.metric.observations')}
              value={metrics.observations}
            />
            <Metric
              label={t('app.converter.etag_revalidation.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.etag_revalidation.metric.critical')}
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
              {t('app.converter.etag_revalidation.presets')}
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
                {t(`app.converter.etag_revalidation.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.etag_revalidation.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.etag_revalidation.model')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.etag_revalidation.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="etag-route">
                  {t('app.converter.etag_revalidation.route_pattern')}
                </Label>
                <Input
                  id="etag-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-url">{t('app.converter.etag_revalidation.url')}</Label>
                <Input
                  id="etag-url"
                  value={draft.url}
                  onChange={event => updateDraft('url', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-method">{t('app.converter.etag_revalidation.method')}</Label>
                <Select
                  id="etag-method"
                  value={draft.method}
                  onChange={event => updateDraft('method', event.target.value as Method)}
                >
                  {METHODS.map(method => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-state">
                  {t('app.converter.etag_revalidation.cache_state')}
                </Label>
                <Select
                  id="etag-state"
                  value={draft.state}
                  onChange={event => updateDraft('state', event.target.value as CacheState)}
                >
                  {CACHE_STATES.map(state => (
                    <option key={state} value={state}>
                      {t(`app.converter.etag_revalidation.state.${state}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-strength">
                  {t('app.converter.etag_revalidation.validator_strength')}
                </Label>
                <Select
                  id="etag-strength"
                  value={draft.validatorStrength}
                  onChange={event =>
                    updateDraft('validatorStrength', event.target.value as ValidatorStrength)
                  }
                >
                  {VALIDATOR_STRENGTHS.map(strength => (
                    <option key={strength} value={strength}>
                      {t(`app.converter.etag_revalidation.strength.${strength}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-status">
                  {t('app.converter.etag_revalidation.response_status')}
                </Label>
                <Input
                  id="etag-status"
                  value={draft.responseStatus}
                  onChange={event => updateDraft('responseStatus', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-current">{t('app.converter.etag_revalidation.etag')}</Label>
                <Input
                  id="etag-current"
                  value={draft.etag}
                  onChange={event => updateDraft('etag', event.target.value.slice(0, 220))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-previous">
                  {t('app.converter.etag_revalidation.previous_etag')}
                </Label>
                <Input
                  id="etag-previous"
                  value={draft.previousEtag}
                  onChange={event => updateDraft('previousEtag', event.target.value.slice(0, 220))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-inm">
                  {t('app.converter.etag_revalidation.if_none_match')}
                </Label>
                <Input
                  id="etag-inm"
                  value={draft.ifNoneMatch}
                  onChange={event => updateDraft('ifNoneMatch', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-last-modified">
                  {t('app.converter.etag_revalidation.last_modified')}
                </Label>
                <Input
                  id="etag-last-modified"
                  value={draft.lastModified}
                  onChange={event => updateDraft('lastModified', event.target.value.slice(0, 140))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-ims">
                  {t('app.converter.etag_revalidation.if_modified_since')}
                </Label>
                <Input
                  id="etag-ims"
                  value={draft.ifModifiedSince}
                  onChange={event =>
                    updateDraft('ifModifiedSince', event.target.value.slice(0, 140))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-samples">
                  {t('app.converter.etag_revalidation.sample_count')}
                </Label>
                <Input
                  id="etag-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-content-length">
                  {t('app.converter.etag_revalidation.content_length')}
                </Label>
                <Input
                  id="etag-content-length"
                  value={draft.contentLength}
                  onChange={event => updateDraft('contentLength', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etag-body">{t('app.converter.etag_revalidation.body_bytes')}</Label>
                <Input
                  id="etag-body"
                  value={draft.bodyBytes}
                  onChange={event => updateDraft('bodyBytes', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="etag-cache-control">
                  {t('app.converter.etag_revalidation.cache_control')}
                </Label>
                <Input
                  id="etag-cache-control"
                  value={draft.cacheControl}
                  onChange={event => updateDraft('cacheControl', event.target.value.slice(0, 360))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="etag-vary">{t('app.converter.etag_revalidation.vary')}</Label>
                <Input
                  id="etag-vary"
                  value={draft.varyHeader}
                  onChange={event => updateDraft('varyHeader', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Checkbox
                checked={draft.gzipVariant}
                onChange={event => updateDraft('gzipVariant', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.etag_revalidation.gzip_variant')}
              />
              <Checkbox
                checked={draft.hasSetCookie}
                onChange={event => updateDraft('hasSetCookie', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.etag_revalidation.has_set_cookie')}
              />
              <Checkbox
                checked={draft.personalized}
                onChange={event => updateDraft('personalized', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.etag_revalidation.personalized')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.etag_revalidation.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.etag_revalidation.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.etag_revalidation.workspace_placeholder')}
              className="min-h-[610px] font-mono"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.etag_revalidation.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.etag_revalidation.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 56).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.etag_revalidation.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.etag_revalidation.level.${finding.level}`)}
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
                  {t('app.converter.etag_revalidation.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.etag_revalidation.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="etag-output">
                  {t('app.converter.etag_revalidation.output_type')}
                </Label>
                <Select
                  id="etag-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.etag_revalidation.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[380px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.etag_revalidation.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'etag-revalidation-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.etag_revalidation.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'etag-revalidation.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.etag_revalidation.download_csv')}
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
                {t('app.converter.etag_revalidation.observations')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={observationQuery}
                onChange={event => setObservationQuery(event.target.value)}
                placeholder={t('app.converter.etag_revalidation.observation_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(item => (
                  <div key={item.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {item.etag || item.lastModified || item.url || item.route || '-'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(item.responseStatus === 304 ? 'good' : 'warn')}`}
                      >
                        {item.responseStatus || '-'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {item.method}
                      <span className="mx-1">/</span>
                      {t(`app.converter.etag_revalidation.source.${item.source}`)}
                      <span className="mx-1">/</span>
                      {t('app.converter.etag_revalidation.bytes', { count: item.contentLength })}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {item.ifNoneMatch || item.cacheControl || item.vary || item.url || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.etag_revalidation.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.etag_revalidation.reference')}
                </CardTitle>
              </div>
              <CardDescription>
                {t('app.converter.etag_revalidation.reference_hint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.etag_revalidation.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.etag_revalidation.reference.${item}_hint`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.etag_revalidation.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.etag_revalidation.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.etag_revalidation.checklist.${item}.body`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
