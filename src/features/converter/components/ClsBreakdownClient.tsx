'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  Move,
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
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'

const DEVICES = ['mobile', 'desktop'] as const
const IMPACT_TYPES = [
  'image',
  'ad',
  'embed',
  'font',
  'animation',
  'insertion',
  'cookie_banner',
  'other'
] as const
const LOAD_STATES = ['loading', 'dom-interactive', 'complete', 'after-load', 'unknown'] as const
const OUTPUT_TYPES = [
  'observer',
  'next',
  'reserve_css',
  'playbook',
  'markdown',
  'json',
  'csv'
] as const
const WORKSPACE_LIMIT = 90000
const SHIFT_LIMIT = 180

type Device = (typeof DEVICES)[number]
type ImpactType = (typeof IMPACT_TYPES)[number]
type LoadState = (typeof LOAD_STATES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ParsedSource = 'json' | 'manual' | 'text'

interface ClsDraft {
  animationShift: boolean
  bfcacheSegment: boolean
  clsScore: string
  device: Device
  expectedHeight: string
  expectedWidth: string
  fontSwap: boolean
  hadRecentInput: boolean
  impactType: ImpactType
  lateInsertion: boolean
  loadState: LoadState
  percentile: string
  reservedSpacePx: string
  rootCause: string
  routePattern: string
  sampleCount: string
  sessionWindowMs: string
  shiftTarget: string
  shiftTimeMs: string
  shiftValue: string
  thirdPartyEmbed: boolean
  viewportHeight: string
  viewportWidth: string
}

interface ParsedShift {
  clsScore: number
  expectedHeight: number
  expectedWidth: number
  hadRecentInput: boolean
  id: string
  impactType: ImpactType
  loadState: LoadState
  reservedSpace: number
  route: string
  shiftTarget: string
  shiftTime: number
  shiftValue: number
  source: ParsedSource
}

interface ParsedWorkspace {
  errors: string[]
  shifts: ParsedShift[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: ClsDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: ClsDraft = {
  animationShift: false,
  bfcacheSegment: false,
  clsScore: '0.06',
  device: 'mobile',
  expectedHeight: '320',
  expectedWidth: '599',
  fontSwap: false,
  hadRecentInput: false,
  impactType: 'image',
  lateInsertion: false,
  loadState: 'complete',
  percentile: 'p75',
  reservedSpacePx: '320',
  rootCause: 'Hero image has fixed dimensions and reserved aspect-ratio.',
  routePattern: '/products/:slug',
  sampleCount: '1600',
  sessionWindowMs: '1800',
  shiftTarget: 'main img[data-hero]',
  shiftTimeMs: '1240',
  shiftValue: '0.04',
  thirdPartyEmbed: false,
  viewportHeight: '844',
  viewportWidth: '390'
}

const PRESETS: Preset[] = [
  {
    key: 'healthy_image',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"name":"CLS","value":0.06,"rating":"good","route":"/products/example","attribution":{"largestShiftTarget":"main img[data-hero]","largestShiftValue":0.04,"largestShiftTime":1240,"loadState":"complete"}}',
      'cls=0.06 value=0.04 target=main img[data-hero] route=/products/example load=complete reserved=320 width=599 height=320'
    ].join('\n')
  },
  {
    key: 'ad_slot',
    draft: {
      ...DEFAULT_DRAFT,
      clsScore: '0.18',
      expectedHeight: '280',
      expectedWidth: '336',
      impactType: 'ad',
      reservedSpacePx: '0',
      rootCause: 'Ad creative injects after content without a reserved slot.',
      routePattern: '/news/:slug',
      shiftTarget: 'iframe.ad-slot',
      shiftTimeMs: '2210',
      shiftValue: '0.13',
      thirdPartyEmbed: true
    },
    workspace: [
      '{"name":"CLS","value":0.18,"rating":"needs-improvement","route":"/news/story","attribution":{"largestShiftTarget":"iframe.ad-slot","largestShiftValue":0.13,"largestShiftTime":2210,"loadState":"complete"}}',
      'CLS 0.18 target=iframe.ad-slot route=/news/story value=0.13 reserved=0 width=336 height=280'
    ].join('\n')
  },
  {
    key: 'font_swap',
    draft: {
      ...DEFAULT_DRAFT,
      clsScore: '0.14',
      expectedHeight: '0',
      expectedWidth: '0',
      fontSwap: true,
      impactType: 'font',
      reservedSpacePx: '0',
      rootCause: 'Web font metrics differ from fallback text metrics.',
      routePattern: '/docs',
      shiftTarget: 'h1.article-title',
      shiftTimeMs: '860',
      shiftValue: '0.09'
    },
    workspace: [
      '{"name":"CLS","value":0.14,"route":"/docs","attribution":{"largestShiftTarget":"h1.article-title","largestShiftValue":0.09,"largestShiftTime":860,"loadState":"dom-interactive","impactType":"font"}}',
      'cls=0.14 value=0.09 target=h1.article-title route=/docs font=true'
    ].join('\n')
  },
  {
    key: 'cookie_banner',
    draft: {
      ...DEFAULT_DRAFT,
      clsScore: '0.21',
      impactType: 'cookie_banner',
      lateInsertion: true,
      reservedSpacePx: '0',
      rootCause: 'Consent banner pushes layout after the first viewport renders.',
      routePattern: '/landing',
      shiftTarget: '.consent-banner',
      shiftTimeMs: '3100',
      shiftValue: '0.16'
    },
    workspace: [
      '{"name":"CLS","value":0.21,"route":"/landing","attribution":{"largestShiftTarget":".consent-banner","largestShiftValue":0.16,"largestShiftTime":3100,"loadState":"after-load"}}',
      'CLS 0.21 target=.consent-banner route=/landing value=0.16 load=after-load late=true'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      animationShift: true,
      bfcacheSegment: true,
      clsScore: '0.36',
      device: 'mobile',
      expectedHeight: '0',
      expectedWidth: '0',
      fontSwap: true,
      hadRecentInput: true,
      impactType: 'embed',
      lateInsertion: true,
      loadState: 'loading',
      percentile: 'p95',
      reservedSpacePx: '0',
      rootCause: '',
      routePattern: '/checkout',
      sampleCount: '38',
      sessionWindowMs: '4800',
      shiftTarget: '',
      shiftTimeMs: '4200',
      shiftValue: '0.24',
      thirdPartyEmbed: true,
      viewportHeight: '844',
      viewportWidth: '390'
    },
    workspace: [
      '{"name":"CLS","value":0.36,"rating":"poor","route":"/checkout","attribution":{"largestShiftTarget":"","largestShiftValue":0.24,"largestShiftTime":4200,"loadState":"loading","hadRecentInput":true,"sources":[{"node":"iframe#ad","previousRect":{"width":320,"height":0},"currentRect":{"width":320,"height":250}}]}}',
      'cls=0.36 value=0.24 target=iframe#ad route=/checkout load=loading reserved=0 width=320 height=250 hadRecentInput=true',
      'CLS 0.36 target=.font-swap route=/checkout value=0.12 font=true late=true'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['cls', 'target', 'reservation', 'fonts', 'animation', 'field'] as const
const CHECKLIST_ITEMS = ['reserve', 'attribute', 'exclude', 'regress'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 3) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeCss = (value: string) => value.replace(/[{};]/gu, '').trim() || '.shift-source'

const normalizeLoadState = (value: unknown): LoadState => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return LOAD_STATES.includes(token as LoadState) ? (token as LoadState) : 'unknown'
}

const normalizeImpactType = (value: unknown, target = ''): ImpactType => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]/gu, '_')
  if (IMPACT_TYPES.includes(token as ImpactType)) return token as ImpactType
  if (/ad|iframe|slot|gpt|doubleclick/iu.test(target)) return 'ad'
  if (/embed|video|map|player|widget/iu.test(target)) return 'embed'
  if (/img|image|picture|hero|avatar/iu.test(target)) return 'image'
  if (/font|title|heading|text|copy/iu.test(target)) return 'font'
  if (/cookie|consent|banner|toast/iu.test(target)) return 'cookie_banner'
  if (/animation|animate|transition/iu.test(target)) return 'animation'
  if (/insert|late|modal|drawer/iu.test(target)) return 'insertion'
  return 'other'
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
    if (typeof value === 'boolean') return String(value)
  }
  return ''
}

const boolFromValue = (value: unknown) => /^(true|1|yes)$/iu.test(String(value ?? '').trim())

const extractAttribution = (record: Record<string, unknown>) => {
  const nested =
    typeof record.attribution === 'object' && record.attribution
      ? (record.attribution as Record<string, unknown>)
      : {}
  return { ...record, ...nested }
}

const firstSourceRecord = (record: Record<string, unknown>) => {
  const sources = record.sources
  if (!Array.isArray(sources) || !sources.length || typeof sources[0] !== 'object' || !sources[0])
    return {}
  const source = sources[0] as Record<string, unknown>
  const previousRect =
    typeof source.previousRect === 'object' && source.previousRect
      ? (source.previousRect as Record<string, unknown>)
      : {}
  const currentRect =
    typeof source.currentRect === 'object' && source.currentRect
      ? (source.currentRect as Record<string, unknown>)
      : {}
  return {
    ...source,
    previousHeight: previousRect.height,
    previousWidth: previousRect.width,
    currentHeight: currentRect.height,
    currentWidth: currentRect.width
  }
}

const addShift = (shifts: ParsedShift[], shift: Omit<ParsedShift, 'id'>) => {
  if (!shift.clsScore && !shift.shiftValue && !shift.shiftTarget && !shift.route) return
  shifts.push({
    ...shift,
    id: `${shift.source}-${shifts.length}-${shift.route || shift.shiftTarget || shift.clsScore}`
  })
}

const collectJsonShifts = (value: unknown, shifts: ParsedShift[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonShifts(item, shifts))
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const merged = extractAttribution(record)
  const source = firstSourceRecord(merged)
  const combined = { ...merged, ...source }
  const metric = getRecordString(combined, ['name', 'metric', 'metricName']).toUpperCase()
  const cls = getRecordString(combined, ['value', 'cls', 'clsScore'])
  const target = getRecordString(combined, [
    'largestShiftTarget',
    'target',
    'selector',
    'node',
    'shiftTarget'
  ])
  const impactType = normalizeImpactType(
    getRecordString(combined, ['impactType', 'cause', 'type']),
    target
  )

  if (metric === 'CLS' || cls || getRecordString(combined, ['largestShiftValue', 'shiftValue'])) {
    addShift(shifts, {
      clsScore: round(numberFromInput(cls)),
      expectedHeight: numberFromInput(
        getRecordString(combined, ['height', 'currentHeight', 'expectedHeight'])
      ),
      expectedWidth: numberFromInput(
        getRecordString(combined, ['width', 'currentWidth', 'expectedWidth'])
      ),
      hadRecentInput: boolFromValue(getRecordString(combined, ['hadRecentInput'])),
      impactType,
      loadState: normalizeLoadState(getRecordString(combined, ['loadState'])),
      reservedSpace: numberFromInput(
        getRecordString(combined, ['reservedSpace', 'reservedSpacePx', 'previousHeight'])
      ),
      route: getRecordString(combined, ['route', 'path', 'routePattern']),
      shiftTarget: target,
      shiftTime: numberFromInput(
        getRecordString(combined, ['largestShiftTime', 'shiftTime', 'startTime'])
      ),
      shiftValue: round(
        numberFromInput(getRecordString(combined, ['largestShiftValue', 'shiftValue', 'value']))
      ),
      source: 'json'
    })
  }

  ;['items', 'entries', 'events', 'metrics', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonShifts(record[key], shifts)
  })
}

const parseJsonShifts = (input: string): { errors: string[]; shifts: ParsedShift[] } => {
  const errors: string[] = []
  const shifts: ParsedShift[] = []
  const trimmedInput = input.trim()

  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonShifts(JSON.parse(trimmedInput) as unknown, shifts)
      return { errors, shifts }
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
        collectJsonShifts(JSON.parse(row) as unknown, shifts)
      } catch {
        errors.push(`json:${index + 1}`)
      }
    })

  return { errors, shifts }
}

const parseTextShifts = (input: string): ParsedShift[] => {
  const shifts: ParsedShift[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    const textMatch = trimmed.match(/\bCLS\b[^0-9]*(\d+(?:\.\d+)?)/iu)
    const cls = tokenValue(trimmed, 'cls') || (textMatch ? (textMatch[1] ?? '') : '')
    const value =
      tokenValue(trimmed, 'value') ||
      tokenValue(trimmed, 'shift') ||
      tokenValue(trimmed, 'largestShiftValue')
    if (!cls && !value) return
    const target =
      tokenValue(trimmed, 'target') ||
      tokenValue(trimmed, 'selector') ||
      tokenValue(trimmed, 'node')
    const impactType = normalizeImpactType(
      tokenValue(trimmed, 'impact') || tokenValue(trimmed, 'type'),
      target
    )
    addShift(shifts, {
      clsScore: round(numberFromInput(cls)),
      expectedHeight: numberFromInput(tokenValue(trimmed, 'height')),
      expectedWidth: numberFromInput(tokenValue(trimmed, 'width')),
      hadRecentInput: boolFromValue(
        tokenValue(trimmed, 'hadRecentInput') || tokenValue(trimmed, 'recentInput')
      ),
      impactType,
      loadState: normalizeLoadState(
        tokenValue(trimmed, 'load') || tokenValue(trimmed, 'loadState')
      ),
      reservedSpace: numberFromInput(
        tokenValue(trimmed, 'reserved') || tokenValue(trimmed, 'reservedSpace')
      ),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      shiftTarget: target,
      shiftTime: numberFromInput(tokenValue(trimmed, 'time') || tokenValue(trimmed, 'shiftTime')),
      shiftValue: round(numberFromInput(value || cls)),
      source: 'text'
    })
  })
  return shifts
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonShifts(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    shifts: [...json.shifts, ...parseTextShifts(source)].slice(0, SHIFT_LIMIT)
  }
}

const draftShift = (draft: ClsDraft): ParsedShift => ({
  clsScore: round(numberFromInput(draft.clsScore)),
  expectedHeight: numberFromInput(draft.expectedHeight),
  expectedWidth: numberFromInput(draft.expectedWidth),
  hadRecentInput: draft.hadRecentInput,
  id: 'manual-draft',
  impactType: draft.impactType,
  loadState: draft.loadState,
  reservedSpace: numberFromInput(draft.reservedSpacePx),
  route: draft.routePattern,
  shiftTarget: draft.shiftTarget,
  shiftTime: numberFromInput(draft.shiftTimeMs),
  shiftValue: round(numberFromInput(draft.shiftValue)),
  source: 'manual'
})

const ratingForCls = (value: number) => {
  if (value > 0.25) return 'poor'
  if (value > 0.1) return 'needs_improvement'
  return 'good'
}

const auditShift = (
  shift: ParsedShift,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  if (shift.clsScore > 0.25) add('danger', `${prefix}cls_poor`, String(shift.clsScore))
  else if (shift.clsScore > 0.1) add('warn', `${prefix}cls_needs_work`, String(shift.clsScore))
  if (!shift.shiftTarget.trim()) add('warn', `${prefix}missing_target`, shift.route || shift.id)
  if (shift.shiftValue > 0.1)
    add(
      shift.shiftValue > 0.2 ? 'danger' : 'warn',
      `${prefix}large_shift_value`,
      String(shift.shiftValue)
    )
  if (shift.loadState === 'loading' || shift.loadState === 'dom-interactive')
    add('warn', `${prefix}early_load_state`, shift.loadState)
  if (
    shift.reservedSpace <= 0 &&
    ['ad', 'cookie_banner', 'embed', 'image'].includes(shift.impactType)
  )
    add('warn', `${prefix}no_reserved_space`, shift.shiftTarget || shift.impactType)
  if (
    (shift.expectedHeight <= 0 || shift.expectedWidth <= 0) &&
    ['ad', 'embed', 'image'].includes(shift.impactType)
  )
    add('warn', `${prefix}missing_dimensions`, shift.shiftTarget || shift.impactType)
  if (shift.impactType === 'ad' || shift.impactType === 'embed')
    add('warn', `${prefix}ad_embed_shift`, shift.shiftTarget || shift.impactType)
  if (shift.impactType === 'font')
    add('warn', `${prefix}font_shift`, shift.shiftTarget || shift.impactType)
  if (shift.impactType === 'animation')
    add('warn', `${prefix}animation_shift`, shift.shiftTarget || shift.impactType)
  if (shift.hadRecentInput)
    add('warn', `${prefix}recent_input_excluded`, shift.shiftTarget || shift.id)
}

const auditCls = (draft: ClsDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftShift(draft)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (!/^p75$/iu.test(draft.percentile.trim())) add('warn', 'percentile_not_p75', draft.percentile)
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  if (!draft.rootCause.trim()) add('warn', 'missing_root_cause', draft.routePattern)
  if (draft.lateInsertion) add('warn', 'late_insertion', draft.shiftTarget || draft.routePattern)
  if (draft.fontSwap) add('warn', 'font_swap', draft.shiftTarget || draft.routePattern)
  if (draft.animationShift) add('warn', 'animation', draft.shiftTarget || draft.routePattern)
  if (draft.thirdPartyEmbed)
    add('warn', 'third_party_embed', draft.shiftTarget || draft.routePattern)
  if (draft.bfcacheSegment) add('warn', 'bfcache_segment', draft.routePattern)
  auditShift(manual, add)

  parsed.shifts.forEach(shift => auditShift(shift, add, true))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.shifts.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'target_ok', draft.shiftTarget)
    add('good', 'reservation_ok', `${draft.reservedSpacePx}px`)
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

const buildObserver = (draft: ClsDraft) =>
  [
    'const observer = new PerformanceObserver((list) => {',
    '  for (const entry of list.getEntries()) {',
    '    if (entry.hadRecentInput) continue',
    '    console.log({',
    '      value: entry.value,',
    '      startTime: Math.round(entry.startTime),',
    '      sources: entry.sources?.map(source => ({',
    '        node: source.node?.nodeName,',
    '        previousRect: source.previousRect,',
    '        currentRect: source.currentRect',
    '      }))',
    '    })',
    '  }',
    '})',
    "observer.observe({ type: 'layout-shift', buffered: true })",
    '',
    `// Route: ${draft.routePattern}`
  ].join('\n')

const buildNext = (draft: ClsDraft) =>
  [
    "import { onCLS } from 'web-vitals/attribution'",
    '',
    'export function reportWebVitals() {',
    '  onCLS(metric => {',
    "    navigator.sendBeacon('/vitals', JSON.stringify({",
    '      name: metric.name,',
    '      value: metric.value,',
    `      route: '${draft.routePattern.replaceAll("'", "\\'")}',`,
    '      attribution: metric.attribution',
    '    }))',
    '  })',
    '}'
  ].join('\n')

const buildReserveCss = (draft: ClsDraft) => {
  const selector = escapeCss(draft.shiftTarget)
  const width = Math.max(1, numberFromInput(draft.expectedWidth))
  const height = Math.max(1, numberFromInput(draft.expectedHeight))
  const minHeight = Math.max(numberFromInput(draft.reservedSpacePx), height)
  return [
    `${selector} {`,
    `  min-height: ${minHeight}px;`,
    `  aspect-ratio: ${width} / ${height};`,
    '  contain: layout paint;',
    '}',
    '',
    '@media (max-width: 640px) {',
    `  ${selector} { min-height: ${Math.round(minHeight * 0.72)}px; }`,
    '}'
  ].join('\n')
}

const buildPlaybook = (draft: ClsDraft) =>
  [
    `# CLS playbook for ${draft.routePattern}`,
    '',
    `1. Confirm p75 field CLS for ${draft.device} users.`,
    `2. Reproduce the largest shift on ${draft.shiftTarget || 'the reported target'}.`,
    '3. Reserve space before the element enters the viewport.',
    '4. Add width/height or aspect-ratio for images, embeds, and ad slots.',
    '5. Use metric-compatible font fallbacks and avoid layout-affecting animations.',
    draft.rootCause
      ? `6. Current hypothesis: ${draft.rootCause}`
      : '6. Capture an owner and root-cause hypothesis before shipping.'
  ].join('\n')

const buildMarkdown = (draft: ClsDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# CLS breakdown: ${draft.routePattern}`,
    '',
    `- CLS: ${draft.clsScore}`,
    `- Largest shift: ${draft.shiftValue}`,
    `- Target: ${draft.shiftTarget || '-'}`,
    `- Reserved space: ${draft.reservedSpacePx}px`,
    `- Load state: ${draft.loadState}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed shifts',
    ...parsed.shifts
      .slice(0, 24)
      .map(
        shift =>
          `- ${shift.route || '-'} / ${shift.shiftTarget || '-'} / CLS ${shift.clsScore} / shift ${shift.shiftValue}`
      )
  ].join('\n')

const buildCsv = (draft: ClsDraft, parsed: ParsedWorkspace) => {
  const rows = [draftShift(draft), ...parsed.shifts]
  return [
    [
      'source',
      'route',
      'cls',
      'shift_value',
      'target',
      'impact_type',
      'load_state',
      'shift_time_ms',
      'reserved_space_px',
      'width',
      'height',
      'had_recent_input'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(shift =>
      [
        shift.source,
        shift.route,
        shift.clsScore,
        shift.shiftValue,
        shift.shiftTarget,
        shift.impactType,
        shift.loadState,
        shift.shiftTime,
        shift.reservedSpace,
        shift.expectedWidth,
        shift.expectedHeight,
        shift.hadRecentInput
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: ClsDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'observer') return buildObserver(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'reserve_css') return buildReserveCss(draft)
  if (outputType === 'playbook') return buildPlaybook(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, shifts: parsed.shifts }, null, 2)
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

export default function ClsBreakdownClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ClsDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('observer')
  const [auditQuery, setAuditQuery] = useState('')
  const [shiftQuery, setShiftQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredShiftQuery = useDeferredValue(shiftQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('capped_input')) return next

    return { ...next, errors: [...next.errors, 'capped_input'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditCls(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      shifts: parsed.shifts.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.errors, parsed.shifts]
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
  const outputPreviewUsesFindings = outputType === 'markdown' || outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesParsedRows ? outputPreviewParsed.shifts.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.shifts.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(draft, parsed), [draft, parsed])
  const rows = useMemo(() => [draftShift(draft), ...parsed.shifts], [draft, parsed.shifts])
  const currentShift = useMemo(() => draftShift(draft), [draft])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.cls_breakdown.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredShiftQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(shift =>
      `${shift.route} ${shift.shiftTarget} ${shift.impactType} ${shift.loadState}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredShiftQuery, rows])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      largest: currentShift.shiftValue,
      rating: t(`app.converter.cls_breakdown.rating.${ratingForCls(currentShift.clsScore)}`),
      score,
      shifts: rows.length,
      target: currentShift.shiftTarget || '-',
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [currentShift, findings, rows.length, score, t]
  )

  const updateDraft = <Key extends keyof ClsDraft>(key: Key, value: ClsDraft[Key]) => {
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
    setOutputType('observer')
    setAuditQuery('')
    setShiftQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.cls_breakdown.summary_title'),
        `${t('app.converter.cls_breakdown.metric.score')}: ${metrics.score}`,
        `${t('app.converter.cls_breakdown.metric.rating')}: ${metrics.rating}`,
        `${t('app.converter.cls_breakdown.metric.largest')}: ${metrics.largest}`,
        `${t('app.converter.cls_breakdown.metric.shifts')}: ${metrics.shifts}`,
        `${t('app.converter.cls_breakdown.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.cls_breakdown.metric.critical')}: ${metrics.critical}`
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
                <Move className="h-4 w-4" />
                {t('app.converter.cls-breakdown')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.cls-breakdown')}</CardTitle>
              <CardDescription>{t('app.converter.cls_breakdown.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.cls_breakdown.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.cls_breakdown.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.cls_breakdown.metric.rating')} value={metrics.rating} />
            <Metric
              label={t('app.converter.cls_breakdown.metric.largest')}
              value={metrics.largest}
            />
            <Metric label={t('app.converter.cls_breakdown.metric.shifts')} value={metrics.shifts} />
            <Metric
              label={t('app.converter.cls_breakdown.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.cls_breakdown.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.cls_breakdown.presets')}</CardTitle>
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
                {t(`app.converter.cls_breakdown.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.cls_breakdown.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.cls_breakdown.model')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.cls_breakdown.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cls-route">{t('app.converter.cls_breakdown.route_pattern')}</Label>
                <Input
                  id="cls-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-device">{t('app.converter.cls_breakdown.device')}</Label>
                <Select
                  id="cls-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.cls_breakdown.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-score">{t('app.converter.cls_breakdown.cls_score')}</Label>
                <Input
                  id="cls-score"
                  value={draft.clsScore}
                  onChange={event => updateDraft('clsScore', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-percentile">
                  {t('app.converter.cls_breakdown.percentile')}
                </Label>
                <Input
                  id="cls-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value.slice(0, 12))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-value">{t('app.converter.cls_breakdown.shift_value')}</Label>
                <Input
                  id="cls-value"
                  value={draft.shiftValue}
                  onChange={event => updateDraft('shiftValue', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-time">{t('app.converter.cls_breakdown.shift_time_ms')}</Label>
                <Input
                  id="cls-time"
                  value={draft.shiftTimeMs}
                  onChange={event => updateDraft('shiftTimeMs', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-target">{t('app.converter.cls_breakdown.shift_target')}</Label>
                <Input
                  id="cls-target"
                  value={draft.shiftTarget}
                  onChange={event => updateDraft('shiftTarget', event.target.value.slice(0, 220))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-impact">{t('app.converter.cls_breakdown.impact_type')}</Label>
                <Select
                  id="cls-impact"
                  value={draft.impactType}
                  onChange={event => updateDraft('impactType', event.target.value as ImpactType)}
                >
                  {IMPACT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.cls_breakdown.impact.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-load">{t('app.converter.cls_breakdown.load_state')}</Label>
                <Select
                  id="cls-load"
                  value={draft.loadState}
                  onChange={event => updateDraft('loadState', event.target.value as LoadState)}
                >
                  {LOAD_STATES.map(state => (
                    <option key={state} value={state}>
                      {t(`app.converter.cls_breakdown.load.${state}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-reserved">
                  {t('app.converter.cls_breakdown.reserved_space')}
                </Label>
                <Input
                  id="cls-reserved"
                  value={draft.reservedSpacePx}
                  onChange={event => updateDraft('reservedSpacePx', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-width">{t('app.converter.cls_breakdown.expected_width')}</Label>
                <Input
                  id="cls-width"
                  value={draft.expectedWidth}
                  onChange={event => updateDraft('expectedWidth', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-height">
                  {t('app.converter.cls_breakdown.expected_height')}
                </Label>
                <Input
                  id="cls-height"
                  value={draft.expectedHeight}
                  onChange={event => updateDraft('expectedHeight', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-samples">{t('app.converter.cls_breakdown.sample_count')}</Label>
                <Input
                  id="cls-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 10))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-session">
                  {t('app.converter.cls_breakdown.session_window')}
                </Label>
                <Input
                  id="cls-session"
                  value={draft.sessionWindowMs}
                  onChange={event =>
                    updateDraft('sessionWindowMs', event.target.value.slice(0, 10))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-viewport-width">
                  {t('app.converter.cls_breakdown.viewport_width')}
                </Label>
                <Input
                  id="cls-viewport-width"
                  value={draft.viewportWidth}
                  onChange={event => updateDraft('viewportWidth', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cls-viewport-height">
                  {t('app.converter.cls_breakdown.viewport_height')}
                </Label>
                <Input
                  id="cls-viewport-height"
                  value={draft.viewportHeight}
                  onChange={event => updateDraft('viewportHeight', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="cls-root-cause">
                  {t('app.converter.cls_breakdown.root_cause')}
                </Label>
                <Input
                  id="cls-root-cause"
                  value={draft.rootCause}
                  onChange={event => updateDraft('rootCause', event.target.value.slice(0, 260))}
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <Checkbox
                checked={draft.lateInsertion}
                onChange={event => updateDraft('lateInsertion', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.late_insertion')}
              />
              <Checkbox
                checked={draft.fontSwap}
                onChange={event => updateDraft('fontSwap', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.font_swap')}
              />
              <Checkbox
                checked={draft.animationShift}
                onChange={event => updateDraft('animationShift', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.animation_shift')}
              />
              <Checkbox
                checked={draft.thirdPartyEmbed}
                onChange={event => updateDraft('thirdPartyEmbed', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.third_party_embed')}
              />
              <Checkbox
                checked={draft.hadRecentInput}
                onChange={event => updateDraft('hadRecentInput', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.had_recent_input')}
              />
              <Checkbox
                checked={draft.bfcacheSegment}
                onChange={event => updateDraft('bfcacheSegment', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.cls_breakdown.bfcache_segment')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.cls_breakdown.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.cls_breakdown.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.cls_breakdown.workspace_placeholder')}
              className="min-h-[640px] font-mono"
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
              <CardTitle className="text-base">{t('app.converter.cls_breakdown.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.cls_breakdown.audit_search')}
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
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.cls_breakdown.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.cls_breakdown.level.${finding.level}`)}
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
                  {t('app.converter.cls_breakdown.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.cls_breakdown.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="cls-output">{t('app.converter.cls_breakdown.output_type')}</Label>
                <Select
                  id="cls-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.cls_breakdown.output.${type}`)}
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
                {t('app.converter.cls_breakdown.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'cls-breakdown-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.cls_breakdown.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentCsv(), 'cls-breakdown.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.cls_breakdown.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.cls_breakdown.shifts')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={shiftQuery}
                onChange={event => setShiftQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.cls_breakdown.shift_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(shift => (
                  <div key={shift.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {shift.shiftTarget || shift.route || '-'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(ratingForCls(shift.clsScore) === 'poor' ? 'danger' : ratingForCls(shift.clsScore) === 'needs_improvement' ? 'warn' : 'good')}`}
                      >
                        {shift.clsScore}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.cls_breakdown.impact.${shift.impactType}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.cls_breakdown.load.${shift.loadState}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.cls_breakdown.source.${shift.source}`)}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {shift.shiftValue} / {shift.shiftTime}ms / {shift.reservedSpace}px /{' '}
                      {shift.route || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.cls_breakdown.empty')}
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
                  {t('app.converter.cls_breakdown.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.cls_breakdown.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.cls_breakdown.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.cls_breakdown.reference.${item}_hint`)}
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
                  {t('app.converter.cls_breakdown.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.cls_breakdown.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.cls_breakdown.checklist.${item}.body`)}
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
