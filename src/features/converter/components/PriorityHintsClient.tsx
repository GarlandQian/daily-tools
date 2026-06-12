'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  Image as ImageIcon,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

const RESOURCE_KINDS = ['image', 'preload', 'script', 'iframe', 'fetch'] as const
const PRIORITIES = ['auto', 'high', 'low'] as const
const LOADING_VALUES = ['none', 'auto', 'eager', 'lazy'] as const
const DECODING_VALUES = ['none', 'auto', 'sync', 'async'] as const
const AS_TYPES = ['auto', 'image', 'script', 'style', 'font', 'fetch', 'document'] as const
const INTENTS = ['lcp', 'above_fold', 'below_fold', 'background', 'third_party'] as const
const OUTPUT_TYPES = ['html', 'next', 'fetch', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 50000
const HINT_LIMIT = 160
const OUTPUT_PREVIEW_HINT_LIMIT = 80
const VISIBLE_FINDING_LIMIT = 24
const VISIBLE_HINT_LIMIT = 42

type ResourceKind = (typeof RESOURCE_KINDS)[number]
type Priority = (typeof PRIORITIES)[number]
type LoadingValue = (typeof LOADING_VALUES)[number]
type DecodingValue = (typeof DECODING_VALUES)[number]
type AsType = (typeof AS_TYPES)[number]
type ResourceIntent = (typeof INTENTS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type HintSource = 'manual' | 'html' | 'header'

interface PriorityDraft {
  asType: AsType
  crossorigin: boolean
  decoding: DecodingValue
  fetchPriority: Priority
  height: string
  href: string
  intent: ResourceIntent
  kind: ResourceKind
  loading: LoadingValue
  scriptMode: 'async' | 'defer' | 'none'
  width: string
}

interface PriorityHint extends PriorityDraft {
  id: string
  raw: string
  source: HintSource
  valid: boolean
}

interface Preset {
  draft: PriorityDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: PriorityDraft = {
  asType: 'image',
  crossorigin: false,
  decoding: 'async',
  fetchPriority: 'high',
  height: '720',
  href: '/images/hero.avif',
  intent: 'lcp',
  kind: 'image',
  loading: 'eager',
  scriptMode: 'none',
  width: '1280'
}

const PRESETS: Preset[] = [
  {
    key: 'lcp_image',
    draft: DEFAULT_DRAFT,
    workspace:
      '<img src="/images/hero.avif" width="1280" height="720" fetchpriority="high" loading="eager" decoding="async" data-lcp="true">'
  },
  {
    key: 'gallery_lazy',
    draft: {
      ...DEFAULT_DRAFT,
      fetchPriority: 'low',
      height: '480',
      href: '/images/gallery-01.webp',
      intent: 'below_fold',
      loading: 'lazy',
      width: '720'
    },
    workspace: [
      '<img src="/images/gallery-01.webp" width="720" height="480" fetchpriority="low" loading="lazy" decoding="async">',
      '<img src="/images/gallery-02.webp" width="720" height="480" loading="lazy" decoding="async">'
    ].join('\n')
  },
  {
    key: 'module_script',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'script',
      decoding: 'none',
      fetchPriority: 'high',
      height: '',
      href: '/assets/app-shell.js',
      intent: 'above_fold',
      kind: 'preload',
      loading: 'none',
      scriptMode: 'defer',
      width: ''
    },
    workspace: [
      '<link rel="modulepreload" href="/assets/app-shell.js" as="script" fetchpriority="high">',
      '<script src="/assets/app-shell.js" defer fetchpriority="high"></script>'
    ].join('\n')
  },
  {
    key: 'third_party',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'script',
      decoding: 'none',
      fetchPriority: 'low',
      height: '',
      href: 'https://analytics.example.com/tag.js',
      intent: 'third_party',
      kind: 'script',
      loading: 'none',
      scriptMode: 'async',
      width: ''
    },
    workspace: [
      '<script src="https://analytics.example.com/tag.js" async fetchpriority="low"></script>',
      '<iframe src="https://ads.example.com/widget" loading="lazy"></iframe>'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      crossorigin: false,
      decoding: 'sync',
      fetchPriority: 'low',
      height: '',
      href: 'http://cdn.example.com/hero-private.jpg?token=abc',
      intent: 'lcp',
      loading: 'lazy',
      width: ''
    },
    workspace: [
      '<img src="http://cdn.example.com/hero-private.jpg?token=abc" fetchpriority="low" loading="lazy" decoding="sync" data-lcp="true">',
      '<img src="/hero-2.jpg" fetchpriority="high" loading="lazy">',
      '<img src="/hero-3.jpg" fetchpriority="high">',
      '<img src="/hero-4.jpg" fetchpriority="high">',
      '<img src="/hero-5.jpg" fetchpriority="high">',
      '<link rel="preload" href="/critical.css" as="style" fetchpriority="low">',
      '<link rel="preload" href="/font.woff2" as="font" fetchpriority="high">',
      '<script src="/blocking.js" fetchpriority="high"></script>',
      '<iframe src="/checkout" loading="eager"></iframe>'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['lcp', 'lazy', 'scripts', 'measure'] as const

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const hasAttr = (tag: string, attr: string) => new RegExp(`\\b${attr}(?:\\s|=|>|/)`, 'iu').test(tag)

const normalizePriority = (value: string): Priority =>
  PRIORITIES.includes(value.toLowerCase() as Priority) ? (value.toLowerCase() as Priority) : 'auto'

const normalizeLoading = (value: string): LoadingValue =>
  LOADING_VALUES.includes(value.toLowerCase() as LoadingValue)
    ? (value.toLowerCase() as LoadingValue)
    : 'none'

const normalizeDecoding = (value: string): DecodingValue =>
  DECODING_VALUES.includes(value.toLowerCase() as DecodingValue)
    ? (value.toLowerCase() as DecodingValue)
    : 'none'

const normalizeAs = (value: string): AsType =>
  AS_TYPES.includes(value.toLowerCase() as AsType) ? (value.toLowerCase() as AsType) : 'auto'

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const inferIntent = (kind: ResourceKind, href: string, raw: string): ResourceIntent => {
  const sample = `${href} ${raw}`.toLowerCase()
  const parsed = safeUrl(href)
  if (parsed && parsed.origin !== 'https://www.example.com') return 'third_party'
  if (/data-lcp|hero|lcp|poster|cover/.test(sample)) return 'lcp'
  if (/gallery|below|lazy|footer|recommend/.test(sample)) return 'below_fold'
  if (kind === 'fetch' || /api|json|background/.test(sample)) return 'background'
  return 'above_fold'
}

const kindFromTag = (tagName: string, rel: string): ResourceKind => {
  if (tagName === 'img') return 'image'
  if (tagName === 'script') return 'script'
  if (tagName === 'iframe') return 'iframe'
  if (tagName === 'link' && /preload|modulepreload/i.test(rel)) return 'preload'
  return 'fetch'
}

const parseTag = (raw: string, index: number): PriorityHint | null => {
  const tagName = raw.match(/^<([a-z0-9-]+)/iu)?.[1]?.toLowerCase() ?? ''
  const rel = getAttr(raw, 'rel')
  const href = getAttr(
    raw,
    tagName === 'img' || tagName === 'script' || tagName === 'iframe' ? 'src' : 'href'
  )
  if (!tagName || !href) return null
  const kind = kindFromTag(tagName, rel)
  const scriptMode = hasAttr(raw, 'async') ? 'async' : hasAttr(raw, 'defer') ? 'defer' : 'none'

  return {
    asType: normalizeAs(
      getAttr(raw, 'as') || (kind === 'image' ? 'image' : kind === 'script' ? 'script' : 'auto')
    ),
    crossorigin: hasAttr(raw, 'crossorigin'),
    decoding: normalizeDecoding(getAttr(raw, 'decoding')),
    fetchPriority: normalizePriority(getAttr(raw, 'fetchpriority') || getAttr(raw, 'importance')),
    height: getAttr(raw, 'height'),
    href,
    id: `html:${kind}:${href}:${index}`,
    intent: inferIntent(kind, href, raw),
    kind,
    loading: normalizeLoading(getAttr(raw, 'loading')),
    raw,
    scriptMode,
    source: 'html',
    valid: Boolean(href.trim()),
    width: getAttr(raw, 'width')
  }
}

const parseHeaderPart = (raw: string, index: number): PriorityHint | null => {
  const match = raw.match(/<([^>]+)>\s*(?:;\s*(.*))?$/u)
  if (!match?.[1]) return null
  const tail = match[2] ?? ''
  const rel = tail.match(/\brel="?([^";,\s]+)"?/iu)?.[1] ?? 'preload'
  const asType = normalizeAs(tail.match(/\bas="?([^";,\s]+)"?/iu)?.[1] ?? 'auto')
  const fetchPriority = normalizePriority(
    tail.match(/\bfetchpriority="?([^";,\s]+)"?/iu)?.[1] ?? 'auto'
  )
  const href = match[1]
  const kind: ResourceKind = /preload|modulepreload/i.test(rel) ? 'preload' : 'fetch'
  return {
    asType,
    crossorigin: /\bcrossorigin\b/iu.test(tail),
    decoding: 'none',
    fetchPriority,
    height: '',
    href,
    id: `header:${kind}:${href}:${index}`,
    intent: inferIntent(kind, href, raw),
    kind,
    loading: 'none',
    raw,
    scriptMode: 'none',
    source: 'header',
    valid: Boolean(href.trim()),
    width: ''
  }
}

const splitLinkHeader = (value: string) => {
  const parts: string[] = []
  let current = ''
  let quote = ''
  let angleDepth = 0

  for (const char of value) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char
      current += char
      continue
    }
    if (char === quote) {
      quote = ''
      current += char
      continue
    }
    if (!quote && char === '<') angleDepth += 1
    if (!quote && char === '>') angleDepth = Math.max(0, angleDepth - 1)
    if (char === ',' && !quote && angleDepth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

const parseWorkspace = (input: string) => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const hints: PriorityHint[] = []

  for (const match of source.matchAll(/<(img|link|script|iframe)\b[^>]*>/giu)) {
    if (hints.length >= HINT_LIMIT) break
    const parsed = parseTag(match[0], hints.length)
    if (parsed) hints.push(parsed)
  }

  source.split(/\r?\n/u).forEach(rawLine => {
    if (hints.length >= HINT_LIMIT) return
    const line = rawLine.trim()
    const link = line.match(/^Link\s*:\s*(.+)$/iu)
    if (!link?.[1]) return
    splitLinkHeader(link[1]).forEach(part => {
      if (hints.length >= HINT_LIMIT) return
      const parsed = parseHeaderPart(part, hints.length)
      if (parsed) hints.push(parsed)
    })
  })

  return { hints, truncated: input.length >= WORKSPACE_LIMIT }
}

const draftToHint = (draft: PriorityDraft): PriorityHint => ({
  ...draft,
  id: `manual:${draft.kind}:${draft.href}`,
  raw: buildHtml(draft),
  source: 'manual',
  valid: Boolean(draft.href.trim())
})

function buildHtml(hint: PriorityDraft) {
  const priority = hint.fetchPriority === 'auto' ? '' : ` fetchpriority="${hint.fetchPriority}"`
  const loading = hint.loading === 'none' ? '' : ` loading="${hint.loading}"`
  const decoding = hint.decoding === 'none' ? '' : ` decoding="${hint.decoding}"`
  const dimensions =
    hint.width && hint.height
      ? ` width="${escapeHtml(hint.width)}" height="${escapeHtml(hint.height)}"`
      : ''
  const crossorigin = hint.crossorigin ? ' crossorigin' : ''

  if (hint.kind === 'image') {
    return `<img src="${escapeHtml(hint.href)}"${dimensions}${priority}${loading}${decoding}${hint.intent === 'lcp' ? ' data-lcp="true"' : ''}>`
  }

  if (hint.kind === 'preload') {
    const rel = hint.asType === 'script' ? 'modulepreload' : 'preload'
    const asType = hint.asType === 'auto' ? '' : ` as="${hint.asType}"`
    return `<link rel="${rel}" href="${escapeHtml(hint.href)}"${asType}${priority}${crossorigin}>`
  }

  if (hint.kind === 'script') {
    const mode = hint.scriptMode === 'none' ? '' : ` ${hint.scriptMode}`
    return `<script src="${escapeHtml(hint.href)}"${mode}${priority}></script>`
  }

  if (hint.kind === 'iframe') {
    return `<iframe src="${escapeHtml(hint.href)}"${loading}></iframe>`
  }

  return `fetch('${escapeJs(hint.href)}', { priority: '${hint.fetchPriority}' })`
}

const buildNext = (hints: PriorityHint[]) =>
  hints
    .map(hint => {
      if (hint.kind === 'image') {
        const sizeProps =
          hint.width && hint.height
            ? ` width={${Number(hint.width) || 0}} height={${Number(hint.height) || 0}}`
            : ''
        const priorityProp =
          hint.intent === 'lcp' || hint.fetchPriority === 'high' ? ' priority' : ''
        return `<Image src="${escapeHtml(hint.href)}" alt=""${sizeProps}${priorityProp} fetchPriority="${hint.fetchPriority}" />`
      }
      if (hint.kind === 'preload') return buildHtml(hint)
      if (hint.kind === 'script')
        return `<Script src="${escapeHtml(hint.href)}" strategy="afterInteractive" />`
      return buildHtml(hint)
    })
    .join('\n')

const buildFetch = (hints: PriorityHint[]) =>
  hints
    .filter(hint => hint.kind === 'fetch' || hint.asType === 'fetch')
    .map(hint => `await fetch('${escapeJs(hint.href)}', { priority: '${hint.fetchPriority}' })`)
    .join('\n') || "await fetch('/api/data', { priority: 'low' })"

const buildCsv = (hints: PriorityHint[]) =>
  [
    [
      'source',
      'kind',
      'intent',
      'href',
      'fetchPriority',
      'loading',
      'decoding',
      'as',
      'width',
      'height',
      'scriptMode'
    ],
    ...hints.map(hint => [
      hint.source,
      hint.kind,
      hint.intent,
      hint.href,
      hint.fetchPriority,
      hint.loading,
      hint.decoding,
      hint.asType,
      hint.width,
      hint.height,
      hint.scriptMode
    ])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const buildOutput = (hints: PriorityHint[], outputType: OutputType) => {
  if (outputType === 'next') return buildNext(hints)
  if (outputType === 'fetch') return buildFetch(hints)
  if (outputType === 'json') return JSON.stringify(hints, null, 2)
  if (outputType === 'csv') return buildCsv(hints)
  return hints.map(buildHtml).join('\n')
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditHints = (hints: PriorityHint[], truncated: boolean): Finding[] => {
  const findings: Finding[] = []
  const seen = new Map<string, number>()
  const highCount = hints.filter(hint => hint.fetchPriority === 'high').length
  const lowCriticalCount = hints.filter(
    hint => hint.intent === 'lcp' && hint.fetchPriority === 'low'
  ).length

  if (!hints.length) addFinding(findings, 'warn', 'empty', '-')

  hints.forEach(hint => {
    const url = safeUrl(hint.href)
    const key = `${hint.kind}:${hint.href}:${hint.fetchPriority}`
    seen.set(key, (seen.get(key) ?? 0) + 1)

    if (!hint.valid) addFinding(findings, 'danger', 'missing_href', hint.raw)
    if (!url) addFinding(findings, 'danger', 'invalid_url', hint.href)
    if (url?.protocol === 'http:') addFinding(findings, 'danger', 'http_url', hint.href)
    if (/token|session|user|private|account/iu.test(hint.href))
      addFinding(findings, 'warn', 'sensitive_url', hint.href)

    if (hint.intent === 'lcp' && hint.loading === 'lazy')
      addFinding(findings, 'danger', 'lcp_lazy', hint.href)
    if (hint.intent === 'lcp' && hint.fetchPriority === 'low')
      addFinding(findings, 'danger', 'lcp_low', hint.href)
    if (hint.intent === 'lcp' && hint.fetchPriority === 'high' && hint.loading !== 'lazy') {
      addFinding(findings, 'good', 'lcp_high_ok', hint.href)
    }
    if (hint.intent === 'below_fold' && hint.loading !== 'lazy' && hint.kind === 'image') {
      addFinding(findings, 'warn', 'below_fold_not_lazy', hint.href)
    }
    if (hint.intent === 'below_fold' && hint.fetchPriority === 'high')
      addFinding(findings, 'warn', 'below_fold_high', hint.href)
    if (hint.kind === 'image' && (!hint.width || !hint.height))
      addFinding(findings, 'warn', 'missing_dimensions', hint.href)
    if (hint.kind === 'image' && hint.decoding === 'sync' && hint.intent !== 'lcp') {
      addFinding(findings, 'warn', 'sync_decoding', hint.href)
    }
    if (hint.kind === 'preload' && hint.fetchPriority === 'low')
      addFinding(findings, 'warn', 'low_preload', hint.href)
    if (hint.kind === 'preload' && hint.asType === 'auto')
      addFinding(findings, 'warn', 'missing_as', hint.href)
    if (hint.asType === 'font' && !hint.crossorigin)
      addFinding(findings, 'warn', 'font_crossorigin', hint.href)
    if (hint.kind === 'script' && hint.fetchPriority === 'high' && hint.scriptMode === 'none') {
      addFinding(findings, 'warn', 'blocking_high_script', hint.href)
    }
    if (hint.kind === 'script' && hint.intent === 'third_party' && hint.fetchPriority !== 'low') {
      addFinding(findings, 'warn', 'third_party_not_low', hint.href)
    }
    if (hint.kind === 'iframe' && hint.loading !== 'lazy')
      addFinding(findings, 'warn', 'iframe_not_lazy', hint.href)
    if (hint.fetchPriority === 'auto' && hint.intent === 'lcp')
      addFinding(findings, 'warn', 'lcp_auto', hint.href)
  })

  seen.forEach((count, key) => {
    if (count > 1) addFinding(findings, 'warn', 'duplicate_hint', key)
  })
  if (highCount > 4) addFinding(findings, 'warn', 'too_many_high', String(highCount))
  if (lowCriticalCount > 0)
    addFinding(findings, 'danger', 'critical_low_count', String(lowCriticalCount))
  if (truncated) addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', String(hints.length))

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length
  return Math.max(0, Math.min(100, 90 + good * 2 - warn * 5 - danger * 18))
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

function Metric({ label, value }: { label: number | string; value: number | string }) {
  return (
    <div className="glass-input min-w-0 rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function PriorityHintsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<PriorityDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const manualHint = useMemo(() => draftToHint(draft), [draft])
  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const hints = useMemo(
    () => [manualHint, ...parsed.hints].slice(0, HINT_LIMIT),
    [manualHint, parsed.hints]
  )
  const findings = useMemo(() => auditHints(hints, parsed.truncated), [hints, parsed.truncated])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewHints = useMemo(() => hints.slice(0, OUTPUT_PREVIEW_HINT_LIMIT), [hints])
  const outputPreviewSource = useMemo(
    () => buildOutput(outputPreviewHints, outputType),
    [outputPreviewHints, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited = hints.length > outputPreviewHints.length
  const buildCurrentOutput = useCallback(() => buildOutput(hints, outputType), [hints, outputType])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.priority_hints.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredHints = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return hints
    return hints.filter(hint =>
      `${hint.kind} ${hint.intent} ${hint.href} ${hint.fetchPriority}`.toLowerCase().includes(query)
    )
  }, [deferredParsedQuery, hints])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, VISIBLE_FINDING_LIMIT),
    [filteredFindings]
  )
  const visibleHints = useMemo(() => filteredHints.slice(0, VISIBLE_HINT_LIMIT), [filteredHints])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      high: hints.filter(hint => hint.fetchPriority === 'high').length,
      hints: hints.length,
      lazy: hints.filter(hint => hint.loading === 'lazy').length,
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [findings, hints, score]
  )

  const updateDraft = <Key extends keyof PriorityDraft>(key: Key, value: PriorityDraft[Key]) => {
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
    setParsedQuery('')
  }, [])

  const appendDraft = useCallback(() => {
    setWorkspace(current =>
      [current.trim(), buildHtml(draft)].filter(Boolean).join('\n').slice(0, WORKSPACE_LIMIT)
    )
  }, [draft])

  const copySummary = () => {
    copy(
      [
        t('app.converter.priority_hints.summary_title'),
        `${t('app.converter.priority_hints.metric.score')}: ${metrics.score}`,
        `${t('app.converter.priority_hints.metric.hints')}: ${metrics.hints}`,
        `${t('app.converter.priority_hints.metric.high')}: ${metrics.high}`,
        `${t('app.converter.priority_hints.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.priority_hints.metric.critical')}: ${metrics.critical}`
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
                <Zap className="h-4 w-4" />
                {t('app.converter.priority-hints')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.priority-hints')}</CardTitle>
              <CardDescription>{t('app.converter.priority_hints.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.priority_hints.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.priority_hints.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.priority_hints.metric.hints')} value={metrics.hints} />
            <Metric label={t('app.converter.priority_hints.metric.high')} value={metrics.high} />
            <Metric label={t('app.converter.priority_hints.metric.lazy')} value={metrics.lazy} />
            <Metric
              label={t('app.converter.priority_hints.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.priority_hints.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.priority_hints.presets')}</CardTitle>
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
                {t(`app.converter.priority_hints.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.priority_hints.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.04fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.priority_hints.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.priority_hints.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priority-kind">{t('app.converter.priority_hints.kind')}</Label>
                <Select
                  id="priority-kind"
                  value={draft.kind}
                  onChange={event => updateDraft('kind', event.target.value as ResourceKind)}
                >
                  {RESOURCE_KINDS.map(kind => (
                    <option key={kind} value={kind}>
                      {t(`app.converter.priority_hints.kind.${kind}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-intent">{t('app.converter.priority_hints.intent')}</Label>
                <Select
                  id="priority-intent"
                  value={draft.intent}
                  onChange={event => updateDraft('intent', event.target.value as ResourceIntent)}
                >
                  {INTENTS.map(intent => (
                    <option key={intent} value={intent}>
                      {t(`app.converter.priority_hints.intent.${intent}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="priority-href">{t('app.converter.priority_hints.href')}</Label>
                <Input
                  id="priority-href"
                  value={draft.href}
                  onChange={event => updateDraft('href', event.target.value.slice(0, 300))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-fetch">
                  {t('app.converter.priority_hints.fetchpriority')}
                </Label>
                <Select
                  id="priority-fetch"
                  value={draft.fetchPriority}
                  onChange={event => updateDraft('fetchPriority', event.target.value as Priority)}
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {t(`app.converter.priority_hints.priority.${priority}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-as">{t('app.converter.priority_hints.as')}</Label>
                <Select
                  id="priority-as"
                  value={draft.asType}
                  onChange={event => updateDraft('asType', event.target.value as AsType)}
                >
                  {AS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.priority_hints.as.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-loading">
                  {t('app.converter.priority_hints.loading')}
                </Label>
                <Select
                  id="priority-loading"
                  value={draft.loading}
                  onChange={event => updateDraft('loading', event.target.value as LoadingValue)}
                >
                  {LOADING_VALUES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.priority_hints.loading.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-decoding">
                  {t('app.converter.priority_hints.decoding')}
                </Label>
                <Select
                  id="priority-decoding"
                  value={draft.decoding}
                  onChange={event => updateDraft('decoding', event.target.value as DecodingValue)}
                >
                  {DECODING_VALUES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.priority_hints.decoding.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-width">{t('app.converter.priority_hints.width')}</Label>
                <Input
                  id="priority-width"
                  value={draft.width}
                  onChange={event => updateDraft('width', event.target.value.slice(0, 8))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-height">{t('app.converter.priority_hints.height')}</Label>
                <Input
                  id="priority-height"
                  value={draft.height}
                  onChange={event => updateDraft('height', event.target.value.slice(0, 8))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority-script-mode">
                  {t('app.converter.priority_hints.script_mode')}
                </Label>
                <Select
                  id="priority-script-mode"
                  value={draft.scriptMode}
                  onChange={event =>
                    updateDraft('scriptMode', event.target.value as PriorityDraft['scriptMode'])
                  }
                >
                  {(['none', 'async', 'defer'] as const).map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.priority_hints.script_mode.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.crossorigin}
                  onChange={event => updateDraft('crossorigin', event.target.checked)}
                  label={t('app.converter.priority_hints.crossorigin')}
                />
              </div>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.priority_hints.preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {buildHtml(draft)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendDraft} className="w-full sm:w-auto">
                <ImageIcon className="h-4 w-4" />
                {t('app.converter.priority_hints.add_hint')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildHtml(draft))}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.priority_hints.copy_snippet')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.priority_hints.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.priority_hints.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.priority_hints.workspace_placeholder')}
              className="min-h-[390px] font-mono"
              spellCheck={false}
            />
            <InputCapNotice visible={workspace.length >= WORKSPACE_LIMIT} limit={WORKSPACE_LIMIT} />
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.priority_hints.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.priority_hints.audit_search')}
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
                      {t(`app.converter.priority_hints.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.priority_hints.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
              {filteredFindings.length > visibleFindings.length && (
                <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.rows_render_limited', {
                    total: filteredFindings.length.toLocaleString(),
                    visible: visibleFindings.length.toLocaleString()
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.priority_hints.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.priority_hints.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="priority-output-type">
                  {t('app.converter.priority_hints.output_type')}
                </Label>
                <Select
                  id="priority-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.priority_hints.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[320px] font-mono" />
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
                  total: hints.length.toLocaleString(),
                  visible: outputPreviewHints.length.toLocaleString()
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
                {t('app.converter.priority_hints.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'priority-hints.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.priority_hints.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCsv(hints), 'priority-hints.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.priority_hints.download_csv')}
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
                {t('app.converter.priority_hints.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.priority_hints.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredHints.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleHints.map(hint => (
                  <div key={hint.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {hint.kind}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {hint.fetchPriority}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {hint.href}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {t(`app.converter.priority_hints.intent.${hint.intent}`)} /{' '}
                      {t(`app.converter.priority_hints.source.${hint.source}`)}
                    </p>
                  </div>
                ))}
                {filteredHints.length > visibleHints.length && (
                  <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)] md:col-span-2 xl:col-span-3">
                    {t('public.rows_render_limited', {
                      total: filteredHints.length.toLocaleString(),
                      visible: visibleHints.length.toLocaleString()
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.priority_hints.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.priority_hints.reference')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.priority_hints.reference_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRIORITIES.map(priority => (
              <div key={priority} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {priority}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.priority_hints.reference.${priority}`)}
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
              {t('app.converter.priority_hints.checklist')}
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
                {item === 'lcp' ? (
                  <Gauge className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.priority_hints.checklist.${item}.title`)}
              </div>
              {t(`app.converter.priority_hints.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
