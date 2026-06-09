'use client'

import {
  AlertTriangle,
  Bot,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2
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

const ROBOT_TARGETS = ['all', 'googlebot', 'bingbot', 'googlebot-news', 'custom'] as const
const CONTENT_TYPES = ['html', 'pdf', 'image', 'api'] as const
const IMAGE_PREVIEWS = ['standard', 'none', 'large'] as const
const OUTPUT_TYPES = ['html', 'headers', 'next', 'nginx', 'apache', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 60000
const RULE_LIMIT = 140

type RobotTarget = (typeof ROBOT_TARGETS)[number]
type ContentType = (typeof CONTENT_TYPES)[number]
type ImagePreview = (typeof IMAGE_PREVIEWS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey = 'indexable' | 'staging' | 'pdf' | 'snippet' | 'news' | 'legacy_risk'
type ParsedSource = 'html' | 'header' | 'raw'

interface RobotsDraft {
  canonicalUrl: string
  contentType: ContentType
  customAgent: string
  follow: boolean
  index: boolean
  maxImagePreview: ImagePreview
  maxSnippet: string
  maxVideoPreview: string
  noarchive: boolean
  noimageindex: boolean
  nosnippet: boolean
  notranslate: boolean
  production: boolean
  robotsBlocked: boolean
  sitemapUrl: string
  target: RobotTarget
  unavailableAfter: string
  indexIfEmbedded: boolean
}

interface ParsedRule {
  agent: string
  content: string
  directives: string[]
  id: string
  raw: string
  source: ParsedSource
  valid: boolean
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: RobotsDraft
  key: PresetKey
  workspace: string
}

interface DirectiveInfo {
  key: string
  name: string
}

const DEFAULT_DRAFT: RobotsDraft = {
  canonicalUrl: 'https://www.example.com/docs/robots-meta',
  contentType: 'html',
  customAgent: 'googlebot-image',
  follow: true,
  index: true,
  maxImagePreview: 'large',
  maxSnippet: '',
  maxVideoPreview: '',
  noarchive: false,
  noimageindex: false,
  nosnippet: false,
  notranslate: false,
  production: true,
  robotsBlocked: false,
  sitemapUrl: 'https://www.example.com/sitemap.xml',
  target: 'all',
  unavailableAfter: '',
  indexIfEmbedded: false
}

const PRESETS: Preset[] = [
  {
    key: 'indexable',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<meta name="robots" content="index, follow, max-image-preview:large">',
      '<link rel="canonical" href="https://www.example.com/docs/robots-meta">'
    ].join('\n')
  },
  {
    key: 'staging',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: '',
      follow: false,
      index: false,
      maxImagePreview: 'standard',
      production: false,
      sitemapUrl: '',
      target: 'all'
    },
    workspace: [
      '<meta name="robots" content="noindex, nofollow">',
      'X-Robots-Tag: noindex, nofollow'
    ].join('\n')
  },
  {
    key: 'pdf',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'https://www.example.com/reports/quarterly.pdf',
      contentType: 'pdf',
      follow: true,
      index: false,
      maxImagePreview: 'standard',
      noarchive: true,
      sitemapUrl: 'https://www.example.com/report-sitemap.xml',
      target: 'all'
    },
    workspace: ['X-Robots-Tag: noindex, follow, noarchive', 'Content-Type: application/pdf'].join(
      '\n'
    )
  },
  {
    key: 'snippet',
    draft: {
      ...DEFAULT_DRAFT,
      maxImagePreview: 'large',
      maxSnippet: '160',
      maxVideoPreview: '30',
      target: 'googlebot'
    },
    workspace: [
      '<meta name="robots" content="index, follow">',
      '<meta name="googlebot" content="max-snippet:160, max-image-preview:large, max-video-preview:30">'
    ].join('\n')
  },
  {
    key: 'news',
    draft: {
      ...DEFAULT_DRAFT,
      customAgent: 'googlebot-news',
      maxImagePreview: 'large',
      maxSnippet: '80',
      target: 'googlebot-news',
      unavailableAfter: '31 Dec 2026 23:59:59 GMT'
    },
    workspace:
      '<meta name="googlebot-news" content="index, follow, max-snippet:80, unavailable_after: 31 Dec 2026 23:59:59 GMT">'
  },
  {
    key: 'legacy_risk',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'https://www.example.com/old-page',
      follow: false,
      index: false,
      maxImagePreview: 'large',
      maxSnippet: '120',
      indexIfEmbedded: true,
      noimageindex: true,
      nosnippet: true,
      production: true,
      robotsBlocked: true,
      sitemapUrl: 'https://www.example.com/sitemap.xml',
      target: 'all',
      unavailableAfter: 'not-a-date'
    },
    workspace: [
      '<meta name="robots" content="index, noindex, follow">',
      '<meta name="robots" content="noindex, nofollow">',
      'X-Robots-Tag: googlebot: index, noindex',
      'X-Robots-Tag: noai, max-snippet:abc'
    ].join('\n')
  }
]

const DIRECTIVE_REFERENCE: DirectiveInfo[] = [
  { key: 'index', name: 'index' },
  { key: 'noindex', name: 'noindex' },
  { key: 'follow', name: 'follow' },
  { key: 'nofollow', name: 'nofollow' },
  { key: 'none', name: 'none' },
  { key: 'noarchive', name: 'noarchive' },
  { key: 'nosnippet', name: 'nosnippet' },
  { key: 'max-snippet', name: 'max-snippet' },
  { key: 'max-image-preview', name: 'max-image-preview' },
  { key: 'max-video-preview', name: 'max-video-preview' },
  { key: 'noimageindex', name: 'noimageindex' },
  { key: 'indexifembedded', name: 'indexifembedded' },
  { key: 'notranslate', name: 'notranslate' },
  { key: 'unavailable_after', name: 'unavailable_after' }
]

const KNOWN_DIRECTIVES = new Set(DIRECTIVE_REFERENCE.map(item => item.key).concat('nocache'))
const CHECKLIST_ITEMS = ['scope', 'production', 'headers', 'signals'] as const

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

const normalizeDirective = (value: string) => value.trim().toLowerCase().replace(/\s+/gu, ' ')

const directiveName = (directive: string) => {
  const normalized = normalizeDirective(directive)
  if (normalized.startsWith('max-snippet:')) return 'max-snippet'
  if (normalized.startsWith('max-image-preview:')) return 'max-image-preview'
  if (normalized.startsWith('max-video-preview:')) return 'max-video-preview'
  if (normalized.startsWith('unavailable_after:')) return 'unavailable_after'
  return normalized
}

const parseDirectives = (content: string) =>
  content.split(',').map(normalizeDirective).filter(Boolean)

const targetAgent = (draft: Pick<RobotsDraft, 'customAgent' | 'target'>) => {
  if (draft.target === 'all') return 'robots'
  if (draft.target === 'custom') return draft.customAgent.trim().toLowerCase() || 'robots'
  return draft.target
}

const buildDirectives = (draft: RobotsDraft) => {
  const directives = [draft.index ? 'index' : 'noindex', draft.follow ? 'follow' : 'nofollow']

  if (draft.noarchive) directives.push('noarchive')
  if (draft.nosnippet) directives.push('nosnippet')
  if (draft.noimageindex) directives.push('noimageindex')
  if (draft.indexIfEmbedded) directives.push('indexifembedded')
  if (draft.notranslate) directives.push('notranslate')

  const maxSnippet = draft.maxSnippet.trim()
  const maxVideoPreview = draft.maxVideoPreview.trim()
  const unavailableAfter = draft.unavailableAfter.trim()

  if (maxSnippet) directives.push(`max-snippet:${maxSnippet}`)
  if (draft.maxImagePreview !== 'standard')
    directives.push(`max-image-preview:${draft.maxImagePreview}`)
  if (maxVideoPreview) directives.push(`max-video-preview:${maxVideoPreview}`)
  if (unavailableAfter) directives.push(`unavailable_after: ${unavailableAfter}`)

  return directives
}

const parseHeaderContent = (value: string) => {
  const trimmed = value.trim()
  const agentMatch = trimmed.match(/^([a-z][a-z0-9_-]*)\s*:\s*(.+)$/iu)
  if (!agentMatch) return { agent: 'robots', content: trimmed }

  const maybeAgent = (agentMatch[1] ?? '').toLowerCase()
  if (KNOWN_DIRECTIVES.has(maybeAgent)) return { agent: 'robots', content: trimmed }

  return { agent: maybeAgent, content: agentMatch[2] ?? '' }
}

const parseWorkspace = (input: string): ParsedRule[] => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const rules: ParsedRule[] = []

  for (const match of source.matchAll(/<meta\b[^>]*>/giu)) {
    const raw = match[0]
    const name = getAttr(raw, 'name').toLowerCase()
    const content = getAttr(raw, 'content')

    if (!name || !content) continue
    if (name !== 'robots' && !name.includes('bot') && name !== 'slurp') continue

    rules.push({
      agent: name,
      content,
      directives: parseDirectives(content),
      id: `${name}:${rules.length}`,
      raw,
      source: 'html',
      valid: Boolean(parseDirectives(content).length)
    })

    if (rules.length >= RULE_LIMIT) return rules
  }

  source.split(/\r?\n/u).forEach(rawLine => {
    if (rules.length >= RULE_LIMIT) return
    const raw = rawLine.trim()
    if (!raw || raw.startsWith('#')) return

    const headerMatch = raw.match(/^x-robots-tag\s*:\s*(.+)$/iu)
    if (headerMatch) {
      const parsed = parseHeaderContent(headerMatch[1] ?? '')
      rules.push({
        agent: parsed.agent,
        content: parsed.content,
        directives: parseDirectives(parsed.content),
        id: `${parsed.agent}:${rules.length}`,
        raw,
        source: 'header',
        valid: Boolean(parsed.content && parseDirectives(parsed.content).length)
      })
      return
    }

    const rawMatch = raw.match(/^(robots|[a-z][a-z0-9_-]*bot[a-z0-9_-]*|slurp)\s*:\s*(.+)$/iu)
    if (rawMatch) {
      const agent = (rawMatch[1] ?? 'robots').toLowerCase()
      const content = rawMatch[2] ?? ''
      rules.push({
        agent,
        content,
        directives: parseDirectives(content),
        id: `${agent}:${rules.length}`,
        raw,
        source: 'raw',
        valid: Boolean(content && parseDirectives(content).length)
      })
    }
  })

  return rules
}

const hasDirective = (directives: string[], name: string) =>
  directives.some(directive => directiveName(directive) === name)

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const isValidLimit = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /^-?\d+$/u.test(trimmed) && Number(trimmed) >= -1
}

const isValidUnavailableAfter = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return !Number.isNaN(Date.parse(trimmed))
}

const auditRuleDirectives = (findings: Finding[], agent: string, directives: string[]) => {
  if (!directives.length) {
    addFinding(findings, 'danger', 'empty_rule', agent)
    return
  }

  if (hasDirective(directives, 'index') && hasDirective(directives, 'noindex')) {
    addFinding(findings, 'danger', 'index_conflict', agent)
  }
  if (hasDirective(directives, 'follow') && hasDirective(directives, 'nofollow')) {
    addFinding(findings, 'danger', 'follow_conflict', agent)
  }
  if (
    hasDirective(directives, 'none') &&
    (hasDirective(directives, 'index') || hasDirective(directives, 'follow'))
  ) {
    addFinding(findings, 'danger', 'none_conflict', agent)
  }
  if (
    hasDirective(directives, 'nosnippet') &&
    directives.some(item => directiveName(item) === 'max-snippet')
  ) {
    addFinding(findings, 'warn', 'snippet_conflict', agent)
  }
  if (
    hasDirective(directives, 'noimageindex') &&
    directives.some(item => directiveName(item) === 'max-image-preview')
  ) {
    addFinding(findings, 'warn', 'image_conflict', agent)
  }
  if (hasDirective(directives, 'indexifembedded') && !hasDirective(directives, 'noindex')) {
    addFinding(findings, 'warn', 'indexifembedded_without_noindex', agent)
  }

  directives.forEach(directive => {
    const name = directiveName(directive)
    if (!KNOWN_DIRECTIVES.has(name)) addFinding(findings, 'warn', 'unknown_directive', directive)
    if (name === 'max-snippet' && !/^max-snippet:-?\d+$/u.test(directive)) {
      addFinding(findings, 'danger', 'invalid_max_snippet', directive)
    }
    if (name === 'max-video-preview' && !/^max-video-preview:-?\d+$/u.test(directive)) {
      addFinding(findings, 'danger', 'invalid_max_video', directive)
    }
    if (
      name === 'max-image-preview' &&
      !/^max-image-preview:(none|standard|large)$/u.test(directive)
    ) {
      addFinding(findings, 'danger', 'invalid_image_preview', directive)
    }
    if (name === 'unavailable_after') {
      const dateValue = directive.replace(/^unavailable_after:\s*/iu, '')
      if (!isValidUnavailableAfter(dateValue))
        addFinding(findings, 'danger', 'invalid_unavailable_after', directive)
    }
  })
}

const auditRobots = (
  draft: RobotsDraft,
  directives: string[],
  parsedRules: ParsedRule[]
): Finding[] => {
  const findings: Finding[] = []
  const agent = targetAgent(draft)

  auditRuleDirectives(findings, agent, directives)

  if (!isValidLimit(draft.maxSnippet))
    addFinding(findings, 'danger', 'invalid_max_snippet', draft.maxSnippet)
  if (!isValidLimit(draft.maxVideoPreview))
    addFinding(findings, 'danger', 'invalid_max_video', draft.maxVideoPreview)
  if (!isValidUnavailableAfter(draft.unavailableAfter)) {
    addFinding(findings, 'danger', 'invalid_unavailable_after', draft.unavailableAfter)
  }
  if (draft.production && !draft.index) addFinding(findings, 'danger', 'production_noindex', agent)
  if (!draft.production && draft.index) addFinding(findings, 'warn', 'staging_indexable', agent)
  if (draft.robotsBlocked && !draft.index)
    addFinding(findings, 'danger', 'robots_blocked_noindex', agent)
  if (draft.robotsBlocked) addFinding(findings, 'warn', 'robots_blocked', agent)
  if (!draft.index && draft.canonicalUrl.trim())
    addFinding(findings, 'warn', 'canonical_noindex', draft.canonicalUrl)
  if (!draft.index && draft.sitemapUrl.trim())
    addFinding(findings, 'warn', 'sitemap_noindex', draft.sitemapUrl)
  if (draft.contentType !== 'html') addFinding(findings, 'good', 'xrobots_fit', draft.contentType)
  if (draft.index && draft.follow) addFinding(findings, 'good', 'index_follow', agent)
  if (!draft.index && !draft.follow) addFinding(findings, 'good', 'none_equivalent', agent)

  const byAgent = new Map<string, Set<string>>()
  parsedRules.forEach(rule => {
    if (!rule.valid) addFinding(findings, 'danger', 'invalid_rule', rule.raw)
    auditRuleDirectives(findings, rule.agent, rule.directives)
    const values = byAgent.get(rule.agent) ?? new Set<string>()
    values.add(rule.directives.map(directiveName).sort().join(','))
    byAgent.set(rule.agent, values)
  })

  byAgent.forEach((contents, ruleAgent) => {
    if (contents.size > 1) addFinding(findings, 'warn', 'duplicate_agent_rules', ruleAgent)
  })

  const robotsRule = parsedRules.find(rule => rule.agent === 'robots')
  if (robotsRule) {
    parsedRules
      .filter(rule => rule.agent !== 'robots')
      .forEach(rule => {
        if (
          rule.directives.map(directiveName).sort().join(',') !==
          robotsRule.directives.map(directiveName).sort().join(',')
        ) {
          addFinding(findings, 'warn', 'bot_override', rule.agent)
        }
      })
  }

  if (!parsedRules.length) addFinding(findings, 'warn', 'parser_empty', '-')
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', agent)

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

const buildHtml = (agent: string, directives: string[]) =>
  `<meta name="${escapeHtml(agent)}" content="${escapeHtml(directives.join(', '))}">`

const buildHeader = (agent: string, directives: string[]) => {
  const prefix = agent === 'robots' ? '' : `${agent}: `
  return `X-Robots-Tag: ${prefix}${directives.join(', ')}`
}

const buildNext = (draft: RobotsDraft, directives: string[]) => {
  const hasGoogleTarget = draft.target === 'googlebot' || draft.target === 'googlebot-news'
  const baseLines = [
    `    index: ${draft.index},`,
    `    follow: ${draft.follow},`,
    draft.noarchive ? '    nocache: true,' : '',
    draft.nosnippet ? '    nosnippet: true,' : '',
    draft.noimageindex ? '    noimageindex: true,' : '',
    draft.notranslate ? '    notranslate: true,' : ''
  ].filter(Boolean)

  const googleLines = [
    `      index: ${draft.index},`,
    `      follow: ${draft.follow},`,
    draft.maxSnippet.trim() ? `      maxSnippet: ${draft.maxSnippet.trim()},` : '',
    draft.maxImagePreview !== 'standard'
      ? `      maxImagePreview: '${draft.maxImagePreview}',`
      : '',
    draft.maxVideoPreview.trim() ? `      maxVideoPreview: ${draft.maxVideoPreview.trim()},` : ''
  ].filter(Boolean)

  return `export const metadata = {
  robots: {
${baseLines.join('\n')}
${hasGoogleTarget ? `    googleBot: {\n${googleLines.join('\n')}\n    },` : ''}
  },
  other: {
    'X-Robots-Tag': '${escapeJs(buildHeader(targetAgent(draft), directives).replace(/^X-Robots-Tag:\s*/u, ''))}'
  }
}`
}

const buildNginx = (agent: string, directives: string[]) =>
  `add_header X-Robots-Tag "${escapeConfig(agent === 'robots' ? directives.join(', ') : `${agent}: ${directives.join(', ')}`)}" always;`

const buildApache = (agent: string, directives: string[]) =>
  `Header set X-Robots-Tag "${escapeConfig(agent === 'robots' ? directives.join(', ') : `${agent}: ${directives.join(', ')}`)}"`

const buildCsv = (rules: ParsedRule[]) =>
  [
    ['agent', 'source', 'content', 'valid'],
    ...rules.map(rule => [rule.agent, rule.source, rule.content, String(rule.valid)])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const buildOutput = (
  draft: RobotsDraft,
  directives: string[],
  parsedRules: ParsedRule[],
  findings: Finding[],
  outputType: OutputType
) => {
  const agent = targetAgent(draft)
  if (outputType === 'headers') return buildHeader(agent, directives)
  if (outputType === 'next') return buildNext(draft, directives)
  if (outputType === 'nginx') return buildNginx(agent, directives)
  if (outputType === 'apache') return buildApache(agent, directives)
  if (outputType === 'json') {
    return JSON.stringify(
      {
        agent,
        contentType: draft.contentType,
        directives,
        findings,
        parsedRules,
        production: draft.production
      },
      null,
      2
    )
  }
  if (outputType === 'csv') return buildCsv(parsedRules)
  return buildHtml(agent, directives)
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

export default function RobotsMetaClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<RobotsDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')
  const [referenceQuery, setReferenceQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredReferenceQuery = useDeferredValue(referenceQuery)

  const directives = useMemo(() => buildDirectives(draft), [draft])
  const parsedRules = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(
    () => auditRobots(draft, directives, parsedRules),
    [directives, draft, parsedRules]
  )
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, directives, parsedRules, findings, outputType),
    [directives, draft, findings, outputType, parsedRules]
  )
  const csvOutput = useMemo(() => buildCsv(parsedRules), [parsedRules])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.subject} ${item.key} ${t(`app.converter.robots_meta.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredReference = useMemo(() => {
    const query = deferredReferenceQuery.trim().toLowerCase()
    if (!query) return DIRECTIVE_REFERENCE
    return DIRECTIVE_REFERENCE.filter(item => {
      const text =
        `${item.name} ${t(`app.converter.robots_meta.reference.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredReferenceQuery, t])
  const metrics = useMemo(
    () => ({
      agents: String(new Set(parsedRules.map(rule => rule.agent)).size || 1),
      critical: String(findings.filter(item => item.level === 'danger').length),
      directives: String(directives.length),
      parsed: String(parsedRules.length),
      score: String(score),
      warnings: String(findings.filter(item => item.level === 'warn').length)
    }),
    [directives.length, findings, parsedRules, score]
  )

  const updateDraft = <Key extends keyof RobotsDraft>(key: Key, value: RobotsDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.robots_meta.summary_title'),
        `${t('app.converter.robots_meta.metric.score')}: ${metrics.score}`,
        `${t('app.converter.robots_meta.metric.directives')}: ${metrics.directives}`,
        `${t('app.converter.robots_meta.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.robots_meta.metric.critical')}: ${metrics.critical}`
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
                <Bot className="h-4 w-4" />
                {t('app.converter.robots-meta')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.robots-meta')}</CardTitle>
              <CardDescription>{t('app.converter.robots_meta.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={copySummary}
              className="w-full shrink-0 sm:w-auto"
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.robots_meta.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.robots_meta.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.robots_meta.metric.directives')}
              value={metrics.directives}
            />
            <Metric label={t('app.converter.robots_meta.metric.parsed')} value={metrics.parsed} />
            <Metric label={t('app.converter.robots_meta.metric.agents')} value={metrics.agents} />
            <Metric
              label={t('app.converter.robots_meta.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.robots_meta.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.robots_meta.presets')}</CardTitle>
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
                {t(`app.converter.robots_meta.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.robots_meta.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.04fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.robots_meta.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.robots_meta.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="robots-target">{t('app.converter.robots_meta.target')}</Label>
                <Select
                  id="robots-target"
                  value={draft.target}
                  onChange={event => updateDraft('target', event.target.value as RobotTarget)}
                >
                  {ROBOT_TARGETS.map(target => (
                    <option key={target} value={target}>
                      {t(`app.converter.robots_meta.target.${target}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots-content-type">
                  {t('app.converter.robots_meta.content_type')}
                </Label>
                <Select
                  id="robots-content-type"
                  value={draft.contentType}
                  onChange={event => updateDraft('contentType', event.target.value as ContentType)}
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.robots_meta.content_type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {draft.target === 'custom' ? (
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="robots-custom-agent">
                    {t('app.converter.robots_meta.custom_agent')}
                  </Label>
                  <Input
                    id="robots-custom-agent"
                    value={draft.customAgent}
                    onChange={event => updateDraft('customAgent', event.target.value)}
                    className="font-mono"
                  />
                </div>
              ) : null}
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="robots-canonical">
                  {t('app.converter.robots_meta.canonical_url')}
                </Label>
                <Input
                  id="robots-canonical"
                  value={draft.canonicalUrl}
                  onChange={event => updateDraft('canonicalUrl', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="robots-sitemap">{t('app.converter.robots_meta.sitemap_url')}</Label>
                <Input
                  id="robots-sitemap"
                  value={draft.sitemapUrl}
                  onChange={event => updateDraft('sitemapUrl', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots-max-snippet">
                  {t('app.converter.robots_meta.max_snippet')}
                </Label>
                <Input
                  id="robots-max-snippet"
                  value={draft.maxSnippet}
                  onChange={event => updateDraft('maxSnippet', event.target.value)}
                  placeholder="160"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots-max-video">
                  {t('app.converter.robots_meta.max_video_preview')}
                </Label>
                <Input
                  id="robots-max-video"
                  value={draft.maxVideoPreview}
                  onChange={event => updateDraft('maxVideoPreview', event.target.value)}
                  placeholder="30"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots-image-preview">
                  {t('app.converter.robots_meta.max_image_preview')}
                </Label>
                <Select
                  id="robots-image-preview"
                  value={draft.maxImagePreview}
                  onChange={event =>
                    updateDraft('maxImagePreview', event.target.value as ImagePreview)
                  }
                >
                  {IMAGE_PREVIEWS.map(preview => (
                    <option key={preview} value={preview}>
                      {t(`app.converter.robots_meta.image_preview.${preview}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="robots-unavailable-after">
                  {t('app.converter.robots_meta.unavailable_after')}
                </Label>
                <Input
                  id="robots-unavailable-after"
                  value={draft.unavailableAfter}
                  onChange={event => updateDraft('unavailableAfter', event.target.value)}
                  placeholder="31 Dec 2026 23:59:59 GMT"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.index}
                  onChange={event => updateDraft('index', event.target.checked)}
                  label={t('app.converter.robots_meta.index')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.follow}
                  onChange={event => updateDraft('follow', event.target.checked)}
                  label={t('app.converter.robots_meta.follow')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.production}
                  onChange={event => updateDraft('production', event.target.checked)}
                  label={t('app.converter.robots_meta.production')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.noarchive}
                  onChange={event => updateDraft('noarchive', event.target.checked)}
                  label={t('app.converter.robots_meta.noarchive')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.nosnippet}
                  onChange={event => updateDraft('nosnippet', event.target.checked)}
                  label={t('app.converter.robots_meta.nosnippet')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.noimageindex}
                  onChange={event => updateDraft('noimageindex', event.target.checked)}
                  label={t('app.converter.robots_meta.noimageindex')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.indexIfEmbedded}
                  onChange={event => updateDraft('indexIfEmbedded', event.target.checked)}
                  label={t('app.converter.robots_meta.indexifembedded')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.notranslate}
                  onChange={event => updateDraft('notranslate', event.target.checked)}
                  label={t('app.converter.robots_meta.notranslate')}
                />
              </div>
              <div className="glass-input rounded-xl px-3 md:col-span-2">
                <Checkbox
                  checked={draft.robotsBlocked}
                  onChange={event => updateDraft('robotsBlocked', event.target.checked)}
                  label={t('app.converter.robots_meta.robots_blocked')}
                />
              </div>
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.robots_meta.directive_preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {directives.join(', ')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => copy(output)} className="w-full sm:w-auto">
                <Copy className="h-4 w-4" />
                {t('app.converter.robots_meta.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildHeader(targetAgent(draft), directives))}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.robots_meta.copy_header')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.robots_meta.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.robots_meta.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.robots_meta.workspace_placeholder')}
              className="min-h-[420px] font-mono"
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
              <CardTitle className="text-base">{t('app.converter.robots_meta.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.robots_meta.audit_search')}
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
                      {t(`app.converter.robots_meta.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.robots_meta.level.${finding.level}`)}
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
                <CardTitle className="text-base">{t('app.converter.robots_meta.output')}</CardTitle>
                <CardDescription>{t('app.converter.robots_meta.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="robots-output-type">
                  {t('app.converter.robots_meta.output_type')}
                </Label>
                <Select
                  id="robots-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.robots_meta.output.${type}`)}
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
                {t('app.converter.robots_meta.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadText(output, 'robots-meta.txt', 'text/plain;charset=utf-8')}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.robots_meta.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'robots-meta-rules.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.robots_meta.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.robots_meta.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {parsedRules.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {parsedRules.slice(0, 42).map(rule => (
                  <div key={rule.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {rule.agent}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {rule.source}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {rule.content}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {rule.valid
                        ? t('app.converter.robots_meta.valid')
                        : t('app.converter.robots_meta.invalid')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.robots_meta.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.robots_meta.reference')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value)}
                placeholder={t('app.converter.robots_meta.reference_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredReference.map(item => (
                <div key={item.key} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.robots_meta.reference.${item.key}`)}
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
            <CardTitle className="text-base">{t('app.converter.robots_meta.checklist')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4" />
                {t(`app.converter.robots_meta.checklist.${item}.title`)}
              </div>
              {t(`app.converter.robots_meta.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
