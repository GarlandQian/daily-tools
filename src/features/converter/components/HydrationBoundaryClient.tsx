'use client'

import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  GitBranch,
  Layers3,
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
const OUTPUT_TYPES = ['boundary', 'dynamic', 'next', 'markdown', 'json', 'csv'] as const
const BOUNDARY_KINDS = ['island', 'provider', 'route', 'widget'] as const
const WORKSPACE_LIMIT = 70000
const SIGNAL_LIMIT = 180

type Device = (typeof DEVICES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type BoundaryKind = (typeof BOUNDARY_KINDS)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface HydrationDraft {
  blockingMs: string
  boundaryKind: BoundaryKind
  candidateBoundary: string
  clientComponents: string
  device: Device
  dynamicBoundaries: string
  eventHandlers: string
  hydrationMs: string
  mismatchCount: string
  providerDepth: string
  routePattern: string
  rscPayloadKb: string
  sampleCount: string
  serializedPropsKb: string
  serverComponents: string
  suspenseBoundaries: string
  thirdPartyWidgets: string
  topClientFile: string
  useClientFiles: string
}

interface ParsedSignal {
  key: string
  source: 'code' | 'json' | 'text'
  subject: string
  value: number | string
}

interface ParsedMetrics {
  blockingMs: number
  browserApiHits: number
  clientFiles: number
  dynamicBoundaries: number
  effectHits: number
  eventHandlers: number
  hydrationMs: number
  mismatches: number
  providerHints: number
  rscPayloadKb: number
  serializedPropsKb: number
  suspenseBoundaries: number
  thirdPartyHints: number
}

interface ParsedWorkspace {
  errors: string[]
  metrics: ParsedMetrics
  rawRows: Array<{ label: string; value: string }>
  signals: ParsedSignal[]
}

interface Preset {
  draft: HydrationDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const EMPTY_METRICS: ParsedMetrics = {
  blockingMs: 0,
  browserApiHits: 0,
  clientFiles: 0,
  dynamicBoundaries: 0,
  effectHits: 0,
  eventHandlers: 0,
  hydrationMs: 0,
  mismatches: 0,
  providerHints: 0,
  rscPayloadKb: 0,
  serializedPropsKb: 0,
  suspenseBoundaries: 0,
  thirdPartyHints: 0
}

const DEFAULT_DRAFT: HydrationDraft = {
  blockingMs: '72',
  boundaryKind: 'island',
  candidateBoundary: '@/components/ProductReviews',
  clientComponents: '18',
  device: 'mobile',
  dynamicBoundaries: '4',
  eventHandlers: '120',
  hydrationMs: '260',
  mismatchCount: '0',
  providerDepth: '3',
  routePattern: '/products/:slug',
  rscPayloadKb: '160',
  sampleCount: '900',
  serializedPropsKb: '48',
  serverComponents: '42',
  suspenseBoundaries: '6',
  thirdPartyWidgets: '2',
  topClientFile: 'app/products/[slug]/ProductReviews.tsx',
  useClientFiles: '8'
}

const PRESETS: Preset[] = [
  {
    key: 'app_route',
    draft: DEFAULT_DRAFT,
    workspace: [
      'route=/products/example hydration=260ms blocking=72ms props=48KB rsc=160KB clients=18 server=42 suspense=6 dynamic=4 handlers=120',
      'file=app/products/[slug]/ProductReviews.tsx useClient=true effects=3 browserApi=1 thirdParty=1 provider=1'
    ].join('\n')
  },
  {
    key: 'dashboard',
    draft: {
      ...DEFAULT_DRAFT,
      blockingMs: '140',
      candidateBoundary: '@/components/DashboardGrid',
      clientComponents: '46',
      dynamicBoundaries: '3',
      eventHandlers: '380',
      hydrationMs: '520',
      providerDepth: '6',
      routePattern: '/dashboard',
      rscPayloadKb: '360',
      serializedPropsKb: '96',
      suspenseBoundaries: '4',
      topClientFile: 'app/dashboard/DashboardGrid.tsx',
      useClientFiles: '22'
    },
    workspace: [
      'route=/dashboard hydration=520ms blocking=140ms props=96KB rsc=360KB clients=46 server=28 suspense=4 dynamic=3 handlers=380 provider=6',
      '"use client"',
      'useEffect(() => { localStorage.setItem("layout", value) }, [value])',
      'window.addEventListener("resize", updateGrid)'
    ].join('\n')
  },
  {
    key: 'commerce',
    draft: {
      ...DEFAULT_DRAFT,
      candidateBoundary: '@/components/BuyBox',
      clientComponents: '28',
      eventHandlers: '260',
      hydrationMs: '410',
      routePattern: '/checkout',
      rscPayloadKb: '280',
      serializedPropsKb: '74',
      thirdPartyWidgets: '4',
      topClientFile: 'app/checkout/BuyBox.tsx',
      useClientFiles: '14'
    },
    workspace: [
      '{"route":"/checkout","hydrationMs":410,"blockingMs":110,"serializedPropsKb":74,"rscPayloadKb":280,"clientComponents":28,"serverComponents":35,"suspenseBoundaries":5,"dynamicBoundaries":3,"thirdPartyWidgets":4,"eventHandlers":260,"topClientFile":"app/checkout/BuyBox.tsx"}',
      'Hydration failed because the initial UI does not match what was rendered on the server.'
    ].join('\n')
  },
  {
    key: 'marketing',
    draft: {
      ...DEFAULT_DRAFT,
      blockingMs: '58',
      boundaryKind: 'widget',
      candidateBoundary: '@/components/LeadForm',
      clientComponents: '16',
      hydrationMs: '220',
      routePattern: '/campaign/:slug',
      rscPayloadKb: '140',
      serializedPropsKb: '36',
      thirdPartyWidgets: '5',
      topClientFile: 'app/campaign/LeadForm.tsx',
      useClientFiles: '7'
    },
    workspace: [
      'route=/campaign/summer hydration=220ms blocking=58ms props=36KB rsc=140KB clients=16 suspense=4 dynamic=2 thirdParty=5 handlers=88',
      'script=https://tags.example.com/form.js widget=lead-form hydration=third-party'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      blockingMs: '420',
      boundaryKind: 'provider',
      candidateBoundary: '',
      clientComponents: '96',
      device: 'mobile',
      dynamicBoundaries: '0',
      eventHandlers: '920',
      hydrationMs: '1280',
      mismatchCount: '6',
      providerDepth: '9',
      routePattern: '/checkout',
      rscPayloadKb: '920',
      sampleCount: '42',
      serializedPropsKb: '260',
      serverComponents: '18',
      suspenseBoundaries: '1',
      thirdPartyWidgets: '9',
      topClientFile: 'app/checkout/page.tsx',
      useClientFiles: '58'
    },
    workspace: [
      '{"route":"/checkout","hydrationMs":1280,"blockingMs":420,"serializedPropsKb":260,"rscPayloadKb":920,"clientComponents":96,"serverComponents":18,"suspenseBoundaries":1,"dynamicBoundaries":0,"thirdPartyWidgets":9,"eventHandlers":920,"providerDepth":9,"mismatchCount":6,"topClientFile":"app/checkout/page.tsx"}',
      '"use client"',
      'const value = window.localStorage.getItem("cart")',
      'document.querySelector("#coupon")?.addEventListener("input", syncCoupon)',
      'Hydration failed because the initial UI does not match what was rendered on the server.',
      'Warning: Text content did not match. Server: "0" Client: "1"',
      'Expected server HTML to contain a matching <div> in <main>.'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['server_first', 'islands', 'suspense', 'measure'] as const
const REFERENCE_ITEMS = ['use_client', 'props', 'rsc', 'suspense', 'effects', 'mismatch'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const textValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.match(/([\d.,]+)\s*(b|kb|kib|mb|mib|ms)?/iu)
    if (!match?.[1]) return null
    const amount = Number(match[1].replace(/,/g, ''))
    if (!Number.isFinite(amount)) return null
    const unit = match[2]?.toLowerCase() ?? ''
    if (unit === 'b') return amount / 1024
    if (unit === 'mb' || unit === 'mib') return amount * 1024
    return amount
  }
  return null
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const tokenValue = (line: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = line.match(new RegExp(`${escaped}=([^\\s,]+)`, 'iu'))
  return match?.[1] ?? ''
}

const incrementMetric = (metrics: ParsedMetrics, key: keyof ParsedMetrics, value: number) => {
  metrics[key] = round(metrics[key] + value)
}

const addSignal = (
  signals: ParsedSignal[],
  key: string,
  subject: string,
  value: number | string,
  source: ParsedSignal['source']
) => {
  if (signals.length < SIGNAL_LIMIT) signals.push({ key, source, subject, value })
}

const mergeRecordMetrics = (parsed: ParsedWorkspace, record: Record<string, unknown>) => {
  const metricMap: Array<[keyof ParsedMetrics, unknown[]]> = [
    ['blockingMs', [record.blockingMs, record.blocking, record.blockingDuration]],
    ['clientFiles', [record.clientFiles, record.useClientFiles, record.useClient]],
    ['dynamicBoundaries', [record.dynamicBoundaries, record.dynamic]],
    ['eventHandlers', [record.eventHandlers, record.handlers]],
    ['hydrationMs', [record.hydrationMs, record.hydration, record.duration]],
    ['mismatches', [record.mismatchCount, record.mismatches]],
    ['providerHints', [record.providerDepth, record.providers, record.provider]],
    ['rscPayloadKb', [record.rscPayloadKb, record.rscKb, record.rscPayload]],
    ['serializedPropsKb', [record.serializedPropsKb, record.propsKb, record.props]],
    ['suspenseBoundaries', [record.suspenseBoundaries, record.suspense]],
    ['thirdPartyHints', [record.thirdPartyWidgets, record.thirdParty]]
  ]
  metricMap.forEach(([key, values]) => {
    const value = values.map(numericValue).find(item => item !== null)
    if (value !== undefined && value !== null)
      parsed.metrics[key] = Math.max(parsed.metrics[key], round(value))
  })
  const clients = numericValue(record.clientComponents ?? record.clients)
  if (clients !== null)
    addSignal(parsed.signals, 'client_components', 'client-components', round(clients), 'json')
  const server = numericValue(record.serverComponents ?? record.server)
  if (server !== null)
    addSignal(parsed.signals, 'server_components', 'server-components', round(server), 'json')
  const file = textValue(record.topClientFile ?? record.file ?? record.clientFile)
  if (file)
    addSignal(
      parsed.signals,
      'top_client_file',
      file,
      textValue(record.route ?? record.path) || '-',
      'json'
    )
}

const collectJson = (value: unknown, parsed: ParsedWorkspace, depth = 0) => {
  if (depth > 6 || parsed.signals.length >= SIGNAL_LIMIT) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJson(item, parsed, depth + 1))
    return
  }
  const record = asRecord(value)
  if (!record) return
  mergeRecordMetrics(parsed, record)
  Object.values(record)
    .slice(0, 40)
    .forEach(item => collectJson(item, parsed, depth + 1))
}

const parseJson = (parsed: ParsedWorkspace, input: string, reportError = true) => {
  try {
    collectJson(JSON.parse(input), parsed)
  } catch {
    if (reportError) parsed.errors.push('json_error')
  }
}

const parseTextLine = (parsed: ParsedWorkspace, line: string) => {
  const mappings: Array<[keyof ParsedMetrics, string[]]> = [
    ['blockingMs', ['blocking']],
    ['clientFiles', ['clientFiles', 'useClientFiles', 'useClient']],
    ['dynamicBoundaries', ['dynamic']],
    ['eventHandlers', ['handlers', 'eventHandlers']],
    ['hydrationMs', ['hydration']],
    ['mismatches', ['mismatches', 'mismatchCount']],
    ['providerHints', ['provider', 'providers']],
    ['rscPayloadKb', ['rsc', 'rscPayload']],
    ['serializedPropsKb', ['props', 'propsKb']],
    ['suspenseBoundaries', ['suspense']],
    ['thirdPartyHints', ['thirdParty']]
  ]
  mappings.forEach(([metric, keys]) => {
    const value = keys.map(key => numericValue(tokenValue(line, key))).find(item => item !== null)
    if (value !== undefined && value !== null)
      parsed.metrics[metric] = Math.max(parsed.metrics[metric], round(value))
  })

  const clients = numericValue(tokenValue(line, 'clients'))
  if (clients !== null)
    addSignal(
      parsed.signals,
      'client_components',
      tokenValue(line, 'route') || 'route',
      round(clients),
      'text'
    )
  const server = numericValue(tokenValue(line, 'server'))
  if (server !== null)
    addSignal(
      parsed.signals,
      'server_components',
      tokenValue(line, 'route') || 'route',
      round(server),
      'text'
    )
  const file = tokenValue(line, 'file')
  if (file)
    addSignal(parsed.signals, 'top_client_file', file, tokenValue(line, 'route') || '-', 'text')
}

const parseCodeLine = (parsed: ParsedWorkspace, line: string) => {
  const clean = line.trim()
  if (!clean) return
  if (/["']use client["']/u.test(clean)) {
    incrementMetric(parsed.metrics, 'clientFiles', 1)
    addSignal(parsed.signals, 'use_client', 'directive', clean.slice(0, 120), 'code')
  }
  const effectCount = (clean.match(/\buse(Effect|LayoutEffect|InsertionEffect)\s*\(/gu) ?? [])
    .length
  if (effectCount) {
    incrementMetric(parsed.metrics, 'effectHits', effectCount)
    addSignal(parsed.signals, 'effect_hook', 'effect', clean.slice(0, 120), 'code')
  }
  const browserApiCount = (
    clean.match(/\b(window|document|localStorage|sessionStorage|navigator)\b/gu) ?? []
  ).length
  if (browserApiCount) {
    incrementMetric(parsed.metrics, 'browserApiHits', browserApiCount)
    addSignal(parsed.signals, 'browser_api', 'browser-api', clean.slice(0, 120), 'code')
  }
  const suspenseCount = (clean.match(/<Suspense\b|React\.Suspense/gu) ?? []).length
  if (suspenseCount) incrementMetric(parsed.metrics, 'suspenseBoundaries', suspenseCount)
  const dynamicCount = (clean.match(/\bdynamic\s*\(|\bimport\s*\(/gu) ?? []).length
  if (dynamicCount) incrementMetric(parsed.metrics, 'dynamicBoundaries', dynamicCount)
  const handlerCount = (clean.match(/\bon[A-Z][A-Za-z]+\s*=/gu) ?? []).length
  if (handlerCount) incrementMetric(parsed.metrics, 'eventHandlers', handlerCount)
  if (/provider|context/iu.test(clean)) incrementMetric(parsed.metrics, 'providerHints', 1)
  if (/third-party|analytics|ads|tag|embed|widget|script=https?:/iu.test(clean)) {
    incrementMetric(parsed.metrics, 'thirdPartyHints', 1)
    addSignal(parsed.signals, 'third_party', 'third-party', clean.slice(0, 120), 'code')
  }
  if (
    /Hydration failed|Text content did not match|Expected server HTML|does not match what was rendered/iu.test(
      clean
    )
  ) {
    incrementMetric(parsed.metrics, 'mismatches', 1)
    addSignal(parsed.signals, 'mismatch', 'hydration-warning', clean.slice(0, 160), 'text')
  }
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedWorkspace = {
    errors: [],
    metrics: { ...EMPTY_METRICS },
    rawRows: [],
    signals: []
  }
  const trimmed = source.trim()
  const parseJsonLines = () => {
    source
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line.startsWith('{') || line.startsWith('['))
      .slice(0, SIGNAL_LIMIT)
      .forEach(line => parseJson(parsed, line, false))
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const before = parsed.signals.length
    parseJson(parsed, trimmed)
    if (parsed.signals.length === before) parseJsonLines()
  } else {
    parseJsonLines()
  }

  source
    .split(/\r?\n/u)
    .slice(0, SIGNAL_LIMIT)
    .forEach(line => {
      const clean = line.trim()
      if (!clean) return
      parseTextLine(parsed, clean)
      parseCodeLine(parsed, clean)
      if (
        /hydration|blocking|props=|rsc=|use client|Hydration failed|Text content did not match|window|document|localStorage/iu.test(
          clean
        )
      ) {
        parsed.rawRows.push({
          label: clean.split(/\s/u)[0]?.slice(0, 80) ?? 'row',
          value: clean.slice(0, 220)
        })
      }
    })

  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditHydration = (draft: HydrationDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const hydration = Math.max(numberFromInput(draft.hydrationMs), parsed.metrics.hydrationMs)
  const blocking = Math.max(numberFromInput(draft.blockingMs), parsed.metrics.blockingMs)
  const props = Math.max(numberFromInput(draft.serializedPropsKb), parsed.metrics.serializedPropsKb)
  const rsc = Math.max(numberFromInput(draft.rscPayloadKb), parsed.metrics.rscPayloadKb)
  const clients = numberFromInput(draft.clientComponents)
  const server = numberFromInput(draft.serverComponents)
  const useClientFiles = Math.max(numberFromInput(draft.useClientFiles), parsed.metrics.clientFiles)
  const suspense = Math.max(
    numberFromInput(draft.suspenseBoundaries),
    parsed.metrics.suspenseBoundaries
  )
  const dynamic = Math.max(
    numberFromInput(draft.dynamicBoundaries),
    parsed.metrics.dynamicBoundaries
  )
  const thirdParty = Math.max(
    numberFromInput(draft.thirdPartyWidgets),
    parsed.metrics.thirdPartyHints
  )
  const providers = Math.max(numberFromInput(draft.providerDepth), parsed.metrics.providerHints)
  const mismatches = Math.max(numberFromInput(draft.mismatchCount), parsed.metrics.mismatches)
  const handlers = Math.max(numberFromInput(draft.eventHandlers), parsed.metrics.eventHandlers)
  const samples = numberFromInput(draft.sampleCount)
  const mobile = draft.device === 'mobile'

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (samples > 0 && samples < 100)
    addFinding(findings, 'warn', 'low_sample_count', String(samples))
  if (hydration > 1000) addFinding(findings, 'danger', 'hydration_extreme', `${hydration} ms`)
  else if (hydration > (mobile ? 500 : 800))
    addFinding(findings, 'danger', 'hydration_severe', `${hydration} ms`)
  else if (hydration > (mobile ? 250 : 450))
    addFinding(findings, 'warn', 'hydration_watch', `${hydration} ms`)
  else addFinding(findings, 'good', 'hydration_ok', `${hydration} ms`)
  if (blocking > 200) addFinding(findings, 'danger', 'blocking_severe', `${blocking} ms`)
  else if (blocking > 50) addFinding(findings, 'warn', 'blocking_watch', `${blocking} ms`)
  if (props > 160) addFinding(findings, 'danger', 'props_severe', `${props} KB`)
  else if (props > 64) addFinding(findings, 'warn', 'props_watch', `${props} KB`)
  if (rsc > 800) addFinding(findings, 'danger', 'rsc_severe', `${rsc} KB`)
  else if (rsc > 300) addFinding(findings, 'warn', 'rsc_watch', `${rsc} KB`)
  if (useClientFiles > 40)
    addFinding(findings, 'danger', 'use_client_severe', String(useClientFiles))
  else if (useClientFiles > 16)
    addFinding(findings, 'warn', 'use_client_watch', String(useClientFiles))
  if (server > 0 && clients / Math.max(server, 1) > 1.5)
    addFinding(findings, 'warn', 'client_ratio_high', `${clients}/${server}`)
  if (suspense < 2 && hydration > 250)
    addFinding(findings, 'warn', 'suspense_missing', String(suspense))
  if (dynamic < 1 && hydration > 250)
    addFinding(findings, 'warn', 'dynamic_missing', String(dynamic))
  if (thirdParty > 4) addFinding(findings, 'warn', 'third_party_hydration', String(thirdParty))
  if (providers > 6) addFinding(findings, 'warn', 'provider_depth_high', String(providers))
  if (mismatches > 0) addFinding(findings, 'danger', 'mismatch_detected', String(mismatches))
  if (handlers > 600) addFinding(findings, 'danger', 'handlers_severe', String(handlers))
  else if (handlers > 250) addFinding(findings, 'warn', 'handlers_watch', String(handlers))
  if (!draft.topClientFile.trim())
    addFinding(findings, 'warn', 'missing_top_client_file', 'client file')
  if (!draft.candidateBoundary.trim() && hydration > 250)
    addFinding(findings, 'warn', 'missing_boundary_candidate', draft.routePattern)
  if (parsed.metrics.browserApiHits > 0)
    addFinding(findings, 'warn', 'browser_api_in_render', String(parsed.metrics.browserApiHits))
  if (parsed.metrics.effectHits > 8)
    addFinding(findings, 'warn', 'many_effects', String(parsed.metrics.effectHits))
  if (parsed.signals.length)
    addFinding(findings, 'good', 'parser_found', String(parsed.signals.length))
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
  return Math.max(0, Math.min(100, 92 + good * 2 - warn * 6 - danger * 18))
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

const buildBoundarySnippet = (draft: HydrationDraft) =>
  [
    '// Server component: keep data loading and formatting here.',
    `import ClientIsland from '${draft.candidateBoundary || '@/components/ClientIsland'}'`,
    '',
    'export default async function RouteSection() {',
    '  const data = await getSmallSerializableModel()',
    '',
    '  return (',
    '    <section>',
    '      <StaticSummary data={data.summary} />',
    '      <ClientIsland initialModel={data.clientModel} />',
    '    </section>',
    '  )',
    '}',
    '',
    `// Route segment: ${draft.routePattern}`,
    `// Boundary kind: ${draft.boundaryKind}`
  ].join('\n')

const buildDynamicSnippet = (draft: HydrationDraft) =>
  [
    "import dynamic from 'next/dynamic'",
    '',
    `const HydrationIsland = dynamic(() => import('${draft.candidateBoundary || '@/components/HydrationIsland'}'), {`,
    '  loading: () => null,',
    '  ssr: false',
    '})',
    '',
    '// Use this only for browser-only widgets. Prefer server components for content that can render on the server.',
    `// Current heavy client file: ${draft.topClientFile || 'unknown'}`
  ].join('\n')

const buildNextNotes = (draft: HydrationDraft) =>
  [
    '// Hydration boundary review',
    '',
    '1. Move data fetching, markdown/JSON parsing, and formatting back to server components.',
    '2. Keep "use client" at the smallest leaf that needs state, effects, or browser APIs.',
    '3. Pass compact serializable props instead of full records, maps, dates, or class instances.',
    '4. Wrap slow islands in Suspense and pair with route-level loading UI.',
    '5. Re-check INP, long tasks, and first-load JavaScript after the split.',
    '',
    `Route: ${draft.routePattern}`,
    `Candidate: ${draft.candidateBoundary || draft.topClientFile}`,
    `Target hydration: keep mobile hydration under 250 ms when possible.`
  ].join('\n')

const buildMarkdownSummary = (
  draft: HydrationDraft,
  parsed: ParsedWorkspace,
  findings: Finding[]
) => {
  const risky = findings.filter(item => item.level !== 'good').slice(0, 10)
  const signals = parsed.signals.slice(0, 8)
  return [
    '# Hydration boundary triage',
    '',
    `Route: ${draft.routePattern}`,
    `Device: ${draft.device}`,
    `Hydration: ${draft.hydrationMs} ms`,
    `Serialized props: ${draft.serializedPropsKb} KB`,
    '',
    '## Findings',
    risky.length
      ? risky.map(item => `- [${item.level}] ${item.subject}: ${item.key}`).join('\n')
      : '- No high-risk findings.',
    '',
    '## Parsed signals',
    signals.length
      ? signals.map(signal => `- ${signal.key}: ${signal.subject} (${signal.value})`).join('\n')
      : '- No parsed signals yet.',
    '',
    '## Next actions',
    '- Shrink "use client" to leaf islands.',
    '- Reduce serialized props and RSC payload size.',
    '- Add Suspense and dynamic boundaries around optional widgets.',
    '- Re-test INP and main-thread tasks after the boundary change.'
  ].join('\n')
}

const buildCsv = (draft: HydrationDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.signals.length
    ? parsed.signals.map(signal => [signal.key, signal.subject, signal.value, signal.source])
    : [['draft', draft.topClientFile || draft.routePattern, draft.hydrationMs, draft.boundaryKind]]
  return ['key,subject,value,source', ...rows.map(row => row.map(escapeCsv).join(','))].join('\n')
}

const buildJsonSummary = (draft: HydrationDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify(
    {
      draft,
      findings,
      parsed,
      thresholds: {
        blockingWatchMs: 50,
        mobileHydrationWatchMs: 250,
        mobileHydrationSevereMs: 500,
        propsWatchKb: 64,
        rscWatchKb: 300
      }
    },
    null,
    2
  )

const buildOutput = (
  draft: HydrationDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'dynamic') return buildDynamicSnippet(draft)
  if (outputType === 'next') return buildNextNotes(draft)
  if (outputType === 'markdown') return buildMarkdownSummary(draft, parsed, findings)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildCsv(draft, parsed)
  return buildBoundarySnippet(draft)
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

export default function HydrationBoundaryClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<HydrationDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('boundary')
  const [auditQuery, setAuditQuery] = useState('')
  const [signalQuery, setSignalQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredSignalQuery = useDeferredValue(signalQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('truncated')) return next

    return { ...next, errors: [...next.errors, 'truncated'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditHydration(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      metrics: parsed.metrics,
      rawRows: parsed.rawRows.slice(0, OUTPUT_PREVIEW_ROWS),
      signals: parsed.signals.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.errors, parsed.metrics, parsed.rawRows, parsed.signals]
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
    (outputPreviewUsesParsedRows ? outputPreviewParsed.signals.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.signals.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.hydration_boundary.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredSignals = useMemo(() => {
    const query = deferredSignalQuery.trim().toLowerCase()
    if (!query) return parsed.signals
    return parsed.signals.filter(signal =>
      `${signal.key} ${signal.subject} ${signal.value} ${signal.source}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredSignalQuery, parsed.signals])
  const metrics = useMemo(
    () => ({
      blocking: `${Math.max(numberFromInput(draft.blockingMs), parsed.metrics.blockingMs)} ms`,
      critical: findings.filter(item => item.level === 'danger').length,
      hydration: `${Math.max(numberFromInput(draft.hydrationMs), parsed.metrics.hydrationMs)} ms`,
      score,
      signals: parsed.signals.length,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [
      draft.blockingMs,
      draft.hydrationMs,
      findings,
      parsed.metrics.blockingMs,
      parsed.metrics.hydrationMs,
      parsed.signals.length,
      score
    ]
  )

  const updateDraft = <Key extends keyof HydrationDraft>(key: Key, value: HydrationDraft[Key]) => {
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
    setOutputType('boundary')
    setAuditQuery('')
    setSignalQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.hydration_boundary.summary_title'),
        `${t('app.converter.hydration_boundary.metric.score')}: ${metrics.score}`,
        `${t('app.converter.hydration_boundary.metric.hydration')}: ${metrics.hydration}`,
        `${t('app.converter.hydration_boundary.metric.blocking')}: ${metrics.blocking}`,
        `${t('app.converter.hydration_boundary.metric.signals')}: ${metrics.signals}`,
        `${t('app.converter.hydration_boundary.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.hydration_boundary.metric.critical')}: ${metrics.critical}`
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
                {t('app.converter.hydration-boundary')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.hydration-boundary')}
              </CardTitle>
              <CardDescription>{t('app.converter.hydration_boundary.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.hydration_boundary.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.hydration_boundary.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.hydration_boundary.metric.hydration')}
              value={metrics.hydration}
            />
            <Metric
              label={t('app.converter.hydration_boundary.metric.blocking')}
              value={metrics.blocking}
            />
            <Metric
              label={t('app.converter.hydration_boundary.metric.signals')}
              value={metrics.signals}
            />
            <Metric
              label={t('app.converter.hydration_boundary.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.hydration_boundary.metric.critical')}
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
              {t('app.converter.hydration_boundary.presets')}
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
                {t(`app.converter.hydration_boundary.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.hydration_boundary.preset.${preset.key}_hint`)}
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
                {t('app.converter.hydration_boundary.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.hydration_boundary.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hydration-route">
                  {t('app.converter.hydration_boundary.route_pattern')}
                </Label>
                <Input
                  id="hydration-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-device">
                  {t('app.converter.hydration_boundary.device')}
                </Label>
                <Select
                  id="hydration-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.hydration_boundary.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-ms">
                  {t('app.converter.hydration_boundary.hydration_ms')}
                </Label>
                <Input
                  id="hydration-ms"
                  value={draft.hydrationMs}
                  onChange={event => updateDraft('hydrationMs', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-blocking">
                  {t('app.converter.hydration_boundary.blocking_ms')}
                </Label>
                <Input
                  id="hydration-blocking"
                  value={draft.blockingMs}
                  onChange={event => updateDraft('blockingMs', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-props">
                  {t('app.converter.hydration_boundary.serialized_props')}
                </Label>
                <Input
                  id="hydration-props"
                  value={draft.serializedPropsKb}
                  onChange={event =>
                    updateDraft('serializedPropsKb', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-rsc">
                  {t('app.converter.hydration_boundary.rsc_payload')}
                </Label>
                <Input
                  id="hydration-rsc"
                  value={draft.rscPayloadKb}
                  onChange={event => updateDraft('rscPayloadKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-client-components">
                  {t('app.converter.hydration_boundary.client_components')}
                </Label>
                <Input
                  id="hydration-client-components"
                  value={draft.clientComponents}
                  onChange={event =>
                    updateDraft('clientComponents', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-server-components">
                  {t('app.converter.hydration_boundary.server_components')}
                </Label>
                <Input
                  id="hydration-server-components"
                  value={draft.serverComponents}
                  onChange={event =>
                    updateDraft('serverComponents', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-use-client">
                  {t('app.converter.hydration_boundary.use_client_files')}
                </Label>
                <Input
                  id="hydration-use-client"
                  value={draft.useClientFiles}
                  onChange={event => updateDraft('useClientFiles', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hydration-samples">
                  {t('app.converter.hydration_boundary.sample_count')}
                </Label>
                <Input
                  id="hydration-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.hydration_boundary.boundary')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hydration-kind">
                    {t('app.converter.hydration_boundary.boundary_kind')}
                  </Label>
                  <Select
                    id="hydration-kind"
                    value={draft.boundaryKind}
                    onChange={event =>
                      updateDraft('boundaryKind', event.target.value as BoundaryKind)
                    }
                  >
                    {BOUNDARY_KINDS.map(kind => (
                      <option key={kind} value={kind}>
                        {t(`app.converter.hydration_boundary.boundary_kind.${kind}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-suspense">
                    {t('app.converter.hydration_boundary.suspense_boundaries')}
                  </Label>
                  <Input
                    id="hydration-suspense"
                    value={draft.suspenseBoundaries}
                    onChange={event =>
                      updateDraft('suspenseBoundaries', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-dynamic">
                    {t('app.converter.hydration_boundary.dynamic_boundaries')}
                  </Label>
                  <Input
                    id="hydration-dynamic"
                    value={draft.dynamicBoundaries}
                    onChange={event =>
                      updateDraft('dynamicBoundaries', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-third-party">
                    {t('app.converter.hydration_boundary.third_party_widgets')}
                  </Label>
                  <Input
                    id="hydration-third-party"
                    value={draft.thirdPartyWidgets}
                    onChange={event =>
                      updateDraft('thirdPartyWidgets', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-provider-depth">
                    {t('app.converter.hydration_boundary.provider_depth')}
                  </Label>
                  <Input
                    id="hydration-provider-depth"
                    value={draft.providerDepth}
                    onChange={event =>
                      updateDraft('providerDepth', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-handlers">
                    {t('app.converter.hydration_boundary.event_handlers')}
                  </Label>
                  <Input
                    id="hydration-handlers"
                    value={draft.eventHandlers}
                    onChange={event =>
                      updateDraft('eventHandlers', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-mismatches">
                    {t('app.converter.hydration_boundary.mismatch_count')}
                  </Label>
                  <Input
                    id="hydration-mismatches"
                    value={draft.mismatchCount}
                    onChange={event =>
                      updateDraft('mismatchCount', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hydration-client-file">
                    {t('app.converter.hydration_boundary.top_client_file')}
                  </Label>
                  <Input
                    id="hydration-client-file"
                    value={draft.topClientFile}
                    onChange={event =>
                      updateDraft('topClientFile', event.target.value.slice(0, 220))
                    }
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="hydration-candidate">
                    {t('app.converter.hydration_boundary.candidate_boundary')}
                  </Label>
                  <Input
                    id="hydration-candidate"
                    value={draft.candidateBoundary}
                    onChange={event =>
                      updateDraft('candidateBoundary', event.target.value.slice(0, 240))
                    }
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
              <CardTitle className="text-base">
                {t('app.converter.hydration_boundary.workspace')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.hydration_boundary.workspace_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.hydration_boundary.workspace_placeholder')}
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
              <CardTitle className="text-base">
                {t('app.converter.hydration_boundary.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.hydration_boundary.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 36).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.hydration_boundary.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.hydration_boundary.level.${finding.level}`)}
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
                  {t('app.converter.hydration_boundary.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.hydration_boundary.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="hydration-output">
                  {t('app.converter.hydration_boundary.output_type')}
                </Label>
                <Select
                  id="hydration-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.hydration_boundary.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[360px] font-mono" />
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
                {t('app.converter.hydration_boundary.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'hydration-boundary-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.hydration_boundary.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentCsv(),
                    'hydration-boundary-signals.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.hydration_boundary.download_csv')}
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
                {t('app.converter.hydration_boundary.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={signalQuery}
                onChange={event => setSignalQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.hydration_boundary.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredSignals.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredSignals.slice(0, 54).map((signal, index) => (
                  <div
                    key={`${signal.key}:${signal.subject}:${index}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {signal.key}
                      </p>
                      <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                        {signal.source}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {signal.subject}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {signal.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.hydration_boundary.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.hydration_boundary.reference')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.hydration_boundary.reference_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.hydration_boundary.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.hydration_boundary.reference.${item}_hint`)}
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
              {t('app.converter.hydration_boundary.checklist')}
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
                {item === 'islands' ? (
                  <GitBranch className="h-4 w-4" />
                ) : item === 'measure' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.hydration_boundary.checklist.${item}.title`)}
              </div>
              {t(`app.converter.hydration_boundary.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
