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
  SlidersHorizontal,
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

const FEATURE_GROUPS = [
  'all',
  'privacy',
  'media',
  'device',
  'identity',
  'embed',
  'performance'
] as const
const ALLOWLIST_MODES = ['none', 'self', 'all', 'origins'] as const
const OUTPUT_TYPES = [
  'raw',
  'report_only',
  'iframe',
  'next',
  'nginx',
  'cloudflare',
  'json'
] as const
const POLICY_INPUT_LIMIT = 28000
const POLICY_ROW_LIMIT = 160
const POLICY_RENDER_LIMIT = 48

type FeatureGroup = (typeof FEATURE_GROUPS)[number]
type AllowlistMode = (typeof ALLOWLIST_MODES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey =
  | 'secure_default'
  | 'media_embed'
  | 'payment'
  | 'passkey'
  | 'analytics_report'
  | 'legacy_cleanup'
type FindingLevel = 'good' | 'warn' | 'danger'

interface FeatureInfo {
  defaultList: 'all' | 'none' | 'self'
  group: Exclude<FeatureGroup, 'all'>
  key: string
  noteKey: string
  powerful: boolean
}

interface PolicyDraft {
  allowlistMode: AllowlistMode
  feature: string
  origins: string
  reportTo: string
  reportUrl: string
}

interface Preset {
  draft: PolicyDraft
  key: PresetKey
  workspace: string
}

interface ParsedDirective {
  allowlist: string
  feature: string
  header: 'Permissions-Policy' | 'Permissions-Policy-Report-Only' | 'Feature-Policy'
  reportTo: string
  raw: string
}

interface Finding {
  feature: string
  key: string
  level: FindingLevel
}

const FEATURE_REFERENCE: FeatureInfo[] = [
  {
    key: 'geolocation',
    group: 'privacy',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.geolocation'
  },
  {
    key: 'camera',
    group: 'media',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.camera'
  },
  {
    key: 'microphone',
    group: 'media',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.microphone'
  },
  {
    key: 'fullscreen',
    group: 'embed',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.fullscreen'
  },
  {
    key: 'payment',
    group: 'identity',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.payment'
  },
  {
    key: 'publickey-credentials-get',
    group: 'identity',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.publickey'
  },
  {
    key: 'clipboard-read',
    group: 'privacy',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.clipboard_read'
  },
  {
    key: 'clipboard-write',
    group: 'privacy',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.clipboard_write'
  },
  {
    key: 'usb',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.usb'
  },
  {
    key: 'serial',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.serial'
  },
  {
    key: 'hid',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.hid'
  },
  {
    key: 'screen-wake-lock',
    group: 'device',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.screen_wake_lock'
  },
  {
    key: 'accelerometer',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.accelerometer'
  },
  {
    key: 'gyroscope',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.gyroscope'
  },
  {
    key: 'magnetometer',
    group: 'device',
    defaultList: 'self',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.magnetometer'
  },
  {
    key: 'autoplay',
    group: 'media',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.autoplay'
  },
  {
    key: 'encrypted-media',
    group: 'media',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.encrypted_media'
  },
  {
    key: 'web-share',
    group: 'privacy',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.web_share'
  },
  {
    key: 'sync-xhr',
    group: 'performance',
    defaultList: 'self',
    powerful: false,
    noteKey: 'app.converter.permissions_policy.feature.sync_xhr'
  },
  {
    key: 'browsing-topics',
    group: 'privacy',
    defaultList: 'none',
    powerful: true,
    noteKey: 'app.converter.permissions_policy.feature.browsing_topics'
  }
]

const FEATURE_MAP = new Map(FEATURE_REFERENCE.map(feature => [feature.key, feature]))
const POWERFUL_FEATURES = new Set(
  FEATURE_REFERENCE.filter(feature => feature.powerful).map(feature => feature.key)
)

const DEFAULT_DRAFT: PolicyDraft = {
  allowlistMode: 'none',
  feature: 'camera',
  origins: 'https://app.example.com',
  reportTo: '',
  reportUrl: ''
}

const PRESETS: Preset[] = [
  {
    key: 'secure_default',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=(), sync-xhr=()'
    ].join('\n')
  },
  {
    key: 'media_embed',
    draft: {
      ...DEFAULT_DRAFT,
      allowlistMode: 'origins',
      feature: 'fullscreen',
      origins: 'self https://video.example.com'
    },
    workspace: [
      'Permissions-Policy: fullscreen=(self "https://video.example.com"), autoplay=(self "https://video.example.com"), encrypted-media=(self "https://video.example.com")'
    ].join('\n')
  },
  {
    key: 'payment',
    draft: {
      ...DEFAULT_DRAFT,
      allowlistMode: 'origins',
      feature: 'payment',
      origins: 'self https://checkout.example.com'
    },
    workspace: [
      'Permissions-Policy: payment=(self "https://checkout.example.com"), publickey-credentials-get=(self)'
    ].join('\n')
  },
  {
    key: 'passkey',
    draft: {
      ...DEFAULT_DRAFT,
      allowlistMode: 'self',
      feature: 'publickey-credentials-get'
    },
    workspace: [
      'Permissions-Policy: publickey-credentials-get=(self), geolocation=(), camera=(), microphone=()'
    ].join('\n')
  },
  {
    key: 'analytics_report',
    draft: {
      ...DEFAULT_DRAFT,
      feature: 'geolocation',
      reportTo: 'permissions',
      reportUrl: 'https://reports.example.com/permissions'
    },
    workspace: [
      'Reporting-Endpoints: permissions="https://reports.example.com/permissions"',
      'Permissions-Policy-Report-Only: geolocation=();report-to=permissions, camera=();report-to=permissions, microphone=();report-to=permissions'
    ].join('\n')
  },
  {
    key: 'legacy_cleanup',
    draft: {
      ...DEFAULT_DRAFT,
      allowlistMode: 'self',
      feature: 'fullscreen'
    },
    workspace: [
      'Feature-Policy: geolocation none; camera none; microphone none',
      'Permissions-Policy: geolocation=(), camera=(), microphone=(), fullscreen=(self)'
    ].join('\n')
  }
]

const splitPolicyEntries = (value: string) => {
  const entries: string[] = []
  let current = ''
  let depth = 0
  let inQuote = false

  for (const char of value) {
    if (char === '"') inQuote = !inQuote
    if (!inQuote && char === '(') depth += 1
    if (!inQuote && char === ')') depth = Math.max(0, depth - 1)

    if (!inQuote && depth === 0 && char === ',') {
      if (current.trim()) entries.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) entries.push(current.trim())

  return entries
}

const sanitizeOrigin = (value: string) => value.trim().replaceAll('"', '')

const buildAllowlist = (mode: AllowlistMode, origins: string) => {
  if (mode === 'none') return '()'
  if (mode === 'all') return '*'
  if (mode === 'self') return '(self)'

  const tokens = origins
    .split(/\s+/u)
    .map(sanitizeOrigin)
    .filter(Boolean)
    .map(origin => (origin === 'self' ? 'self' : `"${origin}"`))

  return tokens.length ? `(${tokens.join(' ')})` : '(self)'
}

const buildDirective = (draft: PolicyDraft) => {
  const feature = draft.feature.trim() || 'camera'
  const reportTo = draft.reportTo.trim()
  const suffix = reportTo ? `;report-to=${reportTo.replace(/[^\w.-]/gu, '')}` : ''

  return `${feature}=${buildAllowlist(draft.allowlistMode, draft.origins)}${suffix}`
}

const buildHeaders = (draft: PolicyDraft, outputType: OutputType) => {
  const headerName =
    outputType === 'report_only' ? 'Permissions-Policy-Report-Only' : 'Permissions-Policy'
  const rows: Array<[string, string]> = []

  if (draft.reportTo.trim() && draft.reportUrl.trim()) {
    rows.push([
      'Reporting-Endpoints',
      `${draft.reportTo.trim().replace(/[^\w.-]/gu, '')}="${sanitizeOrigin(draft.reportUrl)}"`
    ])
  }

  rows.push([headerName, buildDirective(draft)])

  return rows
}

const parseLegacyFeaturePolicy = (value: string): ParsedDirective[] =>
  value
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [feature = '', ...allowlistParts] = entry.split(/\s+/u)

      return {
        allowlist: allowlistParts.join(' ') || 'self',
        feature,
        header: 'Feature-Policy' as const,
        raw: entry,
        reportTo: ''
      }
    })
    .filter(directive => directive.feature)

const parsePolicyDirective = (
  entry: string,
  header: 'Permissions-Policy' | 'Permissions-Policy-Report-Only'
): ParsedDirective | null => {
  const separator = entry.indexOf('=')
  if (separator <= 0) return null
  const feature = entry.slice(0, separator).trim()
  const value = entry.slice(separator + 1).trim()
  const [allowlist = '', ...params] = value.split(';').map(part => part.trim())
  const reportToParam = params.find(param => param.toLowerCase().startsWith('report-to='))
  const reportTo = reportToParam ? reportToParam.slice(reportToParam.indexOf('=') + 1).trim() : ''

  return {
    allowlist,
    feature,
    header,
    raw: entry,
    reportTo
  }
}

const parsePolicyWorkspace = (input: string) => {
  const rows: ParsedDirective[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, POLICY_INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue
    const name = trimmed.slice(0, separator).trim().toLowerCase()
    const value = trimmed.slice(separator + 1).trim()
    let parsed: ParsedDirective[] = []

    if (name === 'permissions-policy' || name === 'permissions-policy-report-only') {
      const header =
        name === 'permissions-policy' ? 'Permissions-Policy' : 'Permissions-Policy-Report-Only'
      parsed = splitPolicyEntries(value)
        .map(entry => parsePolicyDirective(entry, header))
        .filter((entry): entry is ParsedDirective => Boolean(entry))
    } else if (name === 'feature-policy') {
      parsed = parseLegacyFeaturePolicy(value)
    } else {
      continue
    }

    for (const directive of parsed) {
      const key = `${directive.header}:${directive.feature}:${directive.allowlist}:${directive.reportTo}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(directive)
      if (rows.length >= POLICY_ROW_LIMIT) return rows
    }
  }

  return rows
}

const isEmptyAllowlist = (allowlist: string) =>
  allowlist.trim() === '()' || allowlist.trim().toLowerCase() === 'none'
const isWildcardAllowlist = (allowlist: string) => allowlist.trim() === '*'
const isSelfAllowlist = (allowlist: string) =>
  /\bself\b/iu.test(allowlist) && !isWildcardAllowlist(allowlist)

const auditPolicies = (directives: ParsedDirective[], hasReportingEndpoint: boolean): Finding[] => {
  const findings: Finding[] = []
  const seenFeatures = new Set<string>()

  for (const directive of directives) {
    const feature = directive.feature.toLowerCase()
    seenFeatures.add(feature)

    if (directive.header === 'Feature-Policy') {
      findings.push({ feature: directive.feature, key: 'legacy_header', level: 'warn' })
    }

    if (!FEATURE_MAP.has(feature)) {
      findings.push({ feature: directive.feature, key: 'unknown_feature', level: 'warn' })
    }

    if (POWERFUL_FEATURES.has(feature) && isWildcardAllowlist(directive.allowlist)) {
      findings.push({ feature: directive.feature, key: 'wildcard_powerful', level: 'danger' })
    }

    if (POWERFUL_FEATURES.has(feature) && isEmptyAllowlist(directive.allowlist)) {
      findings.push({ feature: directive.feature, key: 'powerful_disabled', level: 'good' })
    }

    if (directive.reportTo && !hasReportingEndpoint) {
      findings.push({ feature: directive.feature, key: 'report_endpoint_missing', level: 'warn' })
    } else if (directive.reportTo) {
      findings.push({ feature: directive.feature, key: 'reporting_ok', level: 'good' })
    }

    if (isSelfAllowlist(directive.allowlist) && !POWERFUL_FEATURES.has(feature)) {
      findings.push({ feature: directive.feature, key: 'self_scoped', level: 'good' })
    }
  }

  for (const feature of ['geolocation', 'camera', 'microphone']) {
    if (!seenFeatures.has(feature)) {
      findings.push({ feature, key: 'sensitive_missing', level: 'warn' })
    }
  }

  return findings.length ? findings : [{ feature: '-', key: 'empty', level: 'warn' }]
}

const normalizeIframeAllowToken = (token: string) => {
  const cleaned = token.trim().replace(/^["']|["']$/gu, '')
  const normalized = cleaned.toLowerCase()

  if (!cleaned || cleaned === '()') return ''
  if (normalized === 'none') return "'none'"
  if (normalized === 'self') return "'self'"
  if (cleaned === '*') return '*'

  return cleaned
}

const buildIframeAllow = (directives: ParsedDirective[]) =>
  directives
    .map(directive => {
      const tokens =
        directive.allowlist.trim() === '*'
          ? ['*']
          : directive.allowlist
              .replace(/[()]/gu, ' ')
              .split(/\s+/u)
              .map(normalizeIframeAllowToken)
              .filter(Boolean)
      const normalized = tokens.length ? tokens.join(' ') : "'none'"

      return `${directive.feature} ${normalized}`
    })
    .join('; ')

const buildOutput = (draft: PolicyDraft, outputType: OutputType) => {
  const rows = buildHeaders(draft, outputType)
  const raw = rows.map(([name, value]) => `${name}: ${value}`).join('\n')
  const parsedForIframe = parsePolicyWorkspace(raw)
  const objectLines = rows
    .map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    .join(',\n')

  switch (outputType) {
    case 'iframe':
      return `<iframe src="https://example.com" allow="${buildIframeAllow(parsedForIframe)}"></iframe>`
    case 'next':
      return `return NextResponse.next({
  headers: {
${objectLines}
  }
})`
    case 'nginx':
      return rows
        .map(([name, value]) => `add_header ${name} "${value.replaceAll('"', '\\"')}" always;`)
        .join('\n')
    case 'cloudflare':
      return `return new Response(body, {
  headers: {
${objectLines}
  }
})`
    case 'json':
      return JSON.stringify(Object.fromEntries(rows), null, 2)
    case 'report_only':
    case 'raw':
    default:
      return raw
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

export default function PermissionsPolicyClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<PolicyDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [query, setQuery] = useState('camera')
  const [group, setGroup] = useState<FeatureGroup>('all')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredQuery = useDeferredValue(query)
  const deferredWorkspace = useDeferredValue(workspace)

  const parsedDirectives = useMemo(
    () => parsePolicyWorkspace(deferredWorkspace),
    [deferredWorkspace]
  )
  const visibleParsedDirectives = useMemo(
    () => parsedDirectives.slice(0, POLICY_RENDER_LIMIT),
    [parsedDirectives]
  )
  const parsedDirectivesLimited = parsedDirectives.length > visibleParsedDirectives.length
  const hasReportingEndpoint = useMemo(
    () => /(^|\n)\s*reporting-endpoints\s*:/iu.test(deferredWorkspace),
    [deferredWorkspace]
  )
  const findings = useMemo(
    () => auditPolicies(parsedDirectives, hasReportingEndpoint),
    [hasReportingEndpoint, parsedDirectives]
  )
  const outputPreviewSource = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(() => buildOutput(draft, outputType), [draft, outputType])
  const filteredFeatures = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return FEATURE_REFERENCE.filter(feature => {
      const matchesGroup = group === 'all' || feature.group === group
      const matchesQuery =
        !normalized ||
        feature.key.includes(normalized) ||
        feature.group.includes(normalized) ||
        feature.defaultList.includes(normalized) ||
        t(feature.noteKey).toLowerCase().includes(normalized)

      return matchesGroup && matchesQuery
    })
  }, [deferredQuery, group, t])
  const metrics = useMemo(() => {
    const disabled = parsedDirectives.filter(directive =>
      isEmptyAllowlist(directive.allowlist)
    ).length
    const wildcard = parsedDirectives.filter(directive =>
      isWildcardAllowlist(directive.allowlist)
    ).length
    const reportOnly = parsedDirectives.filter(
      directive => directive.header === 'Permissions-Policy-Report-Only'
    ).length
    const dangerous = findings.filter(finding => finding.level === 'danger').length

    return {
      dangerous,
      disabled,
      reportOnly,
      total: parsedDirectives.length,
      wildcard
    }
  }, [findings, parsedDirectives])
  const buildExportJson = useCallback(
    () =>
      JSON.stringify(
        {
          metrics,
          directives: parsedDirectives,
          findings
        },
        null,
        2
      ),
    [findings, metrics, parsedDirectives]
  )
  const buildExportCsv = useCallback(
    () =>
      [
        'header,feature,allowlist,reportTo',
        ...parsedDirectives.map(directive =>
          [directive.header, directive.feature, directive.allowlist, directive.reportTo]
            .map(escapeCsv)
            .join(',')
        )
      ].join('\n'),
    [parsedDirectives]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.permissions_policy.summary_title'),
        `${t('app.converter.permissions_policy.metric.total')}: ${metrics.total}`,
        `${t('app.converter.permissions_policy.metric.disabled')}: ${metrics.disabled}`,
        `${t('app.converter.permissions_policy.metric.wildcard')}: ${metrics.wildcard}`,
        `${t('app.converter.permissions_policy.metric.issues')}: ${metrics.dangerous}`,
        outputPreviewSource
      ].join('\n'),
    [metrics, outputPreviewSource, t]
  )

  const loadPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setQuery(preset.key)
    setGroup('all')
  }

  const updateDraft = <Key extends keyof PolicyDraft>(key: Key, value: PolicyDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.permissions_policy')}
              </CardTitle>
              <CardDescription>{t('app.converter.permissions_policy.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.permissions_policy.copy_summary')}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <PolicyMetric
              label={t('app.converter.permissions_policy.metric.total')}
              value={String(metrics.total)}
            />
            <PolicyMetric
              label={t('app.converter.permissions_policy.metric.disabled')}
              value={String(metrics.disabled)}
            />
            <PolicyMetric
              label={t('app.converter.permissions_policy.metric.wildcard')}
              value={String(metrics.wildcard)}
            />
            <PolicyMetric
              label={t('app.converter.permissions_policy.metric.report_only')}
              value={String(metrics.reportOnly)}
            />
            <PolicyMetric
              label={t('app.converter.permissions_policy.metric.issues')}
              value={String(metrics.dangerous)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FlaskConical className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.permissions_policy.presets')}
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
                    {t(`app.converter.permissions_policy.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.permissions_policy.preset.${preset.key}_hint`)}
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
            <CardTitle className="text-base">
              {t('app.converter.permissions_policy.builder')}
            </CardTitle>
            <CardDescription>{t('app.converter.permissions_policy.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="permissions-feature">
                  {t('app.converter.permissions_policy.feature')}
                </Label>
                <Select
                  id="permissions-feature"
                  value={draft.feature}
                  onChange={event => updateDraft('feature', event.target.value)}
                >
                  {FEATURE_REFERENCE.map(feature => (
                    <option key={feature.key} value={feature.key}>
                      {feature.key}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="permissions-allowlist">
                  {t('app.converter.permissions_policy.allowlist')}
                </Label>
                <Select
                  id="permissions-allowlist"
                  value={draft.allowlistMode}
                  onChange={event =>
                    updateDraft('allowlistMode', event.target.value as AllowlistMode)
                  }
                >
                  {ALLOWLIST_MODES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.permissions_policy.allowlist.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <PolicyInput
                id="permissions-origins"
                label={t('app.converter.permissions_policy.origins')}
                value={draft.origins}
                onChange={value => updateDraft('origins', value)}
              />
              <PolicyInput
                id="permissions-report-to"
                label={t('app.converter.permissions_policy.report_to')}
                value={draft.reportTo}
                onChange={value => updateDraft('reportTo', value)}
              />
              <PolicyInput
                id="permissions-report-url"
                label={t('app.converter.permissions_policy.report_url')}
                value={draft.reportUrl}
                onChange={value => updateDraft('reportUrl', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="permissions-output-type">
                  {t('app.converter.permissions_policy.output_type')}
                </Label>
                <Select
                  id="permissions-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.permissions_policy.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.permissions_policy.output_preview')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setWorkspace(
                    buildHeaders(draft, outputType)
                      .map(([name, value]) => `${name}: ${value}`)
                      .join('\n')
                  )
                }
              >
                {t('app.converter.permissions_policy.use_output')}
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
                  {t('app.converter.permissions_policy.workspace')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.permissions_policy.workspace_hint')}
                </CardDescription>
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
              onChange={event => setWorkspace(event.target.value.slice(0, POLICY_INPUT_LIMIT))}
              rows={10}
              placeholder={t('app.converter.permissions_policy.workspace_placeholder')}
              className="min-h-[220px] resize-y font-mono"
            />
            <InputCapNotice
              visible={workspace.length >= POLICY_INPUT_LIMIT}
              limit={POLICY_INPUT_LIMIT}
            />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.permissions_policy.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {findings.slice(0, 8).map((finding, index) => (
                  <div
                    key={`${finding.feature}:${finding.key}:${index}`}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${findingColor(finding.level)}`}
                    />
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {finding.feature}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">/</span>
                    {t(`app.converter.permissions_policy.audit.${finding.key}`)}
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
                {t('app.converter.permissions_policy.parsed')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.permissions_policy.parsed_description')}
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
                {t('app.converter.permissions_policy.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    buildExportCsv(),
                    'daily-tools-permissions-policy.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.converter.permissions_policy.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-3">
              <Label htmlFor="permissions-search">
                {t('app.converter.permissions_policy.search')}
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="permissions-search"
                  value={query}
                  onChange={event => setQuery(event.target.value.slice(0, 160))}
                  placeholder={t('app.converter.permissions_policy.search_placeholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="permissions-group">
                {t('app.converter.permissions_policy.group')}
              </Label>
              <Select
                id="permissions-group"
                value={group}
                onChange={event => setGroup(event.target.value as FeatureGroup)}
              >
                {FEATURE_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.permissions_policy.group.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredFeatures.map(feature => (
              <button
                key={feature.key}
                type="button"
                onClick={() => {
                  setQuery(feature.key)
                  setDraft(current => ({ ...current, feature: feature.key }))
                }}
                className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {feature.key}
                  </p>
                  <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                    {t(`app.converter.permissions_policy.group.${feature.group}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(feature.noteKey)}
                </p>
                <p className="mt-2 rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                  {t('app.converter.permissions_policy.default_allowlist')} {feature.defaultList}
                </p>
              </button>
            ))}
          </div>

          {parsedDirectives.length ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleParsedDirectives.map(directive => (
                  <div
                    key={`${directive.header}:${directive.feature}:${directive.raw}`}
                    className="glass-input rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {directive.feature}
                      </p>
                      <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                        {directive.header}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {directive.allowlist}
                    </p>
                    {directive.reportTo ? (
                      <p className="mt-2 break-all font-mono text-xs text-[var(--text-tertiary)]">
                        report-to={directive.reportTo}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {parsedDirectivesLimited && (
                <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.output_preview_rows_limited', {
                    total: parsedDirectives.length.toLocaleString(),
                    visible: visibleParsedDirectives.length.toLocaleString()
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.permissions_policy.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const PolicyMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const PolicyInput = ({
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
    <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
  </div>
)
