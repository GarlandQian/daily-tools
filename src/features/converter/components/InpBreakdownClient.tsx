'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  MousePointer2,
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

const DEVICES = ['mobile', 'desktop'] as const
const EVENT_TYPES = ['click', 'keydown', 'pointerdown', 'input', 'tap', 'drag', 'other'] as const
const OUTPUT_TYPES = [
  'observer',
  'next',
  'timeline',
  'playbook',
  'markdown',
  'json',
  'csv'
] as const
const WORKSPACE_LIMIT = 90000
const EVENT_LIMIT = 180

type Device = (typeof DEVICES)[number]
type EventType = (typeof EVENT_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type SegmentKey = 'inputDelay' | 'presentationDelay' | 'processingDuration'
type ParsedSource = 'json' | 'manual' | 'text'

interface InpDraft {
  blockingDurationMs: string
  device: Device
  eventTarget: string
  eventType: EventType
  handlerName: string
  hydrationBlocking: boolean
  inpMs: string
  inputDelayMs: string
  interactionTimeMs: string
  longAnimationFrameMs: string
  networkDuringInput: boolean
  percentile: string
  presentationDelayMs: string
  processingDurationMs: string
  routePattern: string
  sampleCount: string
  scriptUrl: string
  thirdPartyScript: boolean
}

interface ParsedInpEvent {
  blockingDuration: number
  eventTarget: string
  eventType: EventType
  handlerName: string
  id: string
  inpMs: number
  inputDelay: number
  interactionTime: number
  longAnimationFrame: number
  presentationDelay: number
  processingDuration: number
  route: string
  scriptUrl: string
  source: ParsedSource
}

interface ParsedWorkspace {
  errors: string[]
  events: ParsedInpEvent[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: InpDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: InpDraft = {
  blockingDurationMs: '42',
  device: 'mobile',
  eventTarget: 'button[data-add-to-cart]',
  eventType: 'click',
  handlerName: 'addToCart',
  hydrationBlocking: false,
  inpMs: '176',
  inputDelayMs: '24',
  interactionTimeMs: '8420',
  longAnimationFrameMs: '88',
  networkDuringInput: false,
  percentile: 'p75',
  presentationDelayMs: '36',
  processingDurationMs: '118',
  routePattern: '/products/:slug',
  sampleCount: '1800',
  scriptUrl: '/_next/static/chunks/product.js',
  thirdPartyScript: false
}

const PRESETS: Preset[] = [
  {
    key: 'healthy_click',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"route":"/products/example","name":"INP","value":176,"rating":"good","attribution":{"eventType":"click","eventTarget":"button[data-add-to-cart]","inputDelay":24,"processingDuration":118,"presentationDelay":36,"interactionTime":8420,"longAnimationFrameDuration":88,"scriptUrl":"/_next/static/chunks/product.js","handler":"addToCart"}}',
      'inp=176 input=24 processing=118 presentation=36 route=/products/example target=button[data-add-to-cart] event=click script=/_next/static/chunks/product.js'
    ].join('\n')
  },
  {
    key: 'input_delay',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '38',
      eventTarget: 'button[data-open-cart]',
      handlerName: 'openCart',
      inpMs: '328',
      inputDelayMs: '148',
      longAnimationFrameMs: '96',
      presentationDelayMs: '42',
      processingDurationMs: '138',
      routePattern: '/cart'
    },
    workspace: [
      '{"route":"/cart","name":"INP","value":328,"attribution":{"eventType":"click","eventTarget":"button[data-open-cart]","inputDelay":148,"processingDuration":138,"presentationDelay":42,"longAnimationFrameDuration":96,"scriptUrl":"/_next/static/chunks/cart.js"}}',
      'inp=328 input=148 processing=138 presentation=42 route=/cart target=button[data-open-cart] event=click'
    ].join('\n')
  },
  {
    key: 'processing_heavy',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '230',
      eventTarget: 'input[name=coupon]',
      eventType: 'keydown',
      handlerName: 'validateCoupon',
      inpMs: '524',
      inputDelayMs: '46',
      longAnimationFrameMs: '460',
      presentationDelayMs: '68',
      processingDurationMs: '410',
      routePattern: '/checkout'
    },
    workspace: [
      '{"route":"/checkout","name":"INP","value":524,"rating":"poor","attribution":{"eventType":"keydown","eventTarget":"input[name=coupon]","inputDelay":46,"processingDuration":410,"presentationDelay":68,"longAnimationFrameDuration":460,"scriptUrl":"/_next/static/chunks/checkout.js","handler":"validateCoupon"}}',
      'inp=524 input=46 processing=410 presentation=68 route=/checkout target=input[name=coupon] event=keydown loaf=460 blocking=230'
    ].join('\n')
  },
  {
    key: 'presentation_delay',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '64',
      eventTarget: 'button[data-filter]',
      handlerName: 'applyFilter',
      inpMs: '410',
      inputDelayMs: '34',
      longAnimationFrameMs: '180',
      presentationDelayMs: '210',
      processingDurationMs: '166',
      routePattern: '/search',
      scriptUrl: '/_next/static/chunks/search.js'
    },
    workspace: [
      '{"route":"/search","metric":"INP","value":410,"attribution":{"eventType":"click","eventTarget":"button[data-filter]","inputDelay":34,"processingDuration":166,"presentationDelay":210,"longAnimationFrameDuration":180,"scriptUrl":"/_next/static/chunks/search.js"}}',
      'inp=410 input=34 processing=166 presentation=210 route=/search target=button[data-filter] event=click'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      blockingDurationMs: '540',
      device: 'mobile',
      eventTarget: '',
      eventType: 'input',
      handlerName: '',
      hydrationBlocking: true,
      inpMs: '820',
      inputDelayMs: '120',
      interactionTimeMs: '12600',
      longAnimationFrameMs: '760',
      networkDuringInput: true,
      percentile: 'p95',
      presentationDelayMs: '170',
      processingDurationMs: '530',
      routePattern: '/checkout',
      sampleCount: '32',
      scriptUrl: 'http://cdn.example.com/private/checkout.js?token=abc',
      thirdPartyScript: true
    },
    workspace: [
      '{"route":"/checkout","name":"INP","value":820,"rating":"poor","attribution":{"eventType":"input","eventTarget":"","inputDelay":120,"processingDuration":530,"presentationDelay":170,"interactionTime":12600,"longAnimationFrameDuration":760,"scriptUrl":"http://cdn.example.com/private/checkout.js?token=abc","handler":""}}',
      'inp=820 input=120 processing=530 presentation=170 route=/checkout target= event=input script=http://cdn.example.com/private/checkout.js?token=abc loaf=760 blocking=540',
      'INP 820ms processing=530ms presentation=170ms inputDelay=120ms'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = [
  'inp',
  'input_delay',
  'processing',
  'presentation',
  'loaf',
  'target'
] as const
const CHECKLIST_ITEMS = ['segment', 'handler', 'render', 'field'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const normalizeEventType = (value: unknown): EventType => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return EVENT_TYPES.includes(token as EventType) ? (token as EventType) : 'other'
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

const parseTimingValue = (value: string, unit?: string) => {
  const parsed = numberFromInput(value)
  return unit?.toLowerCase() === 's' ? parsed * 1000 : parsed
}

const isPrivateUrl = (value: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=|\/private\//iu.test(value)
const isHttpUrl = (value: string) => /^http:/iu.test(value)

const addEvent = (events: ParsedInpEvent[], event: Omit<ParsedInpEvent, 'id'>) => {
  if (!event.inpMs && !event.processingDuration && !event.eventTarget && !event.route) return
  events.push({
    ...event,
    id: `${event.source}-${events.length}-${event.route || event.eventTarget || event.inpMs}`
  })
}

const extractAttribution = (record: Record<string, unknown>) => {
  const nested =
    typeof record.attribution === 'object' && record.attribution
      ? (record.attribution as Record<string, unknown>)
      : {}
  return { ...record, ...nested }
}

const collectJsonEvents = (value: unknown, events: ParsedInpEvent[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonEvents(item, events))
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const merged = extractAttribution(record)
  const metric = getRecordString(merged, ['name', 'metric', 'metricName']).toUpperCase()
  const inp = getRecordString(merged, ['value', 'inp', 'inpMs'])

  if (metric === 'INP' || inp || getRecordString(merged, ['processingDuration'])) {
    addEvent(events, {
      blockingDuration: numberFromInput(
        getRecordString(merged, ['blockingDuration', 'blockingDurationMs'])
      ),
      eventTarget: getRecordString(merged, [
        'eventTarget',
        'interactionTarget',
        'target',
        'selector'
      ]),
      eventType: normalizeEventType(getRecordString(merged, ['eventType', 'type'])),
      handlerName: getRecordString(merged, ['handler', 'handlerName', 'invoker']),
      inpMs: numberFromInput(inp),
      inputDelay: numberFromInput(getRecordString(merged, ['inputDelay', 'inputDelayMs'])),
      interactionTime: numberFromInput(getRecordString(merged, ['interactionTime', 'startTime'])),
      longAnimationFrame: numberFromInput(
        getRecordString(merged, [
          'longAnimationFrameDuration',
          'longAnimationFrame',
          'loaf',
          'loafMs'
        ])
      ),
      presentationDelay: numberFromInput(
        getRecordString(merged, ['presentationDelay', 'presentationDelayMs'])
      ),
      processingDuration: numberFromInput(
        getRecordString(merged, ['processingDuration', 'processingDurationMs'])
      ),
      route: getRecordString(merged, ['route', 'path', 'routePattern']),
      scriptUrl: getRecordString(merged, ['scriptUrl', 'sourceUrl', 'url']),
      source: 'json'
    })
  }

  ;['items', 'entries', 'events', 'metrics', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonEvents(record[key], events)
  })
}

const parseJsonEvents = (input: string): { errors: string[]; events: ParsedInpEvent[] } => {
  const errors: string[] = []
  const events: ParsedInpEvent[] = []
  const trimmedInput = input.trim()

  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonEvents(JSON.parse(trimmedInput) as unknown, events)
      return { errors, events }
    } catch {
      // Mixed workspaces can still recover useful JSONL rows.
    }
  }

  input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))
    .forEach((row, index) => {
      try {
        collectJsonEvents(JSON.parse(row) as unknown, events)
      } catch {
        errors.push(`json:${index + 1}`)
      }
    })

  return { errors, events }
}

const parseTextEvents = (input: string): ParsedInpEvent[] => {
  const events: ParsedInpEvent[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    const textMatch = trimmed.match(/\bINP\b[^0-9]*(\d+(?:\.\d+)?)\s*(ms|s)?/iu)
    const inp =
      tokenValue(trimmed, 'inp') ||
      (textMatch ? parseTimingValue(textMatch[1] ?? '', textMatch[2]).toString() : '')
    const processing =
      tokenValue(trimmed, 'processing') || tokenValue(trimmed, 'processingDuration')
    if (!inp && !processing) return
    addEvent(events, {
      blockingDuration: numberFromInput(tokenValue(trimmed, 'blocking')),
      eventTarget: tokenValue(trimmed, 'target') || tokenValue(trimmed, 'eventTarget'),
      eventType: normalizeEventType(
        tokenValue(trimmed, 'event') || tokenValue(trimmed, 'eventType')
      ),
      handlerName: tokenValue(trimmed, 'handler') || tokenValue(trimmed, 'invoker'),
      inpMs: numberFromInput(inp),
      inputDelay: numberFromInput(
        tokenValue(trimmed, 'input') || tokenValue(trimmed, 'inputDelay')
      ),
      interactionTime: numberFromInput(tokenValue(trimmed, 'interactionTime')),
      longAnimationFrame: numberFromInput(
        tokenValue(trimmed, 'loaf') || tokenValue(trimmed, 'longAnimationFrame')
      ),
      presentationDelay: numberFromInput(
        tokenValue(trimmed, 'presentation') || tokenValue(trimmed, 'presentationDelay')
      ),
      processingDuration: numberFromInput(processing),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      scriptUrl:
        tokenValue(trimmed, 'script') ||
        tokenValue(trimmed, 'scriptUrl') ||
        tokenValue(trimmed, 'url'),
      source: 'text'
    })
  })
  return events
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonEvents(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    events: [...json.events, ...parseTextEvents(source)].slice(0, EVENT_LIMIT)
  }
}

const draftEvent = (draft: InpDraft): ParsedInpEvent => ({
  blockingDuration: numberFromInput(draft.blockingDurationMs),
  eventTarget: draft.eventTarget,
  eventType: draft.eventType,
  handlerName: draft.handlerName,
  id: 'manual-draft',
  inpMs: numberFromInput(draft.inpMs),
  inputDelay: numberFromInput(draft.inputDelayMs),
  interactionTime: numberFromInput(draft.interactionTimeMs),
  longAnimationFrame: numberFromInput(draft.longAnimationFrameMs),
  presentationDelay: numberFromInput(draft.presentationDelayMs),
  processingDuration: numberFromInput(draft.processingDurationMs),
  route: draft.routePattern,
  scriptUrl: draft.scriptUrl,
  source: 'manual'
})

const segmentTotals = (event: ParsedInpEvent) => ({
  inputDelay: event.inputDelay,
  presentationDelay: event.presentationDelay,
  processingDuration: event.processingDuration
})

const dominantSegment = (event: ParsedInpEvent): SegmentKey => {
  const segments = segmentTotals(event)
  return (Object.entries(segments) as Array<[SegmentKey, number]>).reduce((winner, current) =>
    current[1] > winner[1] ? current : winner
  )[0]
}

const ratingForInp = (value: number) => {
  if (value > 500) return 'poor'
  if (value > 200) return 'needs_improvement'
  return 'good'
}

const auditEvent = (
  event: ParsedInpEvent,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  const sum = event.inputDelay + event.processingDuration + event.presentationDelay
  if (event.inpMs > 500) add('danger', `${prefix}inp_poor`, `${event.inpMs}ms`)
  else if (event.inpMs > 200) add('warn', `${prefix}inp_needs_work`, `${event.inpMs}ms`)
  if (!event.eventTarget.trim()) add('warn', `${prefix}missing_target`, event.route || event.id)
  if (event.eventType === 'other')
    add('warn', `${prefix}missing_event_type`, event.route || event.id)
  if (event.inputDelay > 80) add('warn', `${prefix}input_delay_high`, `${event.inputDelay}ms`)
  if (event.processingDuration > 500)
    add('danger', `${prefix}processing_severe`, `${event.processingDuration}ms`)
  else if (event.processingDuration > 200)
    add('warn', `${prefix}processing_high`, `${event.processingDuration}ms`)
  if (event.presentationDelay > 160)
    add('warn', `${prefix}presentation_high`, `${event.presentationDelay}ms`)
  if (event.longAnimationFrame > 500)
    add('danger', `${prefix}loaf_severe`, `${event.longAnimationFrame}ms`)
  else if (event.longAnimationFrame > 200)
    add('warn', `${prefix}loaf_high`, `${event.longAnimationFrame}ms`)
  if (event.blockingDuration > 250)
    add('warn', `${prefix}blocking_high`, `${event.blockingDuration}ms`)
  if (sum && event.inpMs && Math.abs(sum - event.inpMs) > 80)
    add('warn', `${prefix}segment_mismatch`, `${sum}ms`)
  if (isHttpUrl(event.scriptUrl)) add('danger', `${prefix}http_script`, event.scriptUrl)
  if (isPrivateUrl(event.scriptUrl)) add('warn', `${prefix}private_script_url`, event.scriptUrl)
}

const auditInp = (draft: InpDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftEvent(draft)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (!/^p75$/iu.test(draft.percentile.trim())) add('warn', 'percentile_not_p75', draft.percentile)
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  if (draft.hydrationBlocking) add('warn', 'hydration_blocking', draft.routePattern)
  if (draft.networkDuringInput) add('warn', 'network_during_input', draft.routePattern)
  if (draft.thirdPartyScript)
    add('warn', 'third_party_script', draft.scriptUrl || draft.routePattern)
  if (/keydown|input/iu.test(draft.eventType) && manual.processingDuration > 150)
    add('warn', 'typing_handler', draft.eventType)
  auditEvent(manual, add)

  parsed.events.forEach(event => auditEvent(event, add, true))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.events.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'dominant_ok', dominantSegment(manual))
    add('good', 'target_ok', draft.eventTarget)
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

const buildObserver = (draft: InpDraft) =>
  [
    'const observer = new PerformanceObserver((list) => {',
    '  for (const entry of list.getEntries()) {',
    '    if (!entry.interactionId) continue',
    '    console.log({',
    '      name: entry.name,',
    '      duration: Math.round(entry.duration),',
    '      startTime: Math.round(entry.startTime),',
    '      target: entry.target?.outerHTML?.slice(0, 160)',
    '    })',
    '  }',
    '})',
    "observer.observe({ type: 'event', buffered: true, durationThreshold: 40 })",
    '',
    `// Route: ${draft.routePattern}`
  ].join('\n')

const buildNext = (draft: InpDraft) =>
  [
    "import { onINP } from 'web-vitals/attribution'",
    '',
    'export function reportWebVitals() {',
    '  onINP(metric => {',
    "    navigator.sendBeacon('/vitals', JSON.stringify({",
    '      name: metric.name,',
    '      value: Math.round(metric.value),',
    `      route: '${escapeJs(draft.routePattern)}',`,
    '      attribution: metric.attribution',
    '    }))',
    '  })',
    '}'
  ].join('\n')

const buildTimeline = (draft: InpDraft) => {
  const event = draftEvent(draft)
  return [
    `0ms input delay: ${event.inputDelay}ms`,
    `${event.inputDelay}ms processing: ${event.processingDuration}ms`,
    `${event.inputDelay + event.processingDuration}ms presentation delay: ${event.presentationDelay}ms`,
    `${event.inpMs}ms INP total for ${draft.eventType} on ${draft.eventTarget || 'unknown target'}`
  ].join('\n')
}

const buildPlaybook = (draft: InpDraft) =>
  [
    `# INP playbook for ${draft.routePattern}`,
    '',
    `1. Confirm p75 field INP for ${draft.device} users.`,
    `2. Reproduce the ${draft.eventType} interaction on ${draft.eventTarget || 'the reported target'}.`,
    `3. If input delay dominates, reduce queued work before the event.`,
    `4. If processing dominates, split ${draft.handlerName || 'the handler'} and defer non-urgent work.`,
    '5. If presentation delay dominates, inspect render, style, layout, and paint after the handler.',
    draft.scriptUrl
      ? `6. Attribute script cost to ${draft.scriptUrl}.`
      : '6. Attribute script cost from Event Timing or LoAF data.'
  ].join('\n')

const buildMarkdown = (draft: InpDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# INP breakdown: ${draft.routePattern}`,
    '',
    `- INP: ${draft.inpMs}ms`,
    `- Input delay: ${draft.inputDelayMs}ms`,
    `- Processing: ${draft.processingDurationMs}ms`,
    `- Presentation: ${draft.presentationDelayMs}ms`,
    `- Event: ${draft.eventType} / ${draft.eventTarget || '-'}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed events',
    ...parsed.events
      .slice(0, 24)
      .map(
        event =>
          `- ${event.route || '-'} / ${event.eventType} / ${event.inpMs}ms / ${event.eventTarget || '-'}`
      )
  ].join('\n')

const buildCsv = (draft: InpDraft, parsed: ParsedWorkspace) => {
  const rows = [draftEvent(draft), ...parsed.events]
  return [
    [
      'source',
      'route',
      'event_type',
      'target',
      'inp_ms',
      'input_delay_ms',
      'processing_ms',
      'presentation_ms',
      'loaf_ms',
      'blocking_ms',
      'script_url',
      'handler'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(event =>
      [
        event.source,
        event.route,
        event.eventType,
        event.eventTarget,
        event.inpMs,
        event.inputDelay,
        event.processingDuration,
        event.presentationDelay,
        event.longAnimationFrame,
        event.blockingDuration,
        event.scriptUrl,
        event.handlerName
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: InpDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'observer') return buildObserver(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'timeline') return buildTimeline(draft)
  if (outputType === 'playbook') return buildPlaybook(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, events: parsed.events }, null, 2)
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

export default function InpBreakdownClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<InpDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('observer')
  const [auditQuery, setAuditQuery] = useState('')
  const [eventQuery, setEventQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredEventQuery = useDeferredValue(eventQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditInp(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const rows = useMemo(() => [draftEvent(draft), ...parsed.events], [draft, parsed.events])
  const currentEvent = useMemo(() => draftEvent(draft), [draft])
  const dominant = useMemo(() => dominantSegment(currentEvent), [currentEvent])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.inp_breakdown.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredEventQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(event =>
      `${event.route} ${event.eventTarget} ${event.eventType} ${event.scriptUrl} ${event.handlerName}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredEventQuery, rows])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      dominant: t(`app.converter.inp_breakdown.segment.${dominant}`),
      events: rows.length,
      rating: t(`app.converter.inp_breakdown.rating.${ratingForInp(currentEvent.inpMs)}`),
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [currentEvent.inpMs, dominant, findings, rows.length, score, t]
  )

  const updateDraft = <Key extends keyof InpDraft>(key: Key, value: InpDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('observer')
    setAuditQuery('')
    setEventQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.inp_breakdown.summary_title'),
        `${t('app.converter.inp_breakdown.metric.score')}: ${metrics.score}`,
        `${t('app.converter.inp_breakdown.metric.rating')}: ${metrics.rating}`,
        `${t('app.converter.inp_breakdown.metric.dominant')}: ${metrics.dominant}`,
        `${t('app.converter.inp_breakdown.metric.events')}: ${metrics.events}`,
        `${t('app.converter.inp_breakdown.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.inp_breakdown.metric.critical')}: ${metrics.critical}`
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
                <MousePointer2 className="h-4 w-4" />
                {t('app.converter.inp-breakdown')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.inp-breakdown')}</CardTitle>
              <CardDescription>{t('app.converter.inp_breakdown.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.inp_breakdown.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.inp_breakdown.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.inp_breakdown.metric.rating')} value={metrics.rating} />
            <Metric
              label={t('app.converter.inp_breakdown.metric.dominant')}
              value={metrics.dominant}
            />
            <Metric label={t('app.converter.inp_breakdown.metric.events')} value={metrics.events} />
            <Metric
              label={t('app.converter.inp_breakdown.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.inp_breakdown.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.inp_breakdown.presets')}</CardTitle>
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
                {t(`app.converter.inp_breakdown.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.inp_breakdown.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.inp_breakdown.model')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.inp_breakdown.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inp-route">{t('app.converter.inp_breakdown.route_pattern')}</Label>
                <Input
                  id="inp-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-device">{t('app.converter.inp_breakdown.device')}</Label>
                <Select
                  id="inp-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.inp_breakdown.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-value">{t('app.converter.inp_breakdown.inp_ms')}</Label>
                <Input
                  id="inp-value"
                  value={draft.inpMs}
                  onChange={event => updateDraft('inpMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-percentile">
                  {t('app.converter.inp_breakdown.percentile')}
                </Label>
                <Input
                  id="inp-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value.slice(0, 12))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-input-delay">
                  {t('app.converter.inp_breakdown.input_delay_ms')}
                </Label>
                <Input
                  id="inp-input-delay"
                  value={draft.inputDelayMs}
                  onChange={event => updateDraft('inputDelayMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-processing">
                  {t('app.converter.inp_breakdown.processing_ms')}
                </Label>
                <Input
                  id="inp-processing"
                  value={draft.processingDurationMs}
                  onChange={event =>
                    updateDraft('processingDurationMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-presentation">
                  {t('app.converter.inp_breakdown.presentation_ms')}
                </Label>
                <Input
                  id="inp-presentation"
                  value={draft.presentationDelayMs}
                  onChange={event =>
                    updateDraft('presentationDelayMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-interaction">
                  {t('app.converter.inp_breakdown.interaction_time_ms')}
                </Label>
                <Input
                  id="inp-interaction"
                  value={draft.interactionTimeMs}
                  onChange={event =>
                    updateDraft('interactionTimeMs', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-event">{t('app.converter.inp_breakdown.event_type')}</Label>
                <Select
                  id="inp-event"
                  value={draft.eventType}
                  onChange={event => updateDraft('eventType', event.target.value as EventType)}
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.inp_breakdown.event.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-target">{t('app.converter.inp_breakdown.event_target')}</Label>
                <Input
                  id="inp-target"
                  value={draft.eventTarget}
                  onChange={event => updateDraft('eventTarget', event.target.value.slice(0, 220))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-handler">{t('app.converter.inp_breakdown.handler_name')}</Label>
                <Input
                  id="inp-handler"
                  value={draft.handlerName}
                  onChange={event => updateDraft('handlerName', event.target.value.slice(0, 160))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-script">{t('app.converter.inp_breakdown.script_url')}</Label>
                <Input
                  id="inp-script"
                  value={draft.scriptUrl}
                  onChange={event => updateDraft('scriptUrl', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-loaf">{t('app.converter.inp_breakdown.loaf_ms')}</Label>
                <Input
                  id="inp-loaf"
                  value={draft.longAnimationFrameMs}
                  onChange={event =>
                    updateDraft('longAnimationFrameMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-blocking">{t('app.converter.inp_breakdown.blocking_ms')}</Label>
                <Input
                  id="inp-blocking"
                  value={draft.blockingDurationMs}
                  onChange={event =>
                    updateDraft('blockingDurationMs', event.target.value.slice(0, 8))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inp-samples">{t('app.converter.inp_breakdown.sample_count')}</Label>
                <Input
                  id="inp-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Checkbox
                checked={draft.hydrationBlocking}
                onChange={event => updateDraft('hydrationBlocking', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.inp_breakdown.hydration_blocking')}
              />
              <Checkbox
                checked={draft.networkDuringInput}
                onChange={event => updateDraft('networkDuringInput', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.inp_breakdown.network_during_input')}
              />
              <Checkbox
                checked={draft.thirdPartyScript}
                onChange={event => updateDraft('thirdPartyScript', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.inp_breakdown.third_party_script')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.inp_breakdown.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.inp_breakdown.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.inp_breakdown.workspace_placeholder')}
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
              <CardTitle className="text-base">{t('app.converter.inp_breakdown.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.inp_breakdown.audit_search')}
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
                      {t(`app.converter.inp_breakdown.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.inp_breakdown.level.${finding.level}`)}
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
                  {t('app.converter.inp_breakdown.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.inp_breakdown.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="inp-output">{t('app.converter.inp_breakdown.output_type')}</Label>
                <Select
                  id="inp-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.inp_breakdown.output.${type}`)}
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
                {t('app.converter.inp_breakdown.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'inp-breakdown-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.inp_breakdown.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'inp-breakdown.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.inp_breakdown.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.inp_breakdown.events')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={eventQuery}
                onChange={event => setEventQuery(event.target.value)}
                placeholder={t('app.converter.inp_breakdown.event_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(event => (
                  <div key={event.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {event.eventTarget || event.route || '-'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(ratingForInp(event.inpMs) === 'poor' ? 'danger' : ratingForInp(event.inpMs) === 'needs_improvement' ? 'warn' : 'good')}`}
                      >
                        {event.inpMs}ms
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.inp_breakdown.event.${event.eventType}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.inp_breakdown.source.${event.source}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.inp_breakdown.segment.${dominantSegment(event)}`)}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {event.inputDelay} / {event.processingDuration} / {event.presentationDelay}ms
                      / {event.scriptUrl || event.handlerName || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.inp_breakdown.empty')}
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
                  {t('app.converter.inp_breakdown.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.inp_breakdown.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.inp_breakdown.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.inp_breakdown.reference.${item}_hint`)}
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
                  {t('app.converter.inp_breakdown.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.inp_breakdown.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.inp_breakdown.checklist.${item}.body`)}
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
