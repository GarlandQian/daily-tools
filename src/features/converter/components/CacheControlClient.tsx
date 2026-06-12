'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  ListChecks,
  Search,
  ShieldCheck,
  TimerReset,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const VISIBILITY_VALUES = ['default', 'public', 'private'] as const
const DIRECTIVE_GROUPS = [
  'all',
  'storage',
  'freshness',
  'shared',
  'revalidation',
  'integrity'
] as const
const OUTPUT_TYPES = ['raw', 'next', 'nginx', 'vercel', 'cloudflare', 'json'] as const
const CACHE_DIRECTIVE_TOKEN_LIMIT = 32
const CACHE_INPUT_LIMIT = 28000
const CACHE_ROW_LIMIT = 120
const CACHE_RENDER_LIMIT = 48

type VisibilityValue = (typeof VISIBILITY_VALUES)[number]
type DirectiveGroup = (typeof DIRECTIVE_GROUPS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey =
  | 'no_store_api'
  | 'static_immutable'
  | 'swr_html'
  | 'private_user'
  | 'cdn_edge'
  | 'revalidate'
type FindingLevel = 'good' | 'warn' | 'danger'

interface CacheDraft {
  immutable: boolean
  maxAge: string
  mustRevalidate: boolean
  noCache: boolean
  noStore: boolean
  noTransform: boolean
  proxyRevalidate: boolean
  sMaxAge: string
  staleIfError: string
  staleWhileRevalidate: string
  visibility: VisibilityValue
}

interface DirectiveInfo {
  example: string
  group: Exclude<DirectiveGroup, 'all'>
  name: string
  noteKey: string
}

interface Preset {
  draft: CacheDraft
  key: PresetKey
  workspace: string
}

interface ParsedPolicy {
  directives: Record<string, string | true>
  raw: string
  source: string
}

interface Finding {
  key: string
  level: FindingLevel
  policy: string
}

const DEFAULT_DRAFT: CacheDraft = {
  immutable: false,
  maxAge: '3600',
  mustRevalidate: false,
  noCache: false,
  noStore: false,
  noTransform: false,
  proxyRevalidate: false,
  sMaxAge: '',
  staleIfError: '',
  staleWhileRevalidate: '',
  visibility: 'public'
}

const DIRECTIVE_REFERENCE: DirectiveInfo[] = [
  {
    name: 'public',
    example: 'public',
    group: 'storage',
    noteKey: 'app.converter.cache_control.directive.public'
  },
  {
    name: 'private',
    example: 'private',
    group: 'storage',
    noteKey: 'app.converter.cache_control.directive.private'
  },
  {
    name: 'no-store',
    example: 'no-store',
    group: 'storage',
    noteKey: 'app.converter.cache_control.directive.no_store'
  },
  {
    name: 'no-cache',
    example: 'no-cache',
    group: 'revalidation',
    noteKey: 'app.converter.cache_control.directive.no_cache'
  },
  {
    name: 'max-age',
    example: 'max-age=3600',
    group: 'freshness',
    noteKey: 'app.converter.cache_control.directive.max_age'
  },
  {
    name: 's-maxage',
    example: 's-maxage=86400',
    group: 'shared',
    noteKey: 'app.converter.cache_control.directive.s_maxage'
  },
  {
    name: 'stale-while-revalidate',
    example: 'stale-while-revalidate=60',
    group: 'shared',
    noteKey: 'app.converter.cache_control.directive.stale_while_revalidate'
  },
  {
    name: 'stale-if-error',
    example: 'stale-if-error=86400',
    group: 'shared',
    noteKey: 'app.converter.cache_control.directive.stale_if_error'
  },
  {
    name: 'must-revalidate',
    example: 'must-revalidate',
    group: 'revalidation',
    noteKey: 'app.converter.cache_control.directive.must_revalidate'
  },
  {
    name: 'proxy-revalidate',
    example: 'proxy-revalidate',
    group: 'revalidation',
    noteKey: 'app.converter.cache_control.directive.proxy_revalidate'
  },
  {
    name: 'immutable',
    example: 'immutable',
    group: 'integrity',
    noteKey: 'app.converter.cache_control.directive.immutable'
  },
  {
    name: 'no-transform',
    example: 'no-transform',
    group: 'integrity',
    noteKey: 'app.converter.cache_control.directive.no_transform'
  }
]

const PRESETS: Preset[] = [
  {
    key: 'no_store_api',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '',
      noStore: true,
      visibility: 'default'
    },
    workspace: 'Cache-Control: no-store\nPragma: no-cache'
  },
  {
    key: 'static_immutable',
    draft: {
      ...DEFAULT_DRAFT,
      immutable: true,
      maxAge: '31536000',
      sMaxAge: '31536000'
    },
    workspace: 'Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable'
  },
  {
    key: 'swr_html',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '0',
      mustRevalidate: true,
      sMaxAge: '300',
      staleWhileRevalidate: '60'
    },
    workspace:
      'Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=60, must-revalidate'
  },
  {
    key: 'private_user',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '600',
      sMaxAge: '',
      visibility: 'private'
    },
    workspace: 'Cache-Control: private, max-age=600, no-transform'
  },
  {
    key: 'cdn_edge',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '60',
      sMaxAge: '86400',
      staleIfError: '86400',
      staleWhileRevalidate: '600'
    },
    workspace:
      'Cache-Control: public, max-age=60, s-maxage=86400, stale-while-revalidate=600, stale-if-error=86400'
  },
  {
    key: 'revalidate',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '0',
      mustRevalidate: true,
      noCache: true,
      sMaxAge: '',
      visibility: 'private'
    },
    workspace: 'Cache-Control: private, no-cache, max-age=0, must-revalidate'
  }
]

const normalizeSeconds = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return normalized

  return String(Math.max(0, Math.floor(numeric)))
}

const buildCacheControl = (draft: CacheDraft) => {
  const parts: string[] = []

  if (draft.visibility !== 'default') parts.push(draft.visibility)
  if (draft.noStore) parts.push('no-store')
  if (draft.noCache) parts.push('no-cache')
  if (draft.maxAge.trim()) parts.push(`max-age=${normalizeSeconds(draft.maxAge)}`)
  if (draft.sMaxAge.trim()) parts.push(`s-maxage=${normalizeSeconds(draft.sMaxAge)}`)
  if (draft.staleWhileRevalidate.trim()) {
    parts.push(`stale-while-revalidate=${normalizeSeconds(draft.staleWhileRevalidate)}`)
  }
  if (draft.staleIfError.trim())
    parts.push(`stale-if-error=${normalizeSeconds(draft.staleIfError)}`)
  if (draft.mustRevalidate) parts.push('must-revalidate')
  if (draft.proxyRevalidate) parts.push('proxy-revalidate')
  if (draft.immutable) parts.push('immutable')
  if (draft.noTransform) parts.push('no-transform')

  return parts.length ? parts.join(', ') : 'no-store'
}

const parseDirectives = (value: string) => {
  const directives: ParsedPolicy['directives'] = {}
  let parsedCount = 0

  for (const segment of value.split(',')) {
    if (parsedCount >= CACHE_DIRECTIVE_TOKEN_LIMIT) break
    const trimmed = segment.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) {
      directives[trimmed.toLowerCase()] = true
    } else {
      directives[trimmed.slice(0, separator).trim().toLowerCase()] = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^"|"$/gu, '')
    }
    parsedCount += 1
  }

  return directives
}

const parseCacheWorkspace = (input: string) => {
  const rows: ParsedPolicy[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, CACHE_INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const headerMatch = trimmed.match(
      /^(cache-control|cdn-cache-control|surrogate-control)\s*:\s*(.+)$/iu
    )
    const value = headerMatch ? headerMatch[2] : trimmed
    const source = headerMatch ? headerMatch[1] : 'Cache-Control'
    const directives = parseDirectives(value)
    const directiveNames = Object.keys(directives)

    if (!directiveNames.length) continue

    const key = `${source.toLowerCase()}:${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ directives, raw: value, source })
    if (rows.length >= CACHE_ROW_LIMIT) break
  }

  return rows
}

const directiveValue = (policy: ParsedPolicy, name: string) => {
  const value = policy.directives[name]
  return typeof value === 'string' ? value : ''
}

const hasDirective = (policy: ParsedPolicy, name: string) => policy.directives[name] !== undefined

const numericDirective = (policy: ParsedPolicy, name: string) => {
  const value = Number(directiveValue(policy, name))
  return Number.isFinite(value) ? value : 0
}

const auditPolicies = (policies: ParsedPolicy[]): Finding[] => {
  const findings: Finding[] = []

  for (const policy of policies) {
    const label = policy.source
    const hasFreshness =
      hasDirective(policy, 'max-age') ||
      hasDirective(policy, 's-maxage') ||
      hasDirective(policy, 'no-store') ||
      hasDirective(policy, 'no-cache')

    if (hasDirective(policy, 'no-store')) {
      findings.push({ key: 'no_store_ok', level: 'good', policy: label })
      if (hasDirective(policy, 'max-age') || hasDirective(policy, 's-maxage')) {
        findings.push({ key: 'no_store_with_freshness', level: 'danger', policy: label })
      }
    }

    if (!hasFreshness) findings.push({ key: 'freshness_missing', level: 'warn', policy: label })

    if (hasDirective(policy, 'public') && hasDirective(policy, 'private')) {
      findings.push({ key: 'public_private_conflict', level: 'danger', policy: label })
    } else if (hasDirective(policy, 'private')) {
      findings.push({ key: 'private_ok', level: 'good', policy: label })
    }

    if (hasDirective(policy, 'public') && numericDirective(policy, 's-maxage') > 0) {
      findings.push({ key: 'shared_cache_ok', level: 'good', policy: label })
    }

    if (hasDirective(policy, 'immutable') && numericDirective(policy, 'max-age') < 86400) {
      findings.push({ key: 'immutable_short', level: 'warn', policy: label })
    } else if (hasDirective(policy, 'immutable')) {
      findings.push({ key: 'immutable_ok', level: 'good', policy: label })
    }

    if (
      (hasDirective(policy, 'stale-while-revalidate') || hasDirective(policy, 'stale-if-error')) &&
      !hasDirective(policy, 's-maxage') &&
      !hasDirective(policy, 'max-age')
    ) {
      findings.push({ key: 'stale_without_freshness', level: 'warn', policy: label })
    }

    if (hasDirective(policy, 'no-cache') && hasDirective(policy, 'immutable')) {
      findings.push({ key: 'nocache_immutable_conflict', level: 'danger', policy: label })
    }

    if (hasDirective(policy, 'must-revalidate') || hasDirective(policy, 'proxy-revalidate')) {
      findings.push({ key: 'revalidate_ok', level: 'good', policy: label })
    }

    if (hasDirective(policy, 'no-transform'))
      findings.push({ key: 'no_transform_ok', level: 'good', policy: label })
  }

  return findings.length ? findings : [{ key: 'empty', level: 'warn', policy: '-' }]
}

const secondsLabel = (seconds: number) => {
  if (!seconds) return '0s'
  if (seconds % 86400 === 0) return `${seconds / 86400}d`
  if (seconds % 3600 === 0) return `${seconds / 3600}h`
  if (seconds % 60 === 0) return `${seconds / 60}m`

  return `${seconds}s`
}

const buildOutput = (draft: CacheDraft, outputType: OutputType) => {
  const header = buildCacheControl(draft)

  switch (outputType) {
    case 'next':
      return `return NextResponse.json(data, {
  headers: {
    'Cache-Control': ${JSON.stringify(header)}
  }
})`
    case 'nginx':
      return `add_header Cache-Control "${header.replaceAll('"', '\\"')}" always;`
    case 'vercel':
      return `{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": ${JSON.stringify(header)} }
      ]
    }
  ]
}`
    case 'cloudflare':
      return `return new Response(body, {
  headers: {
    'Cache-Control': ${JSON.stringify(header)}
  }
})`
    case 'json':
      return JSON.stringify(draft, null, 2)
    case 'raw':
    default:
      return `Cache-Control: ${header}`
  }
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const findingColor = (level: FindingLevel) => {
  if (level === 'danger') return 'bg-red-400'
  if (level === 'warn') return 'bg-amber-300'
  return 'bg-emerald-300'
}

export default function CacheControlClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CacheDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [query, setQuery] = useState('cache')
  const [group, setGroup] = useState<DirectiveGroup>('all')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredQuery = useDeferredValue(query)
  const deferredWorkspace = useDeferredValue(workspace)

  const generatedHeader = useMemo(() => buildCacheControl(draft), [draft])
  const outputPreviewSource = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedPolicies = useMemo(() => parseCacheWorkspace(deferredWorkspace), [deferredWorkspace])
  const visibleParsedPolicies = useMemo(
    () => parsedPolicies.slice(0, CACHE_RENDER_LIMIT),
    [parsedPolicies]
  )
  const parsedPoliciesLimited = parsedPolicies.length > visibleParsedPolicies.length
  const findings = useMemo(() => auditPolicies(parsedPolicies), [parsedPolicies])
  const filteredDirectives = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return DIRECTIVE_REFERENCE.filter(directive => {
      const matchesGroup = group === 'all' || directive.group === group
      const matchesQuery =
        !normalized ||
        directive.name.toLowerCase().includes(normalized) ||
        directive.example.toLowerCase().includes(normalized) ||
        t(directive.noteKey).toLowerCase().includes(normalized) ||
        directive.group.includes(normalized)

      return matchesGroup && matchesQuery
    })
  }, [deferredQuery, group, t])
  const metrics = useMemo(() => {
    const shared = parsedPolicies.filter(policy => hasDirective(policy, 's-maxage')).length
    const privatePolicies = parsedPolicies.filter(policy => hasDirective(policy, 'private')).length
    const staticReady = parsedPolicies.filter(
      policy => hasDirective(policy, 'immutable') || numericDirective(policy, 'max-age') >= 86400
    ).length
    const maxBrowserAge = Math.max(
      0,
      ...parsedPolicies.map(policy => numericDirective(policy, 'max-age'))
    )
    const dangerous = findings.filter(finding => finding.level === 'danger').length

    return {
      dangerous,
      maxBrowserAge,
      privatePolicies,
      shared,
      staticReady,
      total: parsedPolicies.length
    }
  }, [findings, parsedPolicies])
  const buildExportJson = useCallback(
    () =>
      JSON.stringify(
        {
          metrics,
          policies: parsedPolicies,
          findings
        },
        null,
        2
      ),
    [findings, metrics, parsedPolicies]
  )
  const buildExportCsv = useCallback(
    () =>
      [
        'source,raw,public,private,noStore,noCache,maxAge,sMaxAge,staleWhileRevalidate,staleIfError,immutable',
        ...parsedPolicies.map(policy =>
          [
            policy.source,
            policy.raw,
            hasDirective(policy, 'public'),
            hasDirective(policy, 'private'),
            hasDirective(policy, 'no-store'),
            hasDirective(policy, 'no-cache'),
            directiveValue(policy, 'max-age'),
            directiveValue(policy, 's-maxage'),
            directiveValue(policy, 'stale-while-revalidate'),
            directiveValue(policy, 'stale-if-error'),
            hasDirective(policy, 'immutable')
          ]
            .map(escapeCsv)
            .join(',')
        )
      ].join('\n'),
    [parsedPolicies]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.cache_control.summary_title'),
        `${t('app.converter.cache_control.metric.total')}: ${metrics.total}`,
        `${t('app.converter.cache_control.metric.shared')}: ${metrics.shared}`,
        `${t('app.converter.cache_control.metric.private')}: ${metrics.privatePolicies}`,
        `${t('app.converter.cache_control.metric.issues')}: ${metrics.dangerous}`,
        `Cache-Control: ${generatedHeader}`
      ].join('\n'),
    [generatedHeader, metrics, t]
  )

  const loadPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setQuery(preset.key)
    setGroup('all')
  }

  const updateDraft = <Key extends keyof CacheDraft>(key: Key, value: CacheDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <TimerReset className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.cache_control')}
              </CardTitle>
              <CardDescription>{t('app.converter.cache_control.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.cache_control.copy_summary')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(buildCurrentOutput())}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <CacheMetric
              label={t('app.converter.cache_control.metric.total')}
              value={String(metrics.total)}
            />
            <CacheMetric
              label={t('app.converter.cache_control.metric.shared')}
              value={String(metrics.shared)}
            />
            <CacheMetric
              label={t('app.converter.cache_control.metric.browser_ttl')}
              value={secondsLabel(metrics.maxBrowserAge)}
            />
            <CacheMetric
              label={t('app.converter.cache_control.metric.private')}
              value={String(metrics.privatePolicies)}
            />
            <CacheMetric
              label={t('app.converter.cache_control.metric.static_ready')}
              value={String(metrics.staticReady)}
            />
            <CacheMetric
              label={t('app.converter.cache_control.metric.issues')}
              value={String(metrics.dangerous)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FlaskConical className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.cache_control.presets')}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.cache_control.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.cache_control.preset.${preset.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.cache_control.builder')}</CardTitle>
            <CardDescription>{t('app.converter.cache_control.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="cache-visibility">
                  {t('app.converter.cache_control.visibility')}
                </Label>
                <Select
                  id="cache-visibility"
                  value={draft.visibility}
                  onChange={event =>
                    updateDraft('visibility', event.target.value as VisibilityValue)
                  }
                >
                  {VISIBILITY_VALUES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.cache_control.visibility.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <CacheInput
                id="cache-max-age"
                label={t('app.converter.cache_control.max_age')}
                value={draft.maxAge}
                onChange={value => updateDraft('maxAge', value)}
              />
              <CacheInput
                id="cache-s-maxage"
                label={t('app.converter.cache_control.s_maxage')}
                value={draft.sMaxAge}
                onChange={value => updateDraft('sMaxAge', value)}
              />
              <CacheInput
                id="cache-stale-while-revalidate"
                label={t('app.converter.cache_control.stale_while_revalidate')}
                value={draft.staleWhileRevalidate}
                onChange={value => updateDraft('staleWhileRevalidate', value)}
              />
              <CacheInput
                id="cache-stale-if-error"
                label={t('app.converter.cache_control.stale_if_error')}
                value={draft.staleIfError}
                onChange={value => updateDraft('staleIfError', value)}
              />
              <CacheBoolean
                id="cache-no-store"
                label={t('app.converter.cache_control.no_store')}
                value={draft.noStore}
                onChange={value => updateDraft('noStore', value)}
              />
              <CacheBoolean
                id="cache-no-cache"
                label={t('app.converter.cache_control.no_cache')}
                value={draft.noCache}
                onChange={value => updateDraft('noCache', value)}
              />
              <CacheBoolean
                id="cache-must-revalidate"
                label={t('app.converter.cache_control.must_revalidate')}
                value={draft.mustRevalidate}
                onChange={value => updateDraft('mustRevalidate', value)}
              />
              <CacheBoolean
                id="cache-proxy-revalidate"
                label={t('app.converter.cache_control.proxy_revalidate')}
                value={draft.proxyRevalidate}
                onChange={value => updateDraft('proxyRevalidate', value)}
              />
              <CacheBoolean
                id="cache-immutable"
                label={t('app.converter.cache_control.immutable')}
                value={draft.immutable}
                onChange={value => updateDraft('immutable', value)}
              />
              <CacheBoolean
                id="cache-no-transform"
                label={t('app.converter.cache_control.no_transform')}
                value={draft.noTransform}
                onChange={value => updateDraft('noTransform', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="cache-output-type">
                  {t('app.converter.cache_control.output_type')}
                </Label>
                <Select
                  id="cache-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.cache_control.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cache_control.output_preview')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setWorkspace(`Cache-Control: ${generatedHeader}`)}
              >
                {t('app.converter.cache_control.use_output')}
              </Button>
            </div>
            <Textarea
              value={outputPreview}
              readOnly
              rows={8}
              className="min-h-[190px] resize-none font-mono"
            />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.cache_control.workspace')}
                </CardTitle>
                <CardDescription>{t('app.converter.cache_control.workspace_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, CACHE_INPUT_LIMIT))}
              rows={10}
              placeholder={t('app.converter.cache_control.workspace_placeholder')}
              className="min-h-[220px] resize-y font-mono"
            />
            <InputCapNotice
              visible={workspace.length >= CACHE_INPUT_LIMIT}
              limit={CACHE_INPUT_LIMIT}
            />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cache_control.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {findings.slice(0, 8).map((finding, index) => (
                  <div
                    key={`${finding.policy}:${finding.key}:${index}`}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${findingColor(finding.level)}`}
                    />
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {finding.policy}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">/</span>
                    {t(`app.converter.cache_control.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.cache_control.parsed')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.cache_control.parsed_description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(buildExportJson())}
              >
                {t('app.converter.cache_control.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    buildExportCsv(),
                    'daily-tools-cache-control.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.converter.cache_control.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-3">
              <Label htmlFor="cache-search">{t('app.converter.cache_control.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="cache-search"
                  value={query}
                  onChange={event => setQuery(event.target.value.slice(0, 160))}
                  placeholder={t('app.converter.cache_control.search_placeholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="cache-group">{t('app.converter.cache_control.group')}</Label>
              <Select
                id="cache-group"
                value={group}
                onChange={event => setGroup(event.target.value as DirectiveGroup)}
              >
                {DIRECTIVE_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.cache_control.group.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredDirectives.map(directive => (
              <button
                key={directive.name}
                type="button"
                onClick={() => setQuery(directive.name)}
                className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {directive.name}
                  </p>
                  <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                    {t(`app.converter.cache_control.group.${directive.group}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(directive.noteKey)}
                </p>
                <p className="mt-2 break-all rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                  {directive.example}
                </p>
              </button>
            ))}
          </div>

          {parsedPolicies.length ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleParsedPolicies.map(policy => (
                  <div
                    key={`${policy.source}:${policy.raw}`}
                    className="glass-input rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {policy.source}
                      </p>
                      <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                        {Object.keys(policy.directives).length}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {policy.raw}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(policy.directives)
                        .slice(0, CACHE_DIRECTIVE_TOKEN_LIMIT)
                        .map(([name, value]) => (
                          <span
                            key={name}
                            className="inline-block min-w-0 max-w-full break-all rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs leading-5 text-[var(--text-secondary)]"
                          >
                            {value === true ? name : `${name}=${value}`}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              {parsedPoliciesLimited && (
                <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.output_preview_rows_limited', {
                    total: parsedPolicies.length.toLocaleString(),
                    visible: visibleParsedPolicies.length.toLocaleString()
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.cache_control.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const CacheMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const CacheInput = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      inputMode="numeric"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  </div>
)

const CacheBoolean = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: boolean) => void
  value: boolean
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value ? 'yes' : 'no'}
        onChange={event => onChange(event.target.value === 'yes')}
      >
        <option value="yes">{t('public.yes')}</option>
        <option value="no">{t('public.no')}</option>
      </Select>
    </div>
  )
}
