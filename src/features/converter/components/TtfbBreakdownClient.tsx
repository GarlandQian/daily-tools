'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  Gauge,
  ListChecks,
  Network,
  RotateCcw,
  Search,
  Server,
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

const DEVICES = ['mobile', 'desktop'] as const
const PERCENTILES = ['p50', 'p75', 'p90', 'p95', 'lab'] as const
const NAVIGATION_MODES = ['cold', 'warm', 'reload', 'bfcache', 'prefetch'] as const
const CACHE_STATUSES = ['hit', 'miss', 'bypass', 'revalidated', 'unknown'] as const
const OUTPUT_TYPES = ['headers', 'next', 'nginx', 'playbook', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const SAMPLE_LIMIT = 180

type Device = (typeof DEVICES)[number]
type Percentile = (typeof PERCENTILES)[number]
type NavigationMode = (typeof NAVIGATION_MODES)[number]
type CacheStatus = (typeof CACHE_STATUSES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ParsedSource = 'header' | 'json' | 'manual' | 'text'

interface TtfbDraft {
  cacheStatus: CacheStatus
  compression: boolean
  device: Device
  dnsMs: string
  earlyHints: boolean
  edgeMs: string
  keepAlive: boolean
  navigationMode: NavigationMode
  originMs: string
  percentile: Percentile
  personalized: boolean
  redirectMs: string
  requestWaitMs: string
  routePattern: string
  sampleCount: string
  serverTiming: string
  staticCached: boolean
  streaming: boolean
  tcpMs: string
  tlsMs: string
  ttfbMs: string
  url: string
  usesCdn: boolean
}

interface ParsedTtfbSample {
  cacheStatus: CacheStatus
  dnsMs: number
  edgeMs: number
  id: string
  originMs: number
  redirectMs: number
  requestWaitMs: number
  route: string
  serverTiming: string
  source: ParsedSource
  tcpMs: number
  tlsMs: number
  ttfbMs: number
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  samples: ParsedTtfbSample[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: TtfbDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: TtfbDraft = {
  cacheStatus: 'hit',
  compression: true,
  device: 'mobile',
  dnsMs: '14',
  earlyHints: true,
  edgeMs: '24',
  keepAlive: true,
  navigationMode: 'warm',
  originMs: '94',
  percentile: 'p75',
  personalized: false,
  redirectMs: '0',
  requestWaitMs: '48',
  routePattern: '/products/:slug',
  sampleCount: '2400',
  serverTiming: 'edge;dur=24, origin;dur=94, cache;desc=HIT',
  staticCached: true,
  streaming: true,
  tcpMs: '18',
  tlsMs: '22',
  ttfbMs: '260',
  url: 'https://www.example.com/products/example',
  usesCdn: true
}

const PRESETS: Preset[] = [
  {
    key: 'healthy',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Server-Timing: edge;dur=24, origin;dur=94, cache;desc=HIT',
      'cf-cache-status: HIT',
      'ttfb=260 route=/products/example url=https://www.example.com/products/example dns=14 tcp=18 tls=22 wait=48 edge=24 origin=94 cache=hit'
    ].join('\n')
  },
  {
    key: 'cold_nav',
    draft: {
      ...DEFAULT_DRAFT,
      cacheStatus: 'miss',
      dnsMs: '92',
      edgeMs: '80',
      navigationMode: 'cold',
      tcpMs: '140',
      tlsMs: '120',
      ttfbMs: '880'
    },
    workspace: [
      '{"name":"https://www.example.com/docs","startTime":0,"redirectStart":0,"redirectEnd":0,"domainLookupStart":90,"domainLookupEnd":182,"connectStart":182,"secureConnectionStart":250,"connectEnd":392,"requestStart":410,"responseStart":880,"serverTiming":[{"name":"edge","duration":80},{"name":"origin","duration":410}]}',
      'x-cache: MISS'
    ].join('\n')
  },
  {
    key: 'edge_miss',
    draft: {
      ...DEFAULT_DRAFT,
      cacheStatus: 'miss',
      edgeMs: '340',
      originMs: '520',
      sampleCount: '620',
      staticCached: false,
      ttfbMs: '1180'
    },
    workspace: [
      'Server-Timing: cdn-cache;desc=MISS;dur=340, origin;dur=520',
      'ttfb=1180 route=/landing edge=340 origin=520 cache=miss url=https://www.example.com/landing'
    ].join('\n')
  },
  {
    key: 'origin_slow',
    draft: {
      ...DEFAULT_DRAFT,
      cacheStatus: 'revalidated',
      earlyHints: false,
      originMs: '760',
      requestWaitMs: '220',
      staticCached: false,
      streaming: false,
      ttfbMs: '1320',
      url: 'https://www.example.com/account'
    },
    workspace: [
      'server-timing: db;dur=420, render;dur=250, origin;dur=760',
      'ttfb=1320 route=/account wait=220 origin=760 cache=revalidated url=https://www.example.com/account'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      cacheStatus: 'bypass',
      compression: false,
      device: 'mobile',
      dnsMs: '180',
      earlyHints: false,
      edgeMs: '320',
      keepAlive: false,
      navigationMode: 'cold',
      originMs: '980',
      percentile: 'p75',
      personalized: true,
      redirectMs: '480',
      requestWaitMs: '260',
      routePattern: '/checkout',
      sampleCount: '42',
      serverTiming: '',
      staticCached: false,
      streaming: false,
      tcpMs: '260',
      tlsMs: '220',
      ttfbMs: '2240',
      url: 'http://api.example.com/private/checkout?token=abc',
      usesCdn: false
    },
    workspace: [
      '{"url":"http://api.example.com/private/checkout?token=abc","route":"/checkout","ttfb":2240,"redirect":480,"dns":180,"tcp":260,"tls":220,"wait":260,"edge":320,"origin":980,"cache":"bypass"}',
      'ttfb=2240 route=/checkout url=http://api.example.com/private/checkout?token=abc redirect=480 dns=180 tcp=260 tls=220 wait=260 edge=320 origin=980 cache=bypass',
      'x-cache: BYPASS'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = [
  'navigation',
  'server_timing',
  'cache',
  'connection',
  'streaming',
  'field'
] as const
const CHECKLIST_ITEMS = ['measure', 'cache', 'origin', 'connection'] as const
const NUMERIC_FIELDS: Array<
  [
    keyof Pick<
      TtfbDraft,
      | 'dnsMs'
      | 'edgeMs'
      | 'originMs'
      | 'redirectMs'
      | 'requestWaitMs'
      | 'sampleCount'
      | 'tcpMs'
      | 'tlsMs'
      | 'ttfbMs'
    >,
    string
  ]
> = [
  ['ttfbMs', 'ttfb_ms'],
  ['redirectMs', 'redirect_ms'],
  ['dnsMs', 'dns_ms'],
  ['tcpMs', 'tcp_ms'],
  ['tlsMs', 'tls_ms'],
  ['requestWaitMs', 'request_wait_ms'],
  ['edgeMs', 'edge_ms'],
  ['originMs', 'origin_ms'],
  ['sampleCount', 'sample_count']
]

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeHeader = (value: string) => value.replaceAll('"', "'").replaceAll('\n', ' ')
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
const isHttpUrl = (value: string) => /^http:/iu.test(value)
const isPrivateUrl = (value: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=|\/private\//iu.test(value)

const normalizeCache = (value: unknown): CacheStatus => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (CACHE_STATUSES.includes(token as CacheStatus)) return token as CacheStatus
  if (/hit|fresh|cached/iu.test(token)) return 'hit'
  if (/miss|cold/iu.test(token)) return 'miss'
  if (/bypass|dynamic|no-cache|no_store|no-store/iu.test(token)) return 'bypass'
  if (/revalid|stale|304/iu.test(token)) return 'revalidated'
  return 'unknown'
}

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,>]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const getRecordString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'boolean') return String(value)
  }
  return ''
}

const getRecordNumber = (record: Record<string, unknown>, keys: string[]) =>
  numberFromInput(getRecordString(record, keys))

const diff = (end: number, start: number) =>
  end > 0 && start >= 0 && end >= start ? end - start : 0

const parseServerTimingDurations = (value: string) => {
  const result = { edgeMs: 0, originMs: 0, serverTiming: value.trim() }
  value
    .replace(/^server-timing\s*:\s*/iu, '')
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/u)
    .forEach(part => {
      const name = part.split(';')[0]?.trim().toLowerCase() ?? ''
      const dur = numberFromInput(part.match(/dur\s*=\s*([0-9.]+)/iu)?.[1] ?? '')
      if (!dur) return
      if (/edge|cdn|cache|worker/iu.test(name)) result.edgeMs += dur
      if (/origin|server|app|render|db|database|backend|api/iu.test(name)) result.originMs += dur
    })
  return result
}

const stringifyServerTiming = (value: unknown) => {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map(item => {
      const record = item as Record<string, unknown>
      const name = getRecordString(record, ['name'])
      const duration = getRecordString(record, ['duration', 'dur'])
      return name ? `${name}${duration ? `;dur=${duration}` : ''}` : ''
    })
    .filter(Boolean)
    .join(', ')
}

const addSample = (samples: ParsedTtfbSample[], sample: Omit<ParsedTtfbSample, 'id'>) => {
  if (!sample.url && !sample.route && !sample.ttfbMs && !sample.serverTiming) return
  samples.push({
    ...sample,
    id: `${sample.source}-${samples.length}-${sample.url || sample.route || sample.ttfbMs || sample.serverTiming}`
  })
}

const collectJsonSamples = (value: unknown, samples: ParsedTtfbSample[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonSamples(item, samples))
    return
  }
  if (typeof value !== 'object') return
  const record = value as Record<string, unknown>
  const start = getRecordNumber(record, ['startTime', 'navigationStart'])
  const responseStart = getRecordNumber(record, ['responseStart'])
  const requestStart = getRecordNumber(record, ['requestStart'])
  const redirectStart = getRecordNumber(record, ['redirectStart'])
  const redirectEnd = getRecordNumber(record, ['redirectEnd'])
  const dnsStart = getRecordNumber(record, ['domainLookupStart', 'dnsStart'])
  const dnsEnd = getRecordNumber(record, ['domainLookupEnd', 'dnsEnd'])
  const connectStart = getRecordNumber(record, ['connectStart'])
  const connectEnd = getRecordNumber(record, ['connectEnd'])
  const secureStart = getRecordNumber(record, ['secureConnectionStart'])
  const serverTiming = stringifyServerTiming(record.serverTiming ?? record.server_timing)
  const timingDurations = parseServerTimingDurations(serverTiming)

  const explicitTtfb = getRecordNumber(record, ['ttfb', 'ttfbMs', 'ttfb_ms', 'timeToFirstByte'])
  const ttfbMs = explicitTtfb || diff(responseStart, start)
  const url = getRecordString(record, ['url', 'name', 'href'])
  const route = getRecordString(record, ['route', 'path', 'routePattern'])

  if (ttfbMs || url || route || serverTiming) {
    addSample(samples, {
      cacheStatus: normalizeCache(
        getRecordString(record, ['cache', 'cacheStatus', 'cfCacheStatus', 'xCache'])
      ),
      dnsMs: getRecordNumber(record, ['dns', 'dnsMs']) || diff(dnsEnd, dnsStart),
      edgeMs: getRecordNumber(record, ['edge', 'edgeMs']) || timingDurations.edgeMs,
      originMs: getRecordNumber(record, ['origin', 'originMs']) || timingDurations.originMs,
      redirectMs:
        getRecordNumber(record, ['redirect', 'redirectMs']) || diff(redirectEnd, redirectStart),
      requestWaitMs:
        getRecordNumber(record, ['wait', 'requestWait', 'requestWaitMs']) ||
        diff(responseStart, requestStart),
      route,
      serverTiming,
      source: 'json',
      tcpMs: getRecordNumber(record, ['tcp', 'tcpMs']) || diff(connectEnd, connectStart),
      tlsMs: getRecordNumber(record, ['tls', 'tlsMs']) || diff(connectEnd, secureStart),
      ttfbMs,
      url
    })
  }

  ;['items', 'entries', 'resources', 'requests', 'navigation', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonSamples(record[key], samples)
  })
}

const parseJsonSamples = (input: string): { errors: string[]; samples: ParsedTtfbSample[] } => {
  const errors: string[] = []
  const samples: ParsedTtfbSample[] = []
  const trimmedInput = input.trim()
  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonSamples(JSON.parse(trimmedInput) as unknown, samples)
      return { errors, samples }
    } catch {
      // Mixed workspaces can still recover JSONL rows.
    }
  }
  input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))
    .forEach((row, index) => {
      try {
        collectJsonSamples(JSON.parse(row) as unknown, samples)
      } catch {
        errors.push(`json:${index + 1}`)
      }
    })
  return { errors, samples }
}

const parseTextSamples = (input: string): ParsedTtfbSample[] => {
  const samples: ParsedTtfbSample[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    const headerCache = trimmed.match(/^(?:cf-cache-status|x-cache|cache-status)\s*:\s*(.+)$/iu)
    if (headerCache) {
      addSample(samples, {
        cacheStatus: normalizeCache(headerCache[1]),
        dnsMs: 0,
        edgeMs: 0,
        originMs: 0,
        redirectMs: 0,
        requestWaitMs: 0,
        route: '',
        serverTiming: '',
        source: 'header',
        tcpMs: 0,
        tlsMs: 0,
        ttfbMs: 0,
        url: ''
      })
      return
    }
    if (/^server-timing\s*:/iu.test(trimmed)) {
      const timing = parseServerTimingDurations(trimmed)
      addSample(samples, {
        cacheStatus: normalizeCache(trimmed),
        dnsMs: 0,
        edgeMs: timing.edgeMs,
        originMs: timing.originMs,
        redirectMs: 0,
        requestWaitMs: 0,
        route: tokenValue(trimmed, 'route'),
        serverTiming: timing.serverTiming,
        source: 'header',
        tcpMs: 0,
        tlsMs: 0,
        ttfbMs: numberFromInput(tokenValue(trimmed, 'ttfb')),
        url: tokenValue(trimmed, 'url')
      })
      return
    }
    if (!/(ttfb|route|url|origin|edge|cache)\s*=/iu.test(trimmed)) return
    addSample(samples, {
      cacheStatus: normalizeCache(tokenValue(trimmed, 'cache')),
      dnsMs: numberFromInput(tokenValue(trimmed, 'dns')),
      edgeMs: numberFromInput(tokenValue(trimmed, 'edge')),
      originMs: numberFromInput(tokenValue(trimmed, 'origin')),
      redirectMs: numberFromInput(tokenValue(trimmed, 'redirect')),
      requestWaitMs: numberFromInput(
        tokenValue(trimmed, 'wait') || tokenValue(trimmed, 'requestWait')
      ),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      serverTiming: tokenValue(trimmed, 'serverTiming'),
      source: 'text',
      tcpMs: numberFromInput(tokenValue(trimmed, 'tcp')),
      tlsMs: numberFromInput(tokenValue(trimmed, 'tls')),
      ttfbMs: numberFromInput(tokenValue(trimmed, 'ttfb')),
      url: tokenValue(trimmed, 'url') || tokenValue(trimmed, 'href')
    })
  })
  return samples
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonSamples(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    samples: [...json.samples, ...parseTextSamples(source)].slice(0, SAMPLE_LIMIT)
  }
}

const draftSample = (draft: TtfbDraft): ParsedTtfbSample => ({
  cacheStatus: draft.cacheStatus,
  dnsMs: numberFromInput(draft.dnsMs),
  edgeMs: numberFromInput(draft.edgeMs),
  id: 'manual-draft',
  originMs: numberFromInput(draft.originMs),
  redirectMs: numberFromInput(draft.redirectMs),
  requestWaitMs: numberFromInput(draft.requestWaitMs),
  route: draft.routePattern,
  serverTiming: draft.serverTiming,
  source: 'manual',
  tcpMs: numberFromInput(draft.tcpMs),
  tlsMs: numberFromInput(draft.tlsMs),
  ttfbMs: numberFromInput(draft.ttfbMs),
  url: draft.url
})

const auditSample = (
  sample: ParsedTtfbSample,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  if (sample.ttfbMs > 1800)
    add('danger', `${prefix}ttfb_severe`, `${sample.route || sample.url}: ${sample.ttfbMs}ms`)
  else if (sample.ttfbMs > 800)
    add('warn', `${prefix}ttfb_high`, `${sample.route || sample.url}: ${sample.ttfbMs}ms`)
  if (sample.originMs > 700)
    add('danger', `${prefix}origin_slow`, `${sample.route || sample.url}: ${sample.originMs}ms`)
  else if (sample.originMs > 300)
    add('warn', `${prefix}origin_slow`, `${sample.route || sample.url}: ${sample.originMs}ms`)
  if (sample.edgeMs > 300)
    add('warn', `${prefix}edge_slow`, `${sample.route || sample.url}: ${sample.edgeMs}ms`)
  if (sample.redirectMs > 600)
    add('danger', `${prefix}redirect_slow`, `${sample.route || sample.url}: ${sample.redirectMs}ms`)
  else if (sample.redirectMs > 250)
    add('warn', `${prefix}redirect_slow`, `${sample.route || sample.url}: ${sample.redirectMs}ms`)
  if (sample.dnsMs > 120)
    add('warn', `${prefix}dns_slow`, `${sample.route || sample.url}: ${sample.dnsMs}ms`)
  if (sample.tcpMs > 180)
    add('warn', `${prefix}tcp_slow`, `${sample.route || sample.url}: ${sample.tcpMs}ms`)
  if (sample.tlsMs > 180)
    add('warn', `${prefix}tls_slow`, `${sample.route || sample.url}: ${sample.tlsMs}ms`)
  if (sample.requestWaitMs > 220)
    add(
      'warn',
      `${prefix}request_wait_high`,
      `${sample.route || sample.url}: ${sample.requestWaitMs}ms`
    )
  if (sample.cacheStatus === 'miss')
    add('warn', `${prefix}cache_miss`, sample.route || sample.url || 'MISS')
  if (sample.cacheStatus === 'bypass')
    add('danger', `${prefix}cache_bypass`, sample.route || sample.url || 'BYPASS')
  if (sample.cacheStatus === 'revalidated')
    add('warn', `${prefix}cache_revalidated`, sample.route || sample.url || 'revalidated')
  if (!sample.serverTiming && sample.ttfbMs > 800)
    add('warn', `${prefix}server_timing_missing`, sample.route || sample.url || 'Server-Timing')
  if (isHttpUrl(sample.url)) add('danger', `${prefix}http_url`, sample.url)
  if (isPrivateUrl(sample.url)) add('warn', `${prefix}private_url`, sample.url)
}

const auditTtfb = (draft: TtfbDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftSample(draft)
  const samples = numberFromInput(draft.sampleCount)
  const ttfb = numberFromInput(draft.ttfbMs)
  const origin = numberFromInput(draft.originMs)
  const tcp = numberFromInput(draft.tcpMs)
  const tls = numberFromInput(draft.tlsMs)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  auditSample(manual, add)
  if (!draft.usesCdn && ttfb > 600) add('warn', 'missing_cdn', draft.routePattern)
  if (!draft.keepAlive && tcp + tls > 160) add('warn', 'missing_keep_alive', `${tcp + tls}ms`)
  if (!draft.staticCached && draft.cacheStatus !== 'hit')
    add('warn', 'static_cache_missing', draft.routePattern)
  if (draft.personalized) add('warn', 'personalized_route', draft.routePattern)
  if (!draft.earlyHints && ttfb > 800) add('warn', 'early_hints_candidate', draft.routePattern)
  if (!draft.streaming && origin > 500) add('warn', 'streaming_candidate', draft.routePattern)
  if (!draft.compression && ttfb > 800) add('warn', 'compression_missing', draft.url)
  if (!draft.serverTiming.trim() && ttfb > 800)
    add('warn', 'server_timing_missing', draft.routePattern)

  parsed.samples.forEach(sample => auditSample(sample, add, true))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.samples.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'cache_ok', draft.cacheStatus)
    add('good', 'origin_ok', `${origin}ms`)
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

const buildHeaders = (draft: TtfbDraft) =>
  [
    `Server-Timing: ${escapeHeader(draft.serverTiming || `edge;dur=${draft.edgeMs}, origin;dur=${draft.originMs}`)}`,
    draft.staticCached
      ? 'Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
      : 'Cache-Control: private, no-store',
    draft.earlyHints
      ? `Link: <${draft.url}>; rel=preload; as=document`
      : '# Add 103 Early Hints only when the route knows the critical resource before HTML rendering.'
  ].join('\n')

const buildNext = (draft: TtfbDraft) =>
  [
    "import { NextResponse } from 'next/server'",
    '',
    'export function middleware() {',
    '  const started = Date.now()',
    '  const response = NextResponse.next()',
    `  response.headers.set('Server-Timing', 'edge;dur=${escapeJs(draft.edgeMs)}, origin;dur=${escapeJs(draft.originMs)}')`,
    draft.staticCached
      ? "  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')"
      : "  response.headers.set('Cache-Control', 'private, no-store')",
    "  response.headers.set('Server-Timing', `${response.headers.get('Server-Timing')}, middleware;dur=${Date.now() - started}`)",
    '  return response',
    '}'
  ].join('\n')

const buildNginx = (draft: TtfbDraft) =>
  [
    'proxy_http_version 1.1;',
    'proxy_set_header Connection "";',
    draft.staticCached ? 'proxy_cache_valid 200 10m;' : 'proxy_no_cache 1;',
    `add_header Server-Timing "${escapeHeader(draft.serverTiming || `edge;dur=${draft.edgeMs}, origin;dur=${draft.originMs}`)}" always;`
  ].join('\n')

const buildPlaybook = (draft: TtfbDraft) =>
  [
    `# TTFB playbook for ${draft.routePattern}`,
    '',
    '1. Segment field data by device, geography, cache status, and navigation mode.',
    '2. Split Navigation Timing into redirect, DNS, TCP, TLS, request wait, and response start.',
    '3. Add Server-Timing around CDN, edge, origin render, database, and API calls.',
    '4. Fix cache misses or bypasses before tuning application code.',
    '5. Use keep-alive, connection reuse, compression, streaming, and Early Hints where they change measured starts.',
    '6. Re-check p75 TTFB and LCP together after every change.'
  ].join('\n')

const buildMarkdown = (draft: TtfbDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# TTFB breakdown: ${draft.routePattern}`,
    '',
    `- TTFB: ${draft.ttfbMs} ms`,
    `- Origin: ${draft.originMs} ms`,
    `- Edge: ${draft.edgeMs} ms`,
    `- Cache: ${draft.cacheStatus}`,
    `- Navigation: ${draft.navigationMode} / ${draft.percentile}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed samples',
    ...parsed.samples
      .slice(0, 24)
      .map(
        sample =>
          `- ${sample.route || sample.url || sample.source}: ${sample.ttfbMs} ms / edge ${sample.edgeMs} / origin ${sample.originMs} / ${sample.cacheStatus}`
      )
  ].join('\n')

const buildCsv = (draft: TtfbDraft, parsed: ParsedWorkspace) => {
  const rows = [draftSample(draft), ...parsed.samples]
  return [
    [
      'source',
      'route',
      'url',
      'ttfb_ms',
      'redirect_ms',
      'dns_ms',
      'tcp_ms',
      'tls_ms',
      'request_wait_ms',
      'edge_ms',
      'origin_ms',
      'cache_status',
      'server_timing'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(sample =>
      [
        sample.source,
        sample.route,
        sample.url,
        sample.ttfbMs,
        sample.redirectMs,
        sample.dnsMs,
        sample.tcpMs,
        sample.tlsMs,
        sample.requestWaitMs,
        sample.edgeMs,
        sample.originMs,
        sample.cacheStatus,
        sample.serverTiming
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: TtfbDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'headers') return buildHeaders(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'nginx') return buildNginx(draft)
  if (outputType === 'playbook') return buildPlaybook(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, samples: parsed.samples }, null, 2)
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

export default function TtfbBreakdownClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<TtfbDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('headers')
  const [auditQuery, setAuditQuery] = useState('')
  const [sampleQuery, setSampleQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredSampleQuery = useDeferredValue(sampleQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditTtfb(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const rows = useMemo(() => [draftSample(draft), ...parsed.samples], [draft, parsed.samples])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.ttfb_breakdown.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredSampleQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(sample =>
      `${sample.url} ${sample.route} ${sample.cacheStatus} ${sample.source} ${sample.serverTiming}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredSampleQuery, rows])
  const metrics = useMemo(
    () => ({
      cache: draft.cacheStatus,
      critical: findings.filter(item => item.level === 'danger').length,
      origin: `${draft.originMs}ms`,
      score,
      ttfb: `${draft.ttfbMs}ms`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.cacheStatus, draft.originMs, draft.ttfbMs, findings, score]
  )

  const updateDraft = <Key extends keyof TtfbDraft>(key: Key, value: TtfbDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
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
    setSampleQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.ttfb_breakdown.summary_title'),
        `${t('app.converter.ttfb_breakdown.metric.score')}: ${metrics.score}`,
        `${t('app.converter.ttfb_breakdown.metric.ttfb')}: ${metrics.ttfb}`,
        `${t('app.converter.ttfb_breakdown.metric.origin')}: ${metrics.origin}`,
        `${t('app.converter.ttfb_breakdown.metric.cache')}: ${t(`app.converter.ttfb_breakdown.cache.${metrics.cache}`)}`,
        `${t('app.converter.ttfb_breakdown.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.ttfb_breakdown.metric.critical')}: ${metrics.critical}`
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
                <Server className="h-4 w-4" />
                {t('app.converter.ttfb-breakdown')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.ttfb-breakdown')}</CardTitle>
              <CardDescription>{t('app.converter.ttfb_breakdown.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.ttfb_breakdown.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.ttfb_breakdown.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.ttfb_breakdown.metric.ttfb')} value={metrics.ttfb} />
            <Metric
              label={t('app.converter.ttfb_breakdown.metric.origin')}
              value={metrics.origin}
            />
            <Metric
              label={t('app.converter.ttfb_breakdown.metric.cache')}
              value={t(`app.converter.ttfb_breakdown.cache.${metrics.cache}`)}
            />
            <Metric
              label={t('app.converter.ttfb_breakdown.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.ttfb_breakdown.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.ttfb_breakdown.presets')}</CardTitle>
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
                {t(`app.converter.ttfb_breakdown.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.ttfb_breakdown.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.ttfb_breakdown.model')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.ttfb_breakdown.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ttfb-route">
                  {t('app.converter.ttfb_breakdown.route_pattern')}
                </Label>
                <Input
                  id="ttfb-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttfb-url">{t('app.converter.ttfb_breakdown.url')}</Label>
                <Input
                  id="ttfb-url"
                  value={draft.url}
                  onChange={event => updateDraft('url', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttfb-device">{t('app.converter.ttfb_breakdown.device')}</Label>
                <Select
                  id="ttfb-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.ttfb_breakdown.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttfb-percentile">
                  {t('app.converter.ttfb_breakdown.percentile')}
                </Label>
                <Select
                  id="ttfb-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value as Percentile)}
                >
                  {PERCENTILES.map(percentile => (
                    <option key={percentile} value={percentile}>
                      {t(`app.converter.ttfb_breakdown.percentile.${percentile}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttfb-mode">
                  {t('app.converter.ttfb_breakdown.navigation_mode')}
                </Label>
                <Select
                  id="ttfb-mode"
                  value={draft.navigationMode}
                  onChange={event =>
                    updateDraft('navigationMode', event.target.value as NavigationMode)
                  }
                >
                  {NAVIGATION_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {t(`app.converter.ttfb_breakdown.mode.${mode}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttfb-cache">{t('app.converter.ttfb_breakdown.cache_status')}</Label>
                <Select
                  id="ttfb-cache"
                  value={draft.cacheStatus}
                  onChange={event => updateDraft('cacheStatus', event.target.value as CacheStatus)}
                >
                  {CACHE_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {t(`app.converter.ttfb_breakdown.cache.${status}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {NUMERIC_FIELDS.map(([field, key]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`ttfb-${field}`}>
                    {t(`app.converter.ttfb_breakdown.${key}`)}
                  </Label>
                  <Input
                    id={`ttfb-${field}`}
                    value={draft[field]}
                    onChange={event => updateDraft(field, event.target.value.slice(0, 10))}
                    className="font-mono"
                    inputMode="decimal"
                  />
                </div>
              ))}
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="ttfb-server-timing">
                  {t('app.converter.ttfb_breakdown.server_timing')}
                </Label>
                <Input
                  id="ttfb-server-timing"
                  value={draft.serverTiming}
                  onChange={event => updateDraft('serverTiming', event.target.value.slice(0, 420))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Checkbox
                checked={draft.usesCdn}
                onChange={event => updateDraft('usesCdn', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.uses_cdn')}
              />
              <Checkbox
                checked={draft.keepAlive}
                onChange={event => updateDraft('keepAlive', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.keep_alive')}
              />
              <Checkbox
                checked={draft.earlyHints}
                onChange={event => updateDraft('earlyHints', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.early_hints')}
              />
              <Checkbox
                checked={draft.staticCached}
                onChange={event => updateDraft('staticCached', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.static_cached')}
              />
              <Checkbox
                checked={draft.personalized}
                onChange={event => updateDraft('personalized', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.personalized')}
              />
              <Checkbox
                checked={draft.streaming}
                onChange={event => updateDraft('streaming', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.streaming')}
              />
              <Checkbox
                checked={draft.compression}
                onChange={event => updateDraft('compression', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.ttfb_breakdown.compression')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.ttfb_breakdown.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.ttfb_breakdown.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.ttfb_breakdown.workspace_placeholder')}
              className="min-h-[600px] font-mono"
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
              <CardTitle className="text-base">{t('app.converter.ttfb_breakdown.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.ttfb_breakdown.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 60).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.ttfb_breakdown.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.ttfb_breakdown.level.${finding.level}`)}
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
                  {t('app.converter.ttfb_breakdown.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.ttfb_breakdown.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="ttfb-output">{t('app.converter.ttfb_breakdown.output_type')}</Label>
                <Select
                  id="ttfb-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.ttfb_breakdown.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[360px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.ttfb_breakdown.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'ttfb-breakdown-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.ttfb_breakdown.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'ttfb-breakdown.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.ttfb_breakdown.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.ttfb_breakdown.samples')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={sampleQuery}
                onChange={event => setSampleQuery(event.target.value)}
                placeholder={t('app.converter.ttfb_breakdown.sample_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(sample => (
                  <div key={sample.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {sample.route || sample.url || sample.source}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(sample.ttfbMs > 1800 ? 'danger' : sample.ttfbMs > 800 ? 'warn' : 'good')}`}
                      >
                        {sample.ttfbMs}ms
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.ttfb_breakdown.cache.${sample.cacheStatus}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.ttfb_breakdown.source.${sample.source}`)}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {t('app.converter.ttfb_breakdown.edge_label')} {sample.edgeMs}ms /{' '}
                      {t('app.converter.ttfb_breakdown.origin_label')} {sample.originMs}ms /{' '}
                      {t('app.converter.ttfb_breakdown.wait_label')} {sample.requestWaitMs}ms
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.ttfb_breakdown.empty')}
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
                  {t('app.converter.ttfb_breakdown.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.ttfb_breakdown.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.ttfb_breakdown.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.ttfb_breakdown.reference.${item}_hint`)}
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
                  {t('app.converter.ttfb_breakdown.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.ttfb_breakdown.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.ttfb_breakdown.checklist.${item}.body`)}
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
