'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  Link2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const REL_TYPES = [
  'preload',
  'modulepreload',
  'preconnect',
  'dns-prefetch',
  'prefetch',
  'prerender'
] as const
const AS_TYPES = [
  'auto',
  'script',
  'style',
  'font',
  'image',
  'fetch',
  'document',
  'worker',
  'audio',
  'video'
] as const
const PRIORITIES = ['auto', 'high', 'low'] as const
const OUTPUT_TYPES = ['html', 'headers', 'next', 'nginx', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 70000
const HINT_LIMIT = 160

type RelType = (typeof REL_TYPES)[number]
type AsType = (typeof AS_TYPES)[number]
type Priority = (typeof PRIORITIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey =
  | 'critical_css'
  | 'fonts'
  | 'third_party'
  | 'route_prefetch'
  | 'media'
  | 'legacy_risk'
type HintSource = 'manual' | 'html' | 'header'

interface ResourceHintDraft {
  asType: AsType
  crossorigin: boolean
  fetchPriority: Priority
  href: string
  integrity: string
  media: string
  mimeType: string
  rel: RelType
}

interface ResourceHint extends ResourceHintDraft {
  id: string
  raw: string
  source: HintSource
  valid: boolean
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: ResourceHintDraft
  key: PresetKey
  workspace: string
}

interface ReferenceItem {
  key: RelType
}

const DEFAULT_DRAFT: ResourceHintDraft = {
  asType: 'style',
  crossorigin: false,
  fetchPriority: 'high',
  href: 'https://www.example.com/assets/app.css',
  integrity: '',
  media: '',
  mimeType: 'text/css',
  rel: 'preload'
}

const PRESETS: Preset[] = [
  {
    key: 'critical_css',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<link rel="preload" href="/assets/app.css" as="style" fetchpriority="high">',
      '<link rel="preload" href="/assets/app.js" as="script" fetchpriority="high">'
    ].join('\n')
  },
  {
    key: 'fonts',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'font',
      crossorigin: true,
      fetchPriority: 'auto',
      href: 'https://cdn.example.com/fonts/inter-var.woff2',
      mimeType: 'font/woff2'
    },
    workspace: [
      '<link rel="preconnect" href="https://cdn.example.com" crossorigin>',
      '<link rel="preload" href="https://cdn.example.com/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>'
    ].join('\n')
  },
  {
    key: 'third_party',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'auto',
      crossorigin: true,
      fetchPriority: 'auto',
      href: 'https://analytics.example.com',
      mimeType: '',
      rel: 'preconnect'
    },
    workspace: [
      '<link rel="preconnect" href="https://analytics.example.com" crossorigin>',
      '<link rel="dns-prefetch" href="//analytics.example.com">',
      '<link rel="preconnect" href="https://payments.example.com">'
    ].join('\n')
  },
  {
    key: 'route_prefetch',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'document',
      fetchPriority: 'low',
      href: 'https://www.example.com/pricing',
      mimeType: 'text/html',
      rel: 'prefetch'
    },
    workspace: [
      '<link rel="prefetch" href="/pricing" as="document" fetchpriority="low">',
      '<https://www.example.com/features>; rel=prefetch; as=document'
    ].join('\n')
  },
  {
    key: 'media',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'image',
      fetchPriority: 'high',
      href: 'https://www.example.com/hero.avif',
      media: '(min-width: 768px)',
      mimeType: 'image/avif',
      rel: 'preload'
    },
    workspace: [
      '<link rel="preload" href="/hero.avif" as="image" type="image/avif" imagesrcset="/hero.avif 1x, /hero@2x.avif 2x" fetchpriority="high">',
      '<link rel="preload" href="/hero-mobile.avif" as="image" type="image/avif" media="(max-width: 767px)">'
    ].join('\n')
  },
  {
    key: 'legacy_risk',
    draft: {
      ...DEFAULT_DRAFT,
      asType: 'font',
      crossorigin: false,
      fetchPriority: 'high',
      href: 'http://cdn.example.com/font.woff2',
      integrity: 'sha256-short',
      mimeType: 'text/css',
      rel: 'preload'
    },
    workspace: [
      '<link rel="preload" href="http://cdn.example.com/font.woff2" as="font" type="text/css" fetchpriority="high">',
      '<link rel="preload" href="/app.js">',
      '<link rel="preconnect" href="/local-api">',
      '<link rel="dns-prefetch" href="https://cdn.example.com/path/app.js">',
      '<link rel="prerender" href="/checkout">',
      '<link rel="preload" href="/unused-image.png" as="image" fetchpriority="low">',
      '<link rel="modulepreload" href="/legacy.css" as="style">'
    ].join('\n')
  }
]

const REFERENCE: ReferenceItem[] = REL_TYPES.map(key => ({ key }))
const CHECKLIST_ITEMS = ['critical', 'origin', 'attributes', 'budget'] as const

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeConfig = (value: string) => value.replaceAll('"', '\\"')
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const normalizeUrl = (value: string) => value.trim()

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const isCrossOrigin = (href: string) => {
  const parsed = safeUrl(href)
  if (!parsed) return false
  return parsed.origin !== 'https://www.example.com'
}

const inferAsType = (href: string, fallback: AsType): AsType => {
  if (fallback !== 'auto') return fallback
  const path = safeUrl(href)?.pathname.toLowerCase() ?? href.toLowerCase()
  if (/\.(css)$/u.test(path)) return 'style'
  if (/\.(m?js)$/u.test(path)) return 'script'
  if (/\.(woff2?|ttf|otf)$/u.test(path)) return 'font'
  if (/\.(avif|webp|png|jpe?g|gif|svg)$/u.test(path)) return 'image'
  if (/\.(mp4|webm)$/u.test(path)) return 'video'
  return fallback
}

const expectedMime = (asType: AsType) => {
  if (asType === 'style') return 'text/css'
  if (asType === 'script') return 'text/javascript'
  if (asType === 'font') return 'font/'
  if (asType === 'image') return 'image/'
  if (asType === 'document') return 'text/html'
  return ''
}

const parseHeaderParts = (raw: string) => {
  const match = raw.match(/<([^>]+)>\s*;\s*(.+)$/u)
  if (!match) return null
  const href = match[1] ?? ''
  const tail = match[2] ?? ''
  const rel = tail.match(/rel="?([^";,\s]+)"?/iu)?.[1] ?? 'preload'
  const asType = tail.match(/\bas="?([^";,\s]+)"?/iu)?.[1] ?? 'auto'
  const type = tail.match(/\btype="?([^";]+)"?/iu)?.[1] ?? ''
  const media = tail.match(/\bmedia="?([^";]+)"?/iu)?.[1] ?? ''
  const fetchPriority = tail.match(/\bfetchpriority="?([^";,\s]+)"?/iu)?.[1] ?? 'auto'
  const integrity = tail.match(/\bintegrity="?([^";,\s]+)"?/iu)?.[1] ?? ''
  const crossorigin = /\bcrossorigin\b/iu.test(tail)
  return { asType, crossorigin, fetchPriority, href, integrity, media, mimeType: type, rel }
}

const splitLinkHeader = (value: string) => {
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of value) {
    if (char === '"') inQuotes = !inQuotes
    if (char === ',' && !inQuotes) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

const normalizeRel = (value: string): RelType =>
  REL_TYPES.includes(value as RelType) ? (value as RelType) : 'preload'

const normalizeAs = (value: string): AsType =>
  AS_TYPES.includes(value as AsType) ? (value as AsType) : 'auto'

const normalizePriority = (value: string): Priority =>
  PRIORITIES.includes(value as Priority) ? (value as Priority) : 'auto'

const parseWorkspace = (input: string): ResourceHint[] => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const hints: ResourceHint[] = []

  for (const match of source.matchAll(/<link\b[^>]*>/giu)) {
    if (hints.length >= HINT_LIMIT) break
    const raw = match[0]
    const relAttr = getAttr(raw, 'rel')
    if (!relAttr) continue
    const relTokens = relAttr.toLowerCase().split(/\s+/u)
    const rel = relTokens.find(token => REL_TYPES.includes(token as RelType))
    if (!rel) continue
    const href = getAttr(raw, 'href')
    const asType = normalizeAs(getAttr(raw, 'as') || 'auto')
    const fetchPriority = normalizePriority(getAttr(raw, 'fetchpriority') || 'auto')
    const hint: ResourceHint = {
      asType: inferAsType(href, asType),
      crossorigin: /\bcrossorigin(?:\s|=|>)/iu.test(raw),
      fetchPriority,
      href,
      id: `${rel}:${href}:${hints.length}`,
      integrity: getAttr(raw, 'integrity'),
      media: getAttr(raw, 'media'),
      mimeType: getAttr(raw, 'type'),
      raw,
      rel: normalizeRel(rel),
      source: 'html',
      valid: Boolean(href)
    }
    hints.push(hint)
  }

  source.split(/\r?\n/u).forEach(rawLine => {
    if (hints.length >= HINT_LIMIT) return
    const raw = rawLine.trim()
    if (!raw || raw.startsWith('#')) return
    const line = raw.replace(/^link:\s*/iu, '')
    splitLinkHeader(line).forEach(part => {
      if (hints.length >= HINT_LIMIT) return
      const parsed = parseHeaderParts(part)
      if (!parsed) return
      hints.push({
        asType: inferAsType(parsed.href, normalizeAs(parsed.asType)),
        crossorigin: parsed.crossorigin,
        fetchPriority: normalizePriority(parsed.fetchPriority),
        href: parsed.href,
        id: `${parsed.rel}:${parsed.href}:${hints.length}`,
        integrity: parsed.integrity,
        media: parsed.media,
        mimeType: parsed.mimeType,
        raw: part,
        rel: normalizeRel(parsed.rel),
        source: 'header',
        valid: Boolean(parsed.href)
      })
    })
  })

  return hints
}

const draftToHint = (draft: ResourceHintDraft): ResourceHint => ({
  ...draft,
  asType: inferAsType(draft.href, draft.asType),
  id: `manual:${draft.rel}:${draft.href}`,
  raw: buildHtml(draft),
  source: 'manual',
  valid: Boolean(draft.href.trim())
})

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditHints = (hints: ResourceHint[]): Finding[] => {
  const findings: Finding[] = []
  if (!hints.length) return [{ key: 'empty', level: 'warn', subject: '-' }]

  const seen = new Map<string, number>()
  const preconnectOrigins = new Set<string>()
  const dnsPrefetchHosts = new Set<string>()
  const preloadCount = hints.filter(
    hint => hint.rel === 'preload' || hint.rel === 'modulepreload'
  ).length

  hints.forEach(hint => {
    const href = normalizeUrl(hint.href)
    const parsed = safeUrl(href)
    const key = `${hint.rel}:${href}:${hint.asType}`
    seen.set(key, (seen.get(key) ?? 0) + 1)

    if (!hint.valid) addFinding(findings, 'danger', 'missing_href', hint.raw)
    if (!parsed) addFinding(findings, 'danger', 'invalid_url', href)
    if (parsed?.protocol === 'http:') addFinding(findings, 'danger', 'http_url', href)
    if (hint.rel === 'preload' && hint.asType === 'auto')
      addFinding(findings, 'danger', 'preload_missing_as', href)
    if (hint.rel === 'modulepreload' && hint.asType !== 'script' && hint.asType !== 'auto') {
      addFinding(findings, 'warn', 'modulepreload_as', href)
    }
    if (
      (hint.rel === 'preconnect' || hint.rel === 'dns-prefetch') &&
      parsed &&
      parsed.pathname !== '/'
    ) {
      addFinding(findings, 'warn', 'origin_hint_path', href)
    }
    if (hint.rel === 'preconnect' && !parsed?.host)
      addFinding(findings, 'warn', 'preconnect_relative', href)
    if (hint.rel === 'dns-prefetch' && href.startsWith('https://'))
      addFinding(findings, 'warn', 'dns_prefetch_scheme', href)
    if (hint.asType === 'font' && !hint.crossorigin)
      addFinding(findings, 'danger', 'font_crossorigin', href)
    if (hint.integrity && !hint.crossorigin && isCrossOrigin(href))
      addFinding(findings, 'warn', 'integrity_crossorigin', href)
    if (hint.fetchPriority === 'high' && hint.rel !== 'preload' && hint.rel !== 'modulepreload') {
      addFinding(findings, 'warn', 'priority_without_preload', href)
    }
    if (hint.fetchPriority === 'low' && (hint.rel === 'preload' || hint.rel === 'modulepreload')) {
      addFinding(findings, 'warn', 'low_priority_preload', href)
    }
    if (hint.rel === 'prerender') addFinding(findings, 'warn', 'prerender_risk', href)
    if (hint.rel === 'prefetch' && hint.fetchPriority === 'high')
      addFinding(findings, 'warn', 'prefetch_high', href)
    if (hint.rel === 'preconnect' && parsed) preconnectOrigins.add(parsed.origin)
    if (hint.rel === 'dns-prefetch' && parsed) dnsPrefetchHosts.add(parsed.host)

    const expected = expectedMime(hint.asType)
    if (expected && hint.mimeType && !hint.mimeType.toLowerCase().startsWith(expected)) {
      addFinding(findings, 'warn', 'type_mismatch', `${hint.asType} / ${hint.mimeType}`)
    }
    if (hint.rel === 'preload' && hint.asType === 'image' && !hint.fetchPriority.includes('high')) {
      addFinding(findings, 'good', 'image_preload_ok', href)
    }
    if (hint.rel === 'preconnect') addFinding(findings, 'good', 'preconnect_ok', href)
    if (hint.rel === 'modulepreload') addFinding(findings, 'good', 'modulepreload_ok', href)
  })

  seen.forEach((count, key) => {
    if (count > 1) addFinding(findings, 'warn', 'duplicate_hint', key)
  })
  if (preconnectOrigins.size > 4)
    addFinding(findings, 'warn', 'too_many_preconnect', String(preconnectOrigins.size))
  if (dnsPrefetchHosts.size > 8)
    addFinding(findings, 'warn', 'too_many_dns', String(dnsPrefetchHosts.size))
  if (preloadCount > 8) addFinding(findings, 'warn', 'too_many_preloads', String(preloadCount))
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', String(hints.length))

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length

  return Math.max(0, Math.min(100, 88 + good * 2 - warn * 6 - danger * 18))
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

function buildHtml(hint: ResourceHintDraft) {
  const attrs = [`rel="${escapeHtml(hint.rel)}"`, `href="${escapeHtml(hint.href)}"`]
  if (
    (hint.rel === 'preload' || hint.rel === 'modulepreload' || hint.rel === 'prefetch') &&
    hint.asType !== 'auto'
  ) {
    attrs.push(`as="${escapeHtml(hint.asType)}"`)
  }
  if (hint.mimeType.trim()) attrs.push(`type="${escapeHtml(hint.mimeType.trim())}"`)
  if (hint.media.trim()) attrs.push(`media="${escapeHtml(hint.media.trim())}"`)
  if (hint.fetchPriority !== 'auto') attrs.push(`fetchpriority="${hint.fetchPriority}"`)
  if (hint.integrity.trim()) attrs.push(`integrity="${escapeHtml(hint.integrity.trim())}"`)
  if (hint.crossorigin) attrs.push('crossorigin')
  return `<link ${attrs.join(' ')}>`
}

const buildHeader = (hint: ResourceHintDraft) => {
  const parts = [`<${hint.href}>`, `rel="${hint.rel}"`]
  if (
    (hint.rel === 'preload' || hint.rel === 'modulepreload' || hint.rel === 'prefetch') &&
    hint.asType !== 'auto'
  ) {
    parts.push(`as="${hint.asType}"`)
  }
  if (hint.mimeType.trim()) parts.push(`type="${hint.mimeType.trim()}"`)
  if (hint.media.trim()) parts.push(`media="${hint.media.trim()}"`)
  if (hint.fetchPriority !== 'auto') parts.push(`fetchpriority="${hint.fetchPriority}"`)
  if (hint.integrity.trim()) parts.push(`integrity="${hint.integrity.trim()}"`)
  if (hint.crossorigin) parts.push('crossorigin')
  return parts.join('; ')
}

const buildNext = (hints: ResourceHint[]) => {
  const preconnects = hints
    .filter(hint => hint.rel === 'preconnect')
    .map(hint => `      '${escapeJs(hint.href)}'`)
  const dns = hints
    .filter(hint => hint.rel === 'dns-prefetch')
    .map(hint => `      '${escapeJs(hint.href)}'`)
  const other = hints
    .filter(hint => hint.rel !== 'preconnect' && hint.rel !== 'dns-prefetch')
    .map(
      hint =>
        `      ${JSON.stringify({ as: hint.asType === 'auto' ? undefined : hint.asType, crossOrigin: hint.crossorigin ? 'anonymous' : undefined, href: hint.href, rel: hint.rel }).replaceAll('"undefined"', 'undefined')}`
    )
  return `export default function Head() {
  return (
    <>
${preconnects.map(item => `      <link rel="preconnect" href={${item}} />`).join('\n')}
${dns.map(item => `      <link rel="dns-prefetch" href={${item}} />`).join('\n')}
${other.map(item => `      <link {...${item}} />`).join('\n')}
    </>
  )
}`
}

const buildNginx = (hints: ResourceHint[]) =>
  hints.map(hint => `add_header Link "${escapeConfig(buildHeader(hint))}" always;`).join('\n')

const buildCsv = (hints: ResourceHint[]) =>
  [
    ['rel', 'href', 'as', 'type', 'crossorigin', 'fetchPriority', 'source', 'valid'],
    ...hints.map(hint => [
      hint.rel,
      hint.href,
      hint.asType,
      hint.mimeType,
      String(hint.crossorigin),
      hint.fetchPriority,
      hint.source,
      String(hint.valid)
    ])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const buildOutput = (hints: ResourceHint[], outputType: OutputType) => {
  if (outputType === 'headers') return hints.map(buildHeader).join(',\n')
  if (outputType === 'next') return buildNext(hints)
  if (outputType === 'nginx') return buildNginx(hints)
  if (outputType === 'json') return JSON.stringify(hints, null, 2)
  if (outputType === 'csv') return buildCsv(hints)
  return hints.map(buildHtml).join('\n')
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input min-w-0 rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function ResourceHintsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ResourceHintDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')
  const [referenceQuery, setReferenceQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredReferenceQuery = useDeferredValue(referenceQuery)

  const manualHint = useMemo(() => draftToHint(draft), [draft])
  const parsedHints = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const hints = useMemo(
    () => [manualHint, ...parsedHints].slice(0, HINT_LIMIT),
    [manualHint, parsedHints]
  )
  const findings = useMemo(() => auditHints(hints), [hints])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(() => buildOutput(hints, outputType), [hints, outputType])
  const csvOutput = useMemo(() => buildCsv(hints), [hints])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.subject} ${item.key} ${t(`app.converter.resource_hints.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredReference = useMemo(() => {
    const query = deferredReferenceQuery.trim().toLowerCase()
    if (!query) return REFERENCE
    return REFERENCE.filter(item =>
      `${item.key} ${t(`app.converter.resource_hints.reference.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredReferenceQuery, t])
  const metrics = useMemo(
    () => ({
      critical: String(findings.filter(item => item.level === 'danger').length),
      hints: String(hints.length),
      origins: String(new Set(hints.map(hint => safeUrl(hint.href)?.origin).filter(Boolean)).size),
      preloads: String(
        hints.filter(hint => hint.rel === 'preload' || hint.rel === 'modulepreload').length
      ),
      score: String(score),
      warnings: String(findings.filter(item => item.level === 'warn').length)
    }),
    [findings, hints, score]
  )

  const updateDraft = <Key extends keyof ResourceHintDraft>(
    key: Key,
    value: ResourceHintDraft[Key]
  ) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }

  const appendDraft = () => {
    setWorkspace(current =>
      [current.trim(), buildHtml(draft)].filter(Boolean).join('\n').slice(0, WORKSPACE_LIMIT)
    )
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.resource_hints.summary_title'),
        `${t('app.converter.resource_hints.metric.score')}: ${metrics.score}`,
        `${t('app.converter.resource_hints.metric.hints')}: ${metrics.hints}`,
        `${t('app.converter.resource_hints.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.resource_hints.metric.critical')}: ${metrics.critical}`
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
                {t('app.converter.resource-hints')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.resource-hints')}</CardTitle>
              <CardDescription>{t('app.converter.resource_hints.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={copySummary}
              className="w-full shrink-0 sm:w-auto"
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.resource_hints.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.resource_hints.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.resource_hints.metric.hints')} value={metrics.hints} />
            <Metric
              label={t('app.converter.resource_hints.metric.preloads')}
              value={metrics.preloads}
            />
            <Metric
              label={t('app.converter.resource_hints.metric.origins')}
              value={metrics.origins}
            />
            <Metric
              label={t('app.converter.resource_hints.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.resource_hints.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.resource_hints.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input min-w-0 rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.resource_hints.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.resource_hints.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.04fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.resource_hints.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.resource_hints.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="resource-rel">{t('app.converter.resource_hints.rel')}</Label>
                <Select
                  id="resource-rel"
                  value={draft.rel}
                  onChange={event => updateDraft('rel', event.target.value as RelType)}
                >
                  {REL_TYPES.map(rel => (
                    <option key={rel} value={rel}>
                      {t(`app.converter.resource_hints.rel.${rel}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-as">{t('app.converter.resource_hints.as')}</Label>
                <Select
                  id="resource-as"
                  value={draft.asType}
                  onChange={event => updateDraft('asType', event.target.value as AsType)}
                >
                  {AS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.resource_hints.as.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="resource-href">{t('app.converter.resource_hints.href')}</Label>
                <Input
                  id="resource-href"
                  value={draft.href}
                  onChange={event => updateDraft('href', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-type">{t('app.converter.resource_hints.type')}</Label>
                <Input
                  id="resource-type"
                  value={draft.mimeType}
                  onChange={event => updateDraft('mimeType', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-priority">
                  {t('app.converter.resource_hints.fetchpriority')}
                </Label>
                <Select
                  id="resource-priority"
                  value={draft.fetchPriority}
                  onChange={event => updateDraft('fetchPriority', event.target.value as Priority)}
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {t(`app.converter.resource_hints.priority.${priority}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-media">{t('app.converter.resource_hints.media')}</Label>
                <Input
                  id="resource-media"
                  value={draft.media}
                  onChange={event => updateDraft('media', event.target.value)}
                  placeholder="(min-width: 768px)"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-integrity">
                  {t('app.converter.resource_hints.integrity')}
                </Label>
                <Input
                  id="resource-integrity"
                  value={draft.integrity}
                  onChange={event => updateDraft('integrity', event.target.value)}
                  placeholder="sha384-..."
                  className="font-mono"
                />
              </div>
            </div>
            <div className="glass-input rounded-xl px-3">
              <Checkbox
                checked={draft.crossorigin}
                onChange={event => updateDraft('crossorigin', event.target.checked)}
                label={t('app.converter.resource_hints.crossorigin')}
              />
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.resource_hints.preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {buildHtml(draft)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendDraft} className="w-full sm:w-auto">
                <Link2 className="h-4 w-4" />
                {t('app.converter.resource_hints.add_hint')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildHeader(draft))}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.resource_hints.copy_header')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.resource_hints.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.resource_hints.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.resource_hints.workspace_placeholder')}
              className="min-h-[390px] font-mono"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.resource_hints.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.resource_hints.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 22).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.resource_hints.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.resource_hints.level.${finding.level}`)}
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
                  {t('app.converter.resource_hints.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.resource_hints.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="resource-output-type">
                  {t('app.converter.resource_hints.output_type')}
                </Label>
                <Select
                  id="resource-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.resource_hints.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[320px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.resource_hints.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'resource-hints.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.resource_hints.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'resource-hints.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.resource_hints.download_csv')}
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
                {t('app.converter.resource_hints.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {hints.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {hints.slice(0, 42).map(hint => (
                  <div key={hint.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {hint.rel}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {hint.asType}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {hint.href}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {hint.source} /{' '}
                      {hint.valid
                        ? t('app.converter.resource_hints.valid')
                        : t('app.converter.resource_hints.invalid')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.resource_hints.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.resource_hints.reference')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value)}
                placeholder={t('app.converter.resource_hints.reference_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredReference.map(item => (
                <div key={item.key} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {item.key}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.resource_hints.reference.${item.key}`)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.resource_hints.checklist')}
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
                {item === 'critical' ? (
                  <Gauge className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.resource_hints.checklist.${item}.title`)}
              </div>
              {t(`app.converter.resource_hints.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
