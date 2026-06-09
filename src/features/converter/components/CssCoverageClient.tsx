'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  Paintbrush,
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

const FRAMEWORKS = ['next', 'vite', 'webpack', 'astro', 'plain'] as const
const CSS_KINDS = ['route', 'global', 'component', 'third_party', 'inline', 'print'] as const
const OUTPUT_TYPES = ['purge', 'critical', 'next', 'playbook', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const SAMPLE_LIMIT = 180

type Framework = (typeof FRAMEWORKS)[number]
type CssKind = (typeof CSS_KINDS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ParsedSource = 'css' | 'coverage' | 'json' | 'manual' | 'text'

interface CoverageDraft {
  aboveFoldSelectors: string
  criticalCssKb: string
  criticalExtracted: boolean
  duplicateSelectors: string
  framework: Framework
  hashedCss: boolean
  inlineCssKb: string
  mediaQueryCount: string
  purgeConfigured: boolean
  routePattern: string
  routeScoped: boolean
  sampleCount: string
  selectorCount: string
  sourceMapAvailable: boolean
  stylesheetKind: CssKind
  stylesheetUrl: string
  thirdParty: boolean
  totalCssKb: string
  unusedCssKb: string
  unusedRuleCount: string
}

interface ParsedCoverageSample {
  criticalKb: number
  duplicateSelectors: number
  id: string
  mediaQueries: number
  route: string
  selectorCount: number
  source: ParsedSource
  stylesheetKind: CssKind
  totalKb: number
  unusedKb: number
  unusedRules: number
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  samples: ParsedCoverageSample[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: CoverageDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: CoverageDraft = {
  aboveFoldSelectors: '.product-hero, .price-card, .buy-button',
  criticalCssKb: '18',
  criticalExtracted: true,
  duplicateSelectors: '2',
  framework: 'next',
  hashedCss: true,
  inlineCssKb: '6',
  mediaQueryCount: '18',
  purgeConfigured: true,
  routePattern: '/products/:slug',
  routeScoped: true,
  sampleCount: '1800',
  selectorCount: '420',
  sourceMapAvailable: true,
  stylesheetKind: 'route',
  stylesheetUrl: '/_next/static/css/product.css',
  thirdParty: false,
  totalCssKb: '92',
  unusedCssKb: '24',
  unusedRuleCount: '90'
}

const PRESETS: Preset[] = [
  {
    key: 'healthy',
    draft: DEFAULT_DRAFT,
    workspace: [
      'css=/_next/static/css/product.css route=/products/example kind=route total=92 unused=24 critical=18 selectors=420 unusedRules=90 duplicates=2 media=18',
      '.product-hero, .price-card { display: grid; }',
      '.buy-button { color: white; }'
    ].join('\n')
  },
  {
    key: 'global_bloat',
    draft: {
      ...DEFAULT_DRAFT,
      criticalCssKb: '44',
      criticalExtracted: false,
      duplicateSelectors: '24',
      mediaQueryCount: '64',
      purgeConfigured: false,
      routeScoped: false,
      selectorCount: '1840',
      stylesheetKind: 'global',
      stylesheetUrl: '/assets/app.css',
      totalCssKb: '420',
      unusedCssKb: '310',
      unusedRuleCount: '1260'
    },
    workspace: [
      'css=/assets/app.css route=/dashboard kind=global total=420 unused=310 critical=44 selectors=1840 unusedRules=1260 duplicates=24 media=64',
      '/* Lighthouse */ {"url":"/assets/app.css","totalBytes":430080,"wastedBytes":317440,"selectorCount":1840,"unusedRuleCount":1260}'
    ].join('\n')
  },
  {
    key: 'critical_candidate',
    draft: {
      ...DEFAULT_DRAFT,
      criticalCssKb: '72',
      criticalExtracted: false,
      inlineCssKb: '0',
      mediaQueryCount: '38',
      routeScoped: true,
      selectorCount: '760',
      totalCssKb: '180',
      unusedCssKb: '95',
      unusedRuleCount: '380'
    },
    workspace: [
      'css=/_next/static/css/article.css route=/articles/:slug kind=route total=180 unused=95 critical=72 selectors=760 unusedRules=380 media=38',
      '.article-hero, .headline, .dek, .author-card { content-visibility: auto; }'
    ].join('\n')
  },
  {
    key: 'third_party',
    draft: {
      ...DEFAULT_DRAFT,
      criticalCssKb: '28',
      duplicateSelectors: '12',
      mediaQueryCount: '44',
      routeScoped: false,
      selectorCount: '980',
      stylesheetKind: 'third_party',
      stylesheetUrl: 'https://cdn.example.com/widgets.css',
      thirdParty: true,
      totalCssKb: '210',
      unusedCssKb: '142',
      unusedRuleCount: '620'
    },
    workspace: [
      'css=https://cdn.example.com/widgets.css route=/checkout kind=third_party total=210 unused=142 critical=28 selectors=980 unusedRules=620 duplicates=12 media=44',
      '.widget-card, .widget-card .title, .widget-card .title { color: inherit; }'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      aboveFoldSelectors: '.checkout, .payment, .summary',
      criticalCssKb: '118',
      criticalExtracted: false,
      duplicateSelectors: '48',
      framework: 'next',
      hashedCss: false,
      inlineCssKb: '62',
      mediaQueryCount: '96',
      purgeConfigured: false,
      routePattern: '/checkout',
      routeScoped: false,
      sampleCount: '38',
      selectorCount: '2640',
      sourceMapAvailable: false,
      stylesheetKind: 'global',
      stylesheetUrl: 'http://cdn.example.com/private/checkout.css?token=abc',
      thirdParty: true,
      totalCssKb: '760',
      unusedCssKb: '610',
      unusedRuleCount: '2180'
    },
    workspace: [
      '{"url":"http://cdn.example.com/private/checkout.css?token=abc","route":"/checkout","totalBytes":778240,"wastedBytes":624640,"criticalKb":118,"selectorCount":2640,"unusedRuleCount":2180,"duplicateSelectors":48,"mediaQueries":96,"kind":"global"}',
      'css=http://cdn.example.com/private/checkout.css?token=abc route=/checkout kind=global total=760 unused=610 critical=118 selectors=2640 unusedRules=2180 duplicates=48 media=96',
      '.checkout .button, .checkout .button, .unused-panel, .unused-panel .title { color: red; }'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['coverage', 'critical', 'scope', 'purge', 'duplicates', 'field'] as const
const CHECKLIST_ITEMS = ['capture', 'extract', 'purge', 'measure'] as const
const NUMERIC_FIELDS: Array<
  [
    keyof Pick<
      CoverageDraft,
      | 'criticalCssKb'
      | 'duplicateSelectors'
      | 'inlineCssKb'
      | 'mediaQueryCount'
      | 'sampleCount'
      | 'selectorCount'
      | 'totalCssKb'
      | 'unusedCssKb'
      | 'unusedRuleCount'
    >,
    string
  ]
> = [
  ['totalCssKb', 'total_css'],
  ['unusedCssKb', 'unused_css'],
  ['criticalCssKb', 'critical_css'],
  ['selectorCount', 'selector_count'],
  ['unusedRuleCount', 'unused_rule_count'],
  ['duplicateSelectors', 'duplicate_selectors'],
  ['mediaQueryCount', 'media_query_count'],
  ['inlineCssKb', 'inline_css'],
  ['sampleCount', 'sample_count']
]

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const kbFromBytes = (value: number) => Math.round(value / 102.4) / 10
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
const isHttpUrl = (value: string) => /^http:/iu.test(value)
const isPrivateUrl = (value: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=|\/private\//iu.test(value)

const normalizeKind = (value: unknown): CssKind => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (CSS_KINDS.includes(token as CssKind)) return token as CssKind
  if (/third|vendor|cdn|external/iu.test(token)) return 'third_party'
  if (/global|app|base|site/iu.test(token)) return 'global'
  if (/component|module/iu.test(token)) return 'component'
  if (/inline|style-tag/iu.test(token)) return 'inline'
  if (/print/iu.test(token)) return 'print'
  return 'route'
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

const addSample = (samples: ParsedCoverageSample[], sample: Omit<ParsedCoverageSample, 'id'>) => {
  if (!sample.url && !sample.route && !sample.totalKb && !sample.unusedKb) return
  samples.push({
    ...sample,
    id: `${sample.source}-${samples.length}-${sample.url || sample.route || sample.totalKb}`
  })
}

const collectJsonSamples = (value: unknown, samples: ParsedCoverageSample[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonSamples(item, samples))
    return
  }
  if (typeof value !== 'object') return
  const record = value as Record<string, unknown>
  const url = getRecordString(record, ['url', 'name', 'href', 'stylesheet'])
  const totalBytes = getRecordNumber(record, ['totalBytes', 'totalByteCount', 'textLength'])
  const usedBytes = getRecordNumber(record, ['usedBytes', 'usedByteCount'])
  const wastedBytes = getRecordNumber(record, [
    'wastedBytes',
    'unusedBytes',
    'unusedCssBytes',
    'wastedCssBytes'
  ])
  const totalKb =
    getRecordNumber(record, ['totalKb', 'total', 'transferKb']) ||
    (totalBytes ? kbFromBytes(totalBytes) : 0)
  const unusedKb =
    getRecordNumber(record, ['unusedKb', 'unused', 'wastedKb']) ||
    (wastedBytes
      ? kbFromBytes(wastedBytes)
      : usedBytes && totalBytes
        ? kbFromBytes(Math.max(0, totalBytes - usedBytes))
        : 0)

  if (url || totalKb || unusedKb) {
    addSample(samples, {
      criticalKb: getRecordNumber(record, ['criticalKb', 'criticalCssKb', 'critical']),
      duplicateSelectors: getRecordNumber(record, ['duplicateSelectors', 'duplicates']),
      mediaQueries: getRecordNumber(record, ['mediaQueries', 'mediaQueryCount', 'media']),
      route: getRecordString(record, ['route', 'path', 'routePattern']),
      selectorCount: getRecordNumber(record, ['selectorCount', 'selectors', 'rules']),
      source: 'json',
      stylesheetKind: normalizeKind(getRecordString(record, ['kind', 'type', 'stylesheetKind'])),
      totalKb,
      unusedKb,
      unusedRules: getRecordNumber(record, ['unusedRuleCount', 'unusedRules', 'wastedRules']),
      url
    })
  }

  ;['items', 'entries', 'resources', 'details', 'children', 'nodes'].forEach(key => {
    if (record[key] !== undefined) collectJsonSamples(record[key], samples)
  })
}

const parseJsonSamples = (input: string): { errors: string[]; samples: ParsedCoverageSample[] } => {
  const errors: string[] = []
  const samples: ParsedCoverageSample[] = []
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

const extractSelectorStats = (line: string) => {
  const beforeBrace = line.split('{')[0] ?? ''
  const selectors = beforeBrace
    .split(',')
    .map(selector => selector.trim())
    .filter(Boolean)
  const unique = new Set(selectors)
  return {
    duplicates: Math.max(0, selectors.length - unique.size),
    selectors: selectors.length
  }
}

const parseTextSamples = (input: string): ParsedCoverageSample[] => {
  const samples: ParsedCoverageSample[] = []
  let cssSelectors = 0
  let cssDuplicates = 0
  let cssMedia = 0

  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    if (/^@media\b/iu.test(trimmed)) cssMedia += 1
    if (trimmed.includes('{') && !/^\s*(?:@font-face|@keyframes)/iu.test(trimmed)) {
      const stats = extractSelectorStats(trimmed)
      cssSelectors += stats.selectors
      cssDuplicates += stats.duplicates
    }
    if (!/(css|url|total|unused|coverage)\s*=/iu.test(trimmed)) return
    addSample(samples, {
      criticalKb: numberFromInput(
        tokenValue(trimmed, 'critical') || tokenValue(trimmed, 'criticalKb')
      ),
      duplicateSelectors: numberFromInput(tokenValue(trimmed, 'duplicates')),
      mediaQueries: numberFromInput(tokenValue(trimmed, 'media')),
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      selectorCount: numberFromInput(
        tokenValue(trimmed, 'selectors') || tokenValue(trimmed, 'rules')
      ),
      source: 'text',
      stylesheetKind: normalizeKind(tokenValue(trimmed, 'kind') || tokenValue(trimmed, 'type')),
      totalKb: numberFromInput(tokenValue(trimmed, 'total') || tokenValue(trimmed, 'totalKb')),
      unusedKb: numberFromInput(tokenValue(trimmed, 'unused') || tokenValue(trimmed, 'wasted')),
      unusedRules: numberFromInput(
        tokenValue(trimmed, 'unusedRules') || tokenValue(trimmed, 'wastedRules')
      ),
      url: tokenValue(trimmed, 'css') || tokenValue(trimmed, 'url') || tokenValue(trimmed, 'href')
    })
  })

  if (cssSelectors) {
    addSample(samples, {
      criticalKb: 0,
      duplicateSelectors: cssDuplicates,
      mediaQueries: cssMedia,
      route: '',
      selectorCount: cssSelectors,
      source: 'css',
      stylesheetKind: 'inline',
      totalKb: 0,
      unusedKb: 0,
      unusedRules: 0,
      url: ''
    })
  }

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

const draftSample = (draft: CoverageDraft): ParsedCoverageSample => ({
  criticalKb: numberFromInput(draft.criticalCssKb),
  duplicateSelectors: numberFromInput(draft.duplicateSelectors),
  id: 'manual-draft',
  mediaQueries: numberFromInput(draft.mediaQueryCount),
  route: draft.routePattern,
  selectorCount: numberFromInput(draft.selectorCount),
  source: 'manual',
  stylesheetKind: draft.stylesheetKind,
  totalKb: numberFromInput(draft.totalCssKb),
  unusedKb: numberFromInput(draft.unusedCssKb),
  unusedRules: numberFromInput(draft.unusedRuleCount),
  url: draft.stylesheetUrl
})

const unusedPercent = (totalKb: number, unusedKb: number) =>
  totalKb > 0 ? Math.round((unusedKb / totalKb) * 100) : 0

const auditSample = (
  sample: ParsedCoverageSample,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  const percent = unusedPercent(sample.totalKb, sample.unusedKb)
  const subject = sample.url || sample.route || sample.source
  if (sample.totalKb > 500)
    add('danger', `${prefix}total_css_heavy`, `${subject}: ${sample.totalKb} KB`)
  else if (sample.totalKb > 180)
    add('warn', `${prefix}total_css_heavy`, `${subject}: ${sample.totalKb} KB`)
  if (percent > 75) add('danger', `${prefix}unused_css_severe`, `${subject}: ${percent}%`)
  else if (percent > 45) add('warn', `${prefix}unused_css_high`, `${subject}: ${percent}%`)
  if (sample.criticalKb > 80)
    add('danger', `${prefix}critical_css_large`, `${subject}: ${sample.criticalKb} KB`)
  else if (sample.criticalKb > 32)
    add('warn', `${prefix}critical_css_large`, `${subject}: ${sample.criticalKb} KB`)
  if (sample.selectorCount > 1800)
    add('danger', `${prefix}selector_count_high`, `${subject}: ${sample.selectorCount}`)
  else if (sample.selectorCount > 900)
    add('warn', `${prefix}selector_count_high`, `${subject}: ${sample.selectorCount}`)
  if (sample.unusedRules > 1200)
    add('danger', `${prefix}unused_rules_high`, `${subject}: ${sample.unusedRules}`)
  else if (sample.unusedRules > 450)
    add('warn', `${prefix}unused_rules_high`, `${subject}: ${sample.unusedRules}`)
  if (sample.duplicateSelectors > 20)
    add('warn', `${prefix}duplicate_selectors`, `${subject}: ${sample.duplicateSelectors}`)
  if (sample.mediaQueries > 70)
    add('warn', `${prefix}media_query_bloat`, `${subject}: ${sample.mediaQueries}`)
  if (sample.stylesheetKind === 'global' && percent > 35)
    add('warn', `${prefix}global_bloat`, subject)
  if (sample.stylesheetKind === 'third_party' && percent > 35)
    add('warn', `${prefix}third_party_bloat`, subject)
  if (isHttpUrl(sample.url)) add('danger', `${prefix}http_url`, sample.url)
  if (isPrivateUrl(sample.url)) add('warn', `${prefix}private_url`, sample.url)
}

const auditCoverage = (draft: CoverageDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftSample(draft)
  const samples = numberFromInput(draft.sampleCount)
  const inlineKb = numberFromInput(draft.inlineCssKb)
  const criticalKb = numberFromInput(draft.criticalCssKb)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (!draft.stylesheetUrl.trim()) add('danger', 'missing_stylesheet', 'stylesheet')
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  auditSample(manual, add)
  if (!draft.purgeConfigured && manual.unusedKb > 40) add('warn', 'purge_missing', draft.framework)
  if (!draft.criticalExtracted && criticalKb > 28)
    add('warn', 'critical_not_extracted', `${criticalKb} KB`)
  if (!draft.routeScoped && manual.stylesheetKind !== 'component')
    add('warn', 'route_scope_missing', draft.routePattern)
  if (!draft.hashedCss && manual.totalKb > 120) add('warn', 'hashing_missing', draft.stylesheetUrl)
  if (!draft.sourceMapAvailable && manual.totalKb > 120)
    add('warn', 'source_map_missing', draft.stylesheetUrl)
  if (draft.thirdParty) add('warn', 'third_party_css', draft.stylesheetUrl)
  if (inlineKb > 40) add('warn', 'inline_css_heavy', `${inlineKb} KB`)

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
    add('good', 'purge_ok', draft.framework)
    add('good', 'critical_ok', `${criticalKb} KB`)
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

const buildPurge = (draft: CoverageDraft) =>
  [
    'module.exports = {',
    "  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}', './app/**/*.{ts,tsx,mdx}'],",
    '  safelist: [',
    ...draft.aboveFoldSelectors
      .split(',')
      .map(selector => selector.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map(selector => `    '${selector.replace(/^[.#]/u, '').replaceAll("'", '')}',`),
    '  ],',
    '}'
  ].join('\n')

const buildCritical = (draft: CoverageDraft) =>
  [
    `/* Critical CSS extraction plan for ${draft.routePattern} */`,
    `/* Target inline budget: ${Math.min(numberFromInput(draft.criticalCssKb), 28)} KB */`,
    ...draft.aboveFoldSelectors
      .split(',')
      .map(selector => selector.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map(selector => `${selector} { /* keep above-fold declarations */ }`),
    '',
    `/* Load the remaining stylesheet async or route-scoped: ${draft.stylesheetUrl} */`
  ].join('\n')

const buildNext = (draft: CoverageDraft) =>
  [
    `// Route-scoped CSS plan for ${draft.routePattern}`,
    `import '${escapeJs(draft.stylesheetUrl.startsWith('/') ? draft.stylesheetUrl : './route.css')}'`,
    '',
    'export default function RouteShell({ children }: { children: React.ReactNode }) {',
    '  return children',
    '}'
  ].join('\n')

const buildPlaybook = (draft: CoverageDraft) =>
  [
    `# CSS coverage playbook for ${draft.routePattern}`,
    '',
    '1. Capture Chrome Coverage or Lighthouse unused-css data for the real route and device.',
    '2. Separate route CSS, global CSS, component CSS, third-party CSS, and inline style tags.',
    '3. Extract only above-fold selectors into a tiny critical CSS budget.',
    '4. Purge unused selectors with a safelist for dynamic classes.',
    '5. Split shared global styles from route-only stylesheets.',
    '6. Re-measure render blocking, CLS, LCP, and repeat-view cache behavior.'
  ].join('\n')

const buildMarkdown = (draft: CoverageDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# CSS coverage audit: ${draft.routePattern}`,
    '',
    `- Stylesheet: ${draft.stylesheetUrl}`,
    `- Total CSS: ${draft.totalCssKb} KB`,
    `- Unused CSS: ${draft.unusedCssKb} KB`,
    `- Critical CSS: ${draft.criticalCssKb} KB`,
    `- Coverage: ${100 - unusedPercent(numberFromInput(draft.totalCssKb), numberFromInput(draft.unusedCssKb))}% used`,
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
          `- ${sample.url || sample.route || sample.source}: ${sample.totalKb} KB total / ${sample.unusedKb} KB unused / ${unusedPercent(sample.totalKb, sample.unusedKb)}% unused`
      )
  ].join('\n')

const buildCsv = (draft: CoverageDraft, parsed: ParsedWorkspace) => {
  const rows = [draftSample(draft), ...parsed.samples]
  return [
    [
      'source',
      'route',
      'url',
      'kind',
      'total_kb',
      'unused_kb',
      'unused_percent',
      'critical_kb',
      'selectors',
      'unused_rules',
      'duplicates',
      'media_queries'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(sample =>
      [
        sample.source,
        sample.route,
        sample.url,
        sample.stylesheetKind,
        sample.totalKb,
        sample.unusedKb,
        unusedPercent(sample.totalKb, sample.unusedKb),
        sample.criticalKb,
        sample.selectorCount,
        sample.unusedRules,
        sample.duplicateSelectors,
        sample.mediaQueries
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: CoverageDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'purge') return buildPurge(draft)
  if (outputType === 'critical') return buildCritical(draft)
  if (outputType === 'next') return buildNext(draft)
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

export default function CssCoverageClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CoverageDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('purge')
  const [auditQuery, setAuditQuery] = useState('')
  const [sampleQuery, setSampleQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredSampleQuery = useDeferredValue(sampleQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditCoverage(draft, parsed), [draft, parsed])
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
      `${item.key} ${item.subject} ${t(`app.converter.css_coverage.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredSampleQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(sample =>
      `${sample.url} ${sample.route} ${sample.stylesheetKind} ${sample.source}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredSampleQuery, rows])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      score,
      total: `${draft.totalCssKb} KB`,
      unused: `${draft.unusedCssKb} KB`,
      unusedPercent: `${unusedPercent(numberFromInput(draft.totalCssKb), numberFromInput(draft.unusedCssKb))}%`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.totalCssKb, draft.unusedCssKb, findings, score]
  )

  const updateDraft = <Key extends keyof CoverageDraft>(key: Key, value: CoverageDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('purge')
    setAuditQuery('')
    setSampleQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.css_coverage.summary_title'),
        `${t('app.converter.css_coverage.metric.score')}: ${metrics.score}`,
        `${t('app.converter.css_coverage.metric.total')}: ${metrics.total}`,
        `${t('app.converter.css_coverage.metric.unused')}: ${metrics.unused}`,
        `${t('app.converter.css_coverage.metric.unused_percent')}: ${metrics.unusedPercent}`,
        `${t('app.converter.css_coverage.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.css_coverage.metric.critical')}: ${metrics.critical}`
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
                <Paintbrush className="h-4 w-4" />
                {t('app.converter.css-coverage')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.css-coverage')}</CardTitle>
              <CardDescription>{t('app.converter.css_coverage.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.css_coverage.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.css_coverage.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.css_coverage.metric.total')} value={metrics.total} />
            <Metric label={t('app.converter.css_coverage.metric.unused')} value={metrics.unused} />
            <Metric
              label={t('app.converter.css_coverage.metric.unused_percent')}
              value={metrics.unusedPercent}
            />
            <Metric
              label={t('app.converter.css_coverage.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.css_coverage.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.css_coverage.presets')}</CardTitle>
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
                {t(`app.converter.css_coverage.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.css_coverage.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.css_coverage.model')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.css_coverage.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="css-route">{t('app.converter.css_coverage.route_pattern')}</Label>
                <Input
                  id="css-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="css-url">{t('app.converter.css_coverage.stylesheet_url')}</Label>
                <Input
                  id="css-url"
                  value={draft.stylesheetUrl}
                  onChange={event => updateDraft('stylesheetUrl', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="css-framework">{t('app.converter.css_coverage.framework')}</Label>
                <Select
                  id="css-framework"
                  value={draft.framework}
                  onChange={event => updateDraft('framework', event.target.value as Framework)}
                >
                  {FRAMEWORKS.map(framework => (
                    <option key={framework} value={framework}>
                      {t(`app.converter.css_coverage.framework.${framework}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="css-kind">{t('app.converter.css_coverage.stylesheet_kind')}</Label>
                <Select
                  id="css-kind"
                  value={draft.stylesheetKind}
                  onChange={event => updateDraft('stylesheetKind', event.target.value as CssKind)}
                >
                  {CSS_KINDS.map(kind => (
                    <option key={kind} value={kind}>
                      {t(`app.converter.css_coverage.kind.${kind}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {NUMERIC_FIELDS.map(([field, key]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`css-${field}`}>{t(`app.converter.css_coverage.${key}`)}</Label>
                  <Input
                    id={`css-${field}`}
                    value={draft[field]}
                    onChange={event => updateDraft(field, event.target.value.slice(0, 10))}
                    className="font-mono"
                    inputMode="decimal"
                  />
                </div>
              ))}
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="css-above-fold">
                  {t('app.converter.css_coverage.above_fold_selectors')}
                </Label>
                <Input
                  id="css-above-fold"
                  value={draft.aboveFoldSelectors}
                  onChange={event =>
                    updateDraft('aboveFoldSelectors', event.target.value.slice(0, 420))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Checkbox
                checked={draft.purgeConfigured}
                onChange={event => updateDraft('purgeConfigured', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.purge_configured')}
              />
              <Checkbox
                checked={draft.criticalExtracted}
                onChange={event => updateDraft('criticalExtracted', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.critical_extracted')}
              />
              <Checkbox
                checked={draft.routeScoped}
                onChange={event => updateDraft('routeScoped', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.route_scoped')}
              />
              <Checkbox
                checked={draft.hashedCss}
                onChange={event => updateDraft('hashedCss', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.hashed_css')}
              />
              <Checkbox
                checked={draft.sourceMapAvailable}
                onChange={event => updateDraft('sourceMapAvailable', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.source_map_available')}
              />
              <Checkbox
                checked={draft.thirdParty}
                onChange={event => updateDraft('thirdParty', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.css_coverage.third_party')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.css_coverage.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.css_coverage.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.css_coverage.workspace_placeholder')}
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
              <CardTitle className="text-base">{t('app.converter.css_coverage.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.css_coverage.audit_search')}
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
                      {t(`app.converter.css_coverage.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.css_coverage.level.${finding.level}`)}
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
                  {t('app.converter.css_coverage.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.css_coverage.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="css-output">{t('app.converter.css_coverage.output_type')}</Label>
                <Select
                  id="css-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.css_coverage.output.${type}`)}
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
                {t('app.converter.css_coverage.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'css-coverage-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.css_coverage.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'css-coverage.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.css_coverage.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.css_coverage.samples')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={sampleQuery}
                onChange={event => setSampleQuery(event.target.value)}
                placeholder={t('app.converter.css_coverage.sample_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(sample => (
                  <div key={sample.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {sample.url || sample.route || sample.source}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(unusedPercent(sample.totalKb, sample.unusedKb) > 75 ? 'danger' : unusedPercent(sample.totalKb, sample.unusedKb) > 45 ? 'warn' : 'good')}`}
                      >
                        {unusedPercent(sample.totalKb, sample.unusedKb)}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.css_coverage.kind.${sample.stylesheetKind}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.css_coverage.source.${sample.source}`)}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {sample.totalKb} KB / {sample.unusedKb} KB /{' '}
                      {t('app.converter.css_coverage.selectors_short')}{' '}
                      {sample.selectorCount || '-'} / {t('app.converter.css_coverage.rules_short')}{' '}
                      {sample.unusedRules || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.css_coverage.empty')}
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
                  {t('app.converter.css_coverage.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.css_coverage.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.css_coverage.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.css_coverage.reference.${item}_hint`)}
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
                  {t('app.converter.css_coverage.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.css_coverage.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.css_coverage.checklist.${item}.body`)}
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
