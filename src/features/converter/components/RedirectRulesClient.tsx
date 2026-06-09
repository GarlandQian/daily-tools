'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  GitBranch,
  Link2,
  ListChecks,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
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

const STATUS_CODES = ['301', '302', '303', '307', '308'] as const
const MATCH_TYPES = ['exact', 'prefix', 'wildcard', 'regex'] as const
const OUTPUT_TYPES = ['nginx', 'apache', 'next', 'cloudflare', 'netlify', 'json'] as const
const RULE_INPUT_LIMIT = 36000
const RULE_LIMIT = 220

type RedirectStatus = (typeof STATUS_CODES)[number]
type MatchType = (typeof MATCH_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey =
  | 'domain_move'
  | 'https_www'
  | 'slug_cleanup'
  | 'locale_split'
  | 'campaign'
  | 'legacy_risk'

interface RedirectDraft {
  from: string
  host: string
  matchType: MatchType
  preserveQuery: boolean
  status: RedirectStatus
  to: string
}

interface RedirectRule extends RedirectDraft {
  id: string
  raw: string
  valid: boolean
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  draft: RedirectDraft
  key: PresetKey
  workspace: string
}

interface ReferenceItem {
  key: string
  status: RedirectStatus
}

const DEFAULT_DRAFT: RedirectDraft = {
  from: '/old-path',
  host: 'example.com',
  matchType: 'exact',
  preserveQuery: true,
  status: '308',
  to: '/new-path'
}

const PRESETS: Preset[] = [
  {
    key: 'domain_move',
    draft: {
      from: '/:path*',
      host: 'old.example.com',
      matchType: 'wildcard',
      preserveQuery: true,
      status: '308',
      to: 'https://www.example.com/:path*'
    },
    workspace: [
      '308 old.example.com /:path* https://www.example.com/:path* preserve-query',
      '308 example.org /:path* https://www.example.com/:path* preserve-query'
    ].join('\n')
  },
  {
    key: 'https_www',
    draft: {
      from: '/:path*',
      host: 'example.com',
      matchType: 'wildcard',
      preserveQuery: true,
      status: '308',
      to: 'https://www.example.com/:path*'
    },
    workspace: '308 example.com /:path* https://www.example.com/:path* preserve-query'
  },
  {
    key: 'slug_cleanup',
    draft: {
      from: '/blog/old-launch-post',
      host: 'example.com',
      matchType: 'exact',
      preserveQuery: true,
      status: '301',
      to: '/blog/product-launch'
    },
    workspace: [
      '301 example.com /blog/old-launch-post /blog/product-launch preserve-query',
      '301 example.com /docs/getting-started.html /docs/getting-started preserve-query',
      '301 example.com /pricing/ /pricing preserve-query'
    ].join('\n')
  },
  {
    key: 'locale_split',
    draft: {
      from: '/cn/:path*',
      host: 'example.com',
      matchType: 'wildcard',
      preserveQuery: true,
      status: '308',
      to: '/zh-CN/:path*'
    },
    workspace: [
      '308 example.com /cn/:path* /zh-CN/:path* preserve-query',
      '308 example.com /tw/:path* /zh-TW/:path* preserve-query',
      '308 example.com /jp/:path* /ja/:path* preserve-query'
    ].join('\n')
  },
  {
    key: 'campaign',
    draft: {
      from: '/spring-sale',
      host: 'example.com',
      matchType: 'exact',
      preserveQuery: false,
      status: '302',
      to: '/campaigns/spring-2026'
    },
    workspace: [
      '302 example.com /spring-sale /campaigns/spring-2026 drop-query',
      '302 example.com /launch /waitlist drop-query'
    ].join('\n')
  },
  {
    key: 'legacy_risk',
    draft: {
      from: '/a',
      host: 'example.com',
      matchType: 'exact',
      preserveQuery: true,
      status: '302',
      to: 'http://example.com/b'
    },
    workspace: [
      '302 example.com /a http://example.com/b preserve-query',
      '301 example.com /b /c preserve-query',
      '301 example.com /c /a preserve-query',
      '301 example.com /loop /loop preserve-query',
      '301 example.com /(.* https://example.com/$1 preserve-query'
    ].join('\n')
  }
]

const STATUS_REFERENCE: ReferenceItem[] = STATUS_CODES.map(status => ({ key: status, status }))

const normalizePath = (value: string) => {
  const trimmed = value.trim() || '/'
  if (/^https?:\/\//iu.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      return `${url.pathname || '/'}${url.search}`
    } catch {
      return trimmed
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const getTargetKey = (rule: Pick<RedirectRule, 'host' | 'to'>) => {
  const to = rule.to.trim()
  if (/^https?:\/\//iu.test(to)) {
    try {
      const url = new URL(to)
      return `${url.hostname.toLowerCase()} ${url.pathname || '/'}`
    } catch {
      return to.toLowerCase()
    }
  }
  return `${rule.host.toLowerCase()} ${normalizePath(to)}`
}

const getSourceKey = (rule: Pick<RedirectRule, 'from' | 'host'>) =>
  `${rule.host.toLowerCase()} ${normalizePath(rule.from)}`

const targetLooksExternalWithoutScheme = (value: string) =>
  /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/iu.test(value.trim()) && !/^https?:\/\//iu.test(value.trim())

const inferMatchType = (from: string): MatchType => {
  if (from.includes('(') || from.includes('^') || from.includes('$')) return 'regex'
  if (from.includes('*') || from.includes(':')) return 'wildcard'
  if (from.endsWith('/')) return 'prefix'
  return 'exact'
}

const parseRules = (input: string): RedirectRule[] => {
  const rules: RedirectRule[] = []

  for (const rawLine of input.slice(0, RULE_INPUT_LIMIT).split(/\r?\n/u)) {
    const raw = rawLine.trim()
    if (!raw || raw.startsWith('#')) continue
    const parts = raw.split(/\s+/u)
    let status = '308'
    let cursor = 0

    if (/^30[12378]$/u.test(parts[0] ?? '')) {
      status = parts[0] ?? status
      cursor = 1
    }

    const host = parts[cursor] ?? ''
    const from = parts[cursor + 1] ?? ''
    const to = parts[cursor + 2] ?? ''
    const flags = parts
      .slice(cursor + 3)
      .join(' ')
      .toLowerCase()
    const preserveQuery = !/drop-query|no-query|discard-query/u.test(flags)
    const valid = Boolean(host && from && to && /^30[12378]$/u.test(status))

    rules.push({
      from: normalizePath(from),
      host,
      id: `${host}:${from}:${to}:${rules.length}`,
      matchType: inferMatchType(from),
      preserveQuery,
      raw,
      status: status as RedirectStatus,
      to,
      valid
    })

    if (rules.length >= RULE_LIMIT) break
  }

  return rules
}

const draftToLine = (draft: RedirectDraft) =>
  `${draft.status} ${draft.host || 'example.com'} ${normalizePath(draft.from)} ${draft.to || '/'} ${draft.preserveQuery ? 'preserve-query' : 'drop-query'}`

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditRules = (rules: RedirectRule[]): Finding[] => {
  const findings: Finding[] = []

  if (!rules.length) return [{ key: 'empty', level: 'warn', subject: '-' }]

  rules.forEach(rule => {
    if (!rule.valid) addFinding(findings, 'danger', 'invalid_shape', rule.raw)
    if (rule.from === normalizePath(rule.to))
      addFinding(findings, 'danger', 'self_redirect', rule.from)
    if (/^http:\/\//iu.test(rule.to)) addFinding(findings, 'danger', 'http_target', rule.to)
    if (rule.to.startsWith('//'))
      addFinding(findings, 'danger', 'protocol_relative_target', rule.to)
    if (targetLooksExternalWithoutScheme(rule.to))
      addFinding(findings, 'warn', 'external_without_scheme', rule.to)
    if (rule.status === '302' || rule.status === '303' || rule.status === '307') {
      addFinding(findings, 'warn', 'temporary_status', `${rule.status} ${rule.from}`)
    }
    if (
      /\/(api|webhook|callback|oauth|auth)(\/|$)/iu.test(rule.from) &&
      (rule.status === '301' || rule.status === '302')
    ) {
      addFinding(findings, 'warn', 'method_semantics', `${rule.status} ${rule.from}`)
    }
    if (rule.matchType === 'regex') {
      try {
        new RegExp(rule.from)
        addFinding(findings, 'good', 'regex_valid', rule.from)
      } catch {
        addFinding(findings, 'danger', 'regex_invalid', rule.from)
      }
    }
    if (rule.matchType === 'wildcard' && !rule.to.includes('*') && !rule.to.includes(':')) {
      addFinding(findings, 'warn', 'wildcard_drops_path', rule.from)
    }
    if (!rule.preserveQuery) addFinding(findings, 'warn', 'drops_query', rule.from)
    if (/\butm_|gclid|fbclid/iu.test(rule.from) && rule.preserveQuery) {
      addFinding(findings, 'warn', 'campaign_query_preserved', rule.from)
    }
    if (rule.status === '301' || rule.status === '308')
      addFinding(findings, 'good', 'permanent_status', `${rule.status} ${rule.from}`)
  })

  const sourceCounts = new Map<string, number>()
  const edges = new Map<string, string>()
  rules
    .filter(rule => rule.valid)
    .forEach(rule => {
      const source = getSourceKey(rule)
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
      edges.set(source, getTargetKey(rule))
    })

  sourceCounts.forEach((count, source) => {
    if (count > 1) addFinding(findings, 'danger', 'duplicate_source', source)
  })

  rules
    .filter(rule => rule.valid)
    .forEach(rule => {
      const source = getSourceKey(rule)
      const target = getTargetKey(rule)
      const next = edges.get(target)
      if (next && next !== target)
        addFinding(findings, 'warn', 'redirect_chain', `${source} -> ${target}`)

      const seen = new Set<string>([source])
      let cursor = target
      for (let depth = 0; depth < 8; depth += 1) {
        if (seen.has(cursor)) {
          addFinding(findings, 'danger', 'redirect_loop', cursor)
          break
        }
        seen.add(cursor)
        const nextCursor = edges.get(cursor)
        if (!nextCursor) break
        cursor = nextCursor
      }
    })

  const ordered = rules.filter(rule => rule.valid)
  ordered.forEach((rule, index) => {
    if (rule.matchType !== 'wildcard' && rule.matchType !== 'prefix') return
    const base = normalizePath(rule.from)
      .replace(/[:*].*$/u, '')
      .replace(/\*.*$/u, '')
    if (!base) return
    const shadowed = ordered
      .slice(index + 1)
      .find(
        nextRule =>
          nextRule.host.toLowerCase() === rule.host.toLowerCase() &&
          normalizePath(nextRule.from).startsWith(base)
      )
    if (shadowed) addFinding(findings, 'warn', 'shadowed_rule', `${rule.from} -> ${shadowed.from}`)
  })

  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', `${rules.length}`)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length

  return Math.max(0, Math.min(100, 88 + good * 2 - warn * 7 - danger * 18))
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeConfig = (value: string) => value.replaceAll('"', '\\"')

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

const buildNginx = (rules: RedirectRule[]) =>
  rules
    .filter(rule => rule.valid)
    .map(rule => {
      const permanent = rule.status === '301' || rule.status === '308' ? 'permanent' : 'redirect'
      if (rule.matchType === 'regex') return `rewrite ${rule.from} ${rule.to} ${permanent};`
      return `location = ${rule.from} {\n  return ${rule.status} ${rule.to}${rule.preserveQuery ? '$is_args$args' : ''};\n}`
    })
    .join('\n\n')

const buildApache = (rules: RedirectRule[]) =>
  ['RewriteEngine On']
    .concat(
      rules
        .filter(rule => rule.valid)
        .map(rule => {
          if (rule.matchType === 'exact') {
            return `Redirect ${rule.status} ${rule.from} ${rule.to}`
          }
          return `RewriteRule ${rule.from.replace(/^\//u, '^/')} ${rule.to} [R=${rule.status},L]`
        })
    )
    .join('\n')

const buildNext = (rules: RedirectRule[]) =>
  `async redirects() {
  return ${JSON.stringify(
    rules
      .filter(rule => rule.valid)
      .map(rule => ({
        source: rule.from,
        destination: rule.to,
        permanent: rule.status === '301' || rule.status === '308',
        statusCode: Number(rule.status)
      })),
    null,
    4
  )}
}`

const buildCloudflare = (rules: RedirectRule[]) =>
  `export default {
  async fetch(request) {
    const url = new URL(request.url)
${rules
  .filter(rule => rule.valid)
  .map(
    rule => `    if (url.hostname === "${escapeConfig(rule.host)}" && url.pathname === "${escapeConfig(rule.from)}") {
      return Response.redirect("${escapeConfig(rule.to)}${rule.preserveQuery ? '${url.search}' : ''}", ${rule.status})
    }`
  )
  .join('\n')}
    return fetch(request)
  }
}`

const buildNetlify = (rules: RedirectRule[]) =>
  rules
    .filter(rule => rule.valid)
    .map(rule => `${rule.from} ${rule.to} ${rule.status}${rule.preserveQuery ? '!' : ''}`)
    .join('\n')

const buildOutput = (rules: RedirectRule[], outputType: OutputType) => {
  if (outputType === 'apache') return buildApache(rules)
  if (outputType === 'next') return buildNext(rules)
  if (outputType === 'cloudflare') return buildCloudflare(rules)
  if (outputType === 'netlify') return buildNetlify(rules)
  if (outputType === 'json')
    return JSON.stringify(
      rules.filter(rule => rule.valid),
      null,
      2
    )
  return buildNginx(rules)
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function RedirectRulesClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<RedirectDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [outputType, setOutputType] = useState<OutputType>('nginx')
  const [referenceQuery, setReferenceQuery] = useState('')
  const deferredWorkspace = useDeferredValue(workspace)
  const deferredReferenceQuery = useDeferredValue(referenceQuery)

  const rules = useMemo(() => parseRules(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditRules(rules), [rules])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(() => buildOutput(rules, outputType), [outputType, rules])
  const csvOutput = useMemo(
    () =>
      [
        ['status', 'host', 'from', 'to', 'matchType', 'preserveQuery', 'valid'],
        ...rules.map(rule => [
          rule.status,
          rule.host,
          rule.from,
          rule.to,
          rule.matchType,
          String(rule.preserveQuery),
          String(rule.valid)
        ])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [rules]
  )
  const metrics = useMemo(
    () => ({
      critical: String(findings.filter(item => item.level === 'danger').length),
      permanent: String(
        rules.filter(rule => rule.status === '301' || rule.status === '308').length
      ),
      score: String(score),
      temporary: String(
        rules.filter(
          rule => rule.status === '302' || rule.status === '303' || rule.status === '307'
        ).length
      ),
      total: String(rules.length),
      warnings: String(findings.filter(item => item.level === 'warn').length)
    }),
    [findings, rules, score]
  )
  const filteredReference = useMemo(() => {
    const query = deferredReferenceQuery.trim().toLowerCase()
    if (!query) return STATUS_REFERENCE
    return STATUS_REFERENCE.filter(item =>
      `${item.status} ${t(`app.converter.redirect_rules.reference.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredReferenceQuery, t])

  const updateDraft = <Key extends keyof RedirectDraft>(key: Key, value: RedirectDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }

  const appendDraft = () => {
    setWorkspace(current =>
      [current.trim(), draftToLine(draft)].filter(Boolean).join('\n').slice(0, RULE_INPUT_LIMIT)
    )
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.redirect_rules.summary_title'),
        `${t('app.converter.redirect_rules.metric.score')}: ${metrics.score}`,
        `${t('app.converter.redirect_rules.metric.total')}: ${metrics.total}`,
        `${t('app.converter.redirect_rules.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.redirect_rules.metric.critical')}: ${metrics.critical}`
      ].join('\n')
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="glass-panel glass-clip">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <Route className="h-4 w-4" />
                {t('app.converter.redirect-rules')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.redirect-rules')}</CardTitle>
              <CardDescription>{t('app.converter.redirect_rules.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.redirect_rules.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.redirect_rules.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.redirect_rules.metric.total')} value={metrics.total} />
            <Metric
              label={t('app.converter.redirect_rules.metric.permanent')}
              value={metrics.permanent}
            />
            <Metric
              label={t('app.converter.redirect_rules.metric.temporary')}
              value={metrics.temporary}
            />
            <Metric
              label={t('app.converter.redirect_rules.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.redirect_rules.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.redirect_rules.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.redirect_rules.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.redirect_rules.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.redirect_rules.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.redirect_rules.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="redirect-status">{t('app.converter.redirect_rules.status')}</Label>
                <Select
                  id="redirect-status"
                  value={draft.status}
                  onChange={event => updateDraft('status', event.target.value as RedirectStatus)}
                >
                  {STATUS_CODES.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirect-match">
                  {t('app.converter.redirect_rules.match_type')}
                </Label>
                <Select
                  id="redirect-match"
                  value={draft.matchType}
                  onChange={event => updateDraft('matchType', event.target.value as MatchType)}
                >
                  {MATCH_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.redirect_rules.match.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirect-host">{t('app.converter.redirect_rules.host')}</Label>
                <Input
                  id="redirect-host"
                  value={draft.host}
                  onChange={event => updateDraft('host', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirect-from">{t('app.converter.redirect_rules.from')}</Label>
                <Input
                  id="redirect-from"
                  value={draft.from}
                  onChange={event => updateDraft('from', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="redirect-to">{t('app.converter.redirect_rules.to')}</Label>
                <Input
                  id="redirect-to"
                  value={draft.to}
                  onChange={event => updateDraft('to', event.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="glass-input rounded-xl px-3">
              <Checkbox
                checked={draft.preserveQuery}
                onChange={event => updateDraft('preserveQuery', event.target.checked)}
                label={t('app.converter.redirect_rules.preserve_query')}
              />
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.redirect_rules.preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {draftToLine(draft)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendDraft}>
                <Link2 className="h-4 w-4" />
                {t('app.converter.redirect_rules.add_rule')}
              </Button>
              <Button type="button" variant="outline" onClick={() => copy(draftToLine(draft))}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">
              {t('app.converter.redirect_rules.workspace')}
            </CardTitle>
            <CardDescription>{t('app.converter.redirect_rules.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, RULE_INPUT_LIMIT))}
              placeholder={t('app.converter.redirect_rules.workspace_placeholder')}
              className="min-h-[360px] font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(output)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.redirect_rules.copy_output')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(380px,1.18fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.redirect_rules.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {findings.slice(0, 18).map((finding, index) => (
              <div
                key={`${finding.key}:${finding.subject}:${index}`}
                className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2">/</span>
                    {t(`app.converter.redirect_rules.audit.${finding.key}`)}
                  </span>
                  <span className="font-medium">
                    {t(`app.converter.redirect_rules.level.${finding.level}`)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.redirect_rules.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.redirect_rules.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 md:w-56">
                <Label htmlFor="redirect-output">
                  {t('app.converter.redirect_rules.output_type')}
                </Label>
                <Select
                  id="redirect-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.redirect_rules.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[260px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(output)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.redirect_rules.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'redirect-rules.txt', 'text/plain;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.redirect_rules.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'redirect-rules.csv', 'text/csv;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.redirect_rules.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.redirect_rules.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rules.slice(0, 42).map(rule => (
                  <div key={rule.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {rule.from}
                      </p>
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {rule.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {rule.to}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {rule.host} / {t(`app.converter.redirect_rules.match.${rule.matchType}`)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.redirect_rules.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.redirect_rules.reference')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value)}
                placeholder={t('app.converter.redirect_rules.reference_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredReference.map(item => (
                <div key={item.status} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {item.status}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.redirect_rules.reference.${item.key}`)}
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
              {t('app.converter.redirect_rules.checklist')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {['seo', 'safety', 'rollout'].map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              {t(`app.converter.redirect_rules.checklist.${item}`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
