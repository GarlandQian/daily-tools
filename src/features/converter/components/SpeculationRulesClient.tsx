'use client'

import {
  AlertTriangle,
  Copy,
  Download,
  FileJson,
  Gauge,
  RotateCcw,
  Route,
  Sparkles
} from 'lucide-react'
import type { ReactNode } from 'react'
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

type AuditSeverity = 'error' | 'ok' | 'warn'
type Eagerness = 'conservative' | 'eager' | 'immediate' | 'moderate'
type OutputFormat = 'csv' | 'header' | 'json' | 'next' | 'nginx' | 'script'
type RuleKind = 'prefetch' | 'prerender'
type SourceMode = 'document' | 'list'

interface RuleDraft {
  eagerness: Eagerness
  hrefMatches: string
  kind: RuleKind
  note: string
  referrerPolicy: string
  requiresAnonymousClientIp: boolean
  source: SourceMode
  urls: string
}

interface RulePreset {
  key: string
  value: RuleDraft
  workspace: string
}

interface AuditItem {
  detail?: string
  key: string
  severity: AuditSeverity
  title: string
}

interface ParsedWorkspace {
  error: string
  jsonText: string
  ruleset: null | Record<string, unknown>
}

const MAX_WORKSPACE_LENGTH = 16000
const SAME_ORIGIN = 'https://example.com'
const PRIVATE_ROUTE_PATTERN =
  /(account|admin|auth|cart|checkout|dashboard|order|payment|profile|settings)/i

const DEFAULT_DRAFT: RuleDraft = {
  eagerness: 'moderate',
  hrefMatches: '/products/*',
  kind: 'prefetch',
  note: 'Warm likely product navigations',
  referrerPolicy: 'strict-origin-when-cross-origin',
  requiresAnonymousClientIp: false,
  source: 'document',
  urls: '/products/alpha\n/products/beta'
}

const PRESETS: RulePreset[] = [
  {
    key: 'next_route',
    value: DEFAULT_DRAFT,
    workspace: `<script type="speculationrules">\n${JSON.stringify(
      {
        prefetch: [
          {
            eagerness: 'moderate',
            referrer_policy: 'strict-origin-when-cross-origin',
            source: 'document',
            where: { href_matches: '/products/*' }
          }
        ]
      },
      null,
      2
    )}\n</script>`
  },
  {
    key: 'product_grid',
    value: {
      eagerness: 'moderate',
      hrefMatches: '/products/*',
      kind: 'prefetch',
      note: 'Product listing hover path',
      referrerPolicy: 'strict-origin-when-cross-origin',
      requiresAnonymousClientIp: false,
      source: 'list',
      urls: '/products/camera\n/products/lens\n/products/tripod'
    },
    workspace: JSON.stringify(
      {
        prefetch: [
          {
            eagerness: 'moderate',
            source: 'list',
            urls: ['/products/camera', '/products/lens', '/products/tripod']
          }
        ]
      },
      null,
      2
    )
  },
  {
    key: 'docs_prerender',
    value: {
      eagerness: 'conservative',
      hrefMatches: '/docs/*',
      kind: 'prerender',
      note: 'Safe docs next-page prerender',
      referrerPolicy: 'strict-origin-when-cross-origin',
      requiresAnonymousClientIp: true,
      source: 'document',
      urls: '/docs/getting-started'
    },
    workspace: JSON.stringify(
      {
        prerender: [
          {
            eagerness: 'conservative',
            requires: ['anonymous-client-ip-when-cross-origin'],
            source: 'document',
            where: { href_matches: '/docs/*' }
          }
        ]
      },
      null,
      2
    )
  },
  {
    key: 'checkout_risk',
    value: {
      eagerness: 'eager',
      hrefMatches: '/checkout/*',
      kind: 'prerender',
      note: 'Risky checkout prerender sample',
      referrerPolicy: '',
      requiresAnonymousClientIp: false,
      source: 'list',
      urls: '/checkout\n/account/settings\nhttps://pay.example.net/session'
    },
    workspace: JSON.stringify(
      {
        prerender: [
          {
            eagerness: 'eager',
            source: 'list',
            urls: ['/checkout', '/account/settings', 'https://pay.example.net/session']
          }
        ]
      },
      null,
      2
    )
  },
  {
    key: 'invalid',
    value: {
      eagerness: 'immediate',
      hrefMatches: '*',
      kind: 'prerender',
      note: 'Broken schema sample',
      referrerPolicy: 'unsafe-url',
      requiresAnonymousClientIp: false,
      source: 'document',
      urls: 'javascript:alert(1)\n/account'
    },
    workspace:
      '{"prerender":[{"source":"list","urls":[]},{"source":"document","where":{"href_matches":"*"},"eagerness":"immediate"}]}'
  }
]

const EAGERNESS_OPTIONS: Eagerness[] = ['conservative', 'moderate', 'eager', 'immediate']
const OUTPUT_FORMATS: OutputFormat[] = ['script', 'json', 'next', 'header', 'nginx', 'csv']
const REFERRER_POLICIES = [
  '',
  'strict-origin-when-cross-origin',
  'origin',
  'same-origin',
  'no-referrer',
  'unsafe-url'
]

const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)

const isKnownObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeUrl = (value: string) => {
  try {
    return new URL(value, SAME_ORIGIN)
  } catch {
    return null
  }
}

const isDangerousUrl = (value: string) => /^(javascript|data|vbscript):/i.test(value.trim())

const stripScriptWrapper = (value: string) => {
  const match = value.match(/<script[^>]*type=["']speculationrules["'][^>]*>([\s\S]*?)<\/script>/i)
  return match?.[1]?.trim() ?? value.trim()
}

const buildRule = (draft: RuleDraft) => {
  const rule: Record<string, unknown> = {
    eagerness: draft.eagerness,
    source: draft.source
  }

  if (draft.source === 'list') {
    rule.urls = splitLines(draft.urls)
  } else {
    rule.where = {
      href_matches: draft.hrefMatches.trim() || '/*'
    }
  }

  if (draft.requiresAnonymousClientIp) {
    rule.requires = ['anonymous-client-ip-when-cross-origin']
  }

  if (draft.referrerPolicy.trim()) {
    rule.referrer_policy = draft.referrerPolicy.trim()
  }

  return rule
}

const buildRuleset = (draft: RuleDraft) => ({
  [draft.kind]: [buildRule(draft)]
})

const formatJson = (draft: RuleDraft) => JSON.stringify(buildRuleset(draft), null, 2)
const escapeHtmlScript = (value: string) => value.replace(/</g, '\\u003c')

const buildOutput = (draft: RuleDraft, format: OutputFormat) => {
  const json = formatJson(draft)

  if (format === 'script') {
    return `<script type="speculationrules">\n${escapeHtmlScript(json)}\n</script>`
  }

  if (format === 'next') {
    return [
      'export default function Head() {',
      '  return (',
      '    <script',
      '      type="speculationrules"',
      `      dangerouslySetInnerHTML={{ __html: ${JSON.stringify(json)} }}`,
      '    />',
      '  )',
      '}'
    ].join('\n')
  }

  if (format === 'header') {
    return ['Speculation-Rules: "/speculationrules.json"', '', json].join('\n')
  }

  if (format === 'nginx') {
    return [
      'location = /speculationrules.json {',
      '  add_header Content-Type application/speculationrules+json;',
      `  return 200 '${json.replace(/'/g, "'\\''")}';`,
      '}',
      '',
      'add_header Speculation-Rules "/speculationrules.json";'
    ].join('\n')
  }

  if (format === 'csv') {
    const urls = splitLines(draft.urls)
    return [
      'kind,source,eagerness,target_count,href_matches,requires,referrer_policy,note',
      [
        draft.kind,
        draft.source,
        draft.eagerness,
        String(draft.source === 'list' ? urls.length : 1),
        draft.hrefMatches,
        draft.requiresAnonymousClientIp ? 'anonymous-client-ip-when-cross-origin' : '',
        draft.referrerPolicy,
        draft.note
      ]
        .map(value => `"${value.replace(/"/g, '""')}"`)
        .join(',')
    ].join('\n')
  }

  return json
}

const parseWorkspace = (workspace: string): ParsedWorkspace => {
  const jsonText = stripScriptWrapper(workspace)
  if (!jsonText) return { error: '', jsonText, ruleset: null }

  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!isKnownObject(parsed)) {
      return { error: 'root_object', jsonText, ruleset: null }
    }
    return { error: '', jsonText, ruleset: parsed }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'invalid_json',
      jsonText,
      ruleset: null
    }
  }
}

const getParsedRules = (ruleset: null | Record<string, unknown>) => {
  if (!ruleset) return []

  return (['prefetch', 'prerender'] as const).flatMap(kind => {
    const entries = Array.isArray(ruleset[kind]) ? ruleset[kind] : []
    return entries.map((rule, index) => ({ index, kind, rule }))
  })
}

const getRuleTargets = (rule: unknown) => {
  if (!isKnownObject(rule)) return []
  if (Array.isArray(rule.urls))
    return rule.urls.filter((item): item is string => typeof item === 'string')
  const where = isKnownObject(rule.where) ? rule.where : null
  const hrefMatches = where && typeof where.href_matches === 'string' ? where.href_matches : ''
  return hrefMatches ? [hrefMatches] : []
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

const SpeculationRulesClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<RuleDraft>(DEFAULT_DRAFT)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('script')
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const deferredWorkspace = useDeferredValue(workspace)

  const urls = useMemo(() => splitLines(draft.urls), [draft.urls])
  const outputPreviewSource = useMemo(() => buildOutput(draft, outputFormat), [draft, outputFormat])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, outputFormat),
    [draft, outputFormat]
  )
  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const parsedRules = useMemo(() => getParsedRules(parsed.ruleset), [parsed.ruleset])
  const workspaceTruncated = workspace.length >= MAX_WORKSPACE_LENGTH

  const audits = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = []

    if (draft.source === 'list' && urls.length === 0) {
      items.push({
        key: 'missing_urls',
        severity: 'error',
        title: t('app.converter.speculation_rules.audit.missing_urls')
      })
    }

    if (draft.source === 'list') {
      urls.slice(0, 60).forEach((url, index) => {
        const parsedUrl = safeUrl(url)
        if (
          isDangerousUrl(url) ||
          !parsedUrl ||
          !['http:', 'https:'].includes(parsedUrl.protocol)
        ) {
          items.push({
            key: `url_invalid_${index}`,
            severity: 'error',
            title: t('app.converter.speculation_rules.audit.invalid_url'),
            detail: url
          })
          return
        }

        if (parsedUrl.origin !== SAME_ORIGIN) {
          items.push({
            key: `cross_origin_${index}`,
            severity: draft.kind === 'prerender' ? 'warn' : 'ok',
            title: t('app.converter.speculation_rules.audit.cross_origin'),
            detail: url
          })
        }

        if (PRIVATE_ROUTE_PATTERN.test(url) && draft.kind === 'prerender') {
          items.push({
            key: `private_route_${index}`,
            severity: 'warn',
            title: t('app.converter.speculation_rules.audit.private_route'),
            detail: url
          })
        }
      })
    }

    if (urls.length > 30) {
      items.push({
        key: 'too_many_urls',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.too_many_urls'),
        detail: `${urls.length}`
      })
    }

    if (
      draft.kind === 'prerender' &&
      (draft.eagerness === 'eager' || draft.eagerness === 'immediate')
    ) {
      items.push({
        key: 'eager_prerender',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.eager_prerender'),
        detail: draft.eagerness
      })
    }

    if (
      draft.source === 'document' &&
      draft.kind === 'prerender' &&
      (draft.hrefMatches.trim() === '*' || draft.hrefMatches.trim() === '/*')
    ) {
      items.push({
        key: 'broad_document',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.broad_document'),
        detail: draft.hrefMatches
      })
    }

    if (draft.referrerPolicy === 'unsafe-url') {
      items.push({
        key: 'unsafe_referrer',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.unsafe_referrer')
      })
    }

    if (draft.requiresAnonymousClientIp && draft.kind === 'prefetch') {
      items.push({
        key: 'anonymous_prefetch',
        severity: 'ok',
        title: t('app.converter.speculation_rules.audit.anonymous_prefetch')
      })
    }

    if (parsed.error) {
      items.push({
        key: 'parse_error',
        severity: 'error',
        title: t('app.converter.speculation_rules.audit.parse_error'),
        detail: parsed.error
      })
    } else if (!parsed.ruleset) {
      items.push({
        key: 'parse_missing',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.parse_missing')
      })
    } else if (!parsedRules.length) {
      items.push({
        key: 'no_rules',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.no_rules')
      })
    } else {
      items.push({
        key: 'parse_ok',
        severity: 'ok',
        title: t('app.converter.speculation_rules.audit.parse_ok'),
        detail: `${parsedRules.length}`
      })
    }

    parsedRules.slice(0, 40).forEach(({ index, kind, rule }) => {
      if (!isKnownObject(rule)) {
        items.push({
          key: `parsed_not_object_${kind}_${index}`,
          severity: 'error',
          title: t('app.converter.speculation_rules.audit.rule_not_object'),
          detail: `${kind}[${index}]`
        })
        return
      }

      if (rule.source !== 'list' && rule.source !== 'document') {
        items.push({
          key: `parsed_source_${kind}_${index}`,
          severity: 'error',
          title: t('app.converter.speculation_rules.audit.bad_source'),
          detail: `${kind}[${index}]`
        })
      }

      const targets = getRuleTargets(rule)
      if (!targets.length) {
        items.push({
          key: `parsed_targets_${kind}_${index}`,
          severity: 'error',
          title: t('app.converter.speculation_rules.audit.missing_targets'),
          detail: `${kind}[${index}]`
        })
      }

      if (kind === 'prerender' && rule.eagerness === 'immediate') {
        items.push({
          key: `parsed_immediate_${kind}_${index}`,
          severity: 'warn',
          title: t('app.converter.speculation_rules.audit.immediate_prerender'),
          detail: `${kind}[${index}]`
        })
      }
    })

    if (workspaceTruncated) {
      items.push({
        key: 'workspace_truncated',
        severity: 'warn',
        title: t('app.converter.speculation_rules.audit.workspace_truncated'),
        detail: `${MAX_WORKSPACE_LENGTH}`
      })
    }

    if (!items.some(item => item.severity !== 'ok')) {
      items.push({
        key: 'healthy',
        severity: 'ok',
        title: t('app.converter.speculation_rules.audit.healthy')
      })
    }

    return items
  }, [draft, parsed.error, parsed.ruleset, parsedRules, t, urls, workspaceTruncated])

  const counts = useMemo(
    () => ({
      error: audits.filter(item => item.severity === 'error').length,
      ok: audits.filter(item => item.severity === 'ok').length,
      targets: draft.source === 'list' ? urls.length : 1,
      warn: audits.filter(item => item.severity === 'warn').length
    }),
    [audits, draft.source, urls.length]
  )

  const handleApplyPreset = useCallback((preset: RulePreset) => {
    setDraft(preset.value)
    setWorkspace(preset.workspace)
  }, [])

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setOutputFormat('script')
    setWorkspace(PRESETS[0]?.workspace ?? '')
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.speculation_rules')}
              </CardTitle>
              <CardDescription>{t('app.converter.speculation_rules.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              icon={<Gauge className="h-4 w-4" />}
              label={t('app.converter.speculation_rules.metric.status')}
              value={
                counts.error
                  ? t('app.converter.speculation_rules.status.error')
                  : counts.warn
                    ? t('app.converter.speculation_rules.status.warn')
                    : t('app.converter.speculation_rules.status.ok')
              }
            />
            <Metric
              label={t('app.converter.speculation_rules.metric.targets')}
              value={counts.targets}
            />
            <Metric
              label={t('app.converter.speculation_rules.metric.warnings')}
              value={counts.warn}
            />
            <Metric
              label={t('app.converter.speculation_rules.metric.parsed')}
              value={parsedRules.length}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleApplyPreset(preset)}
              >
                {t(`app.converter.speculation_rules.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.speculation_rules.builder')}</CardTitle>
            <CardDescription>{t('app.converter.speculation_rules.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                id="spec-kind"
                label={t('app.converter.speculation_rules.kind')}
                value={draft.kind}
                options={['prefetch', 'prerender']}
                labelPrefix="app.converter.speculation_rules.kind"
                onChange={value => setDraft(prev => ({ ...prev, kind: value as RuleKind }))}
              />
              <SelectField
                id="spec-source"
                label={t('app.converter.speculation_rules.source')}
                value={draft.source}
                options={['document', 'list']}
                labelPrefix="app.converter.speculation_rules.source"
                onChange={value => setDraft(prev => ({ ...prev, source: value as SourceMode }))}
              />
              <SelectField
                id="spec-eagerness"
                label={t('app.converter.speculation_rules.eagerness')}
                value={draft.eagerness}
                options={EAGERNESS_OPTIONS}
                labelPrefix="app.converter.speculation_rules.eagerness"
                onChange={value => setDraft(prev => ({ ...prev, eagerness: value as Eagerness }))}
              />
              <div className="space-y-3">
                <Label htmlFor="spec-referrer">
                  {t('app.converter.speculation_rules.referrer_policy')}
                </Label>
                <Select
                  id="spec-referrer"
                  value={draft.referrerPolicy}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, referrerPolicy: event.target.value }))
                  }
                >
                  {REFERRER_POLICIES.map(policy => (
                    <option key={policy || 'none'} value={policy}>
                      {policy || t('app.converter.speculation_rules.referrer_policy.none')}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {draft.source === 'list' ? (
              <div className="space-y-3">
                <Label htmlFor="spec-urls">{t('app.converter.speculation_rules.urls')}</Label>
                <Textarea
                  id="spec-urls"
                  value={draft.urls}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, urls: event.target.value.slice(0, 6000) }))
                  }
                  className="min-h-[170px] font-mono"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="spec-href">
                  {t('app.converter.speculation_rules.href_matches')}
                </Label>
                <Input
                  id="spec-href"
                  value={draft.hrefMatches}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, hrefMatches: event.target.value.slice(0, 240) }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="spec-note">{t('app.converter.speculation_rules.note')}</Label>
              <Input
                id="spec-note"
                value={draft.note}
                onChange={event =>
                  setDraft(prev => ({ ...prev, note: event.target.value.slice(0, 140) }))
                }
              />
            </div>

            <Checkbox
              checked={draft.requiresAnonymousClientIp}
              onChange={event =>
                setDraft(prev => ({ ...prev, requiresAnonymousClientIp: event.target.checked }))
              }
              label={t('app.converter.speculation_rules.requires')}
            />

            <div className="glass-input rounded-2xl p-4">
              <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
                {t('app.converter.speculation_rules.preview')}
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {formatJson(draft)}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.speculation_rules.workspace')}</CardTitle>
            <CardDescription>{t('app.converter.speculation_rules.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, MAX_WORKSPACE_LENGTH))}
              className="min-h-[260px] font-mono"
              spellCheck={false}
              placeholder={t('app.converter.speculation_rules.workspace_placeholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => setWorkspace(buildOutput(draft, 'script'))}
              >
                {t('app.converter.speculation_rules.use_output')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setWorkspace('')}>
                {t('public.clear')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {parsedRules.slice(0, 6).map(({ index, kind, rule }) => (
                <div
                  key={`${kind}-${index}`}
                  className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3"
                >
                  <div className="text-xs font-medium text-[var(--text-tertiary)]">
                    {kind}[{index}]
                  </div>
                  <div className="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">
                    {getRuleTargets(rule).join(', ') ||
                      t('app.converter.speculation_rules.no_targets')}
                  </div>
                </div>
              ))}
              {!parsedRules.length ? (
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3 text-sm text-[var(--text-secondary)]">
                  {t('app.converter.speculation_rules.no_parsed')}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.speculation_rules.audit')}</CardTitle>
            <CardDescription>{t('app.converter.speculation_rules.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {audits.map(item => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      item.severity === 'error'
                        ? 'rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-500'
                        : item.severity === 'warn'
                          ? 'rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600'
                          : 'rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-600'
                    }
                  >
                    {t(`app.converter.speculation_rules.severity.${item.severity}`)}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                </div>
                {item.detail ? (
                  <p className="mt-2 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.speculation_rules.output')}</CardTitle>
            <CardDescription>{t('app.converter.speculation_rules.output_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-3">
                <Label htmlFor="spec-output">
                  {t('app.converter.speculation_rules.output_format')}
                </Label>
                <Select
                  id="spec-output"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  {OUTPUT_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.converter.speculation_rules.output.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(buildCurrentOutput())}
                className="self-end"
              >
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    outputFormat === 'csv' ? 'speculation-rules.csv' : 'speculation-rules.txt',
                    outputFormat === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'
                  )
                }
                className="self-end"
              >
                {t('app.converter.speculation_rules.download')}
              </Button>
            </div>

            <div className="glass-input min-h-[300px] rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <FileJson className="h-4 w-4" />
                {t(`app.converter.speculation_rules.output.${outputFormat}`)}
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {outputPreview}
              </pre>
            </div>
            {outputPreviewLimited ? (
              <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('app.converter.speculation_rules.reference')}</CardTitle>
          <CardDescription>{t('app.converter.speculation_rules.reference_hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(['prefetch', 'prerender', 'document', 'list'] as const).map(key => (
              <div
                key={key}
                className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
                  {t(`app.converter.speculation_rules.reference.${key}`)}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`app.converter.speculation_rules.reference.${key}_hint`)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const SelectField = ({
  id,
  label,
  labelPrefix,
  onChange,
  options,
  value
}: {
  id: string
  label: string
  labelPrefix: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => (
          <option key={option} value={option}>
            {t(`${labelPrefix}.${option}`)}
          </option>
        ))}
      </Select>
    </div>
  )
}

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 break-all font-mono text-xl font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default SpeculationRulesClient
