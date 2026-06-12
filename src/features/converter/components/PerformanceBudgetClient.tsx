'use client'

import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  Rocket,
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
const PERCENTILES = ['p75', 'p90', 'p95'] as const
const OUTPUT_TYPES = ['budget', 'lhci', 'github', 'vercel', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 60000
const ROW_LIMIT = 160

type Device = (typeof DEVICES)[number]
type Percentile = (typeof PERCENTILES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type MetricKey = 'cls' | 'fcpMs' | 'inpMs' | 'lcpMs' | 'speedIndexMs' | 'tbtMs' | 'ttfbMs'
type ResourceKey =
  | 'cssKb'
  | 'fontKb'
  | 'imageKb'
  | 'imageRequests'
  | 'jsKb'
  | 'requestCount'
  | 'scriptRequests'
  | 'thirdPartyKb'
  | 'thirdPartyRequests'
  | 'totalKb'

interface PerformanceBudgetDraft {
  clsScore: string
  cssKb: string
  device: Device
  fcpMs: string
  firstPartyHostnames: string
  fontKb: string
  imageKb: string
  imageRequests: string
  inpMs: string
  jsKb: string
  lcpMs: string
  percentile: Percentile
  requestCount: string
  routePattern: string
  scriptRequests: string
  speedIndexMs: string
  tbtMs: string
  thirdPartyKb: string
  thirdPartyRequests: string
  totalKb: string
  ttfbMs: string
}

interface ParsedWorkspace {
  budgets: Array<{ path: string; resourceType: string; sizeKb: number }>
  errors: string[]
  metrics: Partial<Record<MetricKey, number>>
  rawRows: Array<{ label: string; value: string }>
  resources: Partial<Record<ResourceKey, number>>
}

interface Preset {
  draft: PerformanceBudgetDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: PerformanceBudgetDraft = {
  clsScore: '0.1',
  cssKb: '80',
  device: 'mobile',
  fcpMs: '1800',
  firstPartyHostnames: 'www.example.com, static.example.com',
  fontKb: '80',
  imageKb: '420',
  imageRequests: '18',
  inpMs: '200',
  jsKb: '170',
  lcpMs: '2500',
  percentile: 'p75',
  requestCount: '60',
  routePattern: '/*',
  scriptRequests: '12',
  speedIndexMs: '3400',
  tbtMs: '200',
  thirdPartyKb: '180',
  thirdPartyRequests: '10',
  totalKb: '1200',
  ttfbMs: '800'
}

const PRESETS: Preset[] = [
  {
    key: 'mobile_cwv',
    draft: DEFAULT_DRAFT,
    workspace: [
      'LCP: 2.3 s',
      'INP: 180 ms',
      'CLS: 0.08',
      'TTFB: 650 ms',
      'JavaScript: 148 KB',
      'CSS: 64 KB',
      'Images: 390 KB',
      'Fonts: 72 KB',
      'Total: 1080 KB',
      'Requests: 52'
    ].join('\n')
  },
  {
    key: 'ecommerce_pdp',
    draft: {
      ...DEFAULT_DRAFT,
      cssKb: '110',
      imageKb: '720',
      imageRequests: '24',
      jsKb: '260',
      routePattern: '/products/:slug',
      scriptRequests: '18',
      thirdPartyKb: '260',
      thirdPartyRequests: '14',
      totalKb: '1750'
    },
    workspace: [
      'route,/products/example',
      'largest-contentful-paint,3100ms',
      'interaction-to-next-paint,240ms',
      'cumulative-layout-shift,0.12',
      'script,286KB',
      'image,850KB',
      'third-party,340KB',
      'requests,82'
    ].join('\n')
  },
  {
    key: 'app_shell',
    draft: {
      ...DEFAULT_DRAFT,
      cssKb: '70',
      imageKb: '160',
      jsKb: '320',
      lcpMs: '2200',
      routePattern: '/dashboard/:path*',
      scriptRequests: '16',
      thirdPartyKb: '120',
      totalKb: '980'
    },
    workspace: [
      '{"audits":{"largest-contentful-paint":{"numericValue":2160},"interaction-to-next-paint":{"numericValue":175},"cumulative-layout-shift":{"numericValue":0.03},"resource-summary":{"details":{"items":[{"resourceType":"script","transferSize":296960,"requestCount":14},{"resourceType":"stylesheet","transferSize":59392,"requestCount":4},{"resourceType":"image","transferSize":118784,"requestCount":8},{"resourceType":"third-party","transferSize":102400,"requestCount":7},{"resourceType":"total","transferSize":880640,"requestCount":48}]}}}}'
    ].join('\n')
  },
  {
    key: 'marketing',
    draft: {
      ...DEFAULT_DRAFT,
      cssKb: '90',
      imageKb: '960',
      routePattern: '/campaign/:slug',
      thirdPartyKb: '160',
      totalKb: '1500'
    },
    workspace: [
      'LCP 2.1s',
      'FCP 1.2s',
      'CLS 0.04',
      'image 880KB',
      'font 90KB',
      'total 1410KB',
      'request count 58'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      clsScore: '0.28',
      cssKb: '180',
      fcpMs: '3400',
      firstPartyHostnames: '',
      imageKb: '1800',
      imageRequests: '46',
      inpMs: '620',
      jsKb: '680',
      lcpMs: '5200',
      percentile: 'p95',
      requestCount: '132',
      routePattern: '/checkout',
      scriptRequests: '34',
      speedIndexMs: '7200',
      tbtMs: '880',
      thirdPartyKb: '920',
      thirdPartyRequests: '36',
      totalKb: '3600',
      ttfbMs: '2100'
    },
    workspace: [
      'LCP: 5.8 s',
      'INP: 780 ms',
      'CLS: 0.32',
      'TTFB: 2200 ms',
      'FCP: 3.8 s',
      'JavaScript: 760 KB',
      'CSS: 220 KB',
      'Images: 2100 KB',
      'Fonts: 180 KB',
      'Third-party: 1120 KB',
      'Total transfer: 4300 KB',
      'Requests: 156'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['vitals', 'bytes', 'third_party', 'ci'] as const
const REFERENCE_ITEMS = ['lcp', 'inp', 'cls', 'budget_json', 'lhci', 'p75'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const parseTimingValue = (value: string, unit = '') => {
  const parsed = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return null
  const normalized = unit.toLowerCase()
  if (normalized === 's') return parsed * 1000
  return parsed
}

const parseByteValue = (value: string, unit = 'kb') => {
  const parsed = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(parsed)) return null
  const normalized = unit.toLowerCase()
  if (normalized === 'mb') return parsed * 1024
  if (normalized === 'bytes' || normalized === 'b') return parsed / 1024
  return parsed
}

const pickReport = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'lighthouseResult' in value) {
    return (value as { lighthouseResult?: unknown }).lighthouseResult
  }
  return value
}

const addMetricFromAudit = (
  parsed: ParsedWorkspace,
  audits: Record<string, { numericValue?: unknown }>,
  key: MetricKey,
  auditId: string
) => {
  const value = audits[auditId]?.numericValue
  if (typeof value === 'number' && Number.isFinite(value)) parsed.metrics[key] = value
}

const parseBudgetEntries = (parsed: ParsedWorkspace, value: unknown) => {
  const entries = Array.isArray(value) ? value : [value]
  entries.forEach(entry => {
    if (!entry || typeof entry !== 'object') return
    const budget = entry as {
      path?: unknown
      resourceSizes?: Array<{ budget?: unknown; resourceType?: unknown }>
    }
    const path = typeof budget.path === 'string' ? budget.path : '/*'
    budget.resourceSizes?.forEach(item => {
      if (typeof item.resourceType !== 'string' || typeof item.budget !== 'number') return
      parsed.budgets.push({ path, resourceType: item.resourceType, sizeKb: item.budget })
    })
  })
}

const parseJsonWorkspace = (parsed: ParsedWorkspace, input: string) => {
  try {
    const value = JSON.parse(input)
    parseBudgetEntries(parsed, value)
    const report = pickReport(value)
    if (!report || typeof report !== 'object' || !('audits' in report)) return

    const audits =
      (report as { audits?: Record<string, { details?: unknown; numericValue?: unknown }> })
        .audits ?? {}
    addMetricFromAudit(parsed, audits, 'lcpMs', 'largest-contentful-paint')
    addMetricFromAudit(parsed, audits, 'inpMs', 'interaction-to-next-paint')
    addMetricFromAudit(parsed, audits, 'cls', 'cumulative-layout-shift')
    addMetricFromAudit(parsed, audits, 'fcpMs', 'first-contentful-paint')
    addMetricFromAudit(parsed, audits, 'tbtMs', 'total-blocking-time')
    addMetricFromAudit(parsed, audits, 'speedIndexMs', 'speed-index')
    addMetricFromAudit(parsed, audits, 'ttfbMs', 'server-response-time')

    const summary = audits['resource-summary']?.details as
      | {
          items?: Array<{ requestCount?: unknown; resourceType?: unknown; transferSize?: unknown }>
        }
      | undefined

    summary?.items?.forEach(item => {
      if (typeof item.resourceType !== 'string') return
      const transferSize = typeof item.transferSize === 'number' ? item.transferSize / 1024 : null
      const requestCount = typeof item.requestCount === 'number' ? item.requestCount : null

      if (item.resourceType === 'script' && transferSize !== null)
        parsed.resources.jsKb = round(transferSize, 1)
      if (item.resourceType === 'script' && requestCount !== null)
        parsed.resources.scriptRequests = requestCount
      if (item.resourceType === 'stylesheet' && transferSize !== null)
        parsed.resources.cssKb = round(transferSize, 1)
      if (item.resourceType === 'image' && transferSize !== null)
        parsed.resources.imageKb = round(transferSize, 1)
      if (item.resourceType === 'image' && requestCount !== null)
        parsed.resources.imageRequests = requestCount
      if (item.resourceType === 'font' && transferSize !== null)
        parsed.resources.fontKb = round(transferSize, 1)
      if (item.resourceType === 'third-party' && transferSize !== null)
        parsed.resources.thirdPartyKb = round(transferSize, 1)
      if (item.resourceType === 'third-party' && requestCount !== null)
        parsed.resources.thirdPartyRequests = requestCount
      if (item.resourceType === 'total' && transferSize !== null)
        parsed.resources.totalKb = round(transferSize, 1)
      if (item.resourceType === 'total' && requestCount !== null)
        parsed.resources.requestCount = requestCount
    })
  } catch {
    parsed.errors.push('json_error')
  }
}

const matchTiming = (line: string, pattern: RegExp) => {
  const match = line.match(pattern)
  if (!match?.[1]) return null
  return parseTimingValue(match[1], match[2])
}

const matchBytes = (line: string, pattern: RegExp) => {
  const match = line.match(pattern)
  if (!match?.[1]) return null
  return parseByteValue(match[1], match[2])
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedWorkspace = {
    budgets: [],
    errors: [],
    metrics: {},
    rawRows: [],
    resources: {}
  }
  const trimmed = source.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) parseJsonWorkspace(parsed, trimmed)

  source
    .split(/\r?\n/u)
    .slice(0, ROW_LIMIT)
    .forEach(line => {
      const clean = line.trim()
      if (!clean) return

      const lcp = matchTiming(
        clean,
        /\b(?:lcp|largest[-\s]contentful[-\s]paint)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const inp = matchTiming(
        clean,
        /\b(?:inp|interaction[-\s]to[-\s]next[-\s]paint)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const fcp = matchTiming(
        clean,
        /\b(?:fcp|first[-\s]contentful[-\s]paint)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const ttfb = matchTiming(
        clean,
        /\b(?:ttfb|server[-\s]response[-\s]time)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const tbt = matchTiming(
        clean,
        /\b(?:tbt|total[-\s]blocking[-\s]time)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const speedIndex = matchTiming(
        clean,
        /\b(?:speed[-\s]index)\b[^0-9-]*(-?[\d.,]+)\s*(ms|s)?/iu
      )
      const clsMatch = clean.match(
        /\b(?:cls|cumulative[-\s]layout[-\s]shift)\b[^0-9-]*(-?[\d.,]+)/iu
      )
      const js = matchBytes(
        clean,
        /\b(?:javascript|script|js)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu
      )
      const css = matchBytes(clean, /\b(?:stylesheet|css)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu)
      const image = matchBytes(clean, /\b(?:image|images)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu)
      const font = matchBytes(clean, /\b(?:font|fonts)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu)
      const thirdParty = matchBytes(
        clean,
        /\b(?:third[-\s]party|thirdparty)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu
      )
      const total = matchBytes(
        clean,
        /\b(?:total[-\s]transfer|transfer[-\s]size|total)\b[^0-9-]*([\d.,]+)\s*(kb|mb|bytes|b)?/iu
      )
      const requests = clean.match(/\b(?:request[-\s]count|requests?)\b[^0-9-]*([\d.,]+)/iu)

      if (lcp !== null) parsed.metrics.lcpMs = round(lcp)
      if (inp !== null) parsed.metrics.inpMs = round(inp)
      if (fcp !== null) parsed.metrics.fcpMs = round(fcp)
      if (ttfb !== null) parsed.metrics.ttfbMs = round(ttfb)
      if (tbt !== null) parsed.metrics.tbtMs = round(tbt)
      if (speedIndex !== null) parsed.metrics.speedIndexMs = round(speedIndex)
      if (clsMatch?.[1]) parsed.metrics.cls = round(Number(clsMatch[1].replace(/,/g, '')), 3)
      if (js !== null) parsed.resources.jsKb = round(js, 1)
      if (css !== null) parsed.resources.cssKb = round(css, 1)
      if (image !== null) parsed.resources.imageKb = round(image, 1)
      if (font !== null) parsed.resources.fontKb = round(font, 1)
      if (thirdParty !== null) parsed.resources.thirdPartyKb = round(thirdParty, 1)
      if (total !== null) parsed.resources.totalKb = round(total, 1)
      if (requests?.[1]) parsed.resources.requestCount = Number(requests[1].replace(/,/g, ''))

      if (
        /lcp|inp|cls|fcp|ttfb|tbt|speed|script|javascript|css|image|font|third|total|request/iu.test(
          clean
        )
      ) {
        parsed.rawRows.push({
          label: clean.split(/[:,]/u)[0]?.slice(0, 80) ?? clean.slice(0, 80),
          value: clean.slice(0, 180)
        })
      }
    })

  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const firstPartyHostnames = (draft: PerformanceBudgetDraft) =>
  draft.firstPartyHostnames
    .split(/[,\n]/u)
    .map(item => item.trim())
    .filter(Boolean)

const resourceSizeBudgets = (draft: PerformanceBudgetDraft) =>
  [
    { budget: numberFromInput(draft.totalKb), resourceType: 'total' },
    { budget: numberFromInput(draft.jsKb), resourceType: 'script' },
    { budget: numberFromInput(draft.cssKb), resourceType: 'stylesheet' },
    { budget: numberFromInput(draft.imageKb), resourceType: 'image' },
    { budget: numberFromInput(draft.fontKb), resourceType: 'font' },
    { budget: numberFromInput(draft.thirdPartyKb), resourceType: 'third-party' }
  ].filter(item => item.budget > 0)

const resourceCountBudgets = (draft: PerformanceBudgetDraft) =>
  [
    { budget: numberFromInput(draft.requestCount), resourceType: 'total' },
    { budget: numberFromInput(draft.scriptRequests), resourceType: 'script' },
    { budget: numberFromInput(draft.imageRequests), resourceType: 'image' },
    { budget: numberFromInput(draft.thirdPartyRequests), resourceType: 'third-party' }
  ].filter(item => item.budget > 0)

const timingBudgets = (draft: PerformanceBudgetDraft) =>
  [
    { budget: numberFromInput(draft.fcpMs), metric: 'first-contentful-paint' },
    { budget: numberFromInput(draft.lcpMs), metric: 'largest-contentful-paint' },
    { budget: numberFromInput(draft.tbtMs), metric: 'total-blocking-time' },
    { budget: numberFromInput(draft.speedIndexMs), metric: 'speed-index' }
  ].filter(item => item.budget > 0)

const buildBudgetJson = (draft: PerformanceBudgetDraft) => {
  const budget: {
    options?: { firstPartyHostnames: string[] }
    path: string
    resourceCounts: Array<{ budget: number; resourceType: string }>
    resourceSizes: Array<{ budget: number; resourceType: string }>
    timings: Array<{ budget: number; metric: string }>
  } = {
    path: draft.routePattern.trim() || '/*',
    resourceCounts: resourceCountBudgets(draft),
    resourceSizes: resourceSizeBudgets(draft),
    timings: timingBudgets(draft)
  }
  const hosts = firstPartyHostnames(draft)
  if (hosts.length) budget.options = { firstPartyHostnames: hosts }
  return JSON.stringify([budget], null, 2)
}

const buildLhciConfig = (draft: PerformanceBudgetDraft) => {
  const assertions = {
    'cumulative-layout-shift': ['error', { maxNumericValue: numberFromInput(draft.clsScore) }],
    'first-contentful-paint': ['warn', { maxNumericValue: numberFromInput(draft.fcpMs) }],
    'interaction-to-next-paint': ['warn', { maxNumericValue: numberFromInput(draft.inpMs) }],
    'largest-contentful-paint': ['error', { maxNumericValue: numberFromInput(draft.lcpMs) }],
    'resource-summary:image:size': [
      'warn',
      { maxNumericValue: numberFromInput(draft.imageKb) * 1024 }
    ],
    'resource-summary:script:size': [
      'warn',
      { maxNumericValue: numberFromInput(draft.jsKb) * 1024 }
    ],
    'resource-summary:third-party:size': [
      'warn',
      { maxNumericValue: numberFromInput(draft.thirdPartyKb) * 1024 }
    ],
    'server-response-time': ['warn', { maxNumericValue: numberFromInput(draft.ttfbMs) }],
    'total-blocking-time': ['warn', { maxNumericValue: numberFromInput(draft.tbtMs) }]
  }

  return [
    'module.exports = {',
    '  ci: {',
    '    collect: {',
    `      url: ['${draft.routePattern.startsWith('http') ? draft.routePattern : `https://www.example.com${draft.routePattern === '/*' ? '/' : draft.routePattern}`}'],`,
    `      settings: { preset: '${draft.device === 'desktop' ? 'desktop' : 'mobile'}' }`,
    '    },',
    '    assert: {',
    `      assertions: ${JSON.stringify(assertions, null, 8).replace(/\n/g, '\n      ')}`,
    '    }',
    '  }',
    '}'
  ].join('\n')
}

const buildGithubAction = (draft: PerformanceBudgetDraft) =>
  [
    'name: Performance budget',
    'on: [pull_request]',
    'jobs:',
    '  lhci:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: pnpm/action-setup@v4',
    '      - uses: actions/setup-node@v4',
    "        with: { node-version: '22', cache: 'pnpm' }",
    '      - run: pnpm install --frozen-lockfile',
    '      - run: pnpm build',
    '      - run: pnpm dlx @lhci/cli autorun --config=./lighthouserc.cjs',
    `# Pair with budgets for ${draft.routePattern} at ${draft.percentile.toUpperCase()} ${draft.device}.`
  ].join('\n')

const buildVercelNotes = (draft: PerformanceBudgetDraft) =>
  [
    '# Next/Vercel budget notes',
    '1. Keep this budget beside lighthouserc.cjs and run it in preview deployments.',
    '2. Track field data at the 75th percentile; lab budgets should be stricter than production SLOs.',
    '3. Compare next build output for first-load JS before merging large app-shell changes.',
    '',
    `Route: ${draft.routePattern}`,
    `Device: ${draft.device}`,
    `Core Web Vitals: LCP ${draft.lcpMs} ms, INP ${draft.inpMs} ms, CLS ${draft.clsScore}`,
    `Transfer: JS ${draft.jsKb} KB, CSS ${draft.cssKb} KB, Images ${draft.imageKb} KB, Total ${draft.totalKb} KB`,
    `Third-party cap: ${draft.thirdPartyKb} KB across ${draft.thirdPartyRequests} requests`
  ].join('\n')

const buildCsv = (draft: PerformanceBudgetDraft) =>
  [
    'route,device,percentile,lcpMs,inpMs,cls,ttfbMs,fcpMs,tbtMs,jsKb,cssKb,imageKb,fontKb,thirdPartyKb,totalKb,requests',
    [
      draft.routePattern,
      draft.device,
      draft.percentile,
      draft.lcpMs,
      draft.inpMs,
      draft.clsScore,
      draft.ttfbMs,
      draft.fcpMs,
      draft.tbtMs,
      draft.jsKb,
      draft.cssKb,
      draft.imageKb,
      draft.fontKb,
      draft.thirdPartyKb,
      draft.totalKb,
      draft.requestCount
    ]
      .map(escapeCsv)
      .join(',')
  ].join('\n')

const buildJsonSummary = (
  draft: PerformanceBudgetDraft,
  parsed: ParsedWorkspace,
  findings: Finding[]
) =>
  JSON.stringify(
    {
      draft: {
        ...draft,
        firstPartyHostnames: firstPartyHostnames(draft)
      },
      findings,
      parsed,
      sources: {
        cwv: 'Core Web Vitals good thresholds: LCP 2500 ms, INP 200 ms, CLS 0.1',
        lighthouseBudget:
          'budget.json supports resourceSizes, resourceCounts, and selected Lighthouse timings'
      }
    },
    null,
    2
  )

const buildOutput = (
  draft: PerformanceBudgetDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'lhci') return buildLhciConfig(draft)
  if (outputType === 'github') return buildGithubAction(draft)
  if (outputType === 'vercel') return buildVercelNotes(draft)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildCsv(draft)
  return buildBudgetJson(draft)
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const compareParsed = (
  findings: Finding[],
  parsedValue: number | undefined,
  budgetValue: number,
  key: string,
  subject: string,
  digits = 0
) => {
  if (parsedValue === undefined || budgetValue <= 0) return
  if (parsedValue > budgetValue)
    addFinding(
      findings,
      'danger',
      key,
      `${subject}: ${round(parsedValue, digits)} > ${budgetValue}`
    )
  else
    addFinding(
      findings,
      'good',
      'parsed_within_budget',
      `${subject}: ${round(parsedValue, digits)}`
    )
}

const auditBudget = (draft: PerformanceBudgetDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const lcp = numberFromInput(draft.lcpMs)
  const inp = numberFromInput(draft.inpMs)
  const cls = numberFromInput(draft.clsScore)
  const ttfb = numberFromInput(draft.ttfbMs)
  const fcp = numberFromInput(draft.fcpMs)
  const tbt = numberFromInput(draft.tbtMs)
  const speedIndex = numberFromInput(draft.speedIndexMs)
  const js = numberFromInput(draft.jsKb)
  const css = numberFromInput(draft.cssKb)
  const image = numberFromInput(draft.imageKb)
  const font = numberFromInput(draft.fontKb)
  const thirdParty = numberFromInput(draft.thirdPartyKb)
  const total = numberFromInput(draft.totalKb)
  const requests = numberFromInput(draft.requestCount)
  const thirdPartyRequests = numberFromInput(draft.thirdPartyRequests)
  const componentTotal = js + css + image + font + thirdParty

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (draft.percentile !== 'p75')
    addFinding(findings, 'warn', 'percentile_not_p75', draft.percentile.toUpperCase())
  if (lcp > 4000) addFinding(findings, 'danger', 'lcp_poor', `${lcp} ms`)
  else if (lcp > 2500) addFinding(findings, 'warn', 'lcp_needs_work', `${lcp} ms`)
  else addFinding(findings, 'good', 'lcp_good', `${lcp} ms`)

  if (inp > 500) addFinding(findings, 'danger', 'inp_poor', `${inp} ms`)
  else if (inp > 200) addFinding(findings, 'warn', 'inp_needs_work', `${inp} ms`)
  else addFinding(findings, 'good', 'inp_good', `${inp} ms`)

  if (cls > 0.25) addFinding(findings, 'danger', 'cls_poor', String(cls))
  else if (cls > 0.1) addFinding(findings, 'warn', 'cls_needs_work', String(cls))
  else addFinding(findings, 'good', 'cls_good', String(cls))

  if (ttfb > 1800) addFinding(findings, 'danger', 'ttfb_high', `${ttfb} ms`)
  else if (ttfb > 800) addFinding(findings, 'warn', 'ttfb_watch', `${ttfb} ms`)

  if (fcp > 3000) addFinding(findings, 'danger', 'fcp_high', `${fcp} ms`)
  else if (fcp > 1800) addFinding(findings, 'warn', 'fcp_watch', `${fcp} ms`)

  if (tbt > 600) addFinding(findings, 'danger', 'tbt_high', `${tbt} ms`)
  else if (tbt > 300) addFinding(findings, 'warn', 'tbt_watch', `${tbt} ms`)

  if (speedIndex > 5800) addFinding(findings, 'warn', 'speed_index_high', `${speedIndex} ms`)

  if (draft.device === 'mobile' && js > 350)
    addFinding(findings, 'danger', 'js_mobile_heavy', `${js} KB`)
  else if (draft.device === 'mobile' && js > 170)
    addFinding(findings, 'warn', 'js_mobile_watch', `${js} KB`)
  if (css > 140) addFinding(findings, 'warn', 'css_heavy', `${css} KB`)
  if (image > 1200) addFinding(findings, 'warn', 'image_heavy', `${image} KB`)
  if (total > 3000) addFinding(findings, 'danger', 'total_heavy', `${total} KB`)
  else if (total > 1800) addFinding(findings, 'warn', 'total_watch', `${total} KB`)
  if (total > 0 && componentTotal > total)
    addFinding(
      findings,
      'danger',
      'components_exceed_total',
      `${round(componentTotal)} KB > ${total} KB`
    )
  if (total > 0 && thirdParty / total > 0.35)
    addFinding(findings, 'warn', 'third_party_share', `${round((thirdParty / total) * 100)}%`)
  if (thirdParty > 0 && !firstPartyHostnames(draft).length)
    addFinding(findings, 'warn', 'missing_first_party_hosts', 'firstPartyHostnames')
  if (requests > 100) addFinding(findings, 'danger', 'too_many_requests', String(requests))
  else if (requests > 70) addFinding(findings, 'warn', 'request_watch', String(requests))
  if (thirdPartyRequests > 18)
    addFinding(findings, 'warn', 'third_party_requests', String(thirdPartyRequests))

  compareParsed(findings, parsed.metrics.lcpMs, lcp, 'parsed_lcp_over', 'LCP')
  compareParsed(findings, parsed.metrics.inpMs, inp, 'parsed_inp_over', 'INP')
  compareParsed(findings, parsed.metrics.cls, cls, 'parsed_cls_over', 'CLS', 3)
  compareParsed(findings, parsed.metrics.ttfbMs, ttfb, 'parsed_ttfb_over', 'TTFB')
  compareParsed(findings, parsed.resources.jsKb, js, 'parsed_js_over', 'JavaScript', 1)
  compareParsed(findings, parsed.resources.cssKb, css, 'parsed_css_over', 'CSS', 1)
  compareParsed(findings, parsed.resources.imageKb, image, 'parsed_image_over', 'Images', 1)
  compareParsed(
    findings,
    parsed.resources.thirdPartyKb,
    thirdParty,
    'parsed_third_party_over',
    'Third-party',
    1
  )
  compareParsed(findings, parsed.resources.totalKb, total, 'parsed_total_over', 'Total', 1)
  compareParsed(
    findings,
    parsed.resources.requestCount,
    requests,
    'parsed_requests_over',
    'Requests'
  )

  if (parsed.budgets.length)
    addFinding(findings, 'good', 'budget_json_parsed', `${parsed.budgets.length}`)
  if (parsed.rawRows.length)
    addFinding(findings, 'good', 'parser_found', `${parsed.rawRows.length}`)
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

export default function PerformanceBudgetClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<PerformanceBudgetDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('budget')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('truncated')) return next

    return { ...next, errors: [...next.errors, 'truncated'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditBudget(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      budgets: parsed.budgets.slice(0, OUTPUT_PREVIEW_ROWS),
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      metrics: parsed.metrics,
      rawRows: parsed.rawRows.slice(0, OUTPUT_PREVIEW_ROWS),
      resources: parsed.resources
    }),
    [parsed.budgets, parsed.errors, parsed.metrics, parsed.rawRows, parsed.resources]
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
  const outputPreviewUsesRows = outputType === 'json'
  const outputPreviewVisibleRows = outputPreviewUsesRows
    ? outputPreviewParsed.budgets.length +
      outputPreviewParsed.rawRows.length +
      outputPreviewFindings.length
    : 0
  const outputPreviewTotalRows = outputPreviewUsesRows
    ? parsed.budgets.length + parsed.rawRows.length + findings.length
    : 0
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(draft), [draft])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.performance_budget.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    const rows = [
      ...Object.entries(parsed.metrics).map(([key, value]) => ({
        label: key,
        value: String(value)
      })),
      ...Object.entries(parsed.resources).map(([key, value]) => ({
        label: key,
        value: String(value)
      })),
      ...parsed.budgets.map(item => ({
        label: `${item.path} ${item.resourceType}`,
        value: `${item.sizeKb} KB`
      })),
      ...parsed.rawRows
    ]
    if (!query) return rows
    return rows.filter(row => `${row.label} ${row.value}`.toLowerCase().includes(query))
  }, [deferredParsedQuery, parsed])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      lcp: `${numberFromInput(draft.lcpMs)} ms`,
      requests: numberFromInput(draft.requestCount),
      score,
      total: `${numberFromInput(draft.totalKb)} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.lcpMs, draft.requestCount, draft.totalKb, findings, score]
  )

  const updateDraft = <Key extends keyof PerformanceBudgetDraft>(
    key: Key,
    value: PerformanceBudgetDraft[Key]
  ) => {
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
    setOutputType('budget')
    setAuditQuery('')
    setParsedQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.performance_budget.summary_title'),
        `${t('app.converter.performance_budget.metric.score')}: ${metrics.score}`,
        `${t('app.converter.performance_budget.metric.lcp')}: ${metrics.lcp}`,
        `${t('app.converter.performance_budget.metric.total')}: ${metrics.total}`,
        `${t('app.converter.performance_budget.metric.requests')}: ${metrics.requests}`,
        `${t('app.converter.performance_budget.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.performance_budget.metric.critical')}: ${metrics.critical}`
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
                <Rocket className="h-4 w-4" />
                {t('app.converter.performance-budget')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.performance-budget')}
              </CardTitle>
              <CardDescription>{t('app.converter.performance_budget.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.performance_budget.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.performance_budget.metric.score')}
              value={metrics.score}
            />
            <Metric label={t('app.converter.performance_budget.metric.lcp')} value={metrics.lcp} />
            <Metric
              label={t('app.converter.performance_budget.metric.total')}
              value={metrics.total}
            />
            <Metric
              label={t('app.converter.performance_budget.metric.requests')}
              value={metrics.requests}
            />
            <Metric
              label={t('app.converter.performance_budget.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.performance_budget.metric.critical')}
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
              {t('app.converter.performance_budget.presets')}
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
                {t(`app.converter.performance_budget.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.performance_budget.preset.${preset.key}_hint`)}
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
                {t('app.converter.performance_budget.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.performance_budget.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-route">
                  {t('app.converter.performance_budget.route_pattern')}
                </Label>
                <Input
                  id="budget-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-hosts">
                  {t('app.converter.performance_budget.first_party_hosts')}
                </Label>
                <Input
                  id="budget-hosts"
                  value={draft.firstPartyHostnames}
                  onChange={event =>
                    updateDraft('firstPartyHostnames', event.target.value.slice(0, 260))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-device">
                  {t('app.converter.performance_budget.device')}
                </Label>
                <Select
                  id="budget-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.performance_budget.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-percentile">
                  {t('app.converter.performance_budget.percentile')}
                </Label>
                <Select
                  id="budget-percentile"
                  value={draft.percentile}
                  onChange={event => updateDraft('percentile', event.target.value as Percentile)}
                >
                  {PERCENTILES.map(percentile => (
                    <option key={percentile} value={percentile}>
                      {t(`app.converter.performance_budget.percentile.${percentile}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.performance_budget.core_vitals')}</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(
                  [
                    ['lcpMs', 'lcp'],
                    ['inpMs', 'inp'],
                    ['clsScore', 'cls'],
                    ['ttfbMs', 'ttfb'],
                    ['fcpMs', 'fcp'],
                    ['tbtMs', 'tbt'],
                    ['speedIndexMs', 'speed_index']
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`budget-${key}`}>
                      {t(`app.converter.performance_budget.${label}`)}
                    </Label>
                    <Input
                      id={`budget-${key}`}
                      value={draft[key]}
                      onChange={event => updateDraft(key, event.target.value.slice(0, 12))}
                      className="font-mono"
                      inputMode="decimal"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.performance_budget.resource_budgets')}</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(
                  [
                    ['jsKb', 'js_kb'],
                    ['cssKb', 'css_kb'],
                    ['imageKb', 'image_kb'],
                    ['fontKb', 'font_kb'],
                    ['thirdPartyKb', 'third_party_kb'],
                    ['totalKb', 'total_kb'],
                    ['requestCount', 'request_count'],
                    ['scriptRequests', 'script_requests'],
                    ['imageRequests', 'image_requests'],
                    ['thirdPartyRequests', 'third_party_requests']
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`budget-${key}`}>
                      {t(`app.converter.performance_budget.${label}`)}
                    </Label>
                    <Input
                      id={`budget-${key}`}
                      value={draft[key]}
                      onChange={event => updateDraft(key, event.target.value.slice(0, 12))}
                      className="font-mono"
                      inputMode="decimal"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.performance_budget.preview')}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-[var(--text-primary)]">
                {buildBudgetJson(draft)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.performance_budget.workspace')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.performance_budget.workspace_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.performance_budget.workspace_placeholder')}
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
                {t('app.converter.performance_budget.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.performance_budget.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 28).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.performance_budget.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.performance_budget.level.${finding.level}`)}
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
                  {t('app.converter.performance_budget.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.performance_budget.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="budget-output-type">
                  {t('app.converter.performance_budget.output_type')}
                </Label>
                <Select
                  id="budget-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.performance_budget.output.${type}`)}
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
                {t('app.converter.performance_budget.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'performance-budget.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.performance_budget.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentCsv(),
                    'performance-budget.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.performance_budget.download_csv')}
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
                {t('app.converter.performance_budget.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.performance_budget.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRows.slice(0, 48).map((row, index) => (
                  <div
                    key={`${row.label}:${row.value}:${index}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {row.label}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.performance_budget.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.performance_budget.reference')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.performance_budget.reference_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.performance_budget.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.performance_budget.reference.${item}_hint`)}
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
              {t('app.converter.performance_budget.checklist')}
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
                {item === 'ci' ? <Zap className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                {t(`app.converter.performance_budget.checklist.${item}.title`)}
              </div>
              {t(`app.converter.performance_budget.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
