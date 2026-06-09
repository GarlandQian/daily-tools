'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  Link2,
  Megaphone,
  RotateCcw,
  Search,
  ShieldCheck,
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

type UtmPresetKey = 'newsletter' | 'paid' | 'partner' | 'social'
type AuditLevel = 'danger' | 'good' | 'warn'
type BuildError = 'invalid' | 'scheme'

interface UtmFormData {
  campaign: string
  content: string
  id: string
  medium: string
  source: string
  term: string
  url: string
}

interface AuditItem {
  key: string
  level: AuditLevel
  subject: string
}

interface ParsedUtmUrl {
  baseUrl: string
  credentials: boolean
  duplicateUtmKeys: string[]
  error: BuildError | null
  extraTrackingKeys: string[]
  fragmentQuery: boolean
  hostname: string
  isHttps: boolean
  mixedCaseUtmKeys: string[]
  original: string
  preservedParams: Array<{ key: string; value: string }>
  protocol: string
  utm: Omit<UtmFormData, 'url'>
}

interface ParsedWorkspace {
  capped: boolean
  invalidRows: number
  urls: ParsedUtmUrl[]
}

const DEFAULT_FORM_DATA: UtmFormData = {
  campaign: 'launch',
  content: '',
  id: '',
  medium: 'email',
  source: 'newsletter',
  term: '',
  url: 'https://daily-tools.vercel.app'
}

const PRESETS: Record<UtmPresetKey, Pick<UtmFormData, 'campaign' | 'medium' | 'source'>> = {
  newsletter: {
    campaign: 'monthly-update',
    medium: 'email',
    source: 'newsletter'
  },
  social: {
    campaign: 'product-post',
    medium: 'social',
    source: 'twitter'
  },
  paid: {
    campaign: 'search-campaign',
    medium: 'cpc',
    source: 'google'
  },
  partner: {
    campaign: 'co-marketing',
    medium: 'referral',
    source: 'partner'
  }
}

const BULK_CHANNELS = [
  { content: 'hero-link', medium: 'email', source: 'newsletter' },
  { content: 'feed-post', medium: 'social', source: 'linkedin' },
  { content: 'search-ad', medium: 'cpc', source: 'google' },
  { content: 'partner-card', medium: 'referral', source: 'partner' }
]

const UTM_WORKSPACE_LIMIT = 40000
const MAX_WORKSPACE_LINES = 120
const MAX_PARSED_URLS = 16
const HOST_PORT_PATTERN = /^(?:localhost|(?:[\w-]+\.)+[\w-]+|\[[^\]]+\]):\d+(?:[/?#]|$)/iu
const HAS_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu
const URL_CANDIDATE_PATTERN =
  /(?:[a-z][a-z\d+.-]*:\/\/|\/\/|(?:localhost|(?:[\w-]+\.)+[\w-]+|\[[^\]]+\])(?::\d+)?)(?:[^\s<>"'`]*)?/iu

const UTM_PARAM_DEFINITIONS = [
  { field: 'source', key: 'utm_source' },
  { field: 'medium', key: 'utm_medium' },
  { field: 'campaign', key: 'utm_campaign' },
  { field: 'term', key: 'utm_term' },
  { field: 'content', key: 'utm_content' },
  { field: 'id', key: 'utm_id' }
] as const
const UTM_PARAM_KEYS: Set<string> = new Set(UTM_PARAM_DEFINITIONS.map(item => item.key))
const TRACKING_PARAM_KEYS: Set<string> = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'yclid'
])
const DEFAULT_WORKSPACE =
  'https://daily-tools.vercel.app/pricing?plan=pro&utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=hero-link#pricing'

const normalizeUrl = (value: string) => {
  const trimmed = value.trim().replace(/^<|>$/gu, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (HOST_PORT_PATTERN.test(trimmed)) return `https://${trimmed}`
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const normalizeCampaignFields = (formData: UtmFormData): UtmFormData => ({
  ...formData,
  campaign: slugify(formData.campaign),
  content: slugify(formData.content),
  id: slugify(formData.id),
  medium: slugify(formData.medium),
  source: slugify(formData.source),
  term: slugify(formData.term)
})

const buildUtmUrl = (formData: UtmFormData) => {
  const normalized = normalizeUrl(formData.url)
  if (!normalized) return { error: null, query: '', url: '' } as const

  try {
    const url = new URL(normalized)
    if (!isWebProtocol(url.protocol)) return { error: 'scheme' as const, query: '', url: '' }
    const entries = UTM_PARAM_DEFINITIONS.map(item => [item.key, formData[item.field]] as const)

    entries.forEach(([key, value]) => {
      if (value.trim()) {
        url.searchParams.set(key, value.trim())
      } else {
        url.searchParams.delete(key)
      }
    })

    return {
      error: null,
      query: url.searchParams.toString(),
      url: url.toString()
    }
  } catch {
    return { error: 'invalid' as const, query: '', url: '' }
  }
}

const isWebProtocol = (protocol: string) => protocol === 'http:' || protocol === 'https:'

const stripCandidatePunctuation = (value: string) =>
  value.trim().replace(/^["'`(<]+|[>"'`),.;]+$/gu, '')

const extractUrlCandidate = (line: string) => {
  const trimmed = stripCandidatePunctuation(line)
  if (!trimmed) return ''
  if (HOST_PORT_PATTERN.test(trimmed) || HAS_SCHEME_PATTERN.test(trimmed)) {
    return stripCandidatePunctuation(trimmed.split(/\s/u)[0] ?? '')
  }

  return stripCandidatePunctuation(trimmed.match(URL_CANDIDATE_PATTERN)?.[0] ?? '')
}

const getFirstParamValue = (entries: Array<[string, string]>, key: string) => {
  const exact = entries.find(([entryKey, value]) => entryKey.toLowerCase() === key && value.trim())
  if (exact) return exact[1]

  return entries.find(([entryKey]) => entryKey.toLowerCase() === key)?.[1] ?? ''
}

const buildBaseUrlWithoutTracking = (url: URL) => {
  const baseUrl = new URL(url.toString())
  const trackingKeys = new Set<string>()
  baseUrl.searchParams.forEach((_, key) => {
    if (key.toLowerCase().startsWith('utm_')) trackingKeys.add(key)
  })
  trackingKeys.forEach(key => baseUrl.searchParams.delete(key))

  return baseUrl.toString()
}

const parseUtmCandidate = (candidate: string): ParsedUtmUrl | null => {
  if (!candidate.trim()) return null

  const normalized = normalizeUrl(candidate)
  try {
    const url = new URL(normalized)
    const entries = Array.from(url.searchParams.entries())
    const keyCounts = new Map<string, number>()
    const mixedCaseUtmKeys = new Set<string>()
    const duplicateUtmKeys = new Set<string>()
    const extraTrackingKeys = new Set<string>()
    const preservedParams: Array<{ key: string; value: string }> = []
    const utm = UTM_PARAM_DEFINITIONS.reduce(
      (result, item) => ({
        ...result,
        [item.field]: getFirstParamValue(entries, item.key)
      }),
      {} as Omit<UtmFormData, 'url'>
    )

    entries.forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase()
      keyCounts.set(normalizedKey, (keyCounts.get(normalizedKey) ?? 0) + 1)

      if (normalizedKey.startsWith('utm_')) {
        if (key !== normalizedKey) mixedCaseUtmKeys.add(key)
        if (!UTM_PARAM_KEYS.has(normalizedKey)) extraTrackingKeys.add(key)
      } else if (TRACKING_PARAM_KEYS.has(normalizedKey)) {
        extraTrackingKeys.add(key)
        preservedParams.push({ key, value })
      } else {
        preservedParams.push({ key, value })
      }
    })

    keyCounts.forEach((count, key) => {
      if (count > 1 && key.startsWith('utm_')) duplicateUtmKeys.add(key)
    })

    return {
      baseUrl: isWebProtocol(url.protocol) ? buildBaseUrlWithoutTracking(url) : '',
      credentials: Boolean(url.username || url.password),
      duplicateUtmKeys: Array.from(duplicateUtmKeys),
      error: isWebProtocol(url.protocol) ? null : 'scheme',
      extraTrackingKeys: Array.from(extraTrackingKeys),
      fragmentQuery: /[?#&]utm_/iu.test(url.hash),
      hostname: url.hostname,
      isHttps: url.protocol === 'https:',
      mixedCaseUtmKeys: Array.from(mixedCaseUtmKeys),
      original: candidate,
      preservedParams,
      protocol: url.protocol.replace(/:$/u, ''),
      utm
    }
  } catch {
    return {
      baseUrl: '',
      credentials: false,
      duplicateUtmKeys: [],
      error: 'invalid',
      extraTrackingKeys: [],
      fragmentQuery: /[?#&]utm_/iu.test(candidate),
      hostname: '',
      isHttps: false,
      mixedCaseUtmKeys: [],
      original: candidate,
      preservedParams: [],
      protocol: '',
      utm: {
        campaign: '',
        content: '',
        id: '',
        medium: '',
        source: '',
        term: ''
      }
    }
  }
}

const parseUtmWorkspace = (input: string): ParsedWorkspace => {
  const capped = input.length > UTM_WORKSPACE_LIMIT
  const safeInput = input.slice(0, UTM_WORKSPACE_LIMIT)
  const candidates: string[] = []
  let invalidRows = 0

  for (const line of safeInput.split(/\r?\n/u).slice(0, MAX_WORKSPACE_LINES)) {
    const candidate = extractUrlCandidate(line)
    if (!candidate) continue
    candidates.push(candidate)
    if (candidates.length >= MAX_PARSED_URLS) break
  }

  const urls = candidates.reduce<ParsedUtmUrl[]>((items, candidate) => {
    const parsed = parseUtmCandidate(candidate)
    if (!parsed) return items
    if (parsed.error) invalidRows += 1
    items.push(parsed)
    return items
  }, [])

  return { capped, invalidRows, urls }
}

const normalizeDiffFields = (formData: UtmFormData) => {
  const normalized = normalizeCampaignFields(formData)

  return UTM_PARAM_DEFINITIONS.filter(
    item => formData[item.field] && formData[item.field] !== normalized[item.field]
  ).map(item => item.key)
}

const auditExistingBaseUrl = (value: string) => {
  const candidate = parseUtmCandidate(value)
  if (!candidate) return null

  return candidate
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildVariantsCsv = (
  rows: Array<{
    content: string
    id: string
    medium: string
    source: string
    status: string
    term: string
    campaign: string
    url: string
    variant: string
    error: string
  }>
) =>
  [
    ['variant', 'id', 'source', 'medium', 'campaign', 'term', 'content', 'status', 'error', 'url']
      .map(csvCell)
      .join(','),
    ...rows.map(row =>
      [
        row.variant,
        row.id,
        row.source,
        row.medium,
        row.campaign,
        row.term,
        row.content,
        row.status,
        row.error,
        row.url
      ]
        .map(csvCell)
        .join(',')
    )
  ].join('\n')

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const UtmBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<UtmFormData>(DEFAULT_FORM_DATA)
  const [autoNormalize, setAutoNormalize] = useState(true)
  const [auditQuery, setAuditQuery] = useState('')
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE)
  const deferredWorkspace = useDeferredValue(workspace)

  const effectiveFormData = useMemo(
    () => (autoNormalize ? normalizeCampaignFields(formData) : formData),
    [autoNormalize, formData]
  )
  const result = useMemo(() => buildUtmUrl(effectiveFormData), [effectiveFormData])
  const parsedWorkspace = useMemo(() => parseUtmWorkspace(deferredWorkspace), [deferredWorkspace])
  const parsedPrimary = parsedWorkspace.urls.find(item => !item.error)
  const baseAudit = useMemo(() => auditExistingBaseUrl(formData.url), [formData.url])
  const normalizationDiffs = useMemo(() => normalizeDiffFields(formData), [formData])
  const requiredMissing =
    !effectiveFormData.source.trim() ||
    !effectiveFormData.medium.trim() ||
    !effectiveFormData.campaign.trim()
  const canCopy = Boolean(result.url && !result.error && !requiredMissing)
  const bulkRows = useMemo(
    () =>
      BULK_CHANNELS.map(channel => ({
        ...channel,
        result: buildUtmUrl({
          ...effectiveFormData,
          content: channel.content,
          id: effectiveFormData.id,
          medium: channel.medium,
          source: channel.source
        })
      })),
    [effectiveFormData]
  )
  const variantRows = useMemo(
    () => [
      {
        campaign: effectiveFormData.campaign,
        content: effectiveFormData.content,
        error: result.error ?? (requiredMissing ? 'required' : ''),
        id: effectiveFormData.id,
        medium: effectiveFormData.medium,
        source: effectiveFormData.source,
        status: canCopy ? 'ok' : 'blocked',
        term: effectiveFormData.term,
        url: result.url,
        variant: 'primary'
      },
      ...bulkRows.map(row => ({
        campaign: effectiveFormData.campaign,
        content: row.content,
        error: row.result.error ?? '',
        id: effectiveFormData.id,
        medium: row.medium,
        source: row.source,
        status: row.result.url && !row.result.error && !requiredMissing ? 'ok' : 'blocked',
        term: effectiveFormData.term,
        url: row.result.url,
        variant: row.source
      }))
    ],
    [bulkRows, canCopy, effectiveFormData, requiredMissing, result.error, result.url]
  )
  const csvOutput = useMemo(() => buildVariantsCsv(variantRows), [variantRows])
  const jsonSummary = useMemo(
    () =>
      JSON.stringify(
        {
          fields: effectiveFormData,
          query: result.query,
          url: result.url,
          variants: variantRows
        },
        null,
        2
      ),
    [effectiveFormData, result.query, result.url, variantRows]
  )
  const audits = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = []
    const baseHasUtm = baseAudit
      ? UTM_PARAM_DEFINITIONS.some(item => baseAudit.utm[item.field].trim()) ||
        baseAudit.extraTrackingKeys.length > 0
      : false

    if (requiredMissing)
      items.push({
        key: 'missing_required',
        level: 'danger',
        subject: 'utm_source, utm_medium, utm_campaign'
      })
    if (result.error === 'invalid')
      items.push({ key: 'invalid_url', level: 'danger', subject: formData.url || 'URL' })
    if (result.error === 'scheme')
      items.push({ key: 'unsupported_scheme', level: 'danger', subject: formData.url || 'URL' })
    if (normalizationDiffs.length > 0)
      items.push({
        key: 'normalization_loss',
        level: 'warn',
        subject: normalizationDiffs.join(', ')
      })

    if (baseAudit && !baseAudit.error) {
      if (!baseAudit.isHttps)
        items.push({ key: 'non_https', level: 'warn', subject: baseAudit.original })
      if (baseAudit.credentials)
        items.push({ key: 'credentials', level: 'danger', subject: baseAudit.hostname })
      if (baseAudit.duplicateUtmKeys.length > 0)
        items.push({
          key: 'duplicate_utm',
          level: 'warn',
          subject: baseAudit.duplicateUtmKeys.join(', ')
        })
      if (baseAudit.mixedCaseUtmKeys.length > 0)
        items.push({
          key: 'mixed_case_utm',
          level: 'warn',
          subject: baseAudit.mixedCaseUtmKeys.join(', ')
        })
      if (baseAudit.extraTrackingKeys.length > 0)
        items.push({
          key: 'extra_tracking',
          level: 'warn',
          subject: baseAudit.extraTrackingKeys.join(', ')
        })
      if (baseHasUtm)
        items.push({ key: 'existing_utm', level: 'warn', subject: baseAudit.original })
      if (baseAudit.preservedParams.length > 0)
        items.push({
          key: 'preserved_params',
          level: 'good',
          subject: String(baseAudit.preservedParams.length)
        })
      if (baseAudit.fragmentQuery)
        items.push({ key: 'fragment_query', level: 'warn', subject: baseAudit.original })
    }

    if (parsedWorkspace.capped)
      items.push({ key: 'workspace_capped', level: 'warn', subject: String(UTM_WORKSPACE_LIMIT) })
    if (workspace.trim() && parsedWorkspace.urls.length === 0)
      items.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })
    if (parsedWorkspace.invalidRows > 0)
      items.push({
        key: 'parsed_invalid',
        level: 'warn',
        subject: String(parsedWorkspace.invalidRows)
      })

    if (parsedPrimary) {
      if (
        !parsedPrimary.utm.source.trim() ||
        !parsedPrimary.utm.medium.trim() ||
        !parsedPrimary.utm.campaign.trim()
      ) {
        items.push({
          key: 'parsed_missing_required',
          level: 'warn',
          subject: parsedPrimary.original
        })
      }
      if (!parsedPrimary.isHttps)
        items.push({ key: 'parsed_non_https', level: 'warn', subject: parsedPrimary.original })
      if (parsedPrimary.credentials)
        items.push({ key: 'parsed_credentials', level: 'danger', subject: parsedPrimary.hostname })
      if (parsedPrimary.duplicateUtmKeys.length > 0)
        items.push({
          key: 'parsed_duplicate_utm',
          level: 'warn',
          subject: parsedPrimary.duplicateUtmKeys.join(', ')
        })
      if (parsedPrimary.mixedCaseUtmKeys.length > 0)
        items.push({
          key: 'parsed_mixed_case_utm',
          level: 'warn',
          subject: parsedPrimary.mixedCaseUtmKeys.join(', ')
        })
      if (parsedPrimary.extraTrackingKeys.length > 0)
        items.push({
          key: 'parsed_extra_tracking',
          level: 'warn',
          subject: parsedPrimary.extraTrackingKeys.join(', ')
        })
      if (parsedPrimary.preservedParams.length > 0)
        items.push({
          key: 'parsed_preserved_params',
          level: 'good',
          subject: String(parsedPrimary.preservedParams.length)
        })
      if (parsedPrimary.fragmentQuery)
        items.push({ key: 'parsed_fragment_query', level: 'warn', subject: parsedPrimary.original })
    }

    if (items.length === 0)
      items.push({ key: 'ready', level: 'good', subject: result.url || 'UTM' })

    return items
  }, [
    baseAudit,
    formData.url,
    normalizationDiffs,
    parsedPrimary,
    parsedWorkspace,
    requiredMissing,
    result.error,
    result.url,
    workspace
  ])
  const filteredAudits = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return audits

    return audits.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.utm.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, audits, t])
  const metrics = useMemo(
    () => ({
      duplicates: parsedWorkspace.urls.reduce((sum, item) => sum + item.duplicateUtmKeys.length, 0),
      preserved: parsedWorkspace.urls.reduce((sum, item) => sum + item.preservedParams.length, 0),
      valid: parsedWorkspace.urls.filter(item => !item.error).length
    }),
    [parsedWorkspace.urls]
  )

  const applyPreset = (key: UtmPresetKey) => {
    setFormData(prev => ({ ...prev, ...PRESETS[key] }))
  }

  const reset = () => {
    setFormData(DEFAULT_FORM_DATA)
    setAutoNormalize(true)
    setAuditQuery('')
    setWorkspace(DEFAULT_WORKSPACE)
  }

  const applyParsedUrl = () => {
    if (!parsedPrimary) return

    setFormData(prev => ({
      ...prev,
      ...parsedPrimary.utm,
      url: parsedPrimary.baseUrl
    }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.utm')}
              </CardTitle>
              <CardDescription>{t('app.generation.utm.description')}</CardDescription>
            </div>
            <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <Label htmlFor="utm-url">{t('app.generation.utm.url')}</Label>
              <Input
                id="utm-url"
                value={formData.url}
                onChange={event => setFormData(prev => ({ ...prev, url: event.target.value }))}
                placeholder="example.com/pricing"
                className="font-mono"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="utm-preset">{t('app.generation.utm.preset')}</Label>
              <Select
                id="utm-preset"
                defaultValue=""
                onChange={event => applyPreset(event.target.value as UtmPresetKey)}
              >
                <option value="" disabled>
                  {t('app.generation.utm.choose_preset')}
                </option>
                {(['newsletter', 'social', 'paid', 'partner'] as const).map(key => (
                  <option key={key} value={key}>
                    {t(`app.generation.utm.preset.${key}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UtmInput
              id="utm-source"
              label={t('app.generation.utm.source')}
              value={formData.source}
              onChange={value => setFormData(prev => ({ ...prev, source: value }))}
              placeholder="newsletter"
              required
            />
            <UtmInput
              id="utm-medium"
              label={t('app.generation.utm.medium')}
              value={formData.medium}
              onChange={value => setFormData(prev => ({ ...prev, medium: value }))}
              placeholder="email"
              required
            />
            <UtmInput
              id="utm-campaign"
              label={t('app.generation.utm.campaign')}
              value={formData.campaign}
              onChange={value => setFormData(prev => ({ ...prev, campaign: value }))}
              placeholder="launch"
              required
            />
            <UtmInput
              id="utm-term"
              label={t('app.generation.utm.term')}
              value={formData.term}
              onChange={value => setFormData(prev => ({ ...prev, term: value }))}
              placeholder="keyword"
            />
            <UtmInput
              id="utm-content"
              label={t('app.generation.utm.content')}
              value={formData.content}
              onChange={value => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="button-a"
            />
            <UtmInput
              id="utm-id"
              label={t('app.generation.utm.id')}
              value={formData.id}
              onChange={value => setFormData(prev => ({ ...prev, id: value }))}
              placeholder="spring-2026"
            />
            <div className="flex items-end">
              <Checkbox
                checked={autoNormalize}
                onChange={event => setAutoNormalize(event.target.checked)}
                label={t('app.generation.utm.auto_normalize')}
              />
            </div>
          </div>

          {requiredMissing && (
            <p className="text-sm text-[var(--warning)]">{t('app.generation.utm.required')}</p>
          )}
          {result.error && (
            <p className="text-sm text-[var(--error)]">
              {t(
                result.error === 'scheme'
                  ? 'app.generation.utm.unsupported_scheme'
                  : 'app.generation.utm.invalid'
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.utm.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.utm.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value)}
              placeholder={t('app.generation.utm.workspace_placeholder')}
              className="min-h-[180px] font-mono text-sm"
              spellCheck={false}
            />

            <div className="grid grid-cols-3 gap-3">
              <UtmMetric label={t('app.generation.utm.metric.valid_urls')} value={metrics.valid} />
              <UtmMetric
                label={t('app.generation.utm.metric.preserved_params')}
                value={metrics.preserved}
              />
              <UtmMetric
                label={t('app.generation.utm.metric.duplicates')}
                value={metrics.duplicates}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={!parsedPrimary}
                onClick={applyParsedUrl}
              >
                {t('app.generation.utm.use_parsed')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<Link2 className="h-4 w-4" />}
                disabled={!result.url}
                onClick={() => setWorkspace(result.url)}
              >
                {t('app.generation.utm.use_current')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>

            {parsedPrimary ? (
              <div className="space-y-3">
                <div className="glass-input rounded-2xl p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                    <span>{t('app.generation.utm.parsed')}</span>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 font-mono">
                      {parsedPrimary.protocol || '-'}
                    </span>
                  </div>
                  <code className="break-all font-mono text-sm leading-6 text-[var(--text-primary)]">
                    {parsedPrimary.baseUrl || parsedPrimary.original}
                  </code>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {UTM_PARAM_DEFINITIONS.map(item => (
                    <div
                      key={item.key}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2.5"
                    >
                      <span className="font-mono text-xs text-[var(--text-tertiary)]">
                        {item.key}
                      </span>
                      <span className="min-w-0 truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {parsedPrimary.utm[item.field] || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-base)] p-5 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.utm.parsed_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.utm.audit')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="utm-audit-search">{t('app.generation.utm.audit_search')}</Label>
              <Input
                id="utm-audit-search"
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.generation.utm.audit_search_placeholder')}
              />
            </div>
            <div className="space-y-2">
              {filteredAudits.map(item => (
                <AuditRow
                  key={`${item.key}-${item.subject}`}
                  item={item}
                  label={t(`app.generation.utm.audit.${item.key}`)}
                  levelLabel={t(`app.generation.utm.level.${item.level}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="flex min-h-[360px] flex-col overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.utm.result')}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!canCopy}
                  onClick={() => copy(result.url)}
                >
                  {t('public.copy')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canCopy}
                  onClick={() => copy(result.query)}
                >
                  {t('app.generation.utm.copy_query')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canCopy}
                  onClick={() => copy(jsonSummary)}
                >
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  onClick={() => copy(csvOutput)}
                >
                  {t('app.generation.utm.copy_csv')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() =>
                    downloadText(csvOutput, 'utm-variants.csv', 'text/csv;charset=utf-8')
                  }
                >
                  {t('app.generation.utm.download_csv')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {canCopy ? (
              <div className="space-y-4">
                <div className="glass-input rounded-2xl p-4">
                  <code className="break-all font-mono text-sm leading-6 text-[var(--text-primary)]">
                    {result.url}
                  </code>
                </div>
                <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--glass-panel-bg)]">
                      <tr>
                        <th className="px-3 py-2">{t('app.generation.utm.variant')}</th>
                        <th className="px-3 py-2">{t('app.generation.utm.content')}</th>
                        <th className="px-3 py-2">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map(row => (
                        <tr
                          key={`${row.source}-${row.medium}`}
                          className="border-t border-[var(--border-base)]"
                        >
                          <td className="px-3 py-2 font-mono">{row.source}</td>
                          <td className="px-3 py-2 font-mono">{row.content}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="block max-w-[420px] truncate font-mono text-xs text-[var(--primary)]"
                              onClick={() => copy(row.result.url)}
                            >
                              {row.result.url}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-48 items-center justify-center text-center">
                <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.generation.utm.empty')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.utm.summary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['utm_source', effectiveFormData.source],
              ['utm_medium', effectiveFormData.medium],
              ['utm_campaign', effectiveFormData.campaign],
              ['utm_term', effectiveFormData.term],
              ['utm_content', effectiveFormData.content],
              ['utm_id', effectiveFormData.id]
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2.5"
              >
                <span className="font-mono text-xs text-[var(--text-tertiary)]">{key}</span>
                <span className="min-w-0 truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {value || '-'}
                </span>
              </div>
            ))}
            <div className="glass-input rounded-xl p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <FileJson className="h-4 w-4" />
                {t('app.generation.utm.json_summary')}
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {jsonSummary}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const UtmInput = ({
  id,
  label,
  onChange,
  placeholder,
  required,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>
      {label}
      {required ? <span className="ml-1 text-[var(--warning)]">*</span> : null}
    </Label>
    <Input
      id={id}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="font-mono"
    />
  </div>
)

const UtmMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <p className="truncate text-xs font-medium text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

const getAuditColorClass = (level: AuditLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const AuditRow = ({
  item,
  label,
  levelLabel
}: {
  item: AuditItem
  label: string
  levelLabel: string
}) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="flex items-start gap-2">
      {item.level === 'good' ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${item.level === 'danger' ? 'text-[var(--error)]' : 'text-[var(--warning)]'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getAuditColorClass(item.level)}`}
          >
            {levelLabel}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
          {item.subject}
        </p>
      </div>
    </div>
  </div>
)

export default UtmBuilderClient
