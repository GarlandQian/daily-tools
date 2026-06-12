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
import { collectBoundedNonEmptyLines } from '@/utils/textScan'

const SCRIPT_CATEGORIES = [
  'analytics',
  'ads',
  'tag_manager',
  'chat',
  'video',
  'monitoring',
  'ab_test',
  'other'
] as const
const LOAD_STRATEGIES = [
  'beforeInteractive',
  'afterInteractive',
  'lazyOnload',
  'worker',
  'consent',
  'interaction',
  'idle'
] as const
const OUTPUT_TYPES = ['next', 'consent', 'dataLayer', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 70000
const SCRIPT_LIMIT = 180
const JSON_LINE_SCAN_LIMIT = 220
const TEXT_LINE_SCAN_LIMIT = 360
const RAW_ROW_LIMIT = 120
const JSON_CHILD_SCAN_LIMIT = 40
const VISIBLE_FINDINGS_LIMIT = 36
const VISIBLE_SCRIPTS_LIMIT = 54

type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number]
type LoadStrategy = (typeof LOAD_STRATEGIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface ThirdPartyDraft {
  cacheTtlHours: string
  category: ScriptCategory
  consentRequired: 'no' | 'yes'
  cookieAccess: 'no' | 'yes'
  dataLayerEvents: string
  duplicateCount: string
  loadStrategy: LoadStrategy
  mainThreadMs: string
  owner: string
  providerName: string
  requestCount: string
  routePattern: string
  sampleCount: string
  scriptUrl: string
  transferKb: string
}

interface ParsedScript {
  asyncAttr: boolean
  category: ScriptCategory
  deferAttr: boolean
  duplicateKey: string
  id: string
  mainThreadMs: number
  owner: string
  provider: string
  route: string
  sizeKb: number
  source: 'html' | 'json' | 'text'
  strategy: LoadStrategy | 'unknown'
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  limits: {
    htmlTags: boolean
    jsonLines: boolean
    rawRows: boolean
    textLines: boolean
  }
  rawRows: Array<{ label: string; value: string }>
  scripts: ParsedScript[]
}

interface Preset {
  draft: ThirdPartyDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: ThirdPartyDraft = {
  cacheTtlHours: '24',
  category: 'analytics',
  consentRequired: 'yes',
  cookieAccess: 'yes',
  dataLayerEvents: '12',
  duplicateCount: '1',
  loadStrategy: 'afterInteractive',
  mainThreadMs: '42',
  owner: 'growth',
  providerName: 'Analytics',
  requestCount: '3',
  routePattern: '/*',
  sampleCount: '1200',
  scriptUrl: 'https://analytics.example.com/tag.js',
  transferKb: '86'
}

const PRESETS: Preset[] = [
  {
    key: 'analytics',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<Script src="https://analytics.example.com/tag.js" strategy="afterInteractive" data-owner="growth" />',
      'script=https://analytics.example.com/events.js strategy=lazyOnload size=42KB main=18ms category=analytics owner=growth route=/*'
    ].join('\n')
  },
  {
    key: 'tag_manager',
    draft: {
      ...DEFAULT_DRAFT,
      category: 'tag_manager',
      dataLayerEvents: '36',
      mainThreadMs: '88',
      providerName: 'Tag Manager',
      requestCount: '8',
      scriptUrl: 'https://tags.example.com/gtm.js',
      transferKb: '180'
    },
    workspace: [
      '<script src="https://tags.example.com/gtm.js"></script>',
      'script=https://tags.example.com/vendor-a.js strategy=afterInteractive size=86KB main=42ms category=tag_manager owner=growth route=/campaign',
      'script=https://tags.example.com/vendor-b.js strategy=afterInteractive size=92KB main=46ms category=tag_manager owner=growth route=/campaign'
    ].join('\n')
  },
  {
    key: 'ads',
    draft: {
      ...DEFAULT_DRAFT,
      category: 'ads',
      loadStrategy: 'consent',
      mainThreadMs: '140',
      providerName: 'Ad Network',
      requestCount: '14',
      routePattern: '/article/:slug',
      scriptUrl: 'https://ads.example.com/bid.js',
      transferKb: '260'
    },
    workspace: [
      '{"url":"https://ads.example.com/bid.js","strategy":"afterInteractive","sizeKb":260,"mainThreadMs":140,"category":"ads","route":"/article/example","owner":"ads"}',
      '{"url":"https://ads.example.com/render.js","strategy":"lazyOnload","sizeKb":118,"mainThreadMs":72,"category":"ads","route":"/article/example","owner":"ads"}'
    ].join('\n')
  },
  {
    key: 'chat',
    draft: {
      ...DEFAULT_DRAFT,
      category: 'chat',
      loadStrategy: 'interaction',
      mainThreadMs: '96',
      owner: 'support',
      providerName: 'Chat Widget',
      requestCount: '6',
      routePattern: '/pricing',
      scriptUrl: 'https://chat.example.com/widget.js',
      transferKb: '210'
    },
    workspace: [
      '<script async src="https://chat.example.com/widget.js" data-owner="support"></script>',
      'script=https://chat.example.com/runtime.js strategy=interaction size=88KB main=28ms category=chat owner=support route=/pricing'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      cacheTtlHours: '0',
      category: 'ads',
      consentRequired: 'no',
      cookieAccess: 'yes',
      dataLayerEvents: '180',
      duplicateCount: '4',
      loadStrategy: 'beforeInteractive',
      mainThreadMs: '420',
      owner: '',
      providerName: 'Unknown Tags',
      requestCount: '32',
      routePattern: '/checkout',
      sampleCount: '48',
      scriptUrl: 'http://ads.example.com/tag.js?email=user@example.com&token=abc',
      transferKb: '780'
    },
    workspace: [
      '<script src="http://ads.example.com/tag.js?email=user@example.com&token=abc"></script>',
      '<script src="http://ads.example.com/tag.js?email=user@example.com&token=abc"></script>',
      'script=http://ads.example.com/bid.js strategy=beforeInteractive size=380KB main=240ms category=ads route=/checkout',
      'script=https://chat.example.com/widget.js strategy=afterInteractive size=220KB main=160ms category=chat route=/checkout owner=',
      '{"url":"https://video.example.com/embed.js","strategy":"afterInteractive","sizeKb":340,"mainThreadMs":220,"category":"video","route":"/checkout","owner":""}'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['consent', 'defer', 'owner', 'measure'] as const
const REFERENCE_ITEMS = [
  'strategy',
  'consent',
  'main_thread',
  'duplicates',
  'privacy',
  'ownership'
] as const

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

const textValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.match(/([\d.,]+)\s*(b|kb|kib|mb|mib|ms|h|hr|hrs)?/iu)
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

const normalizeCategory = (value: unknown): ScriptCategory => {
  const token = String(value ?? '').toLowerCase()
  if (/ad|bid|doubleclick|adsense/iu.test(token)) return 'ads'
  if (/tag|gtm|tealium|segment/iu.test(token)) return 'tag_manager'
  if (/chat|intercom|zendesk|crisp/iu.test(token)) return 'chat'
  if (/video|player|youtube|vimeo/iu.test(token)) return 'video'
  if (/monitor|sentry|datadog|replay|log/iu.test(token)) return 'monitoring'
  if (/ab|experiment|optimizely|split/iu.test(token)) return 'ab_test'
  if (/analytics|ga|gtag|amplitude|mixpanel|plausible/iu.test(token)) return 'analytics'
  return 'other'
}

const normalizeStrategy = (value: unknown): LoadStrategy | 'unknown' => {
  const token = String(value ?? '').toLowerCase()
  if (token.includes('before')) return 'beforeInteractive'
  if (token.includes('after')) return 'afterInteractive'
  if (token.includes('lazy')) return 'lazyOnload'
  if (token.includes('worker')) return 'worker'
  if (token.includes('consent')) return 'consent'
  if (token.includes('interaction') || token.includes('click')) return 'interaction'
  if (token.includes('idle')) return 'idle'
  return 'unknown'
}

const tokenValue = (line: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = line.match(new RegExp(`${escaped}=([^\\s,]+)`, 'iu'))
  return match?.[1] ?? ''
}

const attrValue = (tag: string, attr: string) => {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, 'iu'))
  return match?.[1] ?? ''
}

const hasAttr = (tag: string, attr: string) => new RegExp(`\\s${attr}(?:\\s|=|>|/)`, 'iu').test(tag)

const providerFromUrl = (url: string) => {
  try {
    const host = new URL(url, 'https://www.example.com').hostname.replace(/^www\./iu, '')
    return host.split('.')[0] || host
  } catch {
    return url.split('/')[0] || 'unknown'
  }
}

const isThirdParty = (url: string) => {
  if (!url || url.startsWith('/') || url.startsWith('_next')) return false
  try {
    return new URL(url, 'https://www.example.com').hostname !== 'www.example.com'
  } catch {
    return false
  }
}

const hasSensitiveUrl = (value: string) =>
  /token|email|session|account|private|user|auth|jwt|phone|address/iu.test(value)

const scriptFromRecord = (record: Record<string, unknown>, index: number): ParsedScript | null => {
  const url = textValue(record.url ?? record.src ?? record.href ?? record.scriptUrl)
  if (!url) return null
  const strategy = normalizeStrategy(record.strategy ?? record.loadStrategy ?? record.loading)
  const category = normalizeCategory(record.category ?? record.kind ?? url)
  const provider = textValue(record.provider ?? record.providerName) || providerFromUrl(url)
  return {
    asyncAttr: Boolean(record.async),
    category,
    deferAttr: Boolean(record.defer),
    duplicateKey: url.replace(/[?#].*$/u, ''),
    id: textValue(record.id) || `json-script-${index + 1}`,
    mainThreadMs: round(numericValue(record.mainThreadMs ?? record.main ?? record.blockingMs) ?? 0),
    owner: textValue(record.owner),
    provider,
    route: textValue(record.route ?? record.path) || '/',
    sizeKb: round(
      numericValue(record.sizeKb ?? record.transferKb ?? record.size ?? record.transferSize) ?? 0
    ),
    source: 'json',
    strategy,
    url
  }
}

const createParsedWorkspace = (): ParsedWorkspace => ({
  errors: [],
  limits: {
    htmlTags: false,
    jsonLines: false,
    rawRows: false,
    textLines: false
  },
  rawRows: [],
  scripts: []
})

const collectJson = (value: unknown, parsed: ParsedWorkspace, depth = 0): boolean => {
  if (parsed.scripts.length >= SCRIPT_LIMIT) return true
  if (depth > 6) return true

  if (Array.isArray(value)) {
    let limited = value.length > JSON_CHILD_SCAN_LIMIT

    for (let index = 0; index < value.length && index < JSON_CHILD_SCAN_LIMIT; index += 1) {
      if (collectJson(value[index], parsed, depth + 1)) limited = true
      if (parsed.scripts.length >= SCRIPT_LIMIT) return true
    }

    return limited
  }

  const record = asRecord(value)
  if (!record) return false

  const script = scriptFromRecord(record, parsed.scripts.length)
  if (script) parsed.scripts.push(script)
  if (parsed.scripts.length >= SCRIPT_LIMIT) return true

  let inspected = 0
  let limited = false

  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue
    if (inspected >= JSON_CHILD_SCAN_LIMIT) {
      limited = true
      break
    }
    if (collectJson(record[key], parsed, depth + 1)) limited = true
    inspected += 1
    if (parsed.scripts.length >= SCRIPT_LIMIT) return true
  }

  return limited
}

const parseJson = (parsed: ParsedWorkspace, input: string, reportError = true) => {
  try {
    if (collectJson(JSON.parse(input), parsed)) parsed.limits.jsonLines = true
  } catch {
    if (reportError) parsed.errors.push('json_error')
  }
}

const parseTag = (tag: string, index: number): ParsedScript | null => {
  const url = attrValue(tag, 'src')
  if (!url) return null
  const strategy = normalizeStrategy(attrValue(tag, 'strategy'))
  const category = normalizeCategory(`${attrValue(tag, 'data-category')} ${url}`)
  const owner = attrValue(tag, 'data-owner')
  return {
    asyncAttr: hasAttr(tag, 'async'),
    category,
    deferAttr: hasAttr(tag, 'defer'),
    duplicateKey: url.replace(/[?#].*$/u, ''),
    id: attrValue(tag, 'id') || `tag-script-${index + 1}`,
    mainThreadMs: 0,
    owner,
    provider: attrValue(tag, 'data-provider') || providerFromUrl(url),
    route: attrValue(tag, 'data-route') || '/',
    sizeKb: 0,
    source: 'html',
    strategy,
    url
  }
}

const parseTextScript = (line: string, index: number): ParsedScript | null => {
  const url = tokenValue(line, 'script') || tokenValue(line, 'src') || tokenValue(line, 'url')
  if (!url) return null
  const strategy = normalizeStrategy(tokenValue(line, 'strategy') || tokenValue(line, 'load'))
  const category = normalizeCategory(tokenValue(line, 'category') || url)
  const owner = tokenValue(line, 'owner')
  return {
    asyncAttr: /async/iu.test(line),
    category,
    deferAttr: /defer/iu.test(line),
    duplicateKey: url.replace(/[?#].*$/u, ''),
    id: `text-script-${index + 1}`,
    mainThreadMs: round(
      numericValue(
        tokenValue(line, 'main') || tokenValue(line, 'mainThread') || tokenValue(line, 'blocking')
      ) ?? 0
    ),
    owner,
    provider: tokenValue(line, 'provider') || providerFromUrl(url),
    route: tokenValue(line, 'route') || '/',
    sizeKb: round(numericValue(tokenValue(line, 'size') || tokenValue(line, 'transfer')) ?? 0),
    source: 'text',
    strategy,
    url
  }
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const parsed = createParsedWorkspace()
  const trimmed = source.trim()
  const jsonRows = collectBoundedNonEmptyLines(source, JSON_LINE_SCAN_LIMIT)
  const textRows = collectBoundedNonEmptyLines(source, TEXT_LINE_SCAN_LIMIT)

  const parseJsonLines = () => {
    if (jsonRows.limited) parsed.limits.jsonLines = true

    for (const line of jsonRows.lines) {
      if (parsed.scripts.length >= SCRIPT_LIMIT) {
        parsed.limits.jsonLines = true
        break
      }
      if (!line.startsWith('{') && !line.startsWith('[')) continue
      parseJson(parsed, line, false)
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const before = parsed.scripts.length
    parseJson(parsed, trimmed)
    if (parsed.scripts.length === before) parseJsonLines()
  } else {
    parseJsonLines()
  }

  const tagPattern = /<(?:Script|script)\b[^>]*>/giu
  let tagIndex = 0
  let tagMatch: RegExpExecArray | null
  while ((tagMatch = tagPattern.exec(source))) {
    if (tagIndex >= SCRIPT_LIMIT || parsed.scripts.length >= SCRIPT_LIMIT) {
      parsed.limits.htmlTags = true
      break
    }
    const script = parseTag(tagMatch[0], tagIndex)
    if (script) parsed.scripts.push(script)
    tagIndex += 1
  }

  if (textRows.limited) parsed.limits.textLines = true
  textRows.lines.forEach((clean, index) => {
    if (parsed.scripts.length < SCRIPT_LIMIT) {
      const script = parseTextScript(clean, index)
      if (script) parsed.scripts.push(script)
    } else {
      parsed.limits.textLines = true
    }

    if (/<script|<Script|script=|strategy=|main=|category=/iu.test(clean)) {
      if (parsed.rawRows.length < RAW_ROW_LIMIT) {
        parsed.rawRows.push({
          label: clean.match(/^\S+/u)?.[0]?.slice(0, 80) ?? 'row',
          value: clean.slice(0, 220)
        })
      } else {
        parsed.limits.rawRows = true
      }
    }
  })

  parsed.scripts = parsed.scripts.slice(0, SCRIPT_LIMIT)
  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditScripts = (draft: ThirdPartyDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const size = numberFromInput(draft.transferKb)
  const main = numberFromInput(draft.mainThreadMs)
  const requests = numberFromInput(draft.requestCount)
  const duplicates = numberFromInput(draft.duplicateCount)
  const events = numberFromInput(draft.dataLayerEvents)
  const cacheTtl = numberFromInput(draft.cacheTtlHours)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (!draft.scriptUrl.trim()) addFinding(findings, 'danger', 'script_missing', 'script')
  if (samples > 0 && samples < 100)
    addFinding(findings, 'warn', 'low_sample_count', String(samples))
  if (draft.loadStrategy === 'beforeInteractive')
    addFinding(findings, 'danger', 'before_interactive', draft.providerName || draft.scriptUrl)
  if (
    draft.loadStrategy === 'afterInteractive' &&
    ['ads', 'chat', 'video'].includes(draft.category)
  )
    addFinding(findings, 'warn', 'after_interactive_heavy', draft.category)
  if (size > 500) addFinding(findings, 'danger', 'transfer_severe', `${size} KB`)
  else if (size > 150) addFinding(findings, 'warn', 'transfer_watch', `${size} KB`)
  else addFinding(findings, 'good', 'transfer_ok', `${size} KB`)
  if (main > 200) addFinding(findings, 'danger', 'main_thread_severe', `${main} ms`)
  else if (main > 50) addFinding(findings, 'warn', 'main_thread_watch', `${main} ms`)
  if (requests > 24) addFinding(findings, 'danger', 'requests_severe', String(requests))
  else if (requests > 8) addFinding(findings, 'warn', 'requests_watch', String(requests))
  if (duplicates > 1) addFinding(findings, 'warn', 'duplicate_declared', String(duplicates))
  if (draft.cookieAccess === 'yes' && draft.consentRequired === 'no')
    addFinding(findings, 'danger', 'cookie_without_consent', draft.providerName || draft.scriptUrl)
  if (events > 100) addFinding(findings, 'warn', 'data_layer_noisy', String(events))
  if (cacheTtl < 1) addFinding(findings, 'warn', 'cache_ttl_low', `${cacheTtl} h`)
  if (!draft.owner.trim())
    addFinding(findings, 'warn', 'owner_missing', draft.providerName || draft.scriptUrl)
  if (draft.scriptUrl.startsWith('http:'))
    addFinding(findings, 'danger', 'http_script', draft.scriptUrl)
  if (hasSensitiveUrl(draft.scriptUrl))
    addFinding(findings, 'danger', 'sensitive_url', draft.scriptUrl)

  const duplicateMap = new Map<string, number>()
  parsed.scripts.forEach(script => {
    duplicateMap.set(script.duplicateKey, (duplicateMap.get(script.duplicateKey) ?? 0) + 1)
    if (script.strategy === 'beforeInteractive')
      addFinding(findings, 'danger', 'parsed_before_interactive', script.url)
    if (script.strategy === 'unknown' && !script.asyncAttr && !script.deferAttr)
      addFinding(findings, 'warn', 'parsed_blocking_script', script.url)
    if (script.url.startsWith('http:'))
      addFinding(findings, 'danger', 'parsed_http_script', script.url)
    if (hasSensitiveUrl(script.url))
      addFinding(findings, 'danger', 'parsed_sensitive_url', script.url)
    if (!script.owner.trim()) addFinding(findings, 'warn', 'parsed_owner_missing', script.url)
    if (script.sizeKb > 300)
      addFinding(findings, 'danger', 'parsed_transfer_severe', `${script.url}: ${script.sizeKb} KB`)
    else if (script.sizeKb > 120)
      addFinding(findings, 'warn', 'parsed_transfer_watch', `${script.url}: ${script.sizeKb} KB`)
    if (script.mainThreadMs > 200)
      addFinding(
        findings,
        'danger',
        'parsed_main_thread_severe',
        `${script.url}: ${script.mainThreadMs} ms`
      )
    else if (script.mainThreadMs > 50)
      addFinding(
        findings,
        'warn',
        'parsed_main_thread_watch',
        `${script.url}: ${script.mainThreadMs} ms`
      )
    if (
      ['ads', 'chat', 'video'].includes(script.category) &&
      script.strategy !== 'consent' &&
      script.strategy !== 'interaction' &&
      script.strategy !== 'lazyOnload'
    ) {
      addFinding(findings, 'warn', 'parsed_needs_gate', `${script.category}: ${script.url}`)
    }
  })
  Array.from(duplicateMap.entries()).forEach(([url, count]) => {
    if (url && count > 1)
      addFinding(findings, 'warn', 'parsed_duplicate_script', `${url} x${count}`)
  })
  const thirdPartyCount = parsed.scripts.filter(script => isThirdParty(script.url)).length
  if (thirdPartyCount > 12)
    addFinding(findings, 'warn', 'many_third_party', String(thirdPartyCount))
  if (parsed.scripts.length)
    addFinding(findings, 'good', 'parser_found', String(parsed.scripts.length))
  else addFinding(findings, 'warn', 'parser_empty', '-')
  if (parsed.errors.includes('truncated'))
    addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (parsed.errors.includes('json_error')) addFinding(findings, 'warn', 'json_error', 'JSON')
  if (
    parsed.limits.htmlTags ||
    parsed.limits.jsonLines ||
    parsed.limits.rawRows ||
    parsed.limits.textLines ||
    parsed.scripts.length >= SCRIPT_LIMIT
  ) {
    addFinding(findings, 'warn', 'scan_limited', String(SCRIPT_LIMIT))
  }
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

const buildNextScript = (draft: ThirdPartyDraft) => {
  const strategy =
    draft.loadStrategy === 'consent' ||
    draft.loadStrategy === 'interaction' ||
    draft.loadStrategy === 'idle'
      ? 'lazyOnload'
      : draft.loadStrategy
  return [
    "import Script from 'next/script'",
    '',
    'export function ThirdPartyScript() {',
    '  return (',
    '    <Script',
    `      src="${escapeHtml(draft.scriptUrl)}"`,
    `      strategy="${strategy}"`,
    `      data-owner="${escapeHtml(draft.owner || 'unassigned')}"`,
    `      data-provider="${escapeHtml(draft.providerName || providerFromUrl(draft.scriptUrl))}"`,
    '    />',
    '  )',
    '}',
    '',
    `// Route: ${draft.routePattern}`,
    `// Category: ${draft.category}`
  ].join('\n')
}

const buildConsentLoader = (draft: ThirdPartyDraft) =>
  [
    'const loadedScripts = new Set()',
    '',
    'export function loadVendorAfterConsent(consent) {',
    `  if (!consent.${draft.category}) return`,
    `  const src = '${draft.scriptUrl}'`,
    '  if (loadedScripts.has(src)) return',
    '  loadedScripts.add(src)',
    '',
    "  const script = document.createElement('script')",
    '  script.src = src',
    '  script.async = true',
    `  script.dataset.owner = '${draft.owner || 'unassigned'}'`,
    '  document.head.appendChild(script)',
    '}',
    '',
    '// Call after the consent state is known, not during initial render.'
  ].join('\n')

const buildDataLayerPlan = (draft: ThirdPartyDraft) =>
  [
    'window.dataLayer = window.dataLayer || []',
    '',
    'function track(eventName, payload = {}) {',
    '  window.dataLayer.push({',
    '    event: eventName,',
    `    route_group: '${draft.routePattern}',`,
    `    owner: '${draft.owner || 'unassigned'}',`,
    '    ...payload',
    '  })',
    '}',
    '',
    `// Current planned events: ${draft.dataLayerEvents}`,
    '// Keep event names stable and avoid sending private URL query data.'
  ].join('\n')

const buildMarkdownSummary = (
  draft: ThirdPartyDraft,
  parsed: ParsedWorkspace,
  findings: Finding[]
) => {
  const risky = findings.filter(item => item.level !== 'good').slice(0, 10)
  const scripts = parsed.scripts.slice(0, 8)
  return [
    '# Third-party script triage',
    '',
    `Route: ${draft.routePattern}`,
    `Provider: ${draft.providerName}`,
    `Strategy: ${draft.loadStrategy}`,
    `Transfer: ${draft.transferKb} KB`,
    '',
    '## Findings',
    risky.length
      ? risky.map(item => `- [${item.level}] ${item.subject}: ${item.key}`).join('\n')
      : '- No high-risk findings.',
    '',
    '## Parsed scripts',
    scripts.length
      ? scripts
          .map(
            script =>
              `- ${script.url} / ${script.strategy} / ${script.sizeKb} KB / ${script.mainThreadMs} ms`
          )
          .join('\n')
      : '- No parsed scripts yet.',
    '',
    '## Next actions',
    '- Move non-critical vendors behind consent, interaction, idle, or lazy-onload gates.',
    '- Assign an owner and route budget for every vendor.',
    '- Re-check INP, main-thread tasks, and field Web Vitals after the change.'
  ].join('\n')
}

const buildCsv = (draft: ThirdPartyDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.scripts.length
    ? parsed.scripts.map(script => [
        script.url,
        script.provider,
        script.category,
        script.strategy,
        script.sizeKb,
        script.mainThreadMs,
        script.owner,
        script.route,
        script.source
      ])
    : [
        [
          draft.scriptUrl,
          draft.providerName,
          draft.category,
          draft.loadStrategy,
          draft.transferKb,
          draft.mainThreadMs,
          draft.owner,
          draft.routePattern,
          'draft'
        ]
      ]
  return [
    'url,provider,category,strategy,sizeKb,mainThreadMs,owner,route,source',
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n')
}

const buildJsonSummary = (draft: ThirdPartyDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify(
    {
      draft,
      findings,
      parsed,
      thresholds: {
        transferWatchKb: 150,
        transferSevereKb: 500,
        mainThreadWatchMs: 50,
        mainThreadSevereMs: 200,
        requestWatchCount: 8
      }
    },
    null,
    2
  )

const buildOutput = (
  draft: ThirdPartyDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'consent') return buildConsentLoader(draft)
  if (outputType === 'dataLayer') return buildDataLayerPlan(draft)
  if (outputType === 'markdown') return buildMarkdownSummary(draft, parsed, findings)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildCsv(draft, parsed)
  return buildNextScript(draft)
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

export default function ThirdPartyScriptsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ThirdPartyDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('next')
  const [auditQuery, setAuditQuery] = useState('')
  const [scriptQuery, setScriptQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredScriptQuery = useDeferredValue(scriptQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('truncated')) return next

    return { ...next, errors: [...next.errors, 'truncated'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditScripts(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      limits: parsed.limits,
      rawRows: parsed.rawRows.slice(0, OUTPUT_PREVIEW_ROWS),
      scripts: parsed.scripts.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.errors, parsed.limits, parsed.rawRows, parsed.scripts]
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
    (outputPreviewUsesParsedRows ? outputPreviewParsed.scripts.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.scripts.length : 0) +
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
        `${item.key} ${item.subject} ${t(`app.converter.third_party_scripts.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredScripts = useMemo(() => {
    const query = deferredScriptQuery.trim().toLowerCase()
    if (!query) return parsed.scripts
    return parsed.scripts.filter(script =>
      `${script.url} ${script.provider} ${script.category} ${script.strategy} ${script.owner} ${script.route}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredScriptQuery, parsed.scripts])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, VISIBLE_FINDINGS_LIMIT),
    [filteredFindings]
  )
  const visibleScripts = useMemo(
    () => filteredScripts.slice(0, VISIBLE_SCRIPTS_LIMIT),
    [filteredScripts]
  )
  const findingsRenderLimited = filteredFindings.length > visibleFindings.length
  const scriptsRenderLimited = filteredScripts.length > visibleScripts.length
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      mainThread: `${numberFromInput(draft.mainThreadMs)} ms`,
      score,
      scripts: parsed.scripts.length,
      transfer: `${numberFromInput(draft.transferKb)} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.mainThreadMs, draft.transferKb, findings, parsed.scripts.length, score]
  )

  const updateDraft = <Key extends keyof ThirdPartyDraft>(
    key: Key,
    value: ThirdPartyDraft[Key]
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
    setOutputType('next')
    setAuditQuery('')
    setScriptQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.third_party_scripts.summary_title'),
        `${t('app.converter.third_party_scripts.metric.score')}: ${metrics.score}`,
        `${t('app.converter.third_party_scripts.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.third_party_scripts.metric.main_thread')}: ${metrics.mainThread}`,
        `${t('app.converter.third_party_scripts.metric.scripts')}: ${metrics.scripts}`,
        `${t('app.converter.third_party_scripts.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.third_party_scripts.metric.critical')}: ${metrics.critical}`
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
                {t('app.converter.third-party-scripts')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.third-party-scripts')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.third_party_scripts.description')}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.third_party_scripts.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.converter.third_party_scripts.metric.score')}
              value={metrics.score}
            />
            <Metric
              label={t('app.converter.third_party_scripts.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric
              label={t('app.converter.third_party_scripts.metric.main_thread')}
              value={metrics.mainThread}
            />
            <Metric
              label={t('app.converter.third_party_scripts.metric.scripts')}
              value={metrics.scripts}
            />
            <Metric
              label={t('app.converter.third_party_scripts.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.third_party_scripts.metric.critical')}
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
              {t('app.converter.third_party_scripts.presets')}
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
                {t(`app.converter.third_party_scripts.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.third_party_scripts.preset.${preset.key}_hint`)}
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
                {t('app.converter.third_party_scripts.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.third_party_scripts.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="third-party-route">
                  {t('app.converter.third_party_scripts.route_pattern')}
                </Label>
                <Input
                  id="third-party-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-provider">
                  {t('app.converter.third_party_scripts.provider')}
                </Label>
                <Input
                  id="third-party-provider"
                  value={draft.providerName}
                  onChange={event => updateDraft('providerName', event.target.value.slice(0, 120))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="third-party-url">
                  {t('app.converter.third_party_scripts.script_url')}
                </Label>
                <Input
                  id="third-party-url"
                  value={draft.scriptUrl}
                  onChange={event => updateDraft('scriptUrl', event.target.value.slice(0, 280))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-category">
                  {t('app.converter.third_party_scripts.category')}
                </Label>
                <Select
                  id="third-party-category"
                  value={draft.category}
                  onChange={event => updateDraft('category', event.target.value as ScriptCategory)}
                >
                  {SCRIPT_CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {t(`app.converter.third_party_scripts.category.${category}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-strategy">
                  {t('app.converter.third_party_scripts.load_strategy')}
                </Label>
                <Select
                  id="third-party-strategy"
                  value={draft.loadStrategy}
                  onChange={event =>
                    updateDraft('loadStrategy', event.target.value as LoadStrategy)
                  }
                >
                  {LOAD_STRATEGIES.map(strategy => (
                    <option key={strategy} value={strategy}>
                      {t(`app.converter.third_party_scripts.strategy.${strategy}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-transfer">
                  {t('app.converter.third_party_scripts.transfer_kb')}
                </Label>
                <Input
                  id="third-party-transfer"
                  value={draft.transferKb}
                  onChange={event => updateDraft('transferKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-main">
                  {t('app.converter.third_party_scripts.main_thread_ms')}
                </Label>
                <Input
                  id="third-party-main"
                  value={draft.mainThreadMs}
                  onChange={event => updateDraft('mainThreadMs', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-requests">
                  {t('app.converter.third_party_scripts.request_count')}
                </Label>
                <Input
                  id="third-party-requests"
                  value={draft.requestCount}
                  onChange={event => updateDraft('requestCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="third-party-samples">
                  {t('app.converter.third_party_scripts.sample_count')}
                </Label>
                <Input
                  id="third-party-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.third_party_scripts.governance')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="third-party-owner">
                    {t('app.converter.third_party_scripts.owner')}
                  </Label>
                  <Input
                    id="third-party-owner"
                    value={draft.owner}
                    onChange={event => updateDraft('owner', event.target.value.slice(0, 120))}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="third-party-consent">
                    {t('app.converter.third_party_scripts.consent_required')}
                  </Label>
                  <Select
                    id="third-party-consent"
                    value={draft.consentRequired}
                    onChange={event =>
                      updateDraft(
                        'consentRequired',
                        event.target.value as ThirdPartyDraft['consentRequired']
                      )
                    }
                  >
                    <option value="yes">
                      {t('app.converter.third_party_scripts.boolean.yes')}
                    </option>
                    <option value="no">{t('app.converter.third_party_scripts.boolean.no')}</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="third-party-cookie">
                    {t('app.converter.third_party_scripts.cookie_access')}
                  </Label>
                  <Select
                    id="third-party-cookie"
                    value={draft.cookieAccess}
                    onChange={event =>
                      updateDraft(
                        'cookieAccess',
                        event.target.value as ThirdPartyDraft['cookieAccess']
                      )
                    }
                  >
                    <option value="yes">
                      {t('app.converter.third_party_scripts.boolean.yes')}
                    </option>
                    <option value="no">{t('app.converter.third_party_scripts.boolean.no')}</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="third-party-events">
                    {t('app.converter.third_party_scripts.data_layer_events')}
                  </Label>
                  <Input
                    id="third-party-events"
                    value={draft.dataLayerEvents}
                    onChange={event =>
                      updateDraft('dataLayerEvents', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="third-party-duplicates">
                    {t('app.converter.third_party_scripts.duplicate_count')}
                  </Label>
                  <Input
                    id="third-party-duplicates"
                    value={draft.duplicateCount}
                    onChange={event =>
                      updateDraft('duplicateCount', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="third-party-cache">
                    {t('app.converter.third_party_scripts.cache_ttl')}
                  </Label>
                  <Input
                    id="third-party-cache"
                    value={draft.cacheTtlHours}
                    onChange={event =>
                      updateDraft('cacheTtlHours', event.target.value.slice(0, 12))
                    }
                    className="font-mono"
                    inputMode="decimal"
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
                {t('app.converter.third_party_scripts.workspace')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.third_party_scripts.workspace_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.third_party_scripts.workspace_placeholder')}
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
                {t('app.converter.third_party_scripts.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.third_party_scripts.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {visibleFindings.map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.third_party_scripts.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.third_party_scripts.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {findingsRenderLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.rows_render_limited', {
                  total: filteredFindings.length.toLocaleString(),
                  visible: visibleFindings.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.third_party_scripts.output')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.third_party_scripts.output_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="third-party-output">
                  {t('app.converter.third_party_scripts.output_type')}
                </Label>
                <Select
                  id="third-party-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.third_party_scripts.output.${type}`)}
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
                {t('app.converter.third_party_scripts.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'third-party-script-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.third_party_scripts.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentCsv(),
                    'third-party-scripts.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.third_party_scripts.download_csv')}
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
                {t('app.converter.third_party_scripts.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={scriptQuery}
                onChange={event => setScriptQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.third_party_scripts.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredScripts.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleScripts.map(script => (
                  <div
                    key={`${script.id}:${script.url}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {script.provider}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(script.mainThreadMs > 200 || script.sizeKb > 300 ? 'danger' : script.mainThreadMs > 50 || script.sizeKb > 120 ? 'warn' : 'good')}`}
                      >
                        {script.strategy}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {script.url}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {script.category} / {script.sizeKb} KB / {script.mainThreadMs} ms /{' '}
                      {script.owner || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.third_party_scripts.empty')}
              </div>
            )}
            {scriptsRenderLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.rows_render_limited', {
                  total: filteredScripts.length.toLocaleString(),
                  visible: visibleScripts.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.third_party_scripts.reference')}
              </CardTitle>
            </div>
            <CardDescription>
              {t('app.converter.third_party_scripts.reference_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.third_party_scripts.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.third_party_scripts.reference.${item}_hint`)}
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
              {t('app.converter.third_party_scripts.checklist')}
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
                {item === 'measure' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.third_party_scripts.checklist.${item}.title`)}
              </div>
              {t(`app.converter.third_party_scripts.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
