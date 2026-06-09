'use client'

import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  MousePointerClick,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const METRICS = ['LCP', 'INP', 'CLS'] as const
const DEVICES = ['mobile', 'desktop'] as const
const OUTPUT_TYPES = [
  'rum',
  'next',
  'next_config',
  'gtag',
  'worker',
  'markdown',
  'json',
  'csv'
] as const
const WORKSPACE_LIMIT = 70000
const EVENT_LIMIT = 120

type MetricName = (typeof METRICS)[number]
type Device = (typeof DEVICES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type Rating = 'good' | 'needs_improvement' | 'poor'
type FindingLevel = 'danger' | 'good' | 'warn'

interface VitalsDraft {
  device: Device
  elementSelector: string
  eventTarget: string
  eventType: string
  loadState: string
  metric: MetricName
  navigationType: string
  percentile: string
  resourceUrl: string
  routePattern: string
  sampleCount: string
  shiftSource: string
  value: string
}

interface ParsedVital {
  attribution: Record<string, string>
  id: string
  metric: MetricName
  rating: Rating
  route: string
  source: 'json' | 'text'
  value: number
}

interface ParsedWorkspace {
  errors: string[]
  events: ParsedVital[]
  rawRows: Array<{ label: string; value: string }>
}

interface Preset {
  draft: VitalsDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: VitalsDraft = {
  device: 'mobile',
  elementSelector: 'main img[data-hero]',
  eventTarget: '',
  eventType: '',
  loadState: 'complete',
  metric: 'LCP',
  navigationType: 'navigate',
  percentile: 'p75',
  resourceUrl: '/images/hero.avif',
  routePattern: '/products/:slug',
  sampleCount: '1200',
  shiftSource: '',
  value: '2300'
}

const PRESETS: Preset[] = [
  {
    key: 'field_report',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"name":"LCP","value":2300,"rating":"good","id":"v4-1","navigationType":"navigate","attribution":{"element":"main img[data-hero]","url":"/images/hero.avif","loadState":"complete"},"route":"/products/example"}',
      '{"name":"INP","value":180,"rating":"good","id":"v4-2","attribution":{"eventType":"click","eventTarget":"button[data-buy]","interactionTarget":"button[data-buy]"},"route":"/products/example"}',
      '{"name":"CLS","value":0.06,"rating":"good","id":"v4-3","attribution":{"largestShiftTarget":".review-card","largestShiftTime":"1240"},"route":"/products/example"}'
    ].join('\n')
  },
  {
    key: 'lcp_image',
    draft: {
      ...DEFAULT_DRAFT,
      elementSelector: 'picture.hero img',
      resourceUrl: 'https://cdn.example.com/hero-large.jpg',
      routePattern: '/campaign/summer',
      value: '3600'
    },
    workspace: [
      'LCP 3.6s element=picture.hero img url=https://cdn.example.com/hero-large.jpg loadState=dom-interactive route=/campaign/summer',
      'FCP 1.4s',
      'TTFB 840ms'
    ].join('\n')
  },
  {
    key: 'inp_checkout',
    draft: {
      ...DEFAULT_DRAFT,
      elementSelector: '',
      eventTarget: 'button[data-submit-order]',
      eventType: 'click',
      metric: 'INP',
      resourceUrl: '',
      routePattern: '/checkout',
      value: '420'
    },
    workspace: [
      '{"name":"INP","value":420,"rating":"needs-improvement","attribution":{"eventType":"click","eventTarget":"button[data-submit-order]","interactionTarget":"button[data-submit-order]","interactionTime":"8120","inputDelay":"38","processingDuration":"330","presentationDelay":"52"},"route":"/checkout"}',
      '{"name":"INP","value":610,"rating":"poor","attribution":{"eventType":"keydown","eventTarget":"input[name=coupon]","processingDuration":"520"},"route":"/checkout"}'
    ].join('\n')
  },
  {
    key: 'cls_ads',
    draft: {
      ...DEFAULT_DRAFT,
      elementSelector: '',
      metric: 'CLS',
      resourceUrl: '',
      routePattern: '/news/:slug',
      shiftSource: 'iframe.ad-slot',
      value: '0.19'
    },
    workspace: [
      'CLS 0.19 target=iframe.ad-slot route=/news/story',
      'CLS 0.07 target=.related-card route=/news/story',
      '{"name":"CLS","value":0.12,"attribution":{"largestShiftTarget":"iframe.ad-slot","largestShiftValue":"0.09"},"route":"/news/story"}'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      device: 'mobile',
      elementSelector: '',
      eventTarget: 'input[name=search]',
      eventType: 'keydown',
      loadState: 'loading',
      metric: 'INP',
      navigationType: 'back-forward-cache',
      percentile: 'p95',
      resourceUrl: 'http://cdn.example.com/hero.jpg?token=abc',
      routePattern: '/checkout',
      sampleCount: '42',
      shiftSource: 'iframe#ad',
      value: '780'
    },
    workspace: [
      '{"name":"LCP","value":5200,"rating":"poor","id":"bad-lcp","navigationType":"navigate","attribution":{"element":"","url":"http://cdn.example.com/hero.jpg?token=abc","loadState":"loading"},"route":"/checkout"}',
      '{"name":"INP","value":780,"rating":"poor","id":"bad-inp","attribution":{"eventType":"keydown","eventTarget":"input[name=search]","processingDuration":"640","presentationDelay":"120"},"route":"/checkout"}',
      '{"name":"CLS","value":0.32,"rating":"poor","id":"bad-cls","attribution":{"largestShiftTarget":"iframe#ad","largestShiftValue":"0.21"},"route":"/checkout"}'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['field', 'attribution', 'segment', 'budget'] as const
const REFERENCE_ITEMS = ['lcp', 'inp', 'cls', 'attribution', 'rum', 'bfcache'] as const

const THRESHOLDS: Record<MetricName, { good: number; poor: number }> = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 }
}

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const normalizeRating = (value: string): Rating | null => {
  const token = value.trim().toLowerCase().replace(/-/g, '_')
  if (token === 'good' || token === 'needs_improvement' || token === 'poor') return token
  return null
}

const normalizeMetric = (value: unknown): MetricName | null => {
  const token = String(value ?? '')
    .trim()
    .toUpperCase()
  return METRICS.includes(token as MetricName) ? (token as MetricName) : null
}

const ratingFor = (metric: MetricName, value: number): Rating => {
  if (value <= THRESHOLDS[metric].good) return 'good'
  if (value > THRESHOLDS[metric].poor) return 'poor'
  return 'needs_improvement'
}

const parseTimingValue = (value: string, unit = '') => {
  const parsed = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return null
  if (unit.toLowerCase() === 's') return parsed * 1000
  return parsed
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const textValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const numberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const next = Number(value.replace(/[,_\s]/g, ''))
    return Number.isFinite(next) ? next : null
  }
  return null
}

const attributionFromRecord = (record: Record<string, unknown>) => {
  const attribution = asRecord(record.attribution) ?? record
  return Object.fromEntries(
    Object.entries(attribution)
      .filter(
        ([, value]) =>
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      )
      .slice(0, 16)
      .map(([key, value]) => [key, String(value)])
  )
}

const vitalFromRecord = (record: Record<string, unknown>, index: number): ParsedVital | null => {
  const metric = normalizeMetric(record.name ?? record.metric ?? record.metricName)
  const rawValue = numberValue(record.value ?? record.numericValue ?? record.duration)
  if (!metric || rawValue === null) return null
  const rating = normalizeRating(textValue(record.rating)) ?? ratingFor(metric, rawValue)
  const route = textValue(record.route ?? record.path ?? record.url ?? record.page) || '/'
  return {
    attribution: attributionFromRecord(record),
    id: textValue(record.id) || `${metric.toLowerCase()}-${index + 1}`,
    metric,
    rating,
    route,
    source: 'json',
    value: metric === 'CLS' ? round(rawValue, 3) : round(rawValue)
  }
}

const collectRecords = (value: unknown, output: ParsedVital[], depth = 0) => {
  if (output.length >= EVENT_LIMIT || depth > 6) return
  if (Array.isArray(value)) {
    value.forEach(item => collectRecords(item, output, depth + 1))
    return
  }

  const record = asRecord(value)
  if (!record) return
  const parsed = vitalFromRecord(record, output.length)
  if (parsed) {
    output.push(parsed)
    return
  }
  Object.values(record)
    .slice(0, 32)
    .forEach(item => collectRecords(item, output, depth + 1))
}

const parseJsonWorkspace = (parsed: ParsedWorkspace, input: string, reportError = true) => {
  try {
    const value = JSON.parse(input)
    collectRecords(value, parsed.events)
  } catch {
    if (reportError) parsed.errors.push('json_error')
  }
}

const attrFromToken = (line: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = line.match(new RegExp(`${escaped}=([^\\s]+)`, 'iu'))
  return match?.[1] ?? ''
}

const parseTextLine = (line: string, index: number): ParsedVital | null => {
  const match = line.match(/\b(LCP|INP|CLS)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu)
  if (!match?.[1] || !match[2]) return null
  const metric = normalizeMetric(match[1])
  if (!metric) return null
  const parsedValue =
    metric === 'CLS' ? Number(match[2].replace(/,/g, '')) : parseTimingValue(match[2], match[3])
  if (parsedValue === null || !Number.isFinite(parsedValue)) return null
  const attribution = Object.fromEntries(
    ['element', 'url', 'loadState', 'target', 'eventType', 'route']
      .map(key => [key, attrFromToken(line, key)])
      .filter(([, value]) => value)
  )
  const route = attrFromToken(line, 'route') || '/'
  return {
    attribution,
    id: `text-${index + 1}`,
    metric,
    rating: ratingFor(metric, parsedValue),
    route,
    source: 'text',
    value: metric === 'CLS' ? round(parsedValue, 3) : round(parsedValue)
  }
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedWorkspace = { errors: [], events: [], rawRows: [] }
  const trimmed = source.trim()
  const parseJsonLines = () => {
    source
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line.startsWith('{') || line.startsWith('['))
      .slice(0, EVENT_LIMIT)
      .forEach(line => parseJsonWorkspace(parsed, line, false))
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const before = parsed.events.length
    parseJsonWorkspace(parsed, trimmed)
    if (parsed.events.length === before) parseJsonLines()
  } else {
    parseJsonLines()
  }

  source
    .split(/\r?\n/u)
    .slice(0, EVENT_LIMIT)
    .forEach((line, index) => {
      const clean = line.trim()
      if (!clean) return
      const textEvent = parseTextLine(clean, index)
      if (
        textEvent &&
        !parsed.events.some(item => item.id === textEvent.id && item.metric === textEvent.metric)
      ) {
        parsed.events.push(textEvent)
      }
      if (/LCP|INP|CLS|element=|target=|route=/iu.test(clean)) {
        parsed.rawRows.push({
          label: clean.split(/\s/u)[0]?.slice(0, 80) ?? 'row',
          value: clean.slice(0, 220)
        })
      }
    })

  parsed.events = parsed.events.slice(0, EVENT_LIMIT)
  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const currentRating = (draft: VitalsDraft) => ratingFor(draft.metric, numberFromInput(draft.value))

const buildRumSnippet = (draft: VitalsDraft) =>
  [
    "import { onCLS, onINP, onLCP } from 'web-vitals/attribution'",
    '',
    "const endpoint = '/api/vitals'",
    '',
    'function sendToAnalytics(metric) {',
    '  const body = JSON.stringify({',
    '    name: metric.name,',
    '    value: metric.value,',
    '    rating: metric.rating,',
    '    id: metric.id,',
    '    navigationType: metric.navigationType,',
    '    attribution: metric.attribution,',
    `    route: '${draft.routePattern}',`,
    `    device: '${draft.device}'`,
    '  })',
    '',
    '  if (navigator.sendBeacon) {',
    '    navigator.sendBeacon(endpoint, body)',
    '    return',
    '  }',
    '',
    "  fetch(endpoint, { body, keepalive: true, method: 'POST' })",
    '}',
    '',
    'onLCP(sendToAnalytics)',
    'onINP(sendToAnalytics)',
    'onCLS(sendToAnalytics)'
  ].join('\n')

const buildNextSnippet = (draft: VitalsDraft) =>
  [
    "'use client'",
    '',
    "import { onCLS, onINP, onLCP } from 'web-vitals/attribution'",
    "import { useEffect } from 'react'",
    '',
    'export function WebVitalsReporter() {',
    '  useEffect(() => {',
    '    const report = metric => {',
    '      const payload = JSON.stringify({ ...metric, route: location.pathname })',
    "      navigator.sendBeacon?.('/api/vitals', payload)",
    '    }',
    '',
    '    onLCP(report)',
    '    onINP(report)',
    '    onCLS(report)',
    '  }, [])',
    '',
    '  return null',
    '}',
    '',
    `// Current target route: ${draft.routePattern}`
  ].join('\n')

const buildWorkerSnippet = (draft: VitalsDraft) =>
  [
    'export default {',
    '  async fetch(request, env, ctx) {',
    "    if (request.method !== 'POST') return new Response('Not found', { status: 404 })",
    '    const metric = await request.json()',
    '    const row = {',
    '      name: metric.name,',
    '      value: metric.value,',
    '      rating: metric.rating,',
    '      route: metric.route,',
    '      attribution: metric.attribution,',
    '      ts: new Date().toISOString()',
    '    }',
    '    ctx.waitUntil(env.VITALS.writeDataPoint?.({ blobs: [JSON.stringify(row)] }))',
    "    return new Response('ok')",
    '  }',
    '}',
    `// Segment: ${draft.device} ${draft.percentile}`
  ].join('\n')

const buildNextConfigSnippet = () =>
  [
    '/** @type {import("next").NextConfig} */',
    'const nextConfig = {',
    '  experimental: {',
    "    webVitalsAttribution: ['CLS', 'LCP', 'INP']",
    '  }',
    '}',
    '',
    'module.exports = nextConfig'
  ].join('\n')

const buildGtagSnippet = (draft: VitalsDraft) =>
  [
    "import { onCLS, onINP, onLCP } from 'web-vitals/attribution'",
    '',
    'function report(metric) {',
    "  window.gtag?.('event', metric.name, {",
    '    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),',
    "    event_category: 'Web Vitals',",
    '    event_label: metric.id,',
    '    metric_rating: metric.rating,',
    '    metric_route: location.pathname,',
    '    metric_navigation_type: metric.navigationType,',
    '    metric_target: metric.attribution?.element || metric.attribution?.eventTarget || metric.attribution?.largestShiftTarget || ""',
    '  })',
    '}',
    '',
    'onLCP(report)',
    'onINP(report)',
    'onCLS(report)',
    '',
    `// Segment: ${draft.device} ${draft.percentile}`
  ].join('\n')

const buildMarkdownSummary = (draft: VitalsDraft, parsed: ParsedWorkspace, findings: Finding[]) => {
  const topFindings = findings
    .filter(item => item.level !== 'good')
    .slice(0, 8)
    .map(item => `- [${item.level}] ${item.subject}: ${item.key}`)
  const topEvents = parsed.events
    .slice(0, 8)
    .map(event => `- ${event.metric} ${event.value} (${event.rating}) on ${event.route}`)

  return [
    '# Web Vitals triage',
    '',
    `Route: ${draft.routePattern}`,
    `Device: ${draft.device}`,
    `Segment: ${draft.percentile} ${draft.navigationType}`,
    `Current metric: ${draft.metric} ${draft.value} (${currentRating(draft)})`,
    '',
    '## Findings',
    topFindings.length ? topFindings.join('\n') : '- No high-risk findings.',
    '',
    '## Parsed events',
    topEvents.length ? topEvents.join('\n') : '- No parsed field events yet.',
    '',
    '## Next actions',
    '- Confirm the failing route and device segment in field data.',
    '- Fix the attributed element, interaction handler, or shift source before widening release.',
    '- Re-check the matching performance budget after the field signal improves.'
  ].join('\n')
}

const buildCsv = (draft: VitalsDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.events.length
    ? parsed.events.map(event => [
        event.metric,
        event.value,
        event.rating,
        event.route,
        event.attribution.element ??
          event.attribution.eventTarget ??
          event.attribution.largestShiftTarget ??
          '',
        event.attribution.url ?? '',
        event.source
      ])
    : [
        [
          draft.metric,
          draft.value,
          currentRating(draft),
          draft.routePattern,
          draft.elementSelector || draft.eventTarget || draft.shiftSource,
          draft.resourceUrl,
          'draft'
        ]
      ]
  return [
    'metric,value,rating,route,target,url,source',
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n')
}

const buildJsonSummary = (draft: VitalsDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify(
    {
      draft: {
        ...draft,
        rating: currentRating(draft)
      },
      findings,
      parsed,
      thresholds: THRESHOLDS
    },
    null,
    2
  )

const buildOutput = (
  draft: VitalsDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'next') return buildNextSnippet(draft)
  if (outputType === 'next_config') return buildNextConfigSnippet()
  if (outputType === 'gtag') return buildGtagSnippet(draft)
  if (outputType === 'worker') return buildWorkerSnippet(draft)
  if (outputType === 'markdown') return buildMarkdownSummary(draft, parsed, findings)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildCsv(draft, parsed)
  return buildRumSnippet(draft)
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const urlRisk = (value: string) => {
  if (!value) return null
  try {
    const next = new URL(value, 'https://www.example.com')
    return next
  } catch {
    return null
  }
}

const auditVitals = (draft: VitalsDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const value = numberFromInput(draft.value)
  const rating = currentRating(draft)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (draft.percentile !== 'p75')
    addFinding(findings, 'warn', 'percentile_not_p75', draft.percentile)
  if (samples > 0 && samples < 400) addFinding(findings, 'warn', 'low_sample_count', `${samples}`)
  if (rating === 'poor')
    addFinding(findings, 'danger', `${draft.metric.toLowerCase()}_poor`, `${value}`)
  else if (rating === 'needs_improvement')
    addFinding(findings, 'warn', `${draft.metric.toLowerCase()}_needs_work`, `${value}`)
  else addFinding(findings, 'good', `${draft.metric.toLowerCase()}_good`, `${value}`)

  if (draft.metric === 'LCP') {
    if (!draft.elementSelector.trim()) addFinding(findings, 'warn', 'lcp_missing_element', 'LCP')
    const resource = urlRisk(draft.resourceUrl)
    if (!draft.resourceUrl.trim()) addFinding(findings, 'warn', 'lcp_missing_url', 'LCP')
    if (resource?.protocol === 'http:')
      addFinding(findings, 'danger', 'http_lcp_resource', draft.resourceUrl)
    if (/token|session|account|private|user/iu.test(draft.resourceUrl))
      addFinding(findings, 'warn', 'sensitive_resource_url', draft.resourceUrl)
    if (/loading|dom-loading/iu.test(draft.loadState))
      addFinding(findings, 'warn', 'lcp_loading_state', draft.loadState)
  }

  if (draft.metric === 'INP') {
    if (!draft.eventType.trim()) addFinding(findings, 'warn', 'inp_missing_event_type', 'INP')
    if (!draft.eventTarget.trim()) addFinding(findings, 'warn', 'inp_missing_target', 'INP')
    if (/keydown|input/iu.test(draft.eventType) && value > 200)
      addFinding(findings, 'warn', 'inp_typing_risk', draft.eventType)
  }

  if (draft.metric === 'CLS') {
    if (!draft.shiftSource.trim()) addFinding(findings, 'warn', 'cls_missing_source', 'CLS')
    if (/iframe|ad|embed/iu.test(draft.shiftSource))
      addFinding(findings, 'warn', 'cls_ad_or_embed', draft.shiftSource)
  }

  if (/back-forward/iu.test(draft.navigationType))
    addFinding(findings, 'warn', 'bfcache_segment', draft.navigationType)

  const poorEvents = parsed.events.filter(event => event.rating === 'poor')
  const needsEvents = parsed.events.filter(event => event.rating === 'needs_improvement')
  if (poorEvents.length)
    addFinding(findings, 'danger', 'parsed_poor_events', `${poorEvents.length}`)
  if (needsEvents.length)
    addFinding(findings, 'warn', 'parsed_needs_work_events', `${needsEvents.length}`)

  parsed.events.forEach(event => {
    if (event.metric === 'LCP') {
      const element = event.attribution.element ?? ''
      const url = event.attribution.url ?? ''
      if (!element) addFinding(findings, 'warn', 'parsed_lcp_no_element', event.id)
      const parsedUrl = urlRisk(url)
      if (parsedUrl?.protocol === 'http:')
        addFinding(findings, 'danger', 'parsed_http_resource', url)
      if (/loading|dom-loading/iu.test(event.attribution.loadState ?? '')) {
        addFinding(findings, 'warn', 'parsed_lcp_loading_state', event.id)
      }
    }
    if (event.metric === 'INP') {
      const duration = numberValue(event.attribution.processingDuration)
      if (duration !== null && duration > 200)
        addFinding(findings, 'danger', 'parsed_long_processing', `${event.id}: ${duration} ms`)
      if (!event.attribution.eventTarget && !event.attribution.interactionTarget)
        addFinding(findings, 'warn', 'parsed_inp_no_target', event.id)
    }
    if (event.metric === 'CLS') {
      const target = event.attribution.largestShiftTarget ?? event.attribution.target ?? ''
      if (!target) addFinding(findings, 'warn', 'parsed_cls_no_target', event.id)
      if (/iframe|ad|embed/iu.test(target))
        addFinding(findings, 'warn', 'parsed_cls_ad_or_embed', target)
    }
  })

  if (parsed.events.length) addFinding(findings, 'good', 'parser_found', `${parsed.events.length}`)
  else addFinding(findings, 'warn', 'parser_empty', '-')
  if (parsed.errors.includes('truncated'))
    addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (parsed.errors.includes('json_error')) addFinding(findings, 'warn', 'json_error', 'JSON')
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', draft.routePattern)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length
  return Math.max(0, Math.min(100, 90 + good * 2 - warn * 6 - danger * 18))
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

export default function WebVitalsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<VitalsDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('rum')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditVitals(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.web_vitals.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredEvents = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return parsed.events
    return parsed.events.filter(event => {
      const text =
        `${event.metric} ${event.value} ${event.rating} ${event.route} ${JSON.stringify(event.attribution)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredParsedQuery, parsed.events])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      events: parsed.events.length,
      rating: t(`app.converter.web_vitals.rating.${currentRating(draft)}`),
      score,
      value:
        draft.metric === 'CLS'
          ? String(numberFromInput(draft.value))
          : `${numberFromInput(draft.value)} ms`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft, findings, parsed.events.length, score, t]
  )

  const updateDraft = <Key extends keyof VitalsDraft>(key: Key, value: VitalsDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('rum')
    setAuditQuery('')
    setParsedQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.web_vitals.summary_title'),
        `${t('app.converter.web_vitals.metric.score')}: ${metrics.score}`,
        `${t('app.converter.web_vitals.metric.value')}: ${metrics.value}`,
        `${t('app.converter.web_vitals.metric.rating')}: ${metrics.rating}`,
        `${t('app.converter.web_vitals.metric.events')}: ${metrics.events}`,
        `${t('app.converter.web_vitals.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.web_vitals.metric.critical')}: ${metrics.critical}`
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
                <Activity className="h-4 w-4" />
                {t('app.converter.web-vitals')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.web-vitals')}</CardTitle>
              <CardDescription>{t('app.converter.web_vitals.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.web_vitals.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.web_vitals.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.web_vitals.metric.value')} value={metrics.value} />
            <Metric label={t('app.converter.web_vitals.metric.rating')} value={metrics.rating} />
            <Metric label={t('app.converter.web_vitals.metric.events')} value={metrics.events} />
            <Metric
              label={t('app.converter.web_vitals.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.web_vitals.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.web_vitals.presets')}</CardTitle>
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
                {t(`app.converter.web_vitals.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.web_vitals.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.web_vitals.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.web_vitals.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vitals-route">{t('app.converter.web_vitals.route_pattern')}</Label>
                <Input
                  id="vitals-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-metric">{t('app.converter.web_vitals.metric_name')}</Label>
                <Select
                  id="vitals-metric"
                  value={draft.metric}
                  onChange={event => updateDraft('metric', event.target.value as MetricName)}
                >
                  {METRICS.map(metric => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-value">{t('app.converter.web_vitals.value')}</Label>
                <Input
                  id="vitals-value"
                  value={draft.value}
                  onChange={event => updateDraft('value', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-samples">{t('app.converter.web_vitals.sample_count')}</Label>
                <Input
                  id="vitals-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-device">{t('app.converter.web_vitals.device')}</Label>
                <Select
                  id="vitals-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.web_vitals.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-percentile">
                  {t('app.converter.web_vitals.percentile')}
                </Label>
                <Input
                  id="vitals-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value.slice(0, 12))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-navigation">
                  {t('app.converter.web_vitals.navigation_type')}
                </Label>
                <Input
                  id="vitals-navigation"
                  value={draft.navigationType}
                  onChange={event => updateDraft('navigationType', event.target.value.slice(0, 60))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vitals-load">{t('app.converter.web_vitals.load_state')}</Label>
                <Input
                  id="vitals-load"
                  value={draft.loadState}
                  onChange={event => updateDraft('loadState', event.target.value.slice(0, 60))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.web_vitals.attribution_fields')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vitals-element">
                    {t('app.converter.web_vitals.element_selector')}
                  </Label>
                  <Input
                    id="vitals-element"
                    value={draft.elementSelector}
                    onChange={event =>
                      updateDraft('elementSelector', event.target.value.slice(0, 180))
                    }
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vitals-url">{t('app.converter.web_vitals.resource_url')}</Label>
                  <Input
                    id="vitals-url"
                    value={draft.resourceUrl}
                    onChange={event => updateDraft('resourceUrl', event.target.value.slice(0, 240))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vitals-event-type">
                    {t('app.converter.web_vitals.event_type')}
                  </Label>
                  <Input
                    id="vitals-event-type"
                    value={draft.eventType}
                    onChange={event => updateDraft('eventType', event.target.value.slice(0, 80))}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vitals-event-target">
                    {t('app.converter.web_vitals.event_target')}
                  </Label>
                  <Input
                    id="vitals-event-target"
                    value={draft.eventTarget}
                    onChange={event => updateDraft('eventTarget', event.target.value.slice(0, 180))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="vitals-shift-source">
                    {t('app.converter.web_vitals.shift_source')}
                  </Label>
                  <Input
                    id="vitals-shift-source"
                    value={draft.shiftSource}
                    onChange={event => updateDraft('shiftSource', event.target.value.slice(0, 180))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.web_vitals.workspace')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.web_vitals.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.web_vitals.workspace_placeholder')}
              className="min-h-[460px] font-mono"
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
              <CardTitle className="text-base">{t('app.converter.web_vitals.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.web_vitals.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 30).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.web_vitals.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.web_vitals.level.${finding.level}`)}
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
                <CardTitle className="text-base">{t('app.converter.web_vitals.output')}</CardTitle>
                <CardDescription>{t('app.converter.web_vitals.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="vitals-output-type">
                  {t('app.converter.web_vitals.output_type')}
                </Label>
                <Select
                  id="vitals-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.web_vitals.output.${type}`)}
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
                {t('app.converter.web_vitals.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'web-vitals-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.web_vitals.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadText(csvOutput, 'web-vitals.csv', 'text/csv;charset=utf-8')}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.web_vitals.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.web_vitals.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value)}
                placeholder={t('app.converter.web_vitals.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredEvents.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredEvents.slice(0, 48).map(event => (
                  <div
                    key={`${event.id}:${event.metric}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {event.metric} {event.value}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(event.rating === 'poor' ? 'danger' : event.rating === 'good' ? 'good' : 'warn')}`}
                      >
                        {t(`app.converter.web_vitals.rating.${event.rating}`)}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {event.route}
                    </p>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {JSON.stringify(event.attribution)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.web_vitals.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.web_vitals.reference')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.web_vitals.reference_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.web_vitals.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.web_vitals.reference.${item}_hint`)}
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
            <CardTitle className="text-base">{t('app.converter.web_vitals.checklist')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {item === 'budget' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.web_vitals.checklist.${item}.title`)}
              </div>
              {t(`app.converter.web_vitals.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
