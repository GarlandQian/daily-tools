'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  Network,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const DEVICES = ['mobile', 'desktop'] as const
const RESOURCE_TYPES = [
  'document',
  'script',
  'style',
  'image',
  'font',
  'fetch',
  'third_party',
  'other'
] as const
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest', 'auto'] as const
const CACHE_STATUSES = ['hit', 'miss', 'stale', 'bypass', 'unknown'] as const
const OUTPUT_TYPES = ['hints', 'priority', 'cache', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const REQUEST_LIMIT = 180

type Device = (typeof DEVICES)[number]
type ResourceType = (typeof RESOURCE_TYPES)[number]
type Priority = (typeof PRIORITIES)[number]
type CacheStatus = (typeof CACHE_STATUSES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type RequestSource = 'har' | 'json' | 'text'

interface WaterfallDraft {
  blockingCssKb: string
  blockingJsKb: string
  cacheHitRate: string
  cacheStatus: CacheStatus
  compressed: 'no' | 'yes'
  criticalChainMs: string
  device: Device
  lcpDiscoveryMs: string
  lcpDownloadMs: string
  lcpUrl: string
  originCount: string
  priority: Priority
  requestCount: string
  resourceType: ResourceType
  routePattern: string
  startDelayMs: string
  totalTransferKb: string
  ttfbMs: string
}

interface ParsedRequest {
  cacheStatus: CacheStatus
  compressed: boolean
  dnsMs: number
  downloadMs: number
  durationMs: number
  id: string
  isLcp: boolean
  method: string
  origin: string
  priority: Priority
  renderBlocking: boolean
  source: RequestSource
  startMs: number
  status: number
  transferKb: number
  ttfbMs: number
  type: ResourceType
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  requests: ParsedRequest[]
}

interface Preset {
  draft: WaterfallDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: WaterfallDraft = {
  blockingCssKb: '42',
  blockingJsKb: '58',
  cacheHitRate: '82',
  cacheStatus: 'hit',
  compressed: 'yes',
  criticalChainMs: '1680',
  device: 'mobile',
  lcpDiscoveryMs: '460',
  lcpDownloadMs: '620',
  lcpUrl: 'https://www.example.com/images/hero.avif',
  originCount: '4',
  priority: 'high',
  requestCount: '44',
  resourceType: 'image',
  routePattern: '/*',
  startDelayMs: '120',
  totalTransferKb: '980',
  ttfbMs: '420'
}

const PRESETS: Preset[] = [
  {
    key: 'lcp_route',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"log":{"entries":[{"request":{"method":"GET","url":"https://www.example.com/","headers":[]},"response":{"status":200,"content":{"mimeType":"text/html"},"headers":[{"name":"Cache-Control","value":"s-maxage=3600"}],"_transferSize":42},"time":420,"timings":{"blocked":20,"dns":16,"connect":34,"ssl":24,"wait":260,"receive":80},"_resourceType":"document","_priority":"VeryHigh"},{"request":{"method":"GET","url":"https://www.example.com/images/hero.avif","headers":[]},"response":{"status":200,"content":{"mimeType":"image/avif"},"headers":[{"name":"Content-Encoding","value":"br"},{"name":"Cache-Control","value":"max-age=31536000"}],"_transferSize":148000},"time":620,"timings":{"blocked":40,"dns":0,"connect":0,"ssl":0,"wait":120,"receive":500},"_resourceType":"image","_priority":"High","_isLcp":true}]}}',
      'url=/assets/app.css type=style start=180 ttfb=90 duration=240 transfer=48KB cache=hit priority=high blocking=true'
    ].join('\n')
  },
  {
    key: 'api_ttfb',
    draft: {
      ...DEFAULT_DRAFT,
      cacheHitRate: '48',
      criticalChainMs: '2600',
      lcpDiscoveryMs: '820',
      lcpUrl: 'https://api.example.com/products/123',
      resourceType: 'fetch',
      routePattern: '/products/:slug',
      startDelayMs: '380',
      ttfbMs: '1280'
    },
    workspace: [
      'url=https://api.example.com/products/123 type=fetch start=220 ttfb=1280 duration=1480 transfer=34KB cache=miss priority=high',
      'url=https://www.example.com/products/123 type=document start=0 ttfb=920 duration=1120 transfer=68KB cache=miss priority=highest',
      'url=https://cdn.example.com/products/hero.jpg type=image start=1360 ttfb=160 duration=1180 transfer=720KB cache=hit priority=high lcp=true'
    ].join('\n')
  },
  {
    key: 'third_party',
    draft: {
      ...DEFAULT_DRAFT,
      blockingJsKb: '180',
      cacheHitRate: '54',
      criticalChainMs: '3100',
      lcpDiscoveryMs: '980',
      originCount: '9',
      requestCount: '86',
      resourceType: 'third_party',
      routePattern: '/campaign/:slug',
      totalTransferKb: '1800'
    },
    workspace: [
      'url=https://tags.example.com/manager.js type=script start=240 ttfb=220 duration=980 transfer=260KB cache=miss priority=high blocking=true',
      'url=https://ads.example.com/bid.js type=script start=680 ttfb=280 duration=1140 transfer=340KB cache=bypass priority=high blocking=true',
      'url=https://analytics.example.com/events.js type=script start=1220 ttfb=120 duration=520 transfer=82KB cache=miss priority=low'
    ].join('\n')
  },
  {
    key: 'cache_miss',
    draft: {
      ...DEFAULT_DRAFT,
      cacheHitRate: '18',
      cacheStatus: 'miss',
      criticalChainMs: '2900',
      requestCount: '78',
      routePattern: '/docs/:slug',
      totalTransferKb: '1650',
      ttfbMs: '960'
    },
    workspace: [
      'url=https://www.example.com/docs/cache type=document start=0 ttfb=960 duration=1180 transfer=96KB cache=miss priority=highest',
      'url=https://www.example.com/assets/docs.css type=style start=300 ttfb=120 duration=460 transfer=160KB cache=miss priority=high blocking=true',
      'url=https://www.example.com/assets/docs.js type=script start=420 ttfb=180 duration=740 transfer=220KB cache=miss priority=medium blocking=true'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      blockingCssKb: '320',
      blockingJsKb: '680',
      cacheHitRate: '9',
      cacheStatus: 'bypass',
      compressed: 'no',
      criticalChainMs: '6500',
      device: 'mobile',
      lcpDiscoveryMs: '3100',
      lcpDownloadMs: '2800',
      lcpUrl: 'http://cdn.example.com/hero-large.jpg?token=abc',
      originCount: '18',
      priority: 'low',
      requestCount: '148',
      resourceType: 'image',
      routePattern: '/checkout',
      startDelayMs: '1300',
      totalTransferKb: '6400',
      ttfbMs: '1800'
    },
    workspace: [
      'url=http://cdn.example.com/hero-large.jpg?token=abc type=image start=3100 ttfb=460 duration=2800 transfer=2200KB cache=miss priority=low lcp=true',
      'url=https://www.example.com/app.css type=style start=1200 ttfb=260 duration=900 transfer=320KB cache=bypass priority=high blocking=true compressed=false',
      'url=https://tags.example.com/manager.js type=script start=420 ttfb=340 duration=1600 transfer=680KB cache=bypass priority=high blocking=true compressed=false',
      'url=https://ads.example.com/bid.js type=script start=1800 ttfb=520 duration=1900 transfer=780KB cache=miss priority=high blocking=true',
      '{"url":"https://api.example.com/checkout","type":"fetch","startMs":260,"ttfbMs":1800,"durationMs":2300,"transferKb":42,"cacheStatus":"miss","priority":"high","status":200}'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = [
  'ttfb',
  'critical_chain',
  'lcp_discovery',
  'origins',
  'cache',
  'compression'
] as const
const CHECKLIST_ITEMS = ['capture', 'lcp', 'cache', 'repeat'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const getOrigin = (url: string) => safeUrl(url)?.origin ?? 'unknown'

const normalizeType = (value: unknown): ResourceType => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (/stylesheet|css/u.test(token)) return 'style'
  if (/xhr|fetch|api|json/u.test(token)) return 'fetch'
  if (/script|javascript|js/u.test(token)) return 'script'
  if (/image|img|jpg|jpeg|png|webp|avif|gif/u.test(token)) return 'image'
  if (/font|woff|ttf|otf/u.test(token)) return 'font'
  if (/document|html|navigation/u.test(token)) return 'document'
  if (/third/u.test(token)) return 'third_party'
  return RESOURCE_TYPES.includes(token as ResourceType) ? (token as ResourceType) : 'other'
}

const normalizePriority = (value: unknown): Priority => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (/veryhigh|highest/u.test(token)) return 'highest'
  if (/verylow|lowest/u.test(token)) return 'lowest'
  return PRIORITIES.includes(token as Priority) ? (token as Priority) : 'auto'
}

const normalizeCache = (value: unknown): CacheStatus => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (/hit/u.test(token)) return 'hit'
  if (/stale|revalidate/u.test(token)) return 'stale'
  if (/bypass|dynamic|no-cache|no-store/u.test(token)) return 'bypass'
  if (/miss|expired/u.test(token)) return 'miss'
  return 'unknown'
}

const toKb = (value: unknown) => {
  if (typeof value === 'number') return value > 8192 ? round(value / 1024) : round(value)
  const text = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  const number = Number(text.replace(/kb|kib|ms|s|b$/giu, ''))
  if (!Number.isFinite(number)) return 0
  if (/mb|mib/iu.test(text)) return round(number * 1024)
  if (/\bb$/iu.test(text) || number > 8192) return round(number / 1024)
  return round(number)
}

const toMs = (value: unknown) => {
  if (typeof value === 'number') return round(value)
  const text = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  const number = Number(text.replace(/ms|s$/giu, ''))
  if (!Number.isFinite(number)) return 0
  return /s$/iu.test(text) && !/ms$/iu.test(text) ? round(number * 1000) : round(number)
}

const getHeader = (headers: unknown, name: string) => {
  if (!Array.isArray(headers)) return ''
  const found = headers.find(item => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return String(record.name ?? '').toLowerCase() === name.toLowerCase()
  }) as Record<string, unknown> | undefined
  return String(found?.value ?? '')
}

const isCompressed = (headers: unknown, fallback = true) => {
  const encoding = getHeader(headers, 'Content-Encoding')
  if (encoding) return /br|gzip|zstd|deflate/iu.test(encoding)
  return fallback
}

const hasPrivateQuery = (url: string) =>
  /[?&](token|auth|session|email|user|key|secret)=/iu.test(url)

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const parseHarEntry = (entry: Record<string, unknown>, index: number): ParsedRequest => {
  const request = (
    entry.request && typeof entry.request === 'object' ? entry.request : {}
  ) as Record<string, unknown>
  const response = (
    entry.response && typeof entry.response === 'object' ? entry.response : {}
  ) as Record<string, unknown>
  const content =
    response.content && typeof response.content === 'object'
      ? (response.content as Record<string, unknown>)
      : {}
  const timings = (
    entry.timings && typeof entry.timings === 'object' ? entry.timings : {}
  ) as Record<string, unknown>
  const url = String(request.url ?? entry.url ?? '')
  const type = normalizeType(entry._resourceType ?? content.mimeType ?? entry.resourceType)
  const durationMs = toMs(entry.time ?? entry.duration ?? entry.durationMs)
  const ttfbMs = toMs(timings.wait ?? entry.ttfbMs ?? entry.ttfb)
  const transferKb = toKb(
    response._transferSize ?? response.bodySize ?? content.size ?? entry.transferKb
  )

  return {
    cacheStatus: normalizeCache(
      getHeader(response.headers, 'Cache-Status') ||
        getHeader(response.headers, 'CF-Cache-Status') ||
        getHeader(response.headers, 'X-Vercel-Cache')
    ),
    compressed: isCompressed(response.headers, true),
    dnsMs: toMs(timings.dns),
    downloadMs: toMs(timings.receive) || Math.max(0, durationMs - ttfbMs),
    durationMs,
    id: `har-${index}`,
    isLcp: Boolean(entry._isLcp) || /lcp|hero|largest/iu.test(url),
    method: String(request.method ?? 'GET'),
    origin: getOrigin(url),
    priority: normalizePriority(entry._priority ?? entry.priority),
    renderBlocking:
      Boolean(entry._renderBlocking) ||
      type === 'style' ||
      (type === 'script' && normalizePriority(entry._priority ?? entry.priority) !== 'low'),
    source: 'har',
    startMs: toMs(entry.startedDateTime ? 0 : (entry.startTime ?? entry.startMs)),
    status: Number(response.status ?? entry.status ?? 0) || 0,
    transferKb,
    ttfbMs,
    type,
    url
  }
}

const getObjectValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key]
  }
  return undefined
}

const parseRequestObject = (
  record: Record<string, unknown>,
  index: number,
  source: RequestSource
): ParsedRequest | null => {
  const url = String(getObjectValue(record, ['url', 'name', 'href', 'requestUrl']) ?? '')
  if (!url) return null
  const startMs = toMs(
    getObjectValue(record, ['startMs', 'startTime', 'start', 'networkRequestTime'])
  )
  const endMs = toMs(getObjectValue(record, ['endMs', 'endTime', 'end']))
  const durationMs =
    toMs(getObjectValue(record, ['durationMs', 'duration', 'time'])) || Math.max(0, endMs - startMs)
  const ttfbMs = toMs(getObjectValue(record, ['ttfbMs', 'ttfb', 'wait', 'waiting']))
  const transferKb = toKb(
    getObjectValue(record, ['transferKb', 'transferSize', 'encodedDataLength', 'sizeKb', 'kb'])
  )
  const type = normalizeType(
    getObjectValue(record, ['type', 'resourceType', 'mimeType', 'initiatorType'])
  )

  return {
    cacheStatus: normalizeCache(getObjectValue(record, ['cacheStatus', 'cache', 'cacheState'])),
    compressed: String(getObjectValue(record, ['compressed', 'compression']) ?? 'true') !== 'false',
    dnsMs: toMs(getObjectValue(record, ['dnsMs', 'dns'])),
    downloadMs:
      toMs(getObjectValue(record, ['downloadMs', 'download', 'receive'])) ||
      Math.max(0, durationMs - ttfbMs),
    durationMs,
    id: `${source}-${index}`,
    isLcp:
      Boolean(record.isLcp ?? record.lcp) || /lcp|hero|largest/iu.test(String(record.label ?? url)),
    method: String(record.method ?? 'GET'),
    origin: String(record.origin ?? '') || getOrigin(url),
    priority: normalizePriority(getObjectValue(record, ['priority', 'fetchPriority'])),
    renderBlocking:
      Boolean(record.renderBlocking ?? record.blocking) ||
      /true|yes/iu.test(String(record.blocking ?? '')),
    source,
    startMs,
    status: Number(getObjectValue(record, ['status', 'statusCode']) ?? 0) || 0,
    transferKb,
    ttfbMs,
    type,
    url
  }
}

const parseJsonWorkspace = (input: string): { errors: string[]; requests: ParsedRequest[] } => {
  const errors: string[] = []
  const requests: ParsedRequest[] = []
  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, rowIndex) => {
    try {
      const parsed = JSON.parse(row) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        const log =
          record.log && typeof record.log === 'object'
            ? (record.log as Record<string, unknown>)
            : null
        const entries = log && Array.isArray(log.entries) ? log.entries : null
        const audits =
          record.audits && typeof record.audits === 'object'
            ? (record.audits as Record<string, unknown>)
            : null
        const networkAudit = audits?.['network-requests'] as Record<string, unknown> | undefined
        const details = networkAudit?.details as Record<string, unknown> | undefined
        const items = details && Array.isArray(details.items) ? details.items : null

        if (entries) {
          entries.forEach((entry, index) => {
            if (entry && typeof entry === 'object')
              requests.push(
                parseHarEntry(entry as Record<string, unknown>, requests.length + index)
              )
          })
          return
        }

        if (items) {
          items.forEach((item, index) => {
            if (!item || typeof item !== 'object') return
            const parsedRequest = parseRequestObject(
              item as Record<string, unknown>,
              requests.length + index,
              'json'
            )
            if (parsedRequest) requests.push(parsedRequest)
          })
          return
        }
      }

      const values = Array.isArray(parsed) ? parsed : [parsed]
      values.forEach((item, index) => {
        if (!item || typeof item !== 'object') return
        const parsedRequest = parseRequestObject(
          item as Record<string, unknown>,
          requests.length + index,
          'json'
        )
        if (parsedRequest) requests.push(parsedRequest)
      })
    } catch {
      errors.push(`json:${rowIndex + 1}`)
    }
  })

  return { errors, requests }
}

const parseTextWorkspace = (input: string): ParsedRequest[] =>
  input
    .split(/\n+/u)
    .map((line, index): ParsedRequest | null => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || /^<|^#/u.test(trimmed))
        return null
      const url =
        tokenValue(trimmed, 'url') ||
        tokenValue(trimmed, 'href') ||
        (trimmed.match(/https?:\/\/[^\s,]+|\/[^\s,]+/iu)?.[0] ?? '')
      if (!url) return null
      const type = normalizeType(tokenValue(trimmed, 'type') || tokenValue(trimmed, 'resource'))
      const durationMs = toMs(tokenValue(trimmed, 'duration') || tokenValue(trimmed, 'time'))
      const ttfbMs = toMs(tokenValue(trimmed, 'ttfb') || tokenValue(trimmed, 'wait'))
      const transferKb = toKb(
        tokenValue(trimmed, 'transfer') || tokenValue(trimmed, 'size') || tokenValue(trimmed, 'kb')
      )

      return {
        cacheStatus: normalizeCache(tokenValue(trimmed, 'cache')),
        compressed: !/compressed\s*=\s*false|encoding\s*=\s*none/iu.test(trimmed),
        dnsMs: toMs(tokenValue(trimmed, 'dns')),
        downloadMs:
          toMs(tokenValue(trimmed, 'download') || tokenValue(trimmed, 'receive')) ||
          Math.max(0, durationMs - ttfbMs),
        durationMs,
        id: `text-${index}`,
        isLcp: /lcp\s*=\s*(true|yes)|\blcp\b|hero/iu.test(trimmed),
        method: tokenValue(trimmed, 'method') || 'GET',
        origin: tokenValue(trimmed, 'origin') || getOrigin(url),
        priority: normalizePriority(tokenValue(trimmed, 'priority')),
        renderBlocking:
          /blocking\s*=\s*(true|yes)|render-blocking/iu.test(trimmed) || type === 'style',
        source: 'text',
        startMs: toMs(tokenValue(trimmed, 'start')),
        status: Number(tokenValue(trimmed, 'status') || 0) || 0,
        transferKb,
        ttfbMs,
        type,
        url
      }
    })
    .filter((request): request is ParsedRequest => Boolean(request))

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonWorkspace(source)
  const requests = [...json.requests, ...parseTextWorkspace(source)].slice(0, REQUEST_LIMIT)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    requests
  }
}

const draftAsRequest = (draft: WaterfallDraft): ParsedRequest => ({
  cacheStatus: draft.cacheStatus,
  compressed: draft.compressed === 'yes',
  dnsMs: 0,
  downloadMs: numberFromInput(draft.lcpDownloadMs),
  durationMs: numberFromInput(draft.lcpDiscoveryMs) + numberFromInput(draft.lcpDownloadMs),
  id: 'manual-lcp',
  isLcp: true,
  method: 'GET',
  origin: getOrigin(draft.lcpUrl),
  priority: draft.priority,
  renderBlocking: false,
  source: 'text',
  startMs: numberFromInput(draft.lcpDiscoveryMs),
  status: 200,
  transferKb: numberFromInput(draft.totalTransferKb),
  ttfbMs: numberFromInput(draft.ttfbMs),
  type: draft.resourceType,
  url: draft.lcpUrl
})

const auditWaterfall = (draft: WaterfallDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const ttfb = numberFromInput(draft.ttfbMs)
  const startDelay = numberFromInput(draft.startDelayMs)
  const lcpDiscovery = numberFromInput(draft.lcpDiscoveryMs)
  const lcpDownload = numberFromInput(draft.lcpDownloadMs)
  const totalTransfer = numberFromInput(draft.totalTransferKb)
  const requests = numberFromInput(draft.requestCount)
  const origins = numberFromInput(draft.originCount)
  const criticalChain = numberFromInput(draft.criticalChainMs)
  const blockingCss = numberFromInput(draft.blockingCssKb)
  const blockingJs = numberFromInput(draft.blockingJsKb)
  const cacheHitRate = numberFromInput(draft.cacheHitRate)
  const lcpUrl = safeUrl(draft.lcpUrl)

  if (!draft.lcpUrl.trim()) add('danger', 'missing_lcp_url', draft.routePattern)
  else if (!lcpUrl) add('danger', 'invalid_lcp_url', draft.lcpUrl)
  else if (lcpUrl.protocol === 'http:') add('danger', 'http_lcp', draft.lcpUrl)
  if (hasPrivateQuery(draft.lcpUrl)) add('danger', 'private_query', draft.lcpUrl)
  if (ttfb > 1600) add('danger', 'ttfb_severe', `${ttfb} ms`)
  else if (ttfb > 800) add('warn', 'ttfb_high', `${ttfb} ms`)
  if (criticalChain > 5000) add('danger', 'critical_chain_severe', `${criticalChain} ms`)
  else if (criticalChain > 2500) add('warn', 'critical_chain_high', `${criticalChain} ms`)
  if (startDelay > 900) add('danger', 'queue_delay', `${startDelay} ms`)
  else if (startDelay > 400) add('warn', 'queue_delay', `${startDelay} ms`)
  if (lcpDiscovery > 1800) add('danger', 'late_lcp_discovery', `${lcpDiscovery} ms`)
  else if (lcpDiscovery > 900) add('warn', 'late_lcp_discovery', `${lcpDiscovery} ms`)
  if (lcpDownload > 1800) add('danger', 'slow_lcp_download', `${lcpDownload} ms`)
  else if (lcpDownload > 900) add('warn', 'slow_lcp_download', `${lcpDownload} ms`)
  if (draft.priority === 'low' || draft.priority === 'lowest')
    add('danger', 'low_priority_lcp', draft.priority)
  if (requests > 120) add('danger', 'too_many_requests', String(requests))
  else if (requests > 75) add('warn', 'too_many_requests', String(requests))
  if (origins > 12) add('danger', 'too_many_origins', String(origins))
  else if (origins > 6) add('warn', 'too_many_origins', String(origins))
  if (totalTransfer > 4000) add('danger', 'heavy_transfer', `${totalTransfer} KB`)
  else if (totalTransfer > 1800) add('warn', 'heavy_transfer', `${totalTransfer} KB`)
  if (blockingCss > 180) add('danger', 'blocking_css', `${blockingCss} KB`)
  else if (blockingCss > 100) add('warn', 'blocking_css', `${blockingCss} KB`)
  if (blockingJs > 380) add('danger', 'blocking_js', `${blockingJs} KB`)
  else if (blockingJs > 180) add('warn', 'blocking_js', `${blockingJs} KB`)
  if (cacheHitRate < 20) add('danger', 'low_cache_hit', `${cacheHitRate}%`)
  else if (cacheHitRate < 55) add('warn', 'low_cache_hit', `${cacheHitRate}%`)
  if (draft.cacheStatus === 'bypass' || draft.cacheStatus === 'miss')
    add('warn', 'cache_miss', draft.cacheStatus)
  if (draft.compressed === 'no') add('danger', 'uncompressed', draft.routePattern)

  parsed.requests.forEach(request => {
    if (safeUrl(request.url)?.protocol === 'http:') add('danger', 'parsed_http', request.url)
    if (hasPrivateQuery(request.url)) add('danger', 'parsed_private_query', request.url)
    if (request.ttfbMs > 1200)
      add('danger', 'parsed_slow_ttfb', `${request.url}: ${request.ttfbMs} ms`)
    else if (request.ttfbMs > 700)
      add('warn', 'parsed_slow_ttfb', `${request.url}: ${request.ttfbMs} ms`)
    if (request.durationMs > 2200)
      add('danger', 'parsed_long_request', `${request.url}: ${request.durationMs} ms`)
    else if (request.durationMs > 1200)
      add('warn', 'parsed_long_request', `${request.url}: ${request.durationMs} ms`)
    if (request.renderBlocking && request.transferKb > 180)
      add('danger', 'parsed_blocking', `${request.url}: ${request.transferKb} KB`)
    else if (request.renderBlocking && request.transferKb > 80)
      add('warn', 'parsed_blocking', `${request.url}: ${request.transferKb} KB`)
    if (request.isLcp && request.startMs > 1800)
      add('danger', 'parsed_late_lcp', `${request.url}: ${request.startMs} ms`)
    else if (request.isLcp && request.startMs > 900)
      add('warn', 'parsed_late_lcp', `${request.url}: ${request.startMs} ms`)
    if (request.isLcp && (request.priority === 'low' || request.priority === 'lowest'))
      add('danger', 'parsed_low_lcp_priority', request.url)
    if (
      (request.cacheStatus === 'miss' || request.cacheStatus === 'bypass') &&
      request.transferKb > 120
    )
      add('warn', 'parsed_cache_miss', `${request.url}: ${request.cacheStatus}`)
    if (
      !request.compressed &&
      (request.type === 'script' || request.type === 'style' || request.type === 'document')
    )
      add('danger', 'parsed_uncompressed', request.url)
  })

  const originsInTrace = new Set(parsed.requests.map(request => request.origin).filter(Boolean))
  if (originsInTrace.size > 10) add('warn', 'parsed_many_origins', String(originsInTrace.size))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'cache_ok', `${cacheHitRate}%`)
    add('good', 'lcp_priority_ok', draft.priority)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 16 : finding.level === 'warn' ? 7 : 0),
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

const lcpTypeForHint = (type: ResourceType) =>
  type === 'image' || type === 'font' || type === 'script' || type === 'style' ? type : 'fetch'

const buildHints = (draft: WaterfallDraft, parsed: ParsedWorkspace) => {
  const origins = Array.from(
    new Set(
      [getOrigin(draft.lcpUrl), ...parsed.requests.map(request => request.origin)].filter(
        origin => origin && origin !== 'unknown'
      )
    )
  ).slice(0, 4)
  const preconnects = origins
    .filter(origin => origin !== 'https://www.example.com')
    .map(origin => `<link rel="preconnect" href="${escapeHtml(origin)}" crossorigin>`)

  return [
    ...preconnects,
    `<link rel="preload" href="${escapeHtml(draft.lcpUrl)}" as="${lcpTypeForHint(draft.resourceType)}" fetchpriority="high">`
  ].join('\n')
}

const buildPriority = (draft: WaterfallDraft) => {
  if (draft.resourceType === 'image') {
    return `<img src="${escapeHtml(draft.lcpUrl)}" width="1280" height="720" fetchpriority="high" loading="eager" decoding="async" alt="">`
  }
  if (draft.resourceType === 'script')
    return `<script src="${escapeHtml(draft.lcpUrl)}" defer fetchpriority="high"></script>`
  return `fetch('${escapeHtml(draft.lcpUrl)}', { priority: 'high' })`
}

const buildCache = (draft: WaterfallDraft, parsed: ParsedWorkspace) =>
  [
    '# Cache triage',
    `Route: ${draft.routePattern}`,
    `Current cache hit rate: ${draft.cacheHitRate}%`,
    'Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    'CDN checks:',
    '- Confirm LCP asset has long immutable caching when URL-fingerprinted.',
    '- Remove Set-Cookie from cacheable HTML/API responses.',
    '- Keep Vary limited to signals that truly change the response.',
    '',
    '# Slow cache misses from trace',
    ...parsed.requests
      .filter(request => request.cacheStatus === 'miss' || request.cacheStatus === 'bypass')
      .slice(0, 12)
      .map(
        request =>
          `- ${request.cacheStatus}: ${request.url} (${request.transferKb} KB, ${request.durationMs} ms)`
      )
  ].join('\n')

const buildMarkdown = (draft: WaterfallDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# Network waterfall triage: ${draft.routePattern}`,
    '',
    `- Device: ${draft.device}`,
    `- TTFB: ${draft.ttfbMs} ms`,
    `- LCP discovery: ${draft.lcpDiscoveryMs} ms`,
    `- Critical chain: ${draft.criticalChainMs} ms`,
    `- Requests: ${draft.requestCount}`,
    `- Origins: ${draft.originCount}`,
    `- Total transfer: ${draft.totalTransferKb} KB`,
    '',
    '## Findings',
    ...findings
      .slice(0, 24)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Longest parsed requests',
    ...parsed.requests
      .slice()
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 12)
      .map(
        request =>
          `- ${request.durationMs} ms / ${request.transferKb} KB / ${request.type}: ${request.url}`
      )
  ].join('\n')

const buildCsv = (draft: WaterfallDraft, parsed: ParsedWorkspace) => {
  const rows = [draftAsRequest(draft), ...parsed.requests]
  return [
    [
      'url',
      'type',
      'origin',
      'startMs',
      'ttfbMs',
      'durationMs',
      'downloadMs',
      'transferKb',
      'priority',
      'cacheStatus',
      'compressed',
      'renderBlocking',
      'isLcp'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(request =>
      [
        request.url,
        request.type,
        request.origin,
        request.startMs,
        request.ttfbMs,
        request.durationMs,
        request.downloadMs,
        request.transferKb,
        request.priority,
        request.cacheStatus,
        request.compressed,
        request.renderBlocking,
        request.isLcp
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: WaterfallDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'hints') return buildHints(draft, parsed)
  if (outputType === 'priority') return buildPriority(draft)
  if (outputType === 'cache') return buildCache(draft, parsed)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, parsedRequests: parsed.requests }, null, 2)
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

export default function NetworkWaterfallClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<WaterfallDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('hints')
  const [auditQuery, setAuditQuery] = useState('')
  const [requestQuery, setRequestQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredRequestQuery = useDeferredValue(requestQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditWaterfall(draft, parsed), [draft, parsed])
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
      `${item.key} ${item.subject} ${t(`app.converter.network_waterfall.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRequests = useMemo(() => {
    const query = deferredRequestQuery.trim().toLowerCase()
    if (!query) return parsed.requests
    return parsed.requests.filter(request =>
      `${request.url} ${request.type} ${request.origin} ${request.priority} ${request.cacheStatus}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredRequestQuery, parsed.requests])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      origins:
        new Set(parsed.requests.map(request => request.origin).filter(Boolean)).size ||
        numberFromInput(draft.originCount),
      requests: parsed.requests.length || numberFromInput(draft.requestCount),
      score,
      transfer: `${numberFromInput(draft.totalTransferKb)} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.originCount, draft.requestCount, draft.totalTransferKb, findings, parsed.requests, score]
  )

  const updateDraft = <Key extends keyof WaterfallDraft>(key: Key, value: WaterfallDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('hints')
    setAuditQuery('')
    setRequestQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.network_waterfall.summary_title'),
        `${t('app.converter.network_waterfall.metric.score')}: ${metrics.score}`,
        `${t('app.converter.network_waterfall.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.network_waterfall.metric.requests')}: ${metrics.requests}`,
        `${t('app.converter.network_waterfall.metric.origins')}: ${metrics.origins}`,
        `${t('app.converter.network_waterfall.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.network_waterfall.metric.critical')}: ${metrics.critical}`
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
                <Network className="h-4 w-4" />
                {t('app.converter.network-waterfall')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.network-waterfall')}
              </CardTitle>
              <CardDescription>{t('app.converter.network_waterfall.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.network_waterfall.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.network_waterfall.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.network_waterfall.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric
              label={t('app.converter.network_waterfall.metric.requests')}
              value={metrics.requests}
            />
            <Metric
              label={t('app.converter.network_waterfall.metric.origins')}
              value={metrics.origins}
            />
            <Metric
              label={t('app.converter.network_waterfall.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.network_waterfall.metric.critical')}
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
              {t('app.converter.network_waterfall.presets')}
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
                {t(`app.converter.network_waterfall.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.network_waterfall.preset.${preset.key}_hint`)}
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
                {t('app.converter.network_waterfall.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.network_waterfall.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="waterfall-route">
                  {t('app.converter.network_waterfall.route_pattern')}
                </Label>
                <Input
                  id="waterfall-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterfall-device">
                  {t('app.converter.network_waterfall.device')}
                </Label>
                <Select
                  id="waterfall-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.network_waterfall.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="waterfall-lcp-url">
                  {t('app.converter.network_waterfall.lcp_url')}
                </Label>
                <Input
                  id="waterfall-lcp-url"
                  value={draft.lcpUrl}
                  onChange={event => updateDraft('lcpUrl', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterfall-type">
                  {t('app.converter.network_waterfall.resource_type')}
                </Label>
                <Select
                  id="waterfall-type"
                  value={draft.resourceType}
                  onChange={event =>
                    updateDraft('resourceType', event.target.value as ResourceType)
                  }
                >
                  {RESOURCE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.network_waterfall.type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterfall-priority">
                  {t('app.converter.network_waterfall.priority')}
                </Label>
                <Select
                  id="waterfall-priority"
                  value={draft.priority}
                  onChange={event => updateDraft('priority', event.target.value as Priority)}
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {t(`app.converter.network_waterfall.priority.${priority}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {[
                ['ttfbMs', 'ttfb_ms'],
                ['startDelayMs', 'start_delay_ms'],
                ['lcpDiscoveryMs', 'lcp_discovery_ms'],
                ['lcpDownloadMs', 'lcp_download_ms'],
                ['criticalChainMs', 'critical_chain_ms'],
                ['totalTransferKb', 'total_transfer_kb'],
                ['requestCount', 'request_count'],
                ['originCount', 'origin_count'],
                ['blockingCssKb', 'blocking_css_kb'],
                ['blockingJsKb', 'blocking_js_kb'],
                ['cacheHitRate', 'cache_hit_rate']
              ].map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`waterfall-${key}`}>
                    {t(`app.converter.network_waterfall.${label}`)}
                  </Label>
                  <Input
                    id={`waterfall-${key}`}
                    value={draft[key as keyof WaterfallDraft]}
                    onChange={event =>
                      updateDraft(key as keyof WaterfallDraft, event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="decimal"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="waterfall-cache">
                  {t('app.converter.network_waterfall.cache_status')}
                </Label>
                <Select
                  id="waterfall-cache"
                  value={draft.cacheStatus}
                  onChange={event => updateDraft('cacheStatus', event.target.value as CacheStatus)}
                >
                  {CACHE_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {t(`app.converter.network_waterfall.cache.${status}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterfall-compressed">
                  {t('app.converter.network_waterfall.compressed')}
                </Label>
                <Select
                  id="waterfall-compressed"
                  value={draft.compressed}
                  onChange={event =>
                    updateDraft('compressed', event.target.value as WaterfallDraft['compressed'])
                  }
                >
                  <option value="yes">{t('app.converter.network_waterfall.boolean.yes')}</option>
                  <option value="no">{t('app.converter.network_waterfall.boolean.no')}</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.network_waterfall.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.network_waterfall.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.network_waterfall.workspace_placeholder')}
              className="min-h-[470px] font-mono"
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
                {t('app.converter.network_waterfall.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.network_waterfall.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 42).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.network_waterfall.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.network_waterfall.level.${finding.level}`)}
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
                  {t('app.converter.network_waterfall.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.network_waterfall.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="waterfall-output">
                  {t('app.converter.network_waterfall.output_type')}
                </Label>
                <Select
                  id="waterfall-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.network_waterfall.output.${type}`)}
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
                {t('app.converter.network_waterfall.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'network-waterfall-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.network_waterfall.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'network-waterfall.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.network_waterfall.download_csv')}
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
                {t('app.converter.network_waterfall.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={requestQuery}
                onChange={event => setRequestQuery(event.target.value)}
                placeholder={t('app.converter.network_waterfall.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredRequests.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRequests.slice(0, 60).map(request => (
                  <div
                    key={`${request.id}:${request.url}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {request.type}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(request.durationMs > 2200 || request.ttfbMs > 1200 ? 'danger' : request.durationMs > 1200 || request.ttfbMs > 700 ? 'warn' : 'good')}`}
                      >
                        {request.durationMs} ms
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {request.url}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {request.transferKb} KB / TTFB {request.ttfbMs} ms / {request.cacheStatus} /{' '}
                      {request.priority}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.network_waterfall.empty')}
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
                  {t('app.converter.network_waterfall.reference')}
                </CardTitle>
              </div>
              <CardDescription>
                {t('app.converter.network_waterfall.reference_hint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.network_waterfall.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.network_waterfall.reference.${item}_hint`)}
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
                  {t('app.converter.network_waterfall.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.network_waterfall.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.network_waterfall.checklist.${item}.body`)}
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
