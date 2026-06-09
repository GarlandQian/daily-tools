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

const DEVICES = ['mobile', 'desktop'] as const
const RESOURCE_TYPES = ['style', 'script', 'font', 'image', 'document', 'other'] as const
const STRATEGIES = ['blocking', 'preload', 'defer', 'async', 'module', 'inline', 'lazy'] as const
const OUTPUT_TYPES = ['html', 'next', 'nginx', 'playbook', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const RESOURCE_LIMIT = 180

type Device = (typeof DEVICES)[number]
type ResourceType = (typeof RESOURCE_TYPES)[number]
type Strategy = (typeof STRATEGIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ParsedSource = 'har' | 'html' | 'json' | 'manual' | 'text'

interface BlockingDraft {
  blockingCount: string
  blockingTransferKb: string
  criticalCssKb: string
  device: Device
  discoveredAtMs: string
  documentTtfbMs: string
  fontDisplaySwap: boolean
  hasAsyncOrDefer: boolean
  inlineCriticalCss: boolean
  lcpDeltaMs: string
  preloadCoverage: boolean
  renderDelayMs: string
  requestChainDepth: string
  resourceType: ResourceType
  routePattern: string
  sampleCount: string
  strategy: Strategy
  thirdParty: boolean
  url: string
}

interface ParsedBlockingResource {
  chainDepth: number
  discoveredAt: number
  id: string
  priority: string
  renderBlocking: boolean
  resourceType: ResourceType
  route: string
  source: ParsedSource
  strategy: Strategy
  transferKb: number
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  resources: ParsedBlockingResource[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: BlockingDraft
  key: string
  workspace: string
}

const DEFAULT_DRAFT: BlockingDraft = {
  blockingCount: '2',
  blockingTransferKb: '92',
  criticalCssKb: '18',
  device: 'mobile',
  discoveredAtMs: '140',
  documentTtfbMs: '420',
  fontDisplaySwap: true,
  hasAsyncOrDefer: true,
  inlineCriticalCss: true,
  lcpDeltaMs: '180',
  preloadCoverage: true,
  renderDelayMs: '120',
  requestChainDepth: '2',
  resourceType: 'style',
  routePattern: '/products/:slug',
  sampleCount: '1800',
  strategy: 'preload',
  thirdParty: false,
  url: '/assets/product.css'
}

const PRESETS: Preset[] = [
  {
    key: 'healthy',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<link rel="preload" href="/assets/product.css" as="style">',
      '<link rel="stylesheet" href="/assets/product.css">',
      '<script src="/_next/static/chunks/product.js" defer></script>',
      'url=/assets/product.css type=style blocking=true kb=42 strategy=preload discovered=140 route=/products/example'
    ].join('\n')
  },
  {
    key: 'blocking_css',
    draft: {
      ...DEFAULT_DRAFT,
      blockingCount: '4',
      blockingTransferKb: '320',
      criticalCssKb: '96',
      inlineCriticalCss: false,
      lcpDeltaMs: '640',
      preloadCoverage: false,
      renderDelayMs: '520',
      requestChainDepth: '4',
      strategy: 'blocking',
      url: '/assets/marketing.css'
    },
    workspace: [
      '<link rel="stylesheet" href="/assets/marketing.css">',
      '<link rel="stylesheet" href="/assets/theme.css">',
      'url=/assets/marketing.css type=style blocking=true kb=210 strategy=blocking discovered=780 chain=4 route=/campaign',
      'url=/assets/theme.css type=style blocking=true kb=110 strategy=blocking discovered=920 chain=5 route=/campaign'
    ].join('\n')
  },
  {
    key: 'blocking_js',
    draft: {
      ...DEFAULT_DRAFT,
      blockingCount: '3',
      blockingTransferKb: '420',
      hasAsyncOrDefer: false,
      lcpDeltaMs: '760',
      renderDelayMs: '680',
      requestChainDepth: '5',
      resourceType: 'script',
      strategy: 'blocking',
      url: '/assets/app-shell.js'
    },
    workspace: [
      '<script src="/assets/app-shell.js"></script>',
      '<script src="/assets/vendor.js"></script>',
      'url=/assets/app-shell.js type=script blocking=true kb=260 strategy=blocking discovered=460 chain=4 route=/dashboard'
    ].join('\n')
  },
  {
    key: 'font_block',
    draft: {
      ...DEFAULT_DRAFT,
      blockingCount: '2',
      blockingTransferKb: '180',
      fontDisplaySwap: false,
      lcpDeltaMs: '420',
      renderDelayMs: '360',
      resourceType: 'font',
      strategy: 'blocking',
      url: 'https://fonts.example.com/inter.woff2'
    },
    workspace: [
      '<link rel="preload" href="https://fonts.example.com/inter.woff2" as="font" crossorigin>',
      '@font-face { font-family: Inter; src: url("https://fonts.example.com/inter.woff2"); font-display: block; }',
      'url=https://fonts.example.com/inter.woff2 type=font blocking=true kb=92 strategy=blocking discovered=520 route=/docs'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      blockingCount: '8',
      blockingTransferKb: '1180',
      criticalCssKb: '240',
      device: 'mobile',
      discoveredAtMs: '1240',
      documentTtfbMs: '1180',
      fontDisplaySwap: false,
      hasAsyncOrDefer: false,
      inlineCriticalCss: false,
      lcpDeltaMs: '1480',
      preloadCoverage: false,
      renderDelayMs: '1320',
      requestChainDepth: '8',
      resourceType: 'script',
      routePattern: '/checkout',
      sampleCount: '36',
      strategy: 'blocking',
      thirdParty: true,
      url: 'http://cdn.example.com/private/checkout.js?token=abc'
    },
    workspace: [
      '<link rel="stylesheet" href="http://cdn.example.com/private/checkout.css?token=abc">',
      '<script src="http://cdn.example.com/private/checkout.js?token=abc"></script>',
      '<script src="https://tags.example.com/manager.js"></script>',
      'url=http://cdn.example.com/private/checkout.js?token=abc type=script blocking=true kb=620 strategy=blocking discovered=1240 chain=8 route=/checkout priority=high',
      '{"url":"http://cdn.example.com/private/checkout.css?token=abc","type":"style","renderBlocking":true,"transferKb":560,"strategy":"blocking","discoveredAt":980,"chainDepth":7,"route":"/checkout"}'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['css', 'scripts', 'fonts', 'preload', 'chains', 'field'] as const
const CHECKLIST_ITEMS = ['inline', 'defer', 'preload', 'measure'] as const
const NUMERIC_FIELDS: Array<
  [
    keyof Pick<
      BlockingDraft,
      | 'blockingCount'
      | 'blockingTransferKb'
      | 'criticalCssKb'
      | 'discoveredAtMs'
      | 'documentTtfbMs'
      | 'lcpDeltaMs'
      | 'renderDelayMs'
      | 'requestChainDepth'
      | 'sampleCount'
    >,
    string
  ]
> = [
  ['blockingCount', 'blocking_count'],
  ['blockingTransferKb', 'blocking_transfer'],
  ['criticalCssKb', 'critical_css'],
  ['documentTtfbMs', 'document_ttfb'],
  ['discoveredAtMs', 'discovered_at'],
  ['renderDelayMs', 'render_delay'],
  ['lcpDeltaMs', 'lcp_delta'],
  ['requestChainDepth', 'chain_depth'],
  ['sampleCount', 'sample_count']
]

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
const isHttpUrl = (value: string) => /^http:/iu.test(value)
const isPrivateUrl = (value: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=|\/private\//iu.test(value)

const normalizeType = (value: unknown): ResourceType => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (RESOURCE_TYPES.includes(token as ResourceType)) return token as ResourceType
  if (/css|style|stylesheet/iu.test(token)) return 'style'
  if (/js|script|module/iu.test(token)) return 'script'
  if (/woff|font/iu.test(token)) return 'font'
  if (/img|image|avif|webp|png|jpg|jpeg/iu.test(token)) return 'image'
  if (/html|document/iu.test(token)) return 'document'
  return 'other'
}

const normalizeStrategy = (value: unknown): Strategy => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (STRATEGIES.includes(token as Strategy)) return token as Strategy
  if (/modulepreload|module/iu.test(token)) return 'module'
  if (/preload/iu.test(token)) return 'preload'
  if (/defer/iu.test(token)) return 'defer'
  if (/async/iu.test(token)) return 'async'
  if (/inline/iu.test(token)) return 'inline'
  if (/lazy/iu.test(token)) return 'lazy'
  return 'blocking'
}

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,>]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const attrValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'iu'))
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

const boolFromValue = (value: unknown) =>
  /^(true|1|yes|blocking)$/iu.test(String(value ?? '').trim())

const addResource = (
  resources: ParsedBlockingResource[],
  resource: Omit<ParsedBlockingResource, 'id'>
) => {
  if (!resource.url && !resource.transferKb && !resource.route) return
  resources.push({
    ...resource,
    id: `${resource.source}-${resources.length}-${resource.url || resource.route || resource.resourceType}`
  })
}

const parseHtmlResource = (line: string): Omit<ParsedBlockingResource, 'id'> | null => {
  const href = attrValue(line, 'href')
  const src = attrValue(line, 'src')
  const url = href || src
  if (!url) return null
  const rel = attrValue(line, 'rel')
  const asType = attrValue(line, 'as')
  const type = normalizeType(
    asType ||
      (/script/iu.test(line)
        ? 'script'
        : /stylesheet|style/iu.test(line)
          ? 'style'
          : /font/iu.test(line)
            ? 'font'
            : 'other')
  )
  const strategy = /defer/iu.test(line)
    ? 'defer'
    : /async/iu.test(line)
      ? 'async'
      : normalizeStrategy(rel || (type === 'style' || type === 'script' ? 'blocking' : 'lazy'))
  return {
    chainDepth: numberFromInput(tokenValue(line, 'chain')),
    discoveredAt: numberFromInput(tokenValue(line, 'discovered') || tokenValue(line, 'start')),
    priority: attrValue(line, 'fetchpriority') || tokenValue(line, 'priority') || 'auto',
    renderBlocking:
      /stylesheet/iu.test(line) ||
      (/script/iu.test(line) && !/defer|async|type=["']module/iu.test(line)),
    resourceType: type,
    route: tokenValue(line, 'route') || '',
    source: 'html',
    strategy,
    transferKb: numberFromInput(tokenValue(line, 'kb') || tokenValue(line, 'transfer')),
    url
  }
}

const collectJsonResources = (value: unknown, resources: ParsedBlockingResource[]) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonResources(item, resources))
    return
  }
  if (typeof value !== 'object') return
  const record = value as Record<string, unknown>
  const url = getRecordString(record, ['url', 'name', 'href', 'src'])
  const type = normalizeType(
    getRecordString(record, ['type', 'resourceType', 'initiatorType', 'as'])
  )
  const strategy = normalizeStrategy(getRecordString(record, ['strategy', 'rel', 'loading']))
  if (url || getRecordString(record, ['transferKb', 'transferSize', 'encodedBodySize'])) {
    addResource(resources, {
      chainDepth: numberFromInput(getRecordString(record, ['chainDepth', 'chain'])),
      discoveredAt: numberFromInput(
        getRecordString(record, ['discoveredAt', 'discoveredAtMs', 'startTime', 'start'])
      ),
      priority: getRecordString(record, ['priority', 'fetchPriority']) || 'auto',
      renderBlocking:
        boolFromValue(getRecordString(record, ['renderBlocking', 'blocking'])) ||
        strategy === 'blocking' ||
        type === 'style',
      resourceType: type,
      route: getRecordString(record, ['route', 'path', 'routePattern']),
      source: 'json',
      strategy,
      transferKb: numberFromInput(
        getRecordString(record, ['transferKb', 'transferSize', 'encodedBodySize', 'kb'])
      ),
      url
    })
  }
  ;['items', 'entries', 'resources', 'requests', 'children'].forEach(key => {
    if (record[key] !== undefined) collectJsonResources(record[key], resources)
  })
}

const parseJsonResources = (
  input: string
): { errors: string[]; resources: ParsedBlockingResource[] } => {
  const errors: string[] = []
  const resources: ParsedBlockingResource[] = []
  const trimmedInput = input.trim()
  if (/^[{[]/u.test(trimmedInput)) {
    try {
      collectJsonResources(JSON.parse(trimmedInput) as unknown, resources)
      return { errors, resources }
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
        collectJsonResources(JSON.parse(row) as unknown, resources)
      } catch {
        errors.push(`json:${index + 1}`)
      }
    })
  return { errors, resources }
}

const parseTextResources = (input: string): ParsedBlockingResource[] => {
  const resources: ParsedBlockingResource[] = []
  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    if (/<(?:link|script)\b/iu.test(trimmed)) {
      const parsed = parseHtmlResource(trimmed)
      if (parsed) addResource(resources, parsed)
      return
    }
    const url =
      tokenValue(trimmed, 'url') || tokenValue(trimmed, 'href') || tokenValue(trimmed, 'src')
    const type = normalizeType(tokenValue(trimmed, 'type') || tokenValue(trimmed, 'as'))
    const strategy = normalizeStrategy(
      tokenValue(trimmed, 'strategy') || tokenValue(trimmed, 'rel')
    )
    if (!url && !/blocking|render/iu.test(trimmed)) return
    addResource(resources, {
      chainDepth: numberFromInput(tokenValue(trimmed, 'chain')),
      discoveredAt: numberFromInput(
        tokenValue(trimmed, 'discovered') || tokenValue(trimmed, 'start')
      ),
      priority: tokenValue(trimmed, 'priority') || 'auto',
      renderBlocking:
        /blocking\s*=\s*(true|yes)|render-blocking|blocking/iu.test(trimmed) ||
        strategy === 'blocking' ||
        type === 'style',
      resourceType: type,
      route: tokenValue(trimmed, 'route') || tokenValue(trimmed, 'path'),
      source: 'text',
      strategy,
      transferKb: numberFromInput(
        tokenValue(trimmed, 'kb') || tokenValue(trimmed, 'transfer') || tokenValue(trimmed, 'size')
      ),
      url
    })
  })
  return resources
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonResources(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    resources: [...json.resources, ...parseTextResources(source)].slice(0, RESOURCE_LIMIT)
  }
}

const draftResource = (draft: BlockingDraft): ParsedBlockingResource => ({
  chainDepth: numberFromInput(draft.requestChainDepth),
  discoveredAt: numberFromInput(draft.discoveredAtMs),
  id: 'manual-draft',
  priority: draft.strategy === 'preload' ? 'high' : 'auto',
  renderBlocking: draft.strategy === 'blocking' || draft.resourceType === 'style',
  resourceType: draft.resourceType,
  route: draft.routePattern,
  source: 'manual',
  strategy: draft.strategy,
  transferKb: numberFromInput(draft.blockingTransferKb),
  url: draft.url
})

const auditResource = (
  resource: ParsedBlockingResource,
  add: (level: FindingLevel, key: string, subject: string) => void,
  parsed = false
) => {
  const prefix = parsed ? 'parsed_' : ''
  if (resource.renderBlocking && resource.transferKb > 300)
    add('danger', `${prefix}heavy_blocking`, `${resource.url}: ${resource.transferKb} KB`)
  else if (resource.renderBlocking && resource.transferKb > 120)
    add('warn', `${prefix}heavy_blocking`, `${resource.url}: ${resource.transferKb} KB`)
  if (
    resource.renderBlocking &&
    resource.resourceType === 'script' &&
    resource.strategy === 'blocking'
  )
    add('danger', `${prefix}blocking_script`, resource.url)
  if (resource.resourceType === 'style' && resource.strategy === 'blocking')
    add('warn', `${prefix}blocking_stylesheet`, resource.url)
  if (resource.resourceType === 'font' && resource.strategy === 'blocking')
    add('warn', `${prefix}blocking_font`, resource.url)
  if (resource.chainDepth > 4)
    add('warn', `${prefix}deep_chain`, `${resource.url}: ${resource.chainDepth}`)
  if (resource.discoveredAt > 900)
    add('warn', `${prefix}late_discovery`, `${resource.url}: ${resource.discoveredAt}ms`)
  if (isHttpUrl(resource.url)) add('danger', `${prefix}http_url`, resource.url)
  if (isPrivateUrl(resource.url)) add('warn', `${prefix}private_url`, resource.url)
}

const auditBlocking = (draft: BlockingDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const manual = draftResource(draft)
  const samples = numberFromInput(draft.sampleCount)
  const blockingCount = numberFromInput(draft.blockingCount)
  const blockingTransfer = numberFromInput(draft.blockingTransferKb)
  const criticalCss = numberFromInput(draft.criticalCssKb)
  const renderDelay = numberFromInput(draft.renderDelayMs)
  const lcpDelta = numberFromInput(draft.lcpDeltaMs)
  const ttfb = numberFromInput(draft.documentTtfbMs)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (samples < 100) add('warn', 'low_sample_count', String(samples))
  if (blockingCount > 6) add('danger', 'too_many_blockers', String(blockingCount))
  else if (blockingCount > 3) add('warn', 'too_many_blockers', String(blockingCount))
  if (blockingTransfer > 600) add('danger', 'blocking_transfer_high', `${blockingTransfer} KB`)
  else if (blockingTransfer > 220) add('warn', 'blocking_transfer_high', `${blockingTransfer} KB`)
  if (criticalCss > 120) add('warn', 'critical_css_large', `${criticalCss} KB`)
  if (!draft.inlineCriticalCss && criticalCss > 28)
    add('warn', 'critical_css_not_inline', `${criticalCss} KB`)
  if (!draft.preloadCoverage && draft.resourceType !== 'script')
    add('warn', 'missing_preload', draft.url)
  if (!draft.hasAsyncOrDefer && draft.resourceType === 'script')
    add('danger', 'missing_async_defer', draft.url)
  if (!draft.fontDisplaySwap && draft.resourceType === 'font')
    add('warn', 'missing_font_display', draft.url)
  if (draft.thirdParty) add('warn', 'third_party_blocker', draft.url)
  if (renderDelay > 800) add('danger', 'render_delay_high', `${renderDelay}ms`)
  else if (renderDelay > 300) add('warn', 'render_delay_high', `${renderDelay}ms`)
  if (lcpDelta > 1000) add('danger', 'lcp_delta_high', `${lcpDelta}ms`)
  else if (lcpDelta > 400) add('warn', 'lcp_delta_high', `${lcpDelta}ms`)
  if (ttfb > 1000) add('warn', 'ttfb_slow', `${ttfb}ms`)
  auditResource(manual, add)

  parsed.resources.forEach(resource => auditResource(resource, add, true))
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )
  if (!parsed.resources.length) add('warn', 'parser_empty', draft.routePattern)

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'preload_ok', draft.url)
    add('good', 'strategy_ok', draft.strategy)
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

const buildHtml = (draft: BlockingDraft) => {
  const url = escapeHtml(draft.url)
  if (draft.resourceType === 'style') {
    return [
      `<link rel="preload" href="${url}" as="style">`,
      `<link rel="stylesheet" href="${url}">`,
      '<style>',
      `  /* Inline the first ${Math.min(numberFromInput(draft.criticalCssKb), 32)} KB of route-critical CSS here. */`,
      '</style>'
    ].join('\n')
  }
  if (draft.resourceType === 'script') return `<script src="${url}" defer></script>`
  if (draft.resourceType === 'font')
    return `<link rel="preload" href="${url}" as="font" crossorigin>`
  return `<link rel="preload" href="${url}" as="${draft.resourceType}">`
}

const buildNext = (draft: BlockingDraft) =>
  [
    "import Script from 'next/script'",
    '',
    'export default function RouteShell() {',
    '  return (',
    '    <>',
    draft.resourceType === 'script'
      ? `      <Script src='${escapeJs(draft.url)}' strategy='afterInteractive' />`
      : `      <link rel='preload' href='${escapeJs(draft.url)}' as='${draft.resourceType === 'style' ? 'style' : draft.resourceType}' />`,
    '    </>',
    '  )',
    '}'
  ].join('\n')

const buildNginx = (draft: BlockingDraft) =>
  [
    'location = / {',
    `  add_header Link "<${draft.url}>; rel=preload; as=${draft.resourceType === 'style' ? 'style' : draft.resourceType}" always;`,
    '}'
  ].join('\n')

const buildPlaybook = (draft: BlockingDraft) =>
  [
    `# Render-blocking playbook for ${draft.routePattern}`,
    '',
    '1. Confirm the field route and device segment before changing priorities.',
    `2. Inspect ${draft.url || 'the blocking resource'} in the request chain and Coverage panel.`,
    '3. Inline only route-critical CSS, then load the rest normally.',
    '4. Add defer/async/module strategy to scripts that do not need parser-blocking execution.',
    '5. Preload only the few resources proven to affect LCP or first paint.',
    '6. Re-measure LCP, render delay, and Total Blocking Time after the change.'
  ].join('\n')

const buildMarkdown = (draft: BlockingDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# Render-blocking audit: ${draft.routePattern}`,
    '',
    `- Blocking resources: ${draft.blockingCount}`,
    `- Blocking transfer: ${draft.blockingTransferKb} KB`,
    `- Render delay: ${draft.renderDelayMs} ms`,
    `- LCP delta: ${draft.lcpDeltaMs} ms`,
    `- Primary resource: ${draft.url}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed resources',
    ...parsed.resources
      .slice(0, 24)
      .map(
        resource =>
          `- ${resource.url || '-'} / ${resource.resourceType} / ${resource.transferKb} KB / ${resource.strategy}`
      )
  ].join('\n')

const buildCsv = (draft: BlockingDraft, parsed: ParsedWorkspace) => {
  const rows = [draftResource(draft), ...parsed.resources]
  return [
    [
      'source',
      'route',
      'url',
      'type',
      'strategy',
      'render_blocking',
      'transfer_kb',
      'discovered_ms',
      'chain_depth',
      'priority'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(resource =>
      [
        resource.source,
        resource.route,
        resource.url,
        resource.resourceType,
        resource.strategy,
        resource.renderBlocking,
        resource.transferKb,
        resource.discoveredAt,
        resource.chainDepth,
        resource.priority
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: BlockingDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'html') return buildHtml(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'nginx') return buildNginx(draft)
  if (outputType === 'playbook') return buildPlaybook(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, resources: parsed.resources }, null, 2)
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

export default function RenderBlockingClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<BlockingDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')
  const [resourceQuery, setResourceQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredResourceQuery = useDeferredValue(resourceQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditBlocking(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const rows = useMemo(() => [draftResource(draft), ...parsed.resources], [draft, parsed.resources])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.render_blocking.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredRows = useMemo(() => {
    const query = deferredResourceQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(resource =>
      `${resource.url} ${resource.route} ${resource.resourceType} ${resource.strategy} ${resource.priority}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredResourceQuery, rows])
  const metrics = useMemo(
    () => ({
      blockers: draft.blockingCount,
      critical: findings.filter(item => item.level === 'danger').length,
      renderDelay: `${draft.renderDelayMs}ms`,
      resources: rows.length,
      score,
      transfer: `${draft.blockingTransferKb} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [
      draft.blockingCount,
      draft.blockingTransferKb,
      draft.renderDelayMs,
      findings,
      rows.length,
      score
    ]
  )

  const updateDraft = <Key extends keyof BlockingDraft>(key: Key, value: BlockingDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('html')
    setAuditQuery('')
    setResourceQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.render_blocking.summary_title'),
        `${t('app.converter.render_blocking.metric.score')}: ${metrics.score}`,
        `${t('app.converter.render_blocking.metric.blockers')}: ${metrics.blockers}`,
        `${t('app.converter.render_blocking.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.render_blocking.metric.render_delay')}: ${metrics.renderDelay}`,
        `${t('app.converter.render_blocking.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.render_blocking.metric.critical')}: ${metrics.critical}`
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
                {t('app.converter.render-blocking')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.render-blocking')}</CardTitle>
              <CardDescription>{t('app.converter.render_blocking.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.render_blocking.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.render_blocking.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.render_blocking.metric.blockers')}
              value={metrics.blockers}
            />
            <Metric
              label={t('app.converter.render_blocking.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric
              label={t('app.converter.render_blocking.metric.render_delay')}
              value={metrics.renderDelay}
            />
            <Metric
              label={t('app.converter.render_blocking.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.render_blocking.metric.critical')}
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
              {t('app.converter.render_blocking.presets')}
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
                {t(`app.converter.render_blocking.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.render_blocking.preset.${preset.key}_hint`)}
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
                {t('app.converter.render_blocking.model')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.render_blocking.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rb-route">{t('app.converter.render_blocking.route_pattern')}</Label>
                <Input
                  id="rb-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rb-device">{t('app.converter.render_blocking.device')}</Label>
                <Select
                  id="rb-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.render_blocking.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="rb-url">{t('app.converter.render_blocking.url')}</Label>
                <Input
                  id="rb-url"
                  value={draft.url}
                  onChange={event => updateDraft('url', event.target.value.slice(0, 320))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rb-type">{t('app.converter.render_blocking.resource_type')}</Label>
                <Select
                  id="rb-type"
                  value={draft.resourceType}
                  onChange={event =>
                    updateDraft('resourceType', event.target.value as ResourceType)
                  }
                >
                  {RESOURCE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.render_blocking.type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rb-strategy">{t('app.converter.render_blocking.strategy')}</Label>
                <Select
                  id="rb-strategy"
                  value={draft.strategy}
                  onChange={event => updateDraft('strategy', event.target.value as Strategy)}
                >
                  {STRATEGIES.map(strategy => (
                    <option key={strategy} value={strategy}>
                      {t(`app.converter.render_blocking.strategy.${strategy}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {NUMERIC_FIELDS.map(([field, key]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`rb-${field}`}>{t(`app.converter.render_blocking.${key}`)}</Label>
                  <Input
                    id={`rb-${field}`}
                    value={draft[field]}
                    onChange={event => updateDraft(field, event.target.value.slice(0, 10))}
                    className="font-mono"
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Checkbox
                checked={draft.inlineCriticalCss}
                onChange={event => updateDraft('inlineCriticalCss', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.render_blocking.inline_critical_css')}
              />
              <Checkbox
                checked={draft.preloadCoverage}
                onChange={event => updateDraft('preloadCoverage', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.render_blocking.preload_coverage')}
              />
              <Checkbox
                checked={draft.hasAsyncOrDefer}
                onChange={event => updateDraft('hasAsyncOrDefer', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.render_blocking.has_async_defer')}
              />
              <Checkbox
                checked={draft.fontDisplaySwap}
                onChange={event => updateDraft('fontDisplaySwap', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.render_blocking.font_display_swap')}
              />
              <Checkbox
                checked={draft.thirdParty}
                onChange={event => updateDraft('thirdParty', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.render_blocking.third_party')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.render_blocking.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.render_blocking.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.render_blocking.workspace_placeholder')}
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
              <CardTitle className="text-base">
                {t('app.converter.render_blocking.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.render_blocking.audit_search')}
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
                      {t(`app.converter.render_blocking.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.render_blocking.level.${finding.level}`)}
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
                  {t('app.converter.render_blocking.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.render_blocking.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="rb-output">{t('app.converter.render_blocking.output_type')}</Label>
                <Select
                  id="rb-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.render_blocking.output.${type}`)}
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
                {t('app.converter.render_blocking.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'render-blocking-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.render_blocking.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'render-blocking.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.render_blocking.download_csv')}
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
                {t('app.converter.render_blocking.resources')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={resourceQuery}
                onChange={event => setResourceQuery(event.target.value)}
                placeholder={t('app.converter.render_blocking.resource_search')}
                className="pl-10"
              />
            </div>
            {filteredRows.length ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {filteredRows.slice(0, 72).map(resource => (
                  <div key={resource.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {resource.url || resource.route || '-'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(resource.renderBlocking && resource.transferKb > 300 ? 'danger' : resource.renderBlocking ? 'warn' : 'good')}`}
                      >
                        {resource.transferKb} KB
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.render_blocking.type.${resource.resourceType}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.render_blocking.strategy.${resource.strategy}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.render_blocking.source.${resource.source}`)}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {resource.discoveredAt}ms /{' '}
                      {t('app.converter.render_blocking.chain_depth_short')}{' '}
                      {resource.chainDepth || '-'} / {resource.priority || 'auto'} /{' '}
                      {resource.route || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.render_blocking.empty')}
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
                  {t('app.converter.render_blocking.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.render_blocking.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.render_blocking.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.render_blocking.reference.${item}_hint`)}
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
                  {t('app.converter.render_blocking.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.render_blocking.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.render_blocking.checklist.${item}.body`)}
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
