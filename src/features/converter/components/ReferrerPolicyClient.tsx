'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const POLICIES = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url'
] as const
const OUTPUT_TYPES = ['header', 'meta', 'attribute', 'next', 'nginx', 'cloudflare', 'json'] as const
const WORKSPACE_LIMIT = 32000
const PARSED_ROW_LIMIT = 140

type Policy = (typeof POLICIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type PresetKey =
  | 'privacy_app'
  | 'saas_default'
  | 'analytics'
  | 'legacy'
  | 'asset_embed'
  | 'migration'
type FindingLevel = 'good' | 'warn' | 'danger'
type LeakKind = 'full' | 'origin' | 'none'

interface Preset {
  fallback: Policy
  includeFallback: boolean
  key: PresetKey
  outputType: OutputType
  policy: Policy
  targetUrl: string
  workspace: string
}

interface PolicyInfo {
  key: Policy
  level: FindingLevel
  privacyScore: number
}

interface ParsedPolicy {
  policy: string
  raw: string
  source: string
  valid: boolean
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const POLICY_INFO: PolicyInfo[] = [
  { key: 'no-referrer', level: 'good', privacyScore: 5 },
  { key: 'no-referrer-when-downgrade', level: 'warn', privacyScore: 2 },
  { key: 'origin', level: 'good', privacyScore: 4 },
  { key: 'origin-when-cross-origin', level: 'warn', privacyScore: 3 },
  { key: 'same-origin', level: 'good', privacyScore: 5 },
  { key: 'strict-origin', level: 'good', privacyScore: 4 },
  { key: 'strict-origin-when-cross-origin', level: 'good', privacyScore: 4 },
  { key: 'unsafe-url', level: 'danger', privacyScore: 1 }
]

const PRESETS: Preset[] = [
  {
    key: 'privacy_app',
    policy: 'no-referrer',
    includeFallback: false,
    fallback: 'strict-origin-when-cross-origin',
    targetUrl: 'https://partner.example.com/callback',
    outputType: 'header',
    workspace: 'Referrer-Policy: no-referrer'
  },
  {
    key: 'saas_default',
    policy: 'strict-origin-when-cross-origin',
    includeFallback: false,
    fallback: 'no-referrer',
    targetUrl: 'https://app.example.com/dashboard',
    outputType: 'header',
    workspace: 'Referrer-Policy: strict-origin-when-cross-origin'
  },
  {
    key: 'analytics',
    policy: 'origin-when-cross-origin',
    includeFallback: false,
    fallback: 'strict-origin',
    targetUrl: 'https://analytics.example.com/collect',
    outputType: 'attribute',
    workspace:
      '<a href="https://analytics.example.com/collect" referrerpolicy="origin-when-cross-origin">analytics</a>'
  },
  {
    key: 'legacy',
    policy: 'no-referrer-when-downgrade',
    includeFallback: false,
    fallback: 'strict-origin-when-cross-origin',
    targetUrl: 'https://legacy.example.com/',
    outputType: 'meta',
    workspace: '<meta name="referrer" content="no-referrer-when-downgrade">'
  },
  {
    key: 'asset_embed',
    policy: 'strict-origin',
    includeFallback: false,
    fallback: 'no-referrer',
    targetUrl: 'https://cdn.example.com/image.png',
    outputType: 'attribute',
    workspace: '<img src="https://cdn.example.com/image.png" referrerpolicy="strict-origin" alt="">'
  },
  {
    key: 'migration',
    policy: 'strict-origin-when-cross-origin',
    includeFallback: true,
    fallback: 'no-referrer',
    targetUrl: 'https://example.com/',
    outputType: 'header',
    workspace: 'Referrer-Policy: no-referrer, strict-origin-when-cross-origin'
  }
]

const POLICY_SET = new Set<string>(POLICIES)
const POLICY_INFO_MAP = new Map<Policy, PolicyInfo>(POLICY_INFO.map(policy => [policy.key, policy]))

const getPolicyHeaderValue = (policy: Policy, includeFallback: boolean, fallback: Policy) =>
  includeFallback && fallback !== policy ? `${fallback}, ${policy}` : policy

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const sanitizeUrl = (value: string) => value.trim().replaceAll('"', '%22') || 'https://example.com/'

const buildOutput = (
  policy: Policy,
  includeFallback: boolean,
  fallback: Policy,
  targetUrl: string,
  outputType: OutputType
) => {
  const headerValue = getPolicyHeaderValue(policy, includeFallback, fallback)
  const url = escapeHtml(sanitizeUrl(targetUrl))

  switch (outputType) {
    case 'meta':
      return `<meta name="referrer" content="${policy}">`
    case 'attribute':
      return `<a href="${url}" referrerpolicy="${policy}">Example link</a>
<img src="${url}" referrerpolicy="${policy}" alt="">`
    case 'next':
      return `return NextResponse.next({
  headers: {
    "Referrer-Policy": "${headerValue}"
  }
})`
    case 'nginx':
      return `add_header Referrer-Policy "${headerValue}" always;`
    case 'cloudflare':
      return `return new Response(body, {
  headers: {
    "Referrer-Policy": "${headerValue}"
  }
})`
    case 'json':
      return JSON.stringify(
        {
          header: 'Referrer-Policy',
          value: headerValue,
          policy,
          fallback: includeFallback ? fallback : null,
          targetUrl: sanitizeUrl(targetUrl)
        },
        null,
        2
      )
    case 'header':
    default:
      return `Referrer-Policy: ${headerValue}`
  }
}

const getAttributeValue = (value: string, attribute: string) => {
  const pattern = new RegExp(`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu')
  const match = pattern.exec(value)

  return match?.[1] || match?.[2] || match?.[3] || ''
}

const splitPolicyTokens = (value: string) =>
  value
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)

const parseWorkspace = (input: string): ParsedPolicy[] => {
  const safeInput = input.slice(0, WORKSPACE_LIMIT)
  const rows: ParsedPolicy[] = []
  const seen = new Set<string>()

  const pushToken = (source: string, token: string, raw: string) => {
    const normalized = token.trim().toLowerCase()
    if (!normalized) return
    const key = `${source}:${normalized}:${raw}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      policy: normalized,
      raw,
      source,
      valid: POLICY_SET.has(normalized)
    })
  }

  for (const line of safeInput.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const headerMatch = /^referrer-policy\s*:\s*(.+)$/iu.exec(trimmed)

    if (headerMatch) {
      for (const token of splitPolicyTokens(headerMatch[1])) {
        pushToken('header', token, trimmed)
      }
      continue
    }

    if (/^add_header\s+referrer-policy\b/iu.test(trimmed)) {
      const headerValue =
        getAttributeValue(trimmed, 'Referrer-Policy') || trimmed.split(/\s+/u).slice(2).join(' ')
      for (const token of splitPolicyTokens(headerValue.replace(/[";]/gu, ''))) {
        pushToken('nginx', token, trimmed)
      }
      continue
    }

    const metaContent =
      /<meta\b/iu.test(trimmed) && /name\s*=\s*["']?referrer/iu.test(trimmed)
        ? getAttributeValue(trimmed, 'content')
        : ''
    if (metaContent) {
      for (const token of splitPolicyTokens(metaContent)) {
        pushToken('meta', token, trimmed)
      }
      continue
    }

    const attrValue = getAttributeValue(trimmed, 'referrerpolicy')
    if (attrValue) {
      for (const token of splitPolicyTokens(attrValue)) {
        pushToken('attribute', token, trimmed)
      }
      continue
    }

    for (const token of splitPolicyTokens(trimmed.replace(/^["']|["']$/gu, ''))) {
      if (/^[a-z-]+$/u.test(token)) pushToken('token', token, trimmed)
    }

    if (rows.length >= PARSED_ROW_LIMIT) return rows
  }

  return rows.slice(0, PARSED_ROW_LIMIT)
}

const getLeakKind = (
  policy: Policy,
  context: 'same_origin' | 'cross_origin' | 'downgrade'
): LeakKind => {
  if (policy === 'no-referrer') return 'none'
  if (policy === 'unsafe-url') return 'full'
  if (policy === 'same-origin') return context === 'same_origin' ? 'full' : 'none'
  if (policy === 'no-referrer-when-downgrade') return context === 'downgrade' ? 'none' : 'full'
  if (policy === 'origin') return 'origin'
  if (policy === 'origin-when-cross-origin') return context === 'same_origin' ? 'full' : 'origin'
  if (policy === 'strict-origin') return context === 'downgrade' ? 'none' : 'origin'

  return context === 'same_origin' ? 'full' : context === 'downgrade' ? 'none' : 'origin'
}

const auditPolicies = (
  policy: Policy,
  includeFallback: boolean,
  fallback: Policy,
  parsedPolicies: ParsedPolicy[]
): Finding[] => {
  const findings: Finding[] = []

  if (policy === 'unsafe-url') {
    findings.push({ key: 'unsafe_url', level: 'danger', subject: policy })
  } else if (policy === 'strict-origin-when-cross-origin') {
    findings.push({ key: 'modern_default', level: 'good', subject: policy })
  } else if (policy === 'no-referrer') {
    findings.push({ key: 'privacy_strict', level: 'good', subject: policy })
  } else if (policy === 'no-referrer-when-downgrade') {
    findings.push({ key: 'legacy_policy', level: 'warn', subject: policy })
  } else {
    findings.push({
      key: 'limited_policy',
      level: POLICY_INFO_MAP.get(policy)?.level ?? 'warn',
      subject: policy
    })
  }

  if (includeFallback) {
    if (fallback === policy) {
      findings.push({ key: 'duplicate_fallback', level: 'warn', subject: fallback })
    } else {
      findings.push({ key: 'fallback_ok', level: 'good', subject: `${fallback}, ${policy}` })
    }
  }

  for (const parsed of parsedPolicies) {
    if (!parsed.valid) {
      findings.push({ key: 'unknown_policy', level: 'danger', subject: parsed.policy })
    } else if (parsed.source === 'meta' && parsed.policy.includes(',')) {
      findings.push({ key: 'meta_single', level: 'warn', subject: parsed.policy })
    } else if (parsed.policy === 'unsafe-url') {
      findings.push({ key: 'parsed_unsafe_url', level: 'danger', subject: parsed.source })
    }
  }

  return findings
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

const getFindingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const getLeakClass = (kind: LeakKind) => {
  if (kind === 'full') return 'bg-red-500/10 text-red-600'
  if (kind === 'origin') return 'bg-amber-500/10 text-amber-700'
  return 'bg-emerald-500/10 text-emerald-700'
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function ReferrerPolicyClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [policy, setPolicy] = useState<Policy>('strict-origin-when-cross-origin')
  const [fallback, setFallback] = useState<Policy>('no-referrer')
  const [includeFallback, setIncludeFallback] = useState(false)
  const [targetUrl, setTargetUrl] = useState('https://partner.example.com/landing')
  const [outputType, setOutputType] = useState<OutputType>('header')
  const [workspace, setWorkspace] = useState(PRESETS[1].workspace)
  const deferredWorkspace = useDeferredValue(workspace)
  const currentInfo =
    POLICY_INFO_MAP.get(policy) ?? POLICY_INFO_MAP.get('strict-origin-when-cross-origin')

  const output = useMemo(
    () => buildOutput(policy, includeFallback, fallback, targetUrl, outputType),
    [fallback, includeFallback, outputType, policy, targetUrl]
  )
  const parsedPolicies = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(
    () => auditPolicies(policy, includeFallback, fallback, parsedPolicies),
    [fallback, includeFallback, parsedPolicies, policy]
  )
  const metrics = useMemo(() => {
    const validCount = parsedPolicies.filter(parsed => parsed.valid).length
    const riskCount = findings.filter(finding => finding.level !== 'good').length

    return {
      privacy: String(currentInfo?.privacyScore ?? 0),
      parsed: String(parsedPolicies.length),
      valid: String(validCount),
      risks: String(riskCount)
    }
  }, [currentInfo?.privacyScore, findings, parsedPolicies])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          generated: {
            header: getPolicyHeaderValue(policy, includeFallback, fallback),
            policy,
            fallback: includeFallback ? fallback : null,
            targetUrl,
            outputType
          },
          parsedPolicies,
          findings
        },
        null,
        2
      ),
    [fallback, findings, includeFallback, outputType, parsedPolicies, policy, targetUrl]
  )
  const exportCsv = useMemo(
    () =>
      [
        ['source', 'policy', 'valid', 'raw'],
        ...parsedPolicies.map(parsed => [
          parsed.source,
          parsed.policy,
          String(parsed.valid),
          parsed.raw
        ])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [parsedPolicies]
  )

  const applyPreset = (preset: Preset) => {
    setPolicy(preset.policy)
    setFallback(preset.fallback)
    setIncludeFallback(preset.includeFallback)
    setTargetUrl(preset.targetUrl)
    setOutputType(preset.outputType)
    setWorkspace(preset.workspace)
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.referrer_policy.summary_title'),
        `${t('app.converter.referrer_policy.metric.privacy')}: ${metrics.privacy}`,
        `${t('app.converter.referrer_policy.metric.parsed')}: ${metrics.parsed}`,
        `${t('app.converter.referrer_policy.metric.risks')}: ${metrics.risks}`,
        getPolicyHeaderValue(policy, includeFallback, fallback)
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
                <ShieldCheck className="h-4 w-4" />
                {t('app.converter.referrer-policy')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.referrer-policy')}</CardTitle>
              <CardDescription>{t('app.converter.referrer_policy.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.referrer_policy.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PolicyMetric
              label={t('app.converter.referrer_policy.metric.privacy')}
              value={metrics.privacy}
            />
            <PolicyMetric
              label={t('app.converter.referrer_policy.metric.parsed')}
              value={metrics.parsed}
            />
            <PolicyMetric
              label={t('app.converter.referrer_policy.metric.valid')}
              value={metrics.valid}
            />
            <PolicyMetric
              label={t('app.converter.referrer_policy.metric.risks')}
              value={metrics.risks}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.referrer_policy.presets')}
            </CardTitle>
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
                {t(`app.converter.referrer_policy.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.referrer_policy.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">
              {t('app.converter.referrer_policy.builder')}
            </CardTitle>
            <CardDescription>{t('app.converter.referrer_policy.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="referrer-policy-select">
                  {t('app.converter.referrer_policy.policy')}
                </Label>
                <Select
                  id="referrer-policy-select"
                  value={policy}
                  onChange={event => setPolicy(event.target.value as Policy)}
                >
                  {POLICIES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="referrer-output-type">
                  {t('app.converter.referrer_policy.output_type')}
                </Label>
                <Select
                  id="referrer-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.referrer_policy.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="referrer-target-url">
                  {t('app.converter.referrer_policy.target_url')}
                </Label>
                <Input
                  id="referrer-target-url"
                  value={targetUrl}
                  onChange={event => setTargetUrl(event.target.value)}
                  placeholder="https://partner.example.com/landing"
                />
              </div>
            </div>

            <label className="glass-input flex flex-col gap-3 rounded-xl p-3 text-sm md:flex-row md:items-center md:justify-between">
              <span className="text-[var(--text-primary)]">
                {t('app.converter.referrer_policy.include_fallback')}
              </span>
              <input
                type="checkbox"
                checked={includeFallback}
                onChange={event => setIncludeFallback(event.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
            </label>

            {includeFallback ? (
              <div className="space-y-3">
                <Label htmlFor="referrer-fallback">
                  {t('app.converter.referrer_policy.fallback')}
                </Label>
                <Select
                  id="referrer-fallback"
                  value={fallback}
                  onChange={event => setFallback(event.target.value as Policy)}
                >
                  {POLICIES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Search className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.referrer_policy.matrix')}
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(['same_origin', 'cross_origin', 'downgrade'] as const).map(context => {
                  const leak = getLeakKind(policy, context)

                  return (
                    <div key={context} className="glass-input rounded-xl p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {t(`app.converter.referrer_policy.context.${context}`)}
                      </p>
                      <p
                        className={`mt-2 rounded-lg px-2 py-1 text-center text-sm font-semibold ${getLeakClass(leak)}`}
                      >
                        {t(`app.converter.referrer_policy.leak.${leak}`)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.referrer_policy.output_preview')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[240px] font-mono" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button type="button" onClick={() => copy(output)}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace(output)}>
                <Search className="h-4 w-4" />
                {t('app.converter.referrer_policy.use_output')}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.referrer_policy.audit')}
              </h3>
              <div className="space-y-2">
                {findings.slice(0, 10).map((finding, index) => (
                  <div
                    key={`${finding.key}:${finding.subject}:${index}`}
                    className={`rounded-xl border px-3 py-2 text-xs ${getFindingClass(finding.level)}`}
                  >
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2">/</span>
                    {t(`app.converter.referrer_policy.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">
                {t('app.converter.referrer_policy.workspace')}
              </CardTitle>
              <CardDescription>{t('app.converter.referrer_policy.workspace_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(exportJson)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.referrer_policy.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(exportCsv, 'referrer-policy.csv', 'text/csv;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.referrer_policy.download_csv')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={workspace}
            onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
            placeholder={t('app.converter.referrer_policy.workspace_placeholder')}
            className="min-h-[180px] font-mono"
          />

          {parsedPolicies.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedPolicies.map((parsed, index) => (
                <div
                  key={`${parsed.source}:${parsed.policy}:${index}`}
                  className="glass-input rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {parsed.policy}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{parsed.source}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        parsed.valid
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      {parsed.valid
                        ? t('app.converter.referrer_policy.valid')
                        : t('app.converter.referrer_policy.invalid')}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {parsed.raw}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.referrer_policy.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
