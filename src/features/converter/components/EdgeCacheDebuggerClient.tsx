'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Cloud,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  RotateCcw,
  Search,
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

const PROVIDERS = ['generic', 'cloudflare', 'vercel', 'fastly', 'cloudfront', 'akamai'] as const
const METHODS = ['GET', 'HEAD', 'POST'] as const
const CACHE_STATUSES = [
  'hit',
  'miss',
  'stale',
  'revalidated',
  'bypass',
  'expired',
  'dynamic',
  'unknown'
] as const
const OUTPUT_TYPES = [
  'curl',
  'headers',
  'next',
  'cloudflare',
  'fastly',
  'markdown',
  'json',
  'csv'
] as const
const WORKSPACE_LIMIT = 90000
const OBSERVATION_LIMIT = 180

type Provider = (typeof PROVIDERS)[number]
type Method = (typeof METHODS)[number]
type CacheStatus = (typeof CACHE_STATUSES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ObservationSource = 'header' | 'json' | 'manual' | 'text'

interface EdgeDraft {
  ageSeconds: string
  cacheControl: string
  cacheKeyIncludesCookie: boolean
  cacheKeyIncludesQuery: boolean
  cacheStatus: CacheStatus
  cdnCacheControl: string
  hasAuthorization: boolean
  hasSetCookie: boolean
  hitRate: string
  method: Method
  provider: Provider
  responseStatus: string
  routePattern: string
  sampleCount: string
  serverTiming: string
  surrogateControl: string
  url: string
  varyHeader: string
}

interface CacheObservation {
  ageSeconds: number
  cacheControl: string
  cacheStatus: CacheStatus
  headers: Record<string, string>
  id: string
  method: Method
  provider: Provider
  responseStatus: number
  route: string
  serverTiming: string
  source: ObservationSource
  url: string
  valid: boolean
  vary: string
}

interface ParsedWorkspace {
  errors: string[]
  observations: CacheObservation[]
}

interface Preset {
  draft: EdgeDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: EdgeDraft = {
  ageSeconds: '128',
  cacheControl: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=600',
  cacheKeyIncludesCookie: false,
  cacheKeyIncludesQuery: false,
  cacheStatus: 'hit',
  cdnCacheControl: 'public, s-maxage=3600, stale-while-revalidate=600',
  hasAuthorization: false,
  hasSetCookie: false,
  hitRate: '92',
  method: 'GET',
  provider: 'cloudflare',
  responseStatus: '200',
  routePattern: '/products/:slug',
  sampleCount: '2400',
  serverTiming: 'cdn-cache;desc=HIT, edge;dur=12, origin;dur=84',
  surrogateControl: '',
  url: 'https://www.example.com/products/wool-jacket',
  varyHeader: 'Accept-Encoding'
}

const PRESETS: Preset[] = [
  {
    key: 'static_asset',
    draft: {
      ...DEFAULT_DRAFT,
      ageSeconds: '86400',
      cacheControl: 'public, max-age=31536000, immutable',
      cdnCacheControl: 'public, s-maxage=31536000, immutable',
      routePattern: '/_next/static/*',
      serverTiming: 'cdn-cache;desc=HIT, edge;dur=3',
      url: 'https://www.example.com/_next/static/chunks/app.abc123.js'
    },
    workspace: [
      'HTTP/2 200',
      'cache-control: public, max-age=31536000, immutable',
      'cdn-cache-control: public, s-maxage=31536000, immutable',
      'cf-cache-status: HIT',
      'age: 86400',
      'vary: Accept-Encoding',
      'server-timing: cdn-cache;desc=HIT, edge;dur=3'
    ].join('\n')
  },
  {
    key: 'html_swr',
    draft: DEFAULT_DRAFT,
    workspace: [
      'HTTP/2 200',
      'cache-control: public, max-age=60, s-maxage=3600, stale-while-revalidate=600',
      'x-vercel-cache: HIT',
      'age: 128',
      'vary: RSC, Next-Router-State-Tree, Accept-Encoding',
      'server-timing: cdn-cache;desc=HIT, origin;dur=84'
    ].join('\n')
  },
  {
    key: 'api_bypass',
    draft: {
      ...DEFAULT_DRAFT,
      ageSeconds: '0',
      cacheControl: 'private, no-store',
      cacheStatus: 'bypass',
      cdnCacheControl: '',
      hasAuthorization: true,
      hasSetCookie: true,
      hitRate: '0',
      routePattern: '/api/account',
      serverTiming: 'cdn-cache;desc=BYPASS, origin;dur=420',
      url: 'https://www.example.com/api/account',
      varyHeader: 'Authorization, Cookie'
    },
    workspace: [
      'HTTP/2 200',
      'cache-control: private, no-store',
      'x-cache: BYPASS',
      'set-cookie: session=redacted; HttpOnly; Secure',
      'vary: Authorization, Cookie',
      'server-timing: cdn-cache;desc=BYPASS, origin;dur=420'
    ].join('\n')
  },
  {
    key: 'vary_explosion',
    draft: {
      ...DEFAULT_DRAFT,
      ageSeconds: '12',
      cacheKeyIncludesCookie: true,
      cacheKeyIncludesQuery: true,
      cacheStatus: 'miss',
      hitRate: '34',
      routePattern: '/search',
      url: 'https://www.example.com/search?q=coat&utm_source=ad&session=abc',
      varyHeader: 'Cookie, User-Agent, Accept-Language, Accept-Encoding'
    },
    workspace: [
      'cache=MISS url=https://www.example.com/search?q=coat&utm_source=ad&session=abc status=200 age=12 vary="Cookie, User-Agent, Accept-Language, Accept-Encoding" provider=cloudflare method=GET',
      'cf-cache-status: MISS',
      'cache-control: public, max-age=60, s-maxage=300',
      'server-timing: cdn-cache;desc=MISS, origin;dur=860'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      ageSeconds: '0',
      cacheControl: 'public, max-age=300, s-maxage=600',
      cacheKeyIncludesCookie: true,
      cacheKeyIncludesQuery: true,
      cacheStatus: 'miss',
      cdnCacheControl: '',
      hasAuthorization: true,
      hasSetCookie: true,
      hitRate: '18',
      method: 'GET',
      provider: 'cloudflare',
      responseStatus: '200',
      routePattern: '/checkout',
      sampleCount: '42',
      serverTiming: 'cdn-cache;desc=MISS, origin;dur=1880',
      surrogateControl: '',
      url: 'http://www.example.com/checkout?token=abc&email=buyer@example.com',
      varyHeader: '*'
    },
    workspace: [
      '{"url":"http://www.example.com/checkout?token=abc&email=buyer@example.com","status":200,"provider":"cloudflare","cacheStatus":"MISS","age":0,"headers":{"cache-control":"public, max-age=300, s-maxage=600","cf-cache-status":"MISS","set-cookie":"session=abc","vary":"*","server-timing":"cdn-cache;desc=MISS, origin;dur=1880","authorization":"Bearer redacted"}}',
      'cache=MISS url=http://www.example.com/checkout?token=abc&email=buyer@example.com status=200 age=0 vary=* provider=cloudflare method=GET',
      'cache-control: public, max-age=300, s-maxage=600',
      'x-cache: MISS from edge',
      'set-cookie: session=abc'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['hit', 'miss', 'age', 'vary', 'cookies', 'stale'] as const
const CHECKLIST_ITEMS = ['segment', 'key', 'headers', 'measure'] as const

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

const normalizeProvider = (value: unknown): Provider => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return PROVIDERS.includes(token as Provider) ? (token as Provider) : 'generic'
}

const normalizeMethod = (value: unknown): Method => {
  const token = String(value ?? '')
    .trim()
    .toUpperCase()
  return METHODS.includes(token as Method) ? (token as Method) : 'GET'
}

const normalizeStatus = (value: unknown): CacheStatus => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  if (/hit/u.test(token)) return 'hit'
  if (/stale/u.test(token)) return 'stale'
  if (/revalid/u.test(token)) return 'revalidated'
  if (/bypass|pass/u.test(token)) return 'bypass'
  if (/expired/u.test(token)) return 'expired'
  if (/dynamic/u.test(token)) return 'dynamic'
  if (/miss/u.test(token)) return 'miss'
  return CACHE_STATUSES.includes(token as CacheStatus) ? (token as CacheStatus) : 'unknown'
}

const parseHeaderLines = (input: string) => {
  const headers: Record<string, string> = {}
  let status = 0
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    const statusMatch = trimmed.match(/^HTTP\/\S+\s+(\d{3})/iu)
    if (statusMatch) status = Number(statusMatch[1])
    const headerMatch = trimmed.match(/^([a-z0-9-]+)\s*:\s*(.+)$/iu)
    if (!headerMatch) return
    headers[(headerMatch[1] ?? '').toLowerCase()] = headerMatch[2] ?? ''
  })
  return { headers, status }
}

const cacheStatusFromHeaders = (headers: Record<string, string>) =>
  normalizeStatus(
    headers['cf-cache-status'] ||
      headers['x-vercel-cache'] ||
      headers['x-cache'] ||
      headers['x-cache-status'] ||
      headers['cdn-cache-status'] ||
      headers['fastly-cachetype'] ||
      headers['akamai-cache-status'] ||
      headers['server-timing']
  )

const providerFromHeaders = (headers: Record<string, string>) => {
  if (headers['cf-cache-status'] || headers['cf-ray']) return 'cloudflare'
  if (headers['x-vercel-cache'] || headers['x-vercel-id']) return 'vercel'
  if (headers['x-served-by'] || headers['fastly-cachetype']) return 'fastly'
  if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop']) return 'cloudfront'
  if (headers['akamai-cache-status'] || headers['x-akamai-transformed']) return 'akamai'
  return 'generic'
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

const getRecordNumber = (record: Record<string, unknown>, keys: string[]) => {
  const value = getRecordString(record, keys)
  return value ? numberFromInput(value) : 0
}

const isPrivateQuery = (url: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=/iu.test(url)
const hasCookieVary = (value: string) => /\bcookie\b|authorization|user-agent/iu.test(value)
const hasWildcardVary = (value: string) => value.trim() === '*'
const isCacheableStatus = (status: number) =>
  [200, 203, 204, 206, 301, 308, 404, 410].includes(status)
const ttlFromHeader = (header: string, directive: string) => {
  const match = header.match(new RegExp(`${directive}\\s*=\\s*(\\d+)`, 'iu'))
  return match ? Number(match[1]) : 0
}

const addObservation = (
  observations: CacheObservation[],
  observation: Omit<CacheObservation, 'id'>
) => {
  if (!observation.url && !Object.keys(observation.headers).length && !observation.cacheControl)
    return
  observations.push({
    ...observation,
    id: `${observation.source}-${observations.length}-${observation.url || observation.cacheStatus}`
  })
}

const parseHeaderObservation = (input: string): CacheObservation[] => {
  const { headers, status } = parseHeaderLines(input)
  if (!Object.keys(headers).length) return []
  return [
    {
      ageSeconds: numberFromInput(headers.age ?? ''),
      cacheControl:
        headers['cache-control'] ||
        headers['cdn-cache-control'] ||
        headers['surrogate-control'] ||
        '',
      cacheStatus: cacheStatusFromHeaders(headers),
      headers,
      id: 'header-0',
      method: 'GET',
      provider: providerFromHeaders(headers),
      responseStatus: status,
      route: '',
      serverTiming: headers['server-timing'] ?? '',
      source: 'header',
      url: '',
      valid: true,
      vary: headers.vary ?? ''
    }
  ]
}

const collectJsonObservations = (value: unknown, observations: CacheObservation[]) => {
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
  const cacheControl =
    getRecordString(record, ['cacheControl', 'cache-control']) ||
    headers['cache-control'] ||
    headers['cdn-cache-control'] ||
    ''

  if (url || cacheControl || Object.keys(headers).length) {
    addObservation(observations, {
      ageSeconds:
        getRecordNumber(record, ['age', 'ageSeconds']) || numberFromInput(headers.age ?? ''),
      cacheControl,
      cacheStatus: normalizeStatus(
        getRecordString(record, ['cacheStatus', 'cache', 'xCache']) ||
          cacheStatusFromHeaders(headers)
      ),
      headers,
      method: normalizeMethod(getRecordString(record, ['method'])),
      provider: normalizeProvider(
        getRecordString(record, ['provider']) || providerFromHeaders(headers)
      ),
      responseStatus:
        getRecordNumber(record, ['status', 'statusCode']) || numberFromInput(headers.status ?? ''),
      route: getRecordString(record, ['route', 'path', 'routePattern']),
      serverTiming: getRecordString(record, ['serverTiming']) || headers['server-timing'] || '',
      source: 'json',
      url,
      valid: !url || Boolean(safeUrl(url)),
      vary: getRecordString(record, ['vary']) || headers.vary || ''
    })
  }

  ;['items', 'entries', 'requests', 'responses', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonObservations(record[key], observations)
  })
}

const parseJsonObservations = (
  input: string
): { errors: string[]; observations: CacheObservation[] } => {
  const errors: string[] = []
  const observations: CacheObservation[] = []
  const trimmedInput = input.trim()

  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonObservations(JSON.parse(trimmedInput) as unknown, observations)
      return { errors, observations }
    } catch {
      // Fall through to JSONL-style parsing so mixed workspaces still recover useful rows.
    }
  }

  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, index) => {
    try {
      collectJsonObservations(JSON.parse(row) as unknown, observations)
    } catch {
      errors.push(`json:${index + 1}`)
    }
  })

  return { errors, observations }
}

const parseTextObservations = (input: string): CacheObservation[] => {
  const observations: CacheObservation[] = []
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
    const cacheStatus = normalizeStatus(
      tokenValue(trimmed, 'cache') ||
        tokenValue(trimmed, 'statusText') ||
        tokenValue(trimmed, 'cacheStatus')
    )
    if (!url && cacheStatus === 'unknown') return
    addObservation(observations, {
      ageSeconds: numberFromInput(tokenValue(trimmed, 'age')),
      cacheControl: tokenValue(trimmed, 'cacheControl'),
      cacheStatus,
      headers: {},
      method: normalizeMethod(tokenValue(trimmed, 'method')),
      provider: normalizeProvider(tokenValue(trimmed, 'provider')),
      responseStatus: numberFromInput(tokenValue(trimmed, 'status')),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      serverTiming: tokenValue(trimmed, 'serverTiming'),
      source: 'text',
      url,
      valid: !url || Boolean(safeUrl(url)),
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

const draftObservation = (draft: EdgeDraft): CacheObservation => ({
  ageSeconds: numberFromInput(draft.ageSeconds),
  cacheControl: draft.cdnCacheControl || draft.surrogateControl || draft.cacheControl,
  cacheStatus: draft.cacheStatus,
  headers: {
    'cache-control': draft.cacheControl,
    'cdn-cache-control': draft.cdnCacheControl,
    'server-timing': draft.serverTiming,
    vary: draft.varyHeader
  },
  id: 'manual-draft',
  method: draft.method,
  provider: draft.provider,
  responseStatus: numberFromInput(draft.responseStatus),
  route: draft.routePattern,
  serverTiming: draft.serverTiming,
  source: 'manual',
  url: draft.url,
  valid: Boolean(safeUrl(draft.url)),
  vary: draft.varyHeader
})

const auditEdgeCache = (draft: EdgeDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftObservation(draft)
  const hitRate = numberFromInput(draft.hitRate)
  const samples = numberFromInput(draft.sampleCount)
  const sMaxAge = ttlFromHeader(manual.cacheControl, 's-maxage')
  const maxAge = ttlFromHeader(manual.cacheControl, 'max-age')

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (!manual.valid) add('danger', 'invalid_url', draft.url)
  if (/^http:/iu.test(draft.url)) add('danger', 'http_url', draft.url)
  if (isPrivateQuery(draft.url)) add('warn', 'private_query', draft.url)
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  if (hitRate < 30) add('danger', 'hit_rate_severe', `${hitRate}%`)
  else if (hitRate < 75) add('warn', 'hit_rate_low', `${hitRate}%`)
  if (manual.cacheStatus === 'miss') add('warn', 'cache_miss', draft.routePattern)
  if (manual.cacheStatus === 'bypass' || manual.cacheStatus === 'dynamic')
    add('warn', 'cache_bypass', draft.routePattern)
  if (
    manual.cacheStatus === 'stale' &&
    !/stale-while-revalidate|stale-if-error/iu.test(manual.cacheControl)
  )
    add('warn', 'stale_without_policy', manual.cacheControl)
  if (/no-store/iu.test(manual.cacheControl) && manual.cacheStatus === 'hit')
    add('danger', 'no_store_hit', manual.cacheControl)
  if (
    !/s-maxage|cdn-cache-control|surrogate-control/iu.test(
      `${manual.cacheControl} ${draft.cdnCacheControl} ${draft.surrogateControl}`
    ) &&
    !/immutable/iu.test(manual.cacheControl)
  )
    add('warn', 'missing_shared_ttl', manual.cacheControl)
  if (
    (sMaxAge || maxAge) &&
    manual.ageSeconds > Math.max(sMaxAge, maxAge) &&
    manual.cacheStatus === 'hit'
  )
    add('warn', 'age_exceeds_ttl', `${manual.ageSeconds}s`)
  if (draft.hasSetCookie && /public|s-maxage/iu.test(manual.cacheControl))
    add('danger', 'set_cookie_public_cache', draft.routePattern)
  if (
    draft.hasAuthorization &&
    !/private|no-store|no-cache/iu.test(manual.cacheControl) &&
    !/authorization/iu.test(draft.varyHeader)
  )
    add('danger', 'authorization_cacheable', draft.routePattern)
  if (hasWildcardVary(draft.varyHeader)) add('danger', 'vary_wildcard', draft.varyHeader)
  if (hasCookieVary(draft.varyHeader)) add('warn', 'vary_high_cardinality', draft.varyHeader)
  if (draft.cacheKeyIncludesCookie) add('warn', 'cookie_in_cache_key', draft.routePattern)
  if (draft.cacheKeyIncludesQuery && /utm_|fbclid|gclid|session|token|email/iu.test(draft.url))
    add('warn', 'noisy_query_cache_key', draft.url)
  if (!isCacheableStatus(manual.responseStatus))
    add('warn', 'uncacheable_status', String(manual.responseStatus))
  if (/origin;dur=(\d{3,})/iu.test(draft.serverTiming) && manual.cacheStatus !== 'hit')
    add('warn', 'slow_origin_on_miss', draft.serverTiming)

  parsed.observations.forEach(item => {
    if (!item.valid) add('danger', 'parsed_invalid_url', item.url)
    if (/^http:/iu.test(item.url)) add('danger', 'parsed_http_url', item.url)
    if (isPrivateQuery(item.url)) add('warn', 'parsed_private_query', item.url)
    if (item.cacheStatus === 'miss')
      add('warn', 'parsed_miss', item.url || item.route || item.source)
    if (item.cacheStatus === 'bypass' || item.cacheStatus === 'dynamic')
      add('warn', 'parsed_bypass', item.url || item.route || item.source)
    if (hasWildcardVary(item.vary)) add('danger', 'parsed_vary_wildcard', item.vary)
    if (hasCookieVary(item.vary)) add('warn', 'parsed_vary_high_cardinality', item.vary)
    if (item.headers['set-cookie'] && /public|s-maxage/iu.test(item.cacheControl))
      add('danger', 'parsed_set_cookie_public', item.url || item.source)
    if (item.headers.authorization && !/private|no-store|no-cache/iu.test(item.cacheControl))
      add('danger', 'parsed_authorization_cacheable', item.url || item.source)
    if (/origin;dur=(\d{3,})/iu.test(item.serverTiming) && item.cacheStatus !== 'hit')
      add('warn', 'parsed_slow_origin', item.serverTiming)
  })

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
    add('good', 'hit_rate_ok', `${hitRate}%`)
    add('good', 'vary_ok', draft.varyHeader || 'none')
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 15 : finding.level === 'warn' ? 6 : 0),
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

const buildCurlProbe = (draft: EdgeDraft) =>
  [
    `curl -I '${draft.url || 'https://www.example.com/'}' \\`,
    "  -H 'Pragma: no-cache' \\",
    "  -H 'Cache-Control: no-cache'",
    '',
    `curl -I '${draft.url || 'https://www.example.com/'}'`,
    '',
    '# Compare Age, cache status, Vary, Server-Timing, Set-Cookie, and response status.'
  ].join('\n')

const buildHeaders = (draft: EdgeDraft) =>
  [
    `Cache-Control: ${draft.cacheControl}`,
    draft.cdnCacheControl ? `CDN-Cache-Control: ${draft.cdnCacheControl}` : '',
    draft.surrogateControl ? `Surrogate-Control: ${draft.surrogateControl}` : '',
    draft.varyHeader ? `Vary: ${draft.varyHeader}` : 'Vary: Accept-Encoding',
    draft.serverTiming ? `Server-Timing: ${draft.serverTiming}` : ''
  ]
    .filter(Boolean)
    .join('\n')

const buildNext = (draft: EdgeDraft) =>
  [
    'import { NextResponse } from "next/server"',
    '',
    'export function middleware(request) {',
    '  const response = NextResponse.next()',
    `  response.headers.set('Cache-Control', '${escapeJs(draft.cacheControl)}')`,
    draft.cdnCacheControl
      ? `  response.headers.set('CDN-Cache-Control', '${escapeJs(draft.cdnCacheControl)}')`
      : '',
    draft.varyHeader ? `  response.headers.set('Vary', '${escapeJs(draft.varyHeader)}')` : '',
    '  return response',
    '}'
  ]
    .filter(Boolean)
    .join('\n')

const buildCloudflare = (draft: EdgeDraft) =>
  [
    'export default {',
    '  async fetch(request, env, ctx) {',
    '    const cache = caches.default',
    '    const url = new URL(request.url)',
    draft.cacheKeyIncludesQuery
      ? '    // Normalize query parameters before using the cache key.'
      : "    url.search = ''",
    '    const cacheKey = new Request(url.toString(), request)',
    '    let response = await cache.match(cacheKey)',
    '    if (!response) {',
    '      response = await fetch(request)',
    `      response = new Response(response.body, response)`,
    `      response.headers.set('Cache-Control', '${escapeJs(draft.cacheControl)}')`,
    '      ctx.waitUntil(cache.put(cacheKey, response.clone()))',
    '    }',
    '    return response',
    '  }',
    '}'
  ].join('\n')

const buildFastly = (draft: EdgeDraft) =>
  [
    `# ${draft.routePattern}`,
    'sub vcl_recv {',
    draft.cacheKeyIncludesQuery
      ? '  # Consider stripping noisy query parameters before hashing.'
      : '  set req.url = querystring.remove(req.url);',
    draft.cacheKeyIncludesCookie
      ? '  # Cookie is currently part of the cache key; confirm this is intentional.'
      : '  unset req.http.Cookie;',
    '}',
    '',
    'sub vcl_backend_response {',
    `  set beresp.http.Cache-Control = "${escapeJs(draft.cacheControl)}";`,
    '}'
  ].join('\n')

const buildMarkdown = (draft: EdgeDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# Edge cache debug: ${draft.routePattern}`,
    '',
    `- URL: ${draft.url || '-'}`,
    `- Provider: ${draft.provider}`,
    `- Cache status: ${draft.cacheStatus}`,
    `- Hit rate: ${draft.hitRate}%`,
    `- Cache-Control: ${draft.cacheControl}`,
    `- Vary: ${draft.varyHeader || '-'}`,
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
          `- ${item.source} / ${item.provider} / ${item.cacheStatus} / ${item.url || item.route || '-'} / age=${item.ageSeconds}s`
      )
  ].join('\n')

const buildCsv = (draft: EdgeDraft, parsed: ParsedWorkspace) => {
  const rows = [draftObservation(draft), ...parsed.observations]
  return [
    [
      'source',
      'provider',
      'cache_status',
      'status',
      'age_seconds',
      'method',
      'url',
      'route',
      'cache_control',
      'vary',
      'server_timing'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(item =>
      [
        item.source,
        item.provider,
        item.cacheStatus,
        item.responseStatus,
        item.ageSeconds,
        item.method,
        item.url,
        item.route,
        item.cacheControl,
        item.vary,
        item.serverTiming
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: EdgeDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'curl') return buildCurlProbe(draft)
  if (outputType === 'headers') return buildHeaders(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'cloudflare') return buildCloudflare(draft)
  if (outputType === 'fastly') return buildFastly(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
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

export default function EdgeCacheDebuggerClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<EdgeDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('curl')
  const [auditQuery, setAuditQuery] = useState('')
  const [observationQuery, setObservationQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredObservationQuery = useDeferredValue(observationQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditEdgeCache(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.edge_cache_debugger.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredObservations = useMemo(() => {
    const query = deferredObservationQuery.trim().toLowerCase()
    const rows = [draftObservation(draft), ...parsed.observations]
    if (!query) return rows
    return rows.filter(item =>
      `${item.url} ${item.route} ${item.provider} ${item.cacheStatus} ${item.cacheControl} ${item.vary}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredObservationQuery, draft, parsed.observations])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      hitRate: `${numberFromInput(draft.hitRate)}%`,
      observations: parsed.observations.length + 1,
      score,
      status: t(`app.converter.edge_cache_debugger.status.${draft.cacheStatus}`),
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.cacheStatus, draft.hitRate, findings, parsed.observations.length, score, t]
  )

  const updateDraft = <Key extends keyof EdgeDraft>(key: Key, value: EdgeDraft[Key]) => {
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
        t('app.converter.edge_cache_debugger.summary_title'),
        `${t('app.converter.edge_cache_debugger.metric.score')}: ${metrics.score}`,
        `${t('app.converter.edge_cache_debugger.metric.status')}: ${metrics.status}`,
        `${t('app.converter.edge_cache_debugger.metric.hit_rate')}: ${metrics.hitRate}`,
        `${t('app.converter.edge_cache_debugger.metric.observations')}: ${metrics.observations}`,
        `${t('app.converter.edge_cache_debugger.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.edge_cache_debugger.metric.critical')}: ${metrics.critical}`
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
                <Cloud className="h-4 w-4" />
                {t('app.converter.edge-cache-debugger')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.edge-cache-debugger')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.edge_cache_debugger.description')}
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
                {t('app.converter.edge_cache_debugger.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.status')}
              value={metrics.status}
            />
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.hit_rate')}
              value={metrics.hitRate}
            />
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.observations')}
              value={metrics.observations}
            />
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.edge_cache_debugger.metric.critical')}
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
              {t('app.converter.edge_cache_debugger.presets')}
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
                {t(`app.converter.edge_cache_debugger.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.edge_cache_debugger.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.edge_cache_debugger.model')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.edge_cache_debugger.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edge-route">
                  {t('app.converter.edge_cache_debugger.route_pattern')}
                </Label>
                <Input
                  id="edge-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-url">{t('app.converter.edge_cache_debugger.url')}</Label>
                <Input
                  id="edge-url"
                  value={draft.url}
                  onChange={event => updateDraft('url', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-provider">
                  {t('app.converter.edge_cache_debugger.provider')}
                </Label>
                <Select
                  id="edge-provider"
                  value={draft.provider}
                  onChange={event => updateDraft('provider', event.target.value as Provider)}
                >
                  {PROVIDERS.map(provider => (
                    <option key={provider} value={provider}>
                      {t(`app.converter.edge_cache_debugger.provider.${provider}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-status">
                  {t('app.converter.edge_cache_debugger.cache_status')}
                </Label>
                <Select
                  id="edge-status"
                  value={draft.cacheStatus}
                  onChange={event => updateDraft('cacheStatus', event.target.value as CacheStatus)}
                >
                  {CACHE_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {t(`app.converter.edge_cache_debugger.status.${status}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-method">{t('app.converter.edge_cache_debugger.method')}</Label>
                <Select
                  id="edge-method"
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
                <Label htmlFor="edge-response-status">
                  {t('app.converter.edge_cache_debugger.response_status')}
                </Label>
                <Input
                  id="edge-response-status"
                  value={draft.responseStatus}
                  onChange={event => updateDraft('responseStatus', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-age">{t('app.converter.edge_cache_debugger.age')}</Label>
                <Input
                  id="edge-age"
                  value={draft.ageSeconds}
                  onChange={event => updateDraft('ageSeconds', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-hit-rate">
                  {t('app.converter.edge_cache_debugger.hit_rate')}
                </Label>
                <Input
                  id="edge-hit-rate"
                  value={draft.hitRate}
                  onChange={event => updateDraft('hitRate', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-samples">
                  {t('app.converter.edge_cache_debugger.sample_count')}
                </Label>
                <Input
                  id="edge-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edge-vary">{t('app.converter.edge_cache_debugger.vary')}</Label>
                <Input
                  id="edge-vary"
                  value={draft.varyHeader}
                  onChange={event => updateDraft('varyHeader', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="edge-cache-control">
                  {t('app.converter.edge_cache_debugger.cache_control')}
                </Label>
                <Input
                  id="edge-cache-control"
                  value={draft.cacheControl}
                  onChange={event => updateDraft('cacheControl', event.target.value.slice(0, 360))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="edge-cdn-cache">
                  {t('app.converter.edge_cache_debugger.cdn_cache_control')}
                </Label>
                <Input
                  id="edge-cdn-cache"
                  value={draft.cdnCacheControl}
                  onChange={event =>
                    updateDraft('cdnCacheControl', event.target.value.slice(0, 360))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="edge-surrogate">
                  {t('app.converter.edge_cache_debugger.surrogate_control')}
                </Label>
                <Input
                  id="edge-surrogate"
                  value={draft.surrogateControl}
                  onChange={event =>
                    updateDraft('surrogateControl', event.target.value.slice(0, 360))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="edge-server-timing">
                  {t('app.converter.edge_cache_debugger.server_timing')}
                </Label>
                <Input
                  id="edge-server-timing"
                  value={draft.serverTiming}
                  onChange={event => updateDraft('serverTiming', event.target.value.slice(0, 360))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Checkbox
                checked={draft.hasSetCookie}
                onChange={event => updateDraft('hasSetCookie', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.edge_cache_debugger.has_set_cookie')}
              />
              <Checkbox
                checked={draft.hasAuthorization}
                onChange={event => updateDraft('hasAuthorization', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.edge_cache_debugger.has_authorization')}
              />
              <Checkbox
                checked={draft.cacheKeyIncludesCookie}
                onChange={event => updateDraft('cacheKeyIncludesCookie', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.edge_cache_debugger.cache_key_cookie')}
              />
              <Checkbox
                checked={draft.cacheKeyIncludesQuery}
                onChange={event => updateDraft('cacheKeyIncludesQuery', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.edge_cache_debugger.cache_key_query')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.edge_cache_debugger.workspace')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.edge_cache_debugger.workspace_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.edge_cache_debugger.workspace_placeholder')}
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
                {t('app.converter.edge_cache_debugger.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.edge_cache_debugger.audit_search')}
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
                      {t(`app.converter.edge_cache_debugger.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.edge_cache_debugger.level.${finding.level}`)}
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
                  {t('app.converter.edge_cache_debugger.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.edge_cache_debugger.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="edge-output">
                  {t('app.converter.edge_cache_debugger.output_type')}
                </Label>
                <Select
                  id="edge-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.edge_cache_debugger.output.${type}`)}
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
                {t('app.converter.edge_cache_debugger.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'edge-cache-debugger-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.edge_cache_debugger.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'edge-cache-debugger.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.edge_cache_debugger.download_csv')}
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
                {t('app.converter.edge_cache_debugger.observations')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={observationQuery}
                onChange={event => setObservationQuery(event.target.value)}
                placeholder={t('app.converter.edge_cache_debugger.observation_search')}
                className="pl-10"
              />
            </div>
            {filteredObservations.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredObservations.slice(0, 72).map(item => (
                  <div key={item.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {item.url || item.route || item.provider}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(item.cacheStatus === 'hit' ? 'good' : item.cacheStatus === 'miss' || item.cacheStatus === 'bypass' ? 'warn' : 'warn')}`}
                      >
                        {t(`app.converter.edge_cache_debugger.status.${item.cacheStatus}`)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.edge_cache_debugger.provider.${item.provider}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.edge_cache_debugger.source.${item.source}`)}
                      <span className="mx-1">/</span>
                      {item.responseStatus || '-'}
                      <span className="mx-1">/</span>
                      {item.ageSeconds}s
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {item.cacheControl || item.vary || item.serverTiming || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.edge_cache_debugger.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.edge_cache_debugger.reference')}
                </CardTitle>
              </div>
              <CardDescription>
                {t('app.converter.edge_cache_debugger.reference_hint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.edge_cache_debugger.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.edge_cache_debugger.reference.${item}_hint`)}
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
                  {t('app.converter.edge_cache_debugger.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.edge_cache_debugger.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.edge_cache_debugger.checklist.${item}.body`)}
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
