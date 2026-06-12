'use client'

import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  Image as ImageIcon,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
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
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'

const DEVICES = ['mobile', 'desktop'] as const
const ELEMENT_TYPES = ['image', 'text', 'video', 'background', 'unknown'] as const
const PRIORITIES = ['high', 'auto', 'low'] as const
const LOADING_MODES = ['eager', 'auto', 'lazy'] as const
const OUTPUT_TYPES = ['probe', 'next', 'preload', 'playbook', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const BREAKDOWN_LIMIT = 160

type Device = (typeof DEVICES)[number]
type ElementType = (typeof ELEMENT_TYPES)[number]
type Priority = (typeof PRIORITIES)[number]
type LoadingMode = (typeof LOADING_MODES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type SegmentKey = 'renderDelay' | 'resourceDelay' | 'resourceDuration' | 'ttfb'
type BreakdownSource = 'json' | 'manual' | 'text'

interface LcpDraft {
  bytesKb: string
  cacheHitRate: string
  device: Device
  elementRenderDelayMs: string
  elementSelector: string
  elementType: ElementType
  fcpMs: string
  hasPreload: boolean
  hydrationBlocking: boolean
  imageOptimized: boolean
  lcpMs: string
  loading: LoadingMode
  percentile: string
  priority: Priority
  resourceLoadDelayMs: string
  resourceLoadDurationMs: string
  resourceUrl: string
  routePattern: string
  sampleCount: string
  serverRendered: boolean
  ttfbMs: string
}

interface ParsedBreakdown {
  bytesKb: number
  cacheHitRate: number
  element: string
  elementType: ElementType
  id: string
  lcpMs: number
  loading: LoadingMode
  priority: Priority
  renderDelay: number
  resourceDelay: number
  resourceDuration: number
  route: string
  source: BreakdownSource
  ttfb: number
  url: string
}

interface ParsedWorkspace {
  breakdowns: ParsedBreakdown[]
  errors: string[]
}

interface Preset {
  draft: LcpDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: LcpDraft = {
  bytesKb: '148',
  cacheHitRate: '82',
  device: 'mobile',
  elementRenderDelayMs: '260',
  elementSelector: 'main img[data-hero]',
  elementType: 'image',
  fcpMs: '1180',
  hasPreload: true,
  hydrationBlocking: false,
  imageOptimized: true,
  lcpMs: '2380',
  loading: 'eager',
  percentile: 'p75',
  priority: 'high',
  resourceLoadDelayMs: '280',
  resourceLoadDurationMs: '520',
  resourceUrl: '/images/product-hero.avif',
  routePattern: '/products/:slug',
  sampleCount: '1200',
  serverRendered: true,
  ttfbMs: '420'
}

const PRESETS: Preset[] = [
  {
    key: 'healthy_image',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"route":"/products/example","lcp":2380,"ttfb":420,"resourceLoadDelay":280,"resourceLoadDuration":520,"elementRenderDelay":260,"url":"/images/product-hero.avif","element":"main img[data-hero]","elementType":"image","priority":"high","loading":"eager","bytesKb":148,"cacheHitRate":82}',
      'lcp=2380 ttfb=420 delay=280 duration=520 render=260 route=/products/example url=/images/product-hero.avif priority=high loading=eager'
    ].join('\n')
  },
  {
    key: 'slow_server',
    draft: {
      ...DEFAULT_DRAFT,
      fcpMs: '2100',
      lcpMs: '4200',
      resourceLoadDelayMs: '310',
      resourceLoadDurationMs: '560',
      routePattern: '/dashboard',
      ttfbMs: '1850'
    },
    workspace: [
      '{"route":"/dashboard","metric":"LCP","value":4200,"attribution":{"timeToFirstByte":1850,"resourceLoadDelay":310,"resourceLoadDuration":560,"elementRenderDelay":490,"element":"main h1","url":""}}',
      'lcp=4200 ttfb=1850 delay=310 duration=560 render=490 route=/dashboard element=main-h1'
    ].join('\n')
  },
  {
    key: 'late_discovery',
    draft: {
      ...DEFAULT_DRAFT,
      fcpMs: '1300',
      hasPreload: false,
      lcpMs: '4100',
      priority: 'auto',
      resourceLoadDelayMs: '1420',
      resourceLoadDurationMs: '680',
      routePattern: '/campaign',
      ttfbMs: '620'
    },
    workspace: [
      '{"url":"/campaign/hero.webp","route":"/campaign","lcpMs":4100,"ttfbMs":620,"loadDelay":1420,"loadDuration":680,"renderDelay":880,"element":"picture.hero img","priority":"auto","loading":"eager","bytesKb":420}',
      'Largest Contentful Paint: 4.1s url=/campaign/hero.webp ttfb=620ms delay=1420ms duration=680ms render=880ms'
    ].join('\n')
  },
  {
    key: 'render_delay',
    draft: {
      ...DEFAULT_DRAFT,
      elementRenderDelayMs: '1550',
      hydrationBlocking: true,
      lcpMs: '4520',
      resourceLoadDelayMs: '310',
      resourceLoadDurationMs: '620',
      routePattern: '/app',
      ttfbMs: '720'
    },
    workspace: [
      '{"route":"/app","name":"LCP","value":4520,"attribution":{"timeToFirstByte":720,"resourceLoadDelay":310,"resourceLoadDuration":620,"elementRenderDelay":1550,"element":"#app-title","url":"/_next/static/media/title-font.woff2"}}',
      'lcp=4520 ttfb=720 delay=310 duration=620 render=1550 route=/app element=#app-title'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      bytesKb: '1680',
      cacheHitRate: '18',
      device: 'mobile',
      elementRenderDelayMs: '1460',
      elementSelector: '',
      elementType: 'image',
      fcpMs: '2600',
      hasPreload: false,
      hydrationBlocking: true,
      imageOptimized: false,
      lcpMs: '6120',
      loading: 'lazy',
      percentile: 'p95',
      priority: 'low',
      resourceLoadDelayMs: '1860',
      resourceLoadDurationMs: '1720',
      resourceUrl: 'http://cdn.example.com/private/hero.jpg?token=abc',
      routePattern: '/checkout',
      sampleCount: '38',
      serverRendered: false,
      ttfbMs: '1520'
    },
    workspace: [
      '{"route":"/checkout","name":"LCP","value":6120,"rating":"poor","attribution":{"timeToFirstByte":1520,"resourceLoadDelay":1860,"resourceLoadDuration":1720,"elementRenderDelay":1460,"element":"","url":"http://cdn.example.com/private/hero.jpg?token=abc","loadState":"loading"},"priority":"low","loading":"lazy","bytesKb":1680,"cacheHitRate":18}',
      'lcp=6120 ttfb=1520 delay=1860 duration=1720 render=1460 route=/checkout url=http://cdn.example.com/private/hero.jpg?token=abc priority=low loading=lazy bytes=1680KB cache=18',
      'LCP 6.12s element= url=http://cdn.example.com/private/hero.jpg?token=abc'
    ].join('\n')
  }
]

const SEGMENTS: Array<{ key: SegmentKey }> = [
  { key: 'ttfb' },
  { key: 'resourceDelay' },
  { key: 'resourceDuration' },
  { key: 'renderDelay' }
]

const REFERENCE_ITEMS = [
  'ttfb',
  'resource_delay',
  'resource_duration',
  'render_delay',
  'images',
  'field'
] as const
const CHECKLIST_ITEMS = ['segment', 'discover', 'download', 'render'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const formatMs = (value: number) => `${Math.round(value)}ms`
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const isPrivateQuery = (url: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=/iu.test(url)

const normalizePriority = (value: unknown): Priority => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return PRIORITIES.includes(token as Priority) ? (token as Priority) : 'auto'
}

const normalizeLoading = (value: unknown): LoadingMode => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return LOADING_MODES.includes(token as LoadingMode) ? (token as LoadingMode) : 'auto'
}

const normalizeElementType = (value: unknown, url = ''): ElementType => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (ELEMENT_TYPES.includes(token as ElementType)) return token as ElementType
  const path = safeUrl(url)?.pathname.toLowerCase() ?? url.toLowerCase()
  if (/\.(avif|webp|png|jpe?g|gif|svg)$/u.test(path)) return 'image'
  if (/\.(mp4|webm)$/u.test(path)) return 'video'
  if (url) return 'unknown'
  return 'text'
}

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const getString = (record: Record<string, unknown>, keys: string[]) => {
  const value = getRecordValue(record, keys)
  return value === undefined ? '' : String(value)
}

const getNumber = (record: Record<string, unknown>, keys: string[]) => {
  const value = getRecordValue(record, keys)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) return numberFromInput(value)
  return 0
}

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const addBreakdown = (items: ParsedBreakdown[], item: Omit<ParsedBreakdown, 'id'>) => {
  if (
    !item.lcpMs &&
    !item.ttfb &&
    !item.resourceDelay &&
    !item.resourceDuration &&
    !item.renderDelay
  )
    return
  items.push({
    ...item,
    id: `${item.source}-${items.length}-${item.route || item.url || item.lcpMs}`
  })
}

const flattenAttribution = (record: Record<string, unknown>) => {
  const attribution = record.attribution
  if (typeof attribution === 'object' && attribution)
    return { ...record, ...(attribution as Record<string, unknown>) }
  return record
}

const collectJsonBreakdowns = (value: unknown, items: ParsedBreakdown[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonBreakdowns(item, items))
    return
  }
  if (typeof value !== 'object') return

  const record = flattenAttribution(value as Record<string, unknown>)
  const lcp = getNumber(record, [
    'lcp',
    'lcpMs',
    'value',
    'largestContentfulPaint',
    'observedLargestContentfulPaint'
  ])
  const ttfb = getNumber(record, ['ttfb', 'ttfbMs', 'timeToFirstByte', 'time_to_first_byte'])
  const resourceDelay = getNumber(record, [
    'resourceLoadDelay',
    'loadDelay',
    'resourceDelay',
    'delay'
  ])
  const resourceDuration = getNumber(record, [
    'resourceLoadDuration',
    'loadDuration',
    'resourceDuration',
    'duration'
  ])
  const renderDelay = getNumber(record, ['elementRenderDelay', 'renderDelay', 'presentationDelay'])
  const url = getString(record, ['url', 'resourceUrl', 'lcpResourceUrl'])
  const route = getString(record, ['route', 'routePattern', 'path', 'page'])

  if (lcp || ttfb || resourceDelay || resourceDuration || renderDelay) {
    addBreakdown(items, {
      bytesKb:
        getNumber(record, ['bytesKb', 'kb']) ||
        Math.round(getNumber(record, ['transferSize', 'encodedBodySize', 'bytes']) / 1024),
      cacheHitRate: getNumber(record, ['cacheHitRate', 'cache', 'hitRate']),
      element: getString(record, ['element', 'elementSelector', 'selector', 'node']),
      elementType: normalizeElementType(getString(record, ['elementType', 'type']), url),
      lcpMs: lcp,
      loading: normalizeLoading(getString(record, ['loading'])),
      priority: normalizePriority(getString(record, ['priority', 'fetchPriority'])),
      renderDelay,
      resourceDelay,
      resourceDuration,
      route,
      source: 'json',
      ttfb,
      url
    })
  }

  ;['items', 'events', 'metrics', 'children', 'audits', 'details'].forEach(key => {
    if (record[key] !== undefined) collectJsonBreakdowns(record[key], items)
  })
}

const parseJsonBreakdowns = (input: string): { errors: string[]; items: ParsedBreakdown[] } => {
  const errors: string[] = []
  const items: ParsedBreakdown[] = []
  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, index) => {
    try {
      collectJsonBreakdowns(JSON.parse(row) as unknown, items)
    } catch {
      errors.push(`json:${index + 1}`)
    }
  })

  return { errors, items }
}

const parseTextBreakdowns = (input: string): ParsedBreakdown[] => {
  const items: ParsedBreakdown[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    const lcpToken =
      tokenValue(trimmed, 'lcp') ||
      (trimmed.match(/\bLCP\s*[:=]?\s*([\d.]+)\s*(s|ms)?/iu)?.[1] ?? '')
    const lcpMs =
      lcpToken && /\bLCP\b.+\bs\b/iu.test(trimmed) && Number(lcpToken) < 100
        ? Number(lcpToken) * 1000
        : numberFromInput(lcpToken)

    addBreakdown(items, {
      bytesKb: numberFromInput(tokenValue(trimmed, 'bytes') || tokenValue(trimmed, 'kb')),
      cacheHitRate: numberFromInput(
        tokenValue(trimmed, 'cache') || tokenValue(trimmed, 'cacheHitRate')
      ),
      element: tokenValue(trimmed, 'element') || tokenValue(trimmed, 'selector'),
      elementType: normalizeElementType(tokenValue(trimmed, 'type'), tokenValue(trimmed, 'url')),
      lcpMs,
      loading: normalizeLoading(tokenValue(trimmed, 'loading')),
      priority: normalizePriority(
        tokenValue(trimmed, 'priority') || tokenValue(trimmed, 'fetchpriority')
      ),
      renderDelay: numberFromInput(
        tokenValue(trimmed, 'render') || tokenValue(trimmed, 'renderDelay')
      ),
      resourceDelay: numberFromInput(
        tokenValue(trimmed, 'delay') || tokenValue(trimmed, 'resourceLoadDelay')
      ),
      resourceDuration: numberFromInput(
        tokenValue(trimmed, 'duration') || tokenValue(trimmed, 'resourceLoadDuration')
      ),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      source: 'text',
      ttfb: numberFromInput(tokenValue(trimmed, 'ttfb')),
      url: tokenValue(trimmed, 'url') || tokenValue(trimmed, 'resource')
    })
  })
  return items
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonBreakdowns(source)
  return {
    breakdowns: [...json.items, ...parseTextBreakdowns(source)].slice(0, BREAKDOWN_LIMIT),
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])]
  }
}

const draftBreakdown = (draft: LcpDraft): ParsedBreakdown => ({
  bytesKb: numberFromInput(draft.bytesKb),
  cacheHitRate: numberFromInput(draft.cacheHitRate),
  element: draft.elementSelector,
  elementType: draft.elementType,
  id: 'manual-draft',
  lcpMs: numberFromInput(draft.lcpMs),
  loading: draft.loading,
  priority: draft.priority,
  renderDelay: numberFromInput(draft.elementRenderDelayMs),
  resourceDelay: numberFromInput(draft.resourceLoadDelayMs),
  resourceDuration: numberFromInput(draft.resourceLoadDurationMs),
  route: draft.routePattern,
  source: 'manual',
  ttfb: numberFromInput(draft.ttfbMs),
  url: draft.resourceUrl
})

const segmentTotal = (item: ParsedBreakdown) =>
  item.ttfb + item.resourceDelay + item.resourceDuration + item.renderDelay

const dominantSegment = (item: ParsedBreakdown): SegmentKey => {
  const segments: Array<[SegmentKey, number]> = [
    ['ttfb', item.ttfb],
    ['resourceDelay', item.resourceDelay],
    ['resourceDuration', item.resourceDuration],
    ['renderDelay', item.renderDelay]
  ]
  let winner: SegmentKey = 'ttfb'
  let max = 0
  segments.forEach(([key, value]) => {
    if (value > max) {
      winner = key
      max = value
    }
  })
  return winner
}

const auditLcp = (draft: LcpDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftBreakdown(draft)
  const sampleCount = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (sampleCount < 100) add('warn', 'low_sample_count', String(sampleCount))
  if (manual.lcpMs > 4000) add('danger', 'lcp_poor', formatMs(manual.lcpMs))
  else if (manual.lcpMs > 2500) add('warn', 'lcp_needs_work', formatMs(manual.lcpMs))
  if (manual.ttfb > 1600) add('danger', 'ttfb_severe', formatMs(manual.ttfb))
  else if (manual.ttfb > 800) add('warn', 'ttfb_slow', formatMs(manual.ttfb))
  if (manual.resourceDelay > 1200)
    add('danger', 'resource_delay_severe', formatMs(manual.resourceDelay))
  else if (manual.resourceDelay > 600)
    add('warn', 'resource_delay_slow', formatMs(manual.resourceDelay))
  if (manual.resourceDuration > 1400)
    add('danger', 'resource_duration_severe', formatMs(manual.resourceDuration))
  else if (manual.resourceDuration > 900)
    add('warn', 'resource_duration_slow', formatMs(manual.resourceDuration))
  if (manual.renderDelay > 1200) add('danger', 'render_delay_severe', formatMs(manual.renderDelay))
  else if (manual.renderDelay > 700) add('warn', 'render_delay_slow', formatMs(manual.renderDelay))
  if (manual.lcpMs && segmentTotal(manual) && Math.abs(manual.lcpMs - segmentTotal(manual)) > 600)
    add('warn', 'segment_mismatch', `${formatMs(manual.lcpMs)} / ${formatMs(segmentTotal(manual))}`)
  if (numberFromInput(draft.fcpMs) > manual.lcpMs && manual.lcpMs > 0)
    add('warn', 'fcp_after_lcp', draft.fcpMs)
  if (manual.elementType === 'image' && !draft.hasPreload && manual.resourceDelay > 450)
    add('warn', 'missing_preload', manual.url)
  if (manual.elementType === 'image' && manual.loading === 'lazy')
    add('danger', 'lazy_lcp', manual.url)
  if (manual.elementType === 'image' && manual.priority === 'low')
    add('danger', 'low_priority_lcp', manual.url)
  if (manual.elementType === 'image' && !draft.imageOptimized)
    add('warn', 'image_not_optimized', manual.url)
  if (manual.bytesKb > 1200) add('danger', 'resource_heavy', `${Math.round(manual.bytesKb)}KB`)
  else if (manual.bytesKb > 500) add('warn', 'resource_heavy', `${Math.round(manual.bytesKb)}KB`)
  if (manual.cacheHitRate > 0 && manual.cacheHitRate < 35)
    add('warn', 'low_cache_hit', `${Math.round(manual.cacheHitRate)}%`)
  if (/^http:/iu.test(manual.url)) add('danger', 'http_lcp_resource', manual.url)
  if (isPrivateQuery(manual.url)) add('warn', 'private_query', manual.url)
  if (!manual.element.trim()) add('warn', 'missing_element', draft.routePattern)
  if (!draft.serverRendered && (manual.elementType === 'text' || manual.renderDelay > 700))
    add('warn', 'not_server_rendered', draft.routePattern)
  if (draft.hydrationBlocking) add('warn', 'hydration_blocking', draft.routePattern)

  parsed.breakdowns.forEach(item => {
    if (item.lcpMs > 4000)
      add('danger', 'parsed_lcp_poor', item.route || item.url || formatMs(item.lcpMs))
    if (item.ttfb > 1600) add('danger', 'parsed_ttfb_severe', item.route || formatMs(item.ttfb))
    if (item.resourceDelay > 1200)
      add('danger', 'parsed_resource_delay', item.url || item.route || formatMs(item.resourceDelay))
    if (item.resourceDuration > 1400)
      add(
        'danger',
        'parsed_resource_duration',
        item.url || item.route || formatMs(item.resourceDuration)
      )
    if (item.renderDelay > 1200)
      add('danger', 'parsed_render_delay', item.element || item.route || formatMs(item.renderDelay))
    if (item.loading === 'lazy' && item.elementType === 'image')
      add('danger', 'parsed_lazy_lcp', item.url || item.route)
    if (item.priority === 'low' && item.elementType === 'image')
      add('danger', 'parsed_low_priority_lcp', item.url || item.route)
    if (/^http:/iu.test(item.url)) add('danger', 'parsed_http_resource', item.url)
  })

  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.breakdowns.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'dominant_segment_ok', dominantSegment(manual))
    add('good', 'field_data_ok', String(sampleCount))
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

const segmentPercent = (item: ParsedBreakdown, key: SegmentKey) => {
  const total = segmentTotal(item)
  if (!total) return 0
  const value =
    key === 'ttfb'
      ? item.ttfb
      : key === 'resourceDelay'
        ? item.resourceDelay
        : key === 'resourceDuration'
          ? item.resourceDuration
          : item.renderDelay
  return Math.round((value / total) * 100)
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-400/35 bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'warn')
    return 'border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

const segmentColor = (key: SegmentKey) => {
  if (key === 'ttfb') return 'bg-sky-500/75'
  if (key === 'resourceDelay') return 'bg-amber-500/75'
  if (key === 'resourceDuration') return 'bg-emerald-500/75'
  return 'bg-fuchsia-500/75'
}

const buildProbe = (draft: LcpDraft) =>
  [
    'import { onLCP } from "web-vitals/attribution"',
    '',
    'export function installLCPBreakdownProbe(report = console.log) {',
    '  onLCP(metric => {',
    '    const attribution = metric.attribution || {}',
    '    report({',
    `      route: '${escapeJs(draft.routePattern)}',`,
    '      name: metric.name,',
    '      value: metric.value,',
    '      rating: metric.rating,',
    '      element: attribution.element,',
    '      url: attribution.url,',
    '      timeToFirstByte: attribution.timeToFirstByte,',
    '      resourceLoadDelay: attribution.resourceLoadDelay,',
    '      resourceLoadDuration: attribution.resourceLoadDuration,',
    '      elementRenderDelay: attribution.elementRenderDelay,',
    '      navigationType: metric.navigationType',
    '    })',
    '  })',
    '}'
  ].join('\n')

const buildNext = (draft: LcpDraft) =>
  [
    "'use client'",
    '',
    "import { onLCP } from 'web-vitals/attribution'",
    "import { useEffect } from 'react'",
    '',
    'export function LCPBreakdownReporter() {',
    '  useEffect(() => {',
    '    onLCP(metric => {',
    '      navigator.sendBeacon?.(',
    "        '/api/rum/lcp',",
    `        JSON.stringify({ route: '${escapeJs(draft.routePattern)}', value: metric.value, attribution: metric.attribution })`,
    '      )',
    '    })',
    '  }, [])',
    '',
    '  return null',
    '}'
  ].join('\n')

const buildPreload = (draft: LcpDraft) =>
  [
    draft.resourceUrl
      ? `<link rel="preload" href="${draft.resourceUrl}" as="${draft.elementType === 'image' ? 'image' : draft.elementType === 'video' ? 'video' : 'fetch'}" fetchpriority="high">`
      : '',
    draft.elementType === 'image' && draft.resourceUrl
      ? `<img src="${draft.resourceUrl}" loading="eager" fetchpriority="high" decoding="async" alt="">`
      : '',
    draft.elementType === 'text'
      ? '<!-- For text LCP, improve server rendering and font delivery before adding image-style preload. -->'
      : ''
  ]
    .filter(Boolean)
    .join('\n')

const buildPlaybook = (draft: LcpDraft, findings: Finding[]) =>
  [
    `LCP recovery playbook for ${draft.routePattern}`,
    '',
    '1. Segment field data by route, device, percentile, cache state, and navigation type.',
    '2. Identify the dominant segment: TTFB, resource load delay, resource load duration, or render delay.',
    '3. Fix that segment before adding broad preloads.',
    '4. Re-measure LCP attribution and compare p75 before and after release.',
    '',
    'Top findings:',
    ...findings
      .slice(0, 14)
      .map(finding => `- [${finding.level}] ${finding.key}: ${finding.subject}`)
  ].join('\n')

const buildMarkdown = (draft: LcpDraft, parsed: ParsedWorkspace, findings: Finding[]) => {
  const manual = draftBreakdown(draft)
  return [
    `# LCP breakdown: ${draft.routePattern}`,
    '',
    `- Device: ${draft.device}`,
    `- Percentile: ${draft.percentile}`,
    `- LCP: ${formatMs(manual.lcpMs)}`,
    `- Dominant segment: ${dominantSegment(manual)}`,
    `- Resource: ${draft.resourceUrl || '-'}`,
    '',
    '## Segments',
    `- TTFB: ${formatMs(manual.ttfb)} (${segmentPercent(manual, 'ttfb')}%)`,
    `- Resource delay: ${formatMs(manual.resourceDelay)} (${segmentPercent(manual, 'resourceDelay')}%)`,
    `- Resource duration: ${formatMs(manual.resourceDuration)} (${segmentPercent(manual, 'resourceDuration')}%)`,
    `- Render delay: ${formatMs(manual.renderDelay)} (${segmentPercent(manual, 'renderDelay')}%)`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed rows',
    ...parsed.breakdowns
      .slice(0, 24)
      .map(
        item =>
          `- ${item.route || item.url || item.source}: ${formatMs(item.lcpMs)} / ${formatMs(item.ttfb)} / ${formatMs(item.resourceDelay)} / ${formatMs(item.resourceDuration)} / ${formatMs(item.renderDelay)}`
      )
  ].join('\n')
}

const buildCsv = (parsed: ParsedWorkspace, draft: LcpDraft) => {
  const rows = [draftBreakdown(draft), ...parsed.breakdowns]
  return [
    [
      'route',
      'source',
      'lcp_ms',
      'ttfb_ms',
      'resource_delay_ms',
      'resource_duration_ms',
      'render_delay_ms',
      'dominant_segment',
      'url',
      'element',
      'priority',
      'loading',
      'bytes_kb',
      'cache_hit_rate'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(item =>
      [
        item.route,
        item.source,
        item.lcpMs,
        item.ttfb,
        item.resourceDelay,
        item.resourceDuration,
        item.renderDelay,
        dominantSegment(item),
        item.url,
        item.element,
        item.priority,
        item.loading,
        item.bytesKb,
        item.cacheHitRate
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: LcpDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'probe') return buildProbe(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'preload') return buildPreload(draft)
  if (outputType === 'playbook') return buildPlaybook(draft, findings)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, parsedBreakdowns: parsed.breakdowns }, null, 2)
  return buildCsv(parsed, draft)
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

function SegmentBar({ item, t }: { item: ParsedBreakdown; t: (key: string) => string }) {
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--glass-input-bg)]">
        {SEGMENTS.map(segment => {
          const width = segmentPercent(item, segment.key)
          return (
            <div
              key={segment.key}
              className={segmentColor(segment.key)}
              style={{ width: `${Math.max(width, item[segment.key] > 0 ? 4 : 0)}%` }}
              title={`${t(`app.converter.lcp_breakdown.segment.${segment.key}`)} ${width}%`}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
        {SEGMENTS.map(segment => (
          <div key={segment.key} className="min-w-0">
            <span className="block truncate">
              {t(`app.converter.lcp_breakdown.segment.${segment.key}`)}
            </span>
            <span className="font-mono text-[var(--text-primary)]">
              {formatMs(item[segment.key])} / {segmentPercent(item, segment.key)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LcpBreakdownClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<LcpDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('probe')
  const [auditQuery, setAuditQuery] = useState('')
  const [breakdownQuery, setBreakdownQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredBreakdownQuery = useDeferredValue(breakdownQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('capped_input')) return next

    return { ...next, errors: [...next.errors, 'capped_input'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditLcp(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const manual = useMemo(() => draftBreakdown(draft), [draft])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      breakdowns: parsed.breakdowns.slice(0, OUTPUT_PREVIEW_ROWS),
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.breakdowns, parsed.errors]
  )
  const outputPreviewFindings = useMemo(() => findings.slice(0, OUTPUT_PREVIEW_ROWS), [findings])
  const outputPreviewSource = useMemo(
    () => buildOutput(draft, outputPreviewParsed, outputPreviewFindings, outputType),
    [draft, outputPreviewFindings, outputPreviewParsed, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewUsesParsedRows =
    outputType === 'markdown' || outputType === 'json' || outputType === 'csv'
  const outputPreviewUsesFindings =
    outputType === 'playbook' || outputType === 'markdown' || outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesParsedRows ? outputPreviewParsed.breakdowns.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.breakdowns.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(parsed, draft), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.lcp_breakdown.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredBreakdowns = useMemo(() => {
    const query = deferredBreakdownQuery.trim().toLowerCase()
    const rows = [manual, ...parsed.breakdowns]
    if (!query) return rows
    return rows.filter(item =>
      `${item.route} ${item.url} ${item.element} ${item.source} ${dominantSegment(item)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredBreakdownQuery, manual, parsed.breakdowns])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      dominant: t(`app.converter.lcp_breakdown.segment.${dominantSegment(manual)}`),
      lcp: formatMs(manual.lcpMs),
      rows: parsed.breakdowns.length + 1,
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [findings, manual, parsed.breakdowns.length, score, t]
  )

  const updateDraft = <Key extends keyof LcpDraft>(key: Key, value: LcpDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const updateWorkspace = useCallback((value: string) => {
    const capped = value.length > WORKSPACE_LIMIT

    setIsWorkspaceCapped(capped)
    setWorkspace(capped ? value.slice(0, WORKSPACE_LIMIT) : value)
  }, [])

  const applyPreset = useCallback(
    (preset: Preset) => {
      setDraft(preset.draft)
      updateWorkspace(preset.workspace)
    },
    [updateWorkspace]
  )

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    updateWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('probe')
    setAuditQuery('')
    setBreakdownQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.lcp_breakdown.summary_title'),
        `${t('app.converter.lcp_breakdown.metric.score')}: ${metrics.score}`,
        `${t('app.converter.lcp_breakdown.metric.lcp')}: ${metrics.lcp}`,
        `${t('app.converter.lcp_breakdown.metric.dominant')}: ${metrics.dominant}`,
        `${t('app.converter.lcp_breakdown.metric.rows')}: ${metrics.rows}`,
        `${t('app.converter.lcp_breakdown.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.lcp_breakdown.metric.critical')}: ${metrics.critical}`
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
                <BarChart3 className="h-4 w-4" />
                {t('app.converter.lcp-breakdown')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.lcp-breakdown')}</CardTitle>
              <CardDescription>{t('app.converter.lcp_breakdown.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.lcp_breakdown.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.lcp_breakdown.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.lcp_breakdown.metric.lcp')} value={metrics.lcp} />
            <Metric
              label={t('app.converter.lcp_breakdown.metric.dominant')}
              value={metrics.dominant}
            />
            <Metric label={t('app.converter.lcp_breakdown.metric.rows')} value={metrics.rows} />
            <Metric
              label={t('app.converter.lcp_breakdown.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.lcp_breakdown.metric.critical')}
              value={metrics.critical}
            />
          </div>
          <div className="glass-input rounded-xl p-3">
            <SegmentBar item={manual} t={t} />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.lcp_breakdown.presets')}</CardTitle>
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
                {t(`app.converter.lcp_breakdown.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.lcp_breakdown.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.lcp_breakdown.model')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.lcp_breakdown.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lcp-route">{t('app.converter.lcp_breakdown.route_pattern')}</Label>
                <Input
                  id="lcp-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-device">{t('app.converter.lcp_breakdown.device')}</Label>
                <Select
                  id="lcp-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.lcp_breakdown.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-value">{t('app.converter.lcp_breakdown.lcp_ms')}</Label>
                <Input
                  id="lcp-value"
                  value={draft.lcpMs}
                  onChange={event => updateDraft('lcpMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-percentile">
                  {t('app.converter.lcp_breakdown.percentile')}
                </Label>
                <Input
                  id="lcp-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value.slice(0, 12))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-ttfb">{t('app.converter.lcp_breakdown.ttfb_ms')}</Label>
                <Input
                  id="lcp-ttfb"
                  value={draft.ttfbMs}
                  onChange={event => updateDraft('ttfbMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-delay">
                  {t('app.converter.lcp_breakdown.resource_delay_ms')}
                </Label>
                <Input
                  id="lcp-delay"
                  value={draft.resourceLoadDelayMs}
                  onChange={event =>
                    updateDraft('resourceLoadDelayMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-duration">
                  {t('app.converter.lcp_breakdown.resource_duration_ms')}
                </Label>
                <Input
                  id="lcp-duration"
                  value={draft.resourceLoadDurationMs}
                  onChange={event =>
                    updateDraft('resourceLoadDurationMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-render">
                  {t('app.converter.lcp_breakdown.render_delay_ms')}
                </Label>
                <Input
                  id="lcp-render"
                  value={draft.elementRenderDelayMs}
                  onChange={event =>
                    updateDraft('elementRenderDelayMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-fcp">{t('app.converter.lcp_breakdown.fcp_ms')}</Label>
                <Input
                  id="lcp-fcp"
                  value={draft.fcpMs}
                  onChange={event => updateDraft('fcpMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-samples">{t('app.converter.lcp_breakdown.sample_count')}</Label>
                <Input
                  id="lcp-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="lcp-resource">
                  {t('app.converter.lcp_breakdown.resource_url')}
                </Label>
                <Input
                  id="lcp-resource"
                  value={draft.resourceUrl}
                  onChange={event => updateDraft('resourceUrl', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-selector">
                  {t('app.converter.lcp_breakdown.element_selector')}
                </Label>
                <Input
                  id="lcp-selector"
                  value={draft.elementSelector}
                  onChange={event =>
                    updateDraft('elementSelector', event.target.value.slice(0, 220))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-element-type">
                  {t('app.converter.lcp_breakdown.element_type')}
                </Label>
                <Select
                  id="lcp-element-type"
                  value={draft.elementType}
                  onChange={event => updateDraft('elementType', event.target.value as ElementType)}
                >
                  {ELEMENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.lcp_breakdown.element_type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-priority">{t('app.converter.lcp_breakdown.priority')}</Label>
                <Select
                  id="lcp-priority"
                  value={draft.priority}
                  onChange={event => updateDraft('priority', event.target.value as Priority)}
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {t(`app.converter.lcp_breakdown.priority.${priority}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-loading">{t('app.converter.lcp_breakdown.loading')}</Label>
                <Select
                  id="lcp-loading"
                  value={draft.loading}
                  onChange={event => updateDraft('loading', event.target.value as LoadingMode)}
                >
                  {LOADING_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {t(`app.converter.lcp_breakdown.loading.${mode}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-bytes">{t('app.converter.lcp_breakdown.bytes_kb')}</Label>
                <Input
                  id="lcp-bytes"
                  value={draft.bytesKb}
                  onChange={event => updateDraft('bytesKb', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lcp-cache">{t('app.converter.lcp_breakdown.cache_hit_rate')}</Label>
                <Input
                  id="lcp-cache"
                  value={draft.cacheHitRate}
                  onChange={event => updateDraft('cacheHitRate', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Checkbox
                checked={draft.hasPreload}
                onChange={event => updateDraft('hasPreload', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.lcp_breakdown.has_preload')}
              />
              <Checkbox
                checked={draft.serverRendered}
                onChange={event => updateDraft('serverRendered', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.lcp_breakdown.server_rendered')}
              />
              <Checkbox
                checked={draft.imageOptimized}
                onChange={event => updateDraft('imageOptimized', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.lcp_breakdown.image_optimized')}
              />
              <Checkbox
                checked={draft.hydrationBlocking}
                onChange={event => updateDraft('hydrationBlocking', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.lcp_breakdown.hydration_blocking_flag')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.lcp_breakdown.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.lcp_breakdown.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.lcp_breakdown.workspace_placeholder')}
              className="min-h-[590px] font-mono"
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
                onClick={() => updateWorkspace('')}
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
              <CardTitle className="text-base">{t('app.converter.lcp_breakdown.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.lcp_breakdown.audit_search')}
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
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.lcp_breakdown.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.lcp_breakdown.level.${finding.level}`)}
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
                  {t('app.converter.lcp_breakdown.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.lcp_breakdown.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="lcp-output">{t('app.converter.lcp_breakdown.output_type')}</Label>
                <Select
                  id="lcp-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.lcp_breakdown.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[380px] font-mono" />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            {outputPreviewRowsLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_rows_limited', {
                  total: outputPreviewTotalRows.toLocaleString(),
                  visible: outputPreviewVisibleRows.toLocaleString()
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
                {t('app.converter.lcp_breakdown.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'lcp-breakdown-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.lcp_breakdown.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentCsv(), 'lcp-breakdown.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.lcp_breakdown.download_csv')}
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
                {t('app.converter.lcp_breakdown.breakdowns')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={breakdownQuery}
                onChange={event => setBreakdownQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.lcp_breakdown.breakdown_search')}
                className="pl-10"
              />
            </div>
            {filteredBreakdowns.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredBreakdowns.slice(0, 56).map(item => (
                  <div key={item.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {item.route || item.url || item.source}
                      </p>
                      <span className="shrink-0 rounded-full border border-[var(--border-base)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                        {t(`app.converter.lcp_breakdown.source.${item.source}`)}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {formatMs(item.lcpMs)} / {item.url || item.element || '-'}
                    </p>
                    <div className="mt-3">
                      <SegmentBar item={item} t={t} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.lcp_breakdown.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.lcp_breakdown.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.lcp_breakdown.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.lcp_breakdown.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.lcp_breakdown.reference.${item}_hint`)}
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
                  {t('app.converter.lcp_breakdown.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.lcp_breakdown.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.lcp_breakdown.checklist.${item}.body`)}
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
