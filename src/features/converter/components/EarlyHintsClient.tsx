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
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS
} from '@/utils/outputPreview'

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
  'worker'
] as const
const METHODS = ['GET', 'HEAD', 'POST', 'PUT'] as const
const OUTPUT_TYPES = ['http', 'headers', 'node', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 50000
const HINT_LIMIT = 160
const HINT_MEDIA_FIELD_LIMIT = 320
const OUTPUT_PREVIEW_HINT_LIMIT = 80
const VISIBLE_FINDING_LIMIT = 24
const VISIBLE_HINT_LIMIT = 42

type RelType = (typeof REL_TYPES)[number]
type AsType = (typeof AS_TYPES)[number]
type RouteMethod = (typeof METHODS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type HintSource = 'early' | 'final' | 'manual' | 'plain'
type FindingLevel = 'danger' | 'good' | 'warn'

interface LinkDraft {
  asType: AsType
  crossorigin: boolean
  href: string
  integrity: string
  media: string
  mimeType: string
  rel: RelType
}

interface EarlyHintsDraft {
  finalStatus: string
  hint: LinkDraft
  includeFinalLink: boolean
  routeMethod: RouteMethod
  routePattern: string
}

interface EarlyHint extends LinkDraft {
  id: string
  raw: string
  source: HintSource
  valid: boolean
}

interface ParsedWorkspace {
  forbiddenEarlyHeaders: string[]
  hints: EarlyHint[]
  sawEarlyStatus: boolean
  sawFinalStatus: boolean
  truncated: boolean
}

interface Preset {
  draft: EarlyHintsDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: EarlyHintsDraft = {
  finalStatus: '200',
  hint: {
    asType: 'style',
    crossorigin: false,
    href: 'https://www.example.com/assets/app.css',
    integrity: '',
    media: '',
    mimeType: 'text/css',
    rel: 'preload'
  },
  includeFinalLink: true,
  routeMethod: 'GET',
  routePattern: '/'
}

const PRESETS: Preset[] = [
  {
    key: 'critical_assets',
    draft: DEFAULT_DRAFT,
    workspace: [
      'HTTP/1.1 103 Early Hints',
      'Link: </assets/app.css>; rel=preload; as=style; type=text/css',
      'Link: </assets/app.js>; rel=modulepreload; as=script',
      '',
      'HTTP/1.1 200 OK',
      'Link: </assets/app.css>; rel=preload; as=style; type=text/css',
      'Link: </assets/app.js>; rel=modulepreload; as=script'
    ].join('\n')
  },
  {
    key: 'font_first',
    draft: {
      ...DEFAULT_DRAFT,
      hint: {
        asType: 'font',
        crossorigin: true,
        href: 'https://cdn.example.com/fonts/inter-var.woff2',
        integrity: '',
        media: '',
        mimeType: 'font/woff2',
        rel: 'preload'
      },
      routePattern: '/docs/:path*'
    },
    workspace: [
      'HTTP/1.1 103 Early Hints',
      'Link: <https://cdn.example.com>; rel=preconnect; crossorigin',
      'Link: <https://cdn.example.com/fonts/inter-var.woff2>; rel=preload; as=font; type=font/woff2; crossorigin',
      '',
      'HTTP/1.1 200 OK',
      'Link: <https://cdn.example.com/fonts/inter-var.woff2>; rel=preload; as=font; type=font/woff2; crossorigin'
    ].join('\n')
  },
  {
    key: 'edge_cdn',
    draft: {
      ...DEFAULT_DRAFT,
      hint: {
        asType: 'script',
        crossorigin: true,
        href: 'https://static.example.com/app.shell.js',
        integrity: 'sha384-example',
        media: '',
        mimeType: 'text/javascript',
        rel: 'modulepreload'
      },
      routePattern: '/products/:slug'
    },
    workspace: [
      'HTTP/2 103',
      'Link: <https://static.example.com>; rel=preconnect; crossorigin',
      'Link: <https://static.example.com/app.shell.js>; rel=modulepreload; as=script; crossorigin',
      '',
      'HTTP/2 200',
      'Link: <https://static.example.com/app.shell.js>; rel=modulepreload; as=script; crossorigin'
    ].join('\n')
  },
  {
    key: 'final_mismatch',
    draft: {
      ...DEFAULT_DRAFT,
      includeFinalLink: false,
      hint: {
        ...DEFAULT_DRAFT.hint,
        href: '/hero.avif',
        mimeType: 'image/avif',
        asType: 'image'
      },
      routePattern: '/landing'
    },
    workspace: [
      'HTTP/1.1 103 Early Hints',
      'Link: </hero.avif>; rel=preload; as=image; type=image/avif',
      'Link: </pricing>; rel=prefetch; as=document',
      '',
      'HTTP/1.1 200 OK'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      finalStatus: '302',
      hint: {
        asType: 'font',
        crossorigin: false,
        href: 'http://cdn.example.com/private-user-font.woff2?token=abc',
        integrity: '',
        media: '',
        mimeType: 'font/woff2',
        rel: 'preload'
      },
      includeFinalLink: false,
      routeMethod: 'POST',
      routePattern: '/account/checkout'
    },
    workspace: [
      'HTTP/1.1 103 Early Hints',
      'Set-Cookie: preview=1',
      'Link: <http://cdn.example.com/private-user-font.woff2?token=abc>; rel=preload; as=font; type=font/woff2',
      'Link: </account/checkout>; rel=prerender; as=document',
      'Link: </app.js>; rel=preload',
      'Link: </app.js>; rel=preload',
      '',
      'HTTP/1.1 302 Found'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['scope', 'mirror', 'budget', 'measure'] as const

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const normalizeRel = (value: string): RelType =>
  REL_TYPES.includes(value.toLowerCase() as RelType) ? (value.toLowerCase() as RelType) : 'preload'

const normalizeAs = (value: string): AsType =>
  AS_TYPES.includes(value.toLowerCase() as AsType) ? (value.toLowerCase() as AsType) : 'auto'

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const splitParams = (value: string) => {
  const parts: string[] = []
  let current = ''
  let quote = ''

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

    if (char === ';' && !quote) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) parts.push(current.trim())
  return parts
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

const unquote = (value: string) => value.trim().replace(/^["']|["']$/g, '')

const parseHeaderPart = (raw: string) => {
  const match = raw.match(/<([^>]+)>\s*(?:;\s*(.*))?$/u)
  if (!match) return null
  const params = new Map<string, string>()
  const flags = new Set<string>()

  splitParams(match[2] ?? '').forEach(part => {
    const [rawKey = '', ...valueParts] = part.split('=')
    const key = rawKey.trim().toLowerCase()
    if (!key) return
    if (!valueParts.length) {
      flags.add(key)
      return
    }
    params.set(key, unquote(valueParts.join('=')))
  })

  return {
    asType: normalizeAs(params.get('as') ?? 'auto'),
    crossorigin: flags.has('crossorigin') || params.has('crossorigin'),
    href: match[1] ?? '',
    integrity: params.get('integrity') ?? '',
    media: params.get('media') ?? '',
    mimeType: params.get('type') ?? '',
    rel: normalizeRel(params.get('rel') ?? 'preload')
  }
}

const parseHtmlLink = (raw: string) => ({
  asType: normalizeAs(getAttr(raw, 'as') || 'auto'),
  crossorigin: /\bcrossorigin(?:\s|=|>)/iu.test(raw),
  href: getAttr(raw, 'href'),
  integrity: getAttr(raw, 'integrity'),
  media: getAttr(raw, 'media'),
  mimeType: getAttr(raw, 'type'),
  rel: normalizeRel(getAttr(raw, 'rel') || 'preload')
})

const createHint = (
  hint: LinkDraft,
  raw: string,
  source: HintSource,
  index: number
): EarlyHint => ({
  ...hint,
  id: `${source}:${hint.rel}:${hint.href}:${index}`,
  raw,
  source,
  valid: Boolean(hint.href.trim())
})

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const hints: EarlyHint[] = []
  const forbiddenEarlyHeaders: string[] = []
  let currentSource: HintSource = 'plain'
  let sawEarlyStatus = false
  let sawFinalStatus = false

  source.split(/\r?\n/u).forEach(rawLine => {
    if (hints.length >= HINT_LIMIT) return
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) return

    if (/^(?:HTTP\/\S+\s+103\b|:status\s+103\b)/iu.test(line)) {
      currentSource = 'early'
      sawEarlyStatus = true
      return
    }

    if (/^(?:HTTP\/\S+\s+[2-5]\d\d\b|:status\s+[2-5]\d\d\b)/iu.test(line)) {
      currentSource = 'final'
      sawFinalStatus = true
      return
    }

    const headerName = line.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:/u)?.[1] ?? ''
    if (
      currentSource === 'early' &&
      /^(?:authorization|content-security-policy|set-cookie|vary)$/iu.test(headerName)
    ) {
      forbiddenEarlyHeaders.push(headerName)
    }

    const linkHeader = line.match(/^Link\s*:\s*(.+)$/iu)
    if (linkHeader?.[1]) {
      splitLinkHeader(linkHeader[1]).forEach(part => {
        if (hints.length >= HINT_LIMIT) return
        const parsed = parseHeaderPart(part)
        if (!parsed) return
        hints.push(createHint(parsed, part, currentSource, hints.length))
      })
      return
    }

    if (/^<link\b/iu.test(line)) {
      hints.push(createHint(parseHtmlLink(line), line, 'plain', hints.length))
      return
    }

    if (/^<[^>]+>\s*;/u.test(line)) {
      splitLinkHeader(line).forEach(part => {
        if (hints.length >= HINT_LIMIT) return
        const parsed = parseHeaderPart(part)
        if (!parsed) return
        hints.push(createHint(parsed, part, currentSource, hints.length))
      })
    }
  })

  return {
    forbiddenEarlyHeaders,
    hints,
    sawEarlyStatus,
    sawFinalStatus,
    truncated: input.length >= WORKSPACE_LIMIT
  }
}

const formatLink = (hint: LinkDraft) => {
  const parts = [`<${hint.href}>`, `rel=${hint.rel}`]
  if (
    (hint.rel === 'preload' || hint.rel === 'modulepreload' || hint.rel === 'prefetch') &&
    hint.asType !== 'auto'
  ) {
    parts.push(`as=${hint.asType}`)
  }
  if (hint.mimeType.trim()) parts.push(`type=${hint.mimeType.trim()}`)
  if (hint.media.trim()) parts.push(`media="${hint.media.trim()}"`)
  if (hint.integrity.trim()) parts.push(`integrity=${hint.integrity.trim()}`)
  if (hint.crossorigin) parts.push('crossorigin')
  return parts.join('; ')
}

const buildHeaderLines = (hints: EarlyHint[]) => hints.map(hint => `Link: ${formatLink(hint)}`)

const buildCsv = (hints: EarlyHint[]) =>
  [
    ['source', 'rel', 'href', 'as', 'type', 'crossorigin', 'media', 'integrity', 'valid'],
    ...hints.map(hint => [
      hint.source,
      hint.rel,
      hint.href,
      hint.asType,
      hint.mimeType,
      String(hint.crossorigin),
      hint.media,
      hint.integrity,
      String(hint.valid)
    ])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const buildOutput = (
  earlyHints: EarlyHint[],
  finalHints: EarlyHint[],
  draft: EarlyHintsDraft,
  outputType: OutputType
) => {
  if (outputType === 'headers') {
    return [
      '# 103 Early Hints',
      ...buildHeaderLines(earlyHints),
      '',
      '# Final response',
      ...(finalHints.length
        ? buildHeaderLines(finalHints)
        : ['# Mirror critical Link headers here when the final response is sent.'])
    ].join('\n')
  }

  if (outputType === 'node') {
    const early = earlyHints.map(formatLink)
    const final = finalHints.map(formatLink)
    return [
      'export function sendPage(request, response) {',
      `  const earlyLinks = ${JSON.stringify(early, null, 2).replace(/\n/g, '\n  ')}`,
      `  const finalLinks = ${JSON.stringify(final, null, 2).replace(/\n/g, '\n  ')}`,
      '',
      "  if (request.method === 'GET' || request.method === 'HEAD') {",
      "    response.writeEarlyHints({ link: earlyLinks.join(', ') })",
      '  }',
      '',
      "  if (finalLinks.length) response.setHeader('Link', finalLinks.join(', '))",
      '  response.statusCode = 200',
      "  response.end('<!doctype html>')",
      '}'
    ].join('\n')
  }

  if (outputType === 'json') {
    return JSON.stringify(
      {
        earlyHints,
        finalHints,
        route: {
          finalStatus: draft.finalStatus,
          includeFinalLink: draft.includeFinalLink,
          method: draft.routeMethod,
          pattern: draft.routePattern
        }
      },
      null,
      2
    )
  }

  if (outputType === 'csv') return buildCsv([...earlyHints, ...finalHints])

  return [
    'HTTP/1.1 103 Early Hints',
    ...buildHeaderLines(earlyHints),
    '',
    `HTTP/1.1 ${draft.finalStatus || '200'} OK`,
    ...(finalHints.length
      ? buildHeaderLines(finalHints)
      : ['# Final response has no mirrored Link headers.'])
  ].join('\n')
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

const hintKey = (hint: EarlyHint) => `${hint.rel}:${hint.href.trim().toLowerCase()}:${hint.asType}`

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditHints = (
  earlyHints: EarlyHint[],
  finalHints: EarlyHint[],
  draft: EarlyHintsDraft,
  parsed: ParsedWorkspace,
  workspaceHasInput: boolean
): Finding[] => {
  const findings: Finding[] = []
  const seen = new Map<string, number>()
  const finalKeys = new Set(finalHints.map(hintKey))
  const preconnectOrigins = new Set<string>()
  const preloadCount = earlyHints.filter(
    hint => hint.rel === 'preload' || hint.rel === 'modulepreload'
  ).length

  if (!earlyHints.length) addFinding(findings, 'warn', 'empty', '-')

  if (draft.routeMethod !== 'GET' && draft.routeMethod !== 'HEAD') {
    addFinding(findings, 'danger', 'unsafe_method', draft.routeMethod)
  }

  if (
    /account|admin|api\/(?:checkout|pay|mutate|write)|cart|checkout|payment|session/iu.test(
      draft.routePattern
    )
  ) {
    addFinding(findings, 'warn', 'stateful_route', draft.routePattern)
  }

  if (!draft.includeFinalLink) {
    addFinding(findings, 'warn', 'final_link_disabled', draft.routePattern)
  }

  parsed.forbiddenEarlyHeaders.forEach(header => {
    addFinding(findings, 'danger', 'forbidden_early_header', header)
  })

  if (
    workspaceHasInput &&
    !parsed.sawEarlyStatus &&
    parsed.hints.some(hint => hint.source === 'plain')
  ) {
    addFinding(findings, 'warn', 'missing_103_status', '103')
  }

  if (workspaceHasInput && parsed.sawEarlyStatus && !parsed.sawFinalStatus) {
    addFinding(findings, 'warn', 'missing_final_status', draft.finalStatus)
  }

  earlyHints.forEach(hint => {
    const parsedUrl = safeUrl(hint.href)
    const key = hintKey(hint)
    seen.set(key, (seen.get(key) ?? 0) + 1)

    if (!hint.valid) addFinding(findings, 'danger', 'missing_href', hint.raw)
    if (!parsedUrl) addFinding(findings, 'danger', 'invalid_url', hint.href)
    if (parsedUrl?.protocol === 'http:') addFinding(findings, 'danger', 'http_url', hint.href)
    if (hint.rel === 'preload' && hint.asType === 'auto')
      addFinding(findings, 'danger', 'preload_missing_as', hint.href)
    if (hint.rel === 'modulepreload' && hint.asType !== 'auto' && hint.asType !== 'script') {
      addFinding(findings, 'warn', 'modulepreload_as', hint.href)
    }
    if (hint.rel === 'preconnect' && parsedUrl) {
      preconnectOrigins.add(parsedUrl.origin)
      if (parsedUrl.pathname !== '/') addFinding(findings, 'warn', 'origin_hint_path', hint.href)
    }
    if (hint.rel === 'preconnect' && !/^https?:\/\//iu.test(hint.href)) {
      addFinding(findings, 'warn', 'preconnect_absolute', hint.href)
    }
    if (hint.rel === 'dns-prefetch') addFinding(findings, 'warn', 'dns_prefetch_weak', hint.href)
    if (hint.rel === 'prefetch' || hint.rel === 'prerender')
      addFinding(findings, 'warn', 'speculation_in_103', hint.href)
    if (hint.asType === 'font' && !hint.crossorigin)
      addFinding(findings, 'danger', 'font_crossorigin', hint.href)
    if (hint.asType === 'document' && hint.rel === 'preload')
      addFinding(findings, 'warn', 'document_preload', hint.href)
    if (hint.integrity) addFinding(findings, 'warn', 'integrity_final', hint.href)
    if (/token|session|user|account|private/iu.test(hint.href))
      addFinding(findings, 'warn', 'sensitive_url', hint.href)
    if (!finalKeys.has(key)) addFinding(findings, 'warn', 'final_mismatch', hint.href)
  })

  seen.forEach((count, key) => {
    if (count > 1) addFinding(findings, 'warn', 'duplicate_hint', key)
  })

  if (preloadCount > 6) addFinding(findings, 'warn', 'too_many_preloads', String(preloadCount))
  if (preconnectOrigins.size > 3)
    addFinding(findings, 'warn', 'too_many_preconnect', String(preconnectOrigins.size))
  if (earlyHints.length > 10)
    addFinding(findings, 'warn', 'too_many_early_hints', String(earlyHints.length))
  if (parsed.truncated) addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (parsed.sawEarlyStatus)
    addFinding(
      findings,
      'good',
      'parsed_103',
      String(parsed.hints.filter(hint => hint.source === 'early').length)
    )
  if (finalHints.length) addFinding(findings, 'good', 'final_mirror_ok', String(finalHints.length))
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', String(earlyHints.length))

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length
  return Math.max(0, Math.min(100, 90 + good * 2 - warn * 6 - danger * 20))
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
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

export default function EarlyHintsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<EarlyHintsDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('http')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const manualHint = useMemo(
    () => createHint(draft.hint, formatLink(draft.hint), 'manual', 0),
    [draft.hint]
  )
  const manualFinalHint = useMemo(
    () => createHint(draft.hint, formatLink(draft.hint), 'final', -1),
    [draft.hint]
  )
  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const parsedEarlyHints = useMemo(
    () => parsed.hints.filter(hint => hint.source === 'early' || hint.source === 'plain'),
    [parsed.hints]
  )
  const parsedFinalHints = useMemo(
    () => parsed.hints.filter(hint => hint.source === 'final'),
    [parsed.hints]
  )
  const earlyHints = useMemo(
    () => [manualHint, ...parsedEarlyHints].slice(0, HINT_LIMIT),
    [manualHint, parsedEarlyHints]
  )
  const finalHints = useMemo(
    () =>
      [...(draft.includeFinalLink ? [manualFinalHint] : []), ...parsedFinalHints].slice(
        0,
        HINT_LIMIT
      ),
    [draft.includeFinalLink, manualFinalHint, parsedFinalHints]
  )
  const allHints = useMemo(() => [...earlyHints, ...finalHints], [earlyHints, finalHints])
  const findings = useMemo(
    () => auditHints(earlyHints, finalHints, draft, parsed, Boolean(deferredWorkspace.trim())),
    [deferredWorkspace, draft, earlyHints, finalHints, parsed]
  )
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewEarlyHints = useMemo(
    () => earlyHints.slice(0, OUTPUT_PREVIEW_HINT_LIMIT),
    [earlyHints]
  )
  const outputPreviewFinalHints = useMemo(
    () => finalHints.slice(0, OUTPUT_PREVIEW_HINT_LIMIT),
    [finalHints]
  )
  const outputPreviewSource = useMemo(
    () => buildOutput(outputPreviewEarlyHints, outputPreviewFinalHints, draft, outputType),
    [draft, outputPreviewEarlyHints, outputPreviewFinalHints, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited =
    earlyHints.length > outputPreviewEarlyHints.length ||
    finalHints.length > outputPreviewFinalHints.length
  const buildCurrentOutput = useCallback(
    () => buildOutput(earlyHints, finalHints, draft, outputType),
    [draft, earlyHints, finalHints, outputType]
  )
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.early_hints.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, VISIBLE_FINDING_LIMIT),
    [filteredFindings]
  )
  const findingsLimited = filteredFindings.length > visibleFindings.length
  const filteredHints = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return allHints
    return allHints.filter(hint =>
      `${hint.source} ${hint.rel} ${hint.href} ${hint.asType}`.toLowerCase().includes(query)
    )
  }, [allHints, deferredParsedQuery])
  const visibleHints = useMemo(() => filteredHints.slice(0, VISIBLE_HINT_LIMIT), [filteredHints])
  const hintsLimited = filteredHints.length > visibleHints.length
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      early: earlyHints.length,
      final: finalHints.length,
      origins: new Set(
        allHints
          .map(hint => safeUrl(hint.href)?.origin)
          .filter((origin): origin is string => Boolean(origin))
      ).size,
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [allHints, earlyHints.length, finalHints.length, findings, score]
  )

  const updateHint = <Key extends keyof LinkDraft>(key: Key, value: LinkDraft[Key]) => {
    setDraft(current => ({ ...current, hint: { ...current.hint, [key]: value } }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('http')
    setAuditQuery('')
    setParsedQuery('')
  }, [])

  const appendDraft = useCallback(() => {
    const line = `Link: ${formatLink(draft.hint)}`
    setWorkspace(current =>
      [current.trim(), line].filter(Boolean).join('\n').slice(0, WORKSPACE_LIMIT)
    )
  }, [draft.hint])

  const copySummary = () => {
    copy(
      [
        t('app.converter.early_hints.summary_title'),
        `${t('app.converter.early_hints.metric.score')}: ${metrics.score}`,
        `${t('app.converter.early_hints.metric.early')}: ${metrics.early}`,
        `${t('app.converter.early_hints.metric.final')}: ${metrics.final}`,
        `${t('app.converter.early_hints.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.early_hints.metric.critical')}: ${metrics.critical}`
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
                {t('app.converter.early-hints')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.early-hints')}</CardTitle>
              <CardDescription>{t('app.converter.early_hints.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.early_hints.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.early_hints.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.early_hints.metric.early')} value={metrics.early} />
            <Metric label={t('app.converter.early_hints.metric.final')} value={metrics.final} />
            <Metric label={t('app.converter.early_hints.metric.origins')} value={metrics.origins} />
            <Metric
              label={t('app.converter.early_hints.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.early_hints.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.early_hints.presets')}</CardTitle>
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
                {t(`app.converter.early_hints.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.early_hints.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.early_hints.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.early_hints.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="early-route">{t('app.converter.early_hints.route_pattern')}</Label>
                <Input
                  id="early-route"
                  value={draft.routePattern}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      routePattern: event.target.value.slice(0, 140)
                    }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-method">{t('app.converter.early_hints.route_method')}</Label>
                <Select
                  id="early-method"
                  value={draft.routeMethod}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      routeMethod: event.target.value as RouteMethod
                    }))
                  }
                >
                  {METHODS.map(method => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-rel">{t('app.converter.early_hints.rel')}</Label>
                <Select
                  id="early-rel"
                  value={draft.hint.rel}
                  onChange={event => updateHint('rel', event.target.value as RelType)}
                >
                  {REL_TYPES.map(rel => (
                    <option key={rel} value={rel}>
                      {t(`app.converter.early_hints.rel.${rel}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-as">{t('app.converter.early_hints.as')}</Label>
                <Select
                  id="early-as"
                  value={draft.hint.asType}
                  onChange={event => updateHint('asType', event.target.value as AsType)}
                >
                  {AS_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.early_hints.as.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="early-href">{t('app.converter.early_hints.href')}</Label>
                <Input
                  id="early-href"
                  value={draft.hint.href}
                  onChange={event => updateHint('href', event.target.value.slice(0, 300))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-type">{t('app.converter.early_hints.type')}</Label>
                <Input
                  id="early-type"
                  value={draft.hint.mimeType}
                  onChange={event => updateHint('mimeType', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-final-status">
                  {t('app.converter.early_hints.final_status')}
                </Label>
                <Input
                  id="early-final-status"
                  value={draft.finalStatus}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      finalStatus: event.target.value.slice(0, 12)
                    }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-media">{t('app.converter.early_hints.media')}</Label>
                <Input
                  id="early-media"
                  value={draft.hint.media}
                  onChange={event =>
                    updateHint('media', event.target.value.slice(0, HINT_MEDIA_FIELD_LIMIT))
                  }
                  maxLength={HINT_MEDIA_FIELD_LIMIT}
                  placeholder="(min-width: 768px)"
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="early-integrity">{t('app.converter.early_hints.integrity')}</Label>
                <Input
                  id="early-integrity"
                  value={draft.hint.integrity}
                  onChange={event => updateHint('integrity', event.target.value.slice(0, 180))}
                  placeholder="sha384-..."
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.hint.crossorigin}
                  onChange={event => updateHint('crossorigin', event.target.checked)}
                  label={t('app.converter.early_hints.crossorigin')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.includeFinalLink}
                  onChange={event =>
                    setDraft(current => ({ ...current, includeFinalLink: event.target.checked }))
                  }
                  label={t('app.converter.early_hints.include_final_link')}
                />
              </div>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.early_hints.preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {formatLink(draft.hint)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendDraft} className="w-full sm:w-auto">
                <Link2 className="h-4 w-4" />
                {t('app.converter.early_hints.add_hint')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(formatLink(draft.hint))}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.early_hints.copy_link')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.early_hints.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.early_hints.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.early_hints.workspace_placeholder')}
              className="min-h-[390px] font-mono"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,1.12fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.early_hints.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.early_hints.audit_search')}
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
                      {t(`app.converter.early_hints.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.early_hints.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {findingsLimited && (
              <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                {t('public.rows_render_limited', {
                  total: filteredFindings.length,
                  visible: visibleFindings.length
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">{t('app.converter.early_hints.output')}</CardTitle>
                <CardDescription>{t('app.converter.early_hints.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="early-output-type">
                  {t('app.converter.early_hints.output_type')}
                </Label>
                <Select
                  id="early-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.early_hints.output.${type}`)}
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
                  total: (earlyHints.length + finalHints.length).toLocaleString(),
                  visible: (
                    outputPreviewEarlyHints.length + outputPreviewFinalHints.length
                  ).toLocaleString()
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
                {t('app.converter.early_hints.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentOutput(), 'early-hints.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.early_hints.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCsv(allHints), 'early-hints.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.early_hints.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.early_hints.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.early_hints.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredHints.length ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleHints.map((hint, index) => (
                    <div key={`${hint.id}:${index}`} className="glass-input min-w-0 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {hint.rel}
                        </p>
                        <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                          {t(`app.converter.early_hints.source.${hint.source}`)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                        {hint.href}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                        {hint.asType} /{' '}
                        {hint.valid
                          ? t('app.converter.early_hints.valid')
                          : t('app.converter.early_hints.invalid')}
                      </p>
                    </div>
                  ))}
                </div>
                {hintsLimited && (
                  <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                    {t('public.rows_render_limited', {
                      total: filteredHints.length,
                      visible: visibleHints.length
                    })}
                  </p>
                )}
              </>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.early_hints.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.early_hints.reference')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.early_hints.reference_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REL_TYPES.map(rel => (
              <div key={rel} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{rel}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.early_hints.reference.${rel}`)}
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
            <CardTitle className="text-base">{t('app.converter.early_hints.checklist')}</CardTitle>
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
                  <Gauge className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.early_hints.checklist.${item}.title`)}
              </div>
              {t(`app.converter.early_hints.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
