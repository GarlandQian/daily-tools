'use client'

import {
  ClipboardCheck,
  Cookie,
  Copy,
  Download,
  FileCode2,
  FlaskConical,
  ListChecks,
  Search,
  ShieldCheck,
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

const ATTRIBUTE_GROUPS = ['all', 'security', 'scope', 'lifetime', 'client'] as const
const OUTPUT_TYPES = ['raw', 'next', 'express', 'nginx', 'document', 'json'] as const
const SAME_SITE_VALUES = ['Lax', 'Strict', 'None'] as const
const COOKIE_INPUT_LIMIT = 28000
const COOKIE_ROW_LIMIT = 120

type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type SameSiteValue = (typeof SAME_SITE_VALUES)[number]
type PresetKey = 'session' | 'auth' | 'csrf' | 'preferences' | 'analytics' | 'delete'
type FindingLevel = 'good' | 'warn' | 'danger'

interface CookieDraft {
  domain: string
  httpOnly: boolean
  maxAge: string
  name: string
  partitioned: boolean
  path: string
  sameSite: SameSiteValue
  secure: boolean
  value: string
}

interface AttributeInfo {
  example: string
  group: Exclude<AttributeGroup, 'all'>
  name: string
  note: string
}

interface Preset {
  draft: CookieDraft
  key: PresetKey
  workspace: string
}

interface ParsedCookie {
  attributes: Record<string, string | true>
  name: string
  raw: string
  value: string
}

interface Finding {
  cookie: string
  key: string
  level: FindingLevel
}

const ATTRIBUTE_REFERENCE: AttributeInfo[] = [
  {
    name: 'Secure',
    example: 'Secure',
    group: 'security',
    note: 'Sends the cookie only over HTTPS.'
  },
  {
    name: 'HttpOnly',
    example: 'HttpOnly',
    group: 'security',
    note: 'Prevents JavaScript from reading the cookie.'
  },
  {
    name: 'SameSite',
    example: 'SameSite=Lax',
    group: 'security',
    note: 'Controls whether the cookie is sent with cross-site requests.'
  },
  {
    name: 'Path',
    example: 'Path=/',
    group: 'scope',
    note: 'Limits the request path where the cookie is included.'
  },
  {
    name: 'Domain',
    example: 'Domain=example.com',
    group: 'scope',
    note: 'Scopes the cookie to a host or parent domain.'
  },
  {
    name: 'Max-Age',
    example: 'Max-Age=3600',
    group: 'lifetime',
    note: 'Sets cookie lifetime in seconds.'
  },
  {
    name: 'Expires',
    example: 'Expires=Tue, 09 Jun 2026 12:00:00 GMT',
    group: 'lifetime',
    note: 'Sets an absolute expiration date.'
  },
  {
    name: 'Partitioned',
    example: 'Partitioned',
    group: 'client',
    note: 'Stores the cookie in partitioned browser storage.'
  }
]

const DEFAULT_DRAFT: CookieDraft = {
  domain: '',
  httpOnly: true,
  maxAge: '3600',
  name: 'session',
  partitioned: false,
  path: '/',
  sameSite: 'Lax',
  secure: true,
  value: 'abc123'
}

const PRESETS: Preset[] = [
  {
    key: 'session',
    draft: DEFAULT_DRAFT,
    workspace: 'Set-Cookie: session=abc123; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax'
  },
  {
    key: 'auth',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '604800',
      name: '__Host-auth',
      value: 'token'
    },
    workspace:
      'Set-Cookie: __Host-auth=token; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax'
  },
  {
    key: 'csrf',
    draft: {
      ...DEFAULT_DRAFT,
      httpOnly: false,
      maxAge: '7200',
      name: 'csrf_token',
      sameSite: 'Strict',
      value: 'nonce'
    },
    workspace: 'Set-Cookie: csrf_token=nonce; Path=/; Max-Age=7200; Secure; SameSite=Strict'
  },
  {
    key: 'preferences',
    draft: {
      ...DEFAULT_DRAFT,
      httpOnly: false,
      maxAge: '31536000',
      name: 'prefs',
      value: 'theme.dark'
    },
    workspace: 'Set-Cookie: prefs=theme.dark; Path=/; Max-Age=31536000; Secure; SameSite=Lax'
  },
  {
    key: 'analytics',
    draft: {
      ...DEFAULT_DRAFT,
      domain: 'example.com',
      httpOnly: false,
      maxAge: '31536000',
      name: 'cid',
      sameSite: 'None',
      value: 'client-123'
    },
    workspace:
      'Set-Cookie: cid=client-123; Domain=example.com; Path=/; Max-Age=31536000; Secure; SameSite=None'
  },
  {
    key: 'delete',
    draft: {
      ...DEFAULT_DRAFT,
      maxAge: '0',
      name: 'session',
      value: ''
    },
    workspace:
      'Set-Cookie: session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
  }
]

const normalizeName = (value: string) => value.trim()

const buildSetCookie = (draft: CookieDraft) => {
  const parts = [`${normalizeName(draft.name) || 'cookie'}=${draft.value}`]

  if (draft.domain.trim()) parts.push(`Domain=${draft.domain.trim()}`)
  if (draft.path.trim()) parts.push(`Path=${draft.path.trim()}`)
  if (draft.maxAge.trim()) parts.push(`Max-Age=${draft.maxAge.trim()}`)
  if (draft.httpOnly) parts.push('HttpOnly')
  if (draft.secure) parts.push('Secure')
  if (draft.sameSite) parts.push(`SameSite=${draft.sameSite}`)
  if (draft.partitioned) parts.push('Partitioned')

  return parts.join('; ')
}

const parseCookieLine = (line: string): ParsedCookie | null => {
  const normalized = line.trim().replace(/^set-cookie:\s*/iu, '')
  if (!normalized) return null
  const segments = normalized
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
  const [nameValue, ...attributeSegments] = segments
  const separator = nameValue.indexOf('=')
  if (separator <= 0) return null

  const attributes: ParsedCookie['attributes'] = {}

  for (const segment of attributeSegments) {
    const attributeSeparator = segment.indexOf('=')
    if (attributeSeparator === -1) {
      attributes[segment.toLowerCase()] = true
    } else {
      attributes[segment.slice(0, attributeSeparator).toLowerCase()] = segment
        .slice(attributeSeparator + 1)
        .trim()
    }
  }

  return {
    attributes,
    name: nameValue.slice(0, separator).trim(),
    raw: normalized,
    value: nameValue.slice(separator + 1).trim()
  }
}

const parseCookieWorkspace = (input: string) => {
  const rows: ParsedCookie[] = []
  const seen = new Set<string>()

  for (const line of input.slice(0, COOKIE_INPUT_LIMIT).split(/\r?\n/u)) {
    const parsed = parseCookieLine(line)
    if (!parsed) continue
    const key = `${parsed.name}:${parsed.raw}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(parsed)
    if (rows.length >= COOKIE_ROW_LIMIT) break
  }

  return rows
}

const hasAttribute = (cookie: ParsedCookie, name: string) => cookie.attributes[name] !== undefined

const attributeValue = (cookie: ParsedCookie, name: string) => {
  const value = cookie.attributes[name]
  return typeof value === 'string' ? value : ''
}

const auditCookies = (cookies: ParsedCookie[]): Finding[] => {
  const findings: Finding[] = []

  for (const cookie of cookies) {
    const lowerName = cookie.name.toLowerCase()
    const sameSite = attributeValue(cookie, 'samesite').toLowerCase()
    const maxAge = attributeValue(cookie, 'max-age')
    const domain = attributeValue(cookie, 'domain')

    if (hasAttribute(cookie, 'secure'))
      findings.push({ cookie: cookie.name, key: 'secure_ok', level: 'good' })
    else findings.push({ cookie: cookie.name, key: 'secure_missing', level: 'danger' })

    if (hasAttribute(cookie, 'httponly'))
      findings.push({ cookie: cookie.name, key: 'httponly_ok', level: 'good' })
    else if (/session|auth|token|jwt/u.test(lowerName)) {
      findings.push({ cookie: cookie.name, key: 'httponly_missing', level: 'danger' })
    }

    if (sameSite === 'none' && !hasAttribute(cookie, 'secure')) {
      findings.push({ cookie: cookie.name, key: 'none_without_secure', level: 'danger' })
    } else if (sameSite) {
      findings.push({ cookie: cookie.name, key: 'samesite_ok', level: 'good' })
    } else {
      findings.push({ cookie: cookie.name, key: 'samesite_missing', level: 'warn' })
    }

    if (!hasAttribute(cookie, 'path'))
      findings.push({ cookie: cookie.name, key: 'path_missing', level: 'warn' })

    if (domain.startsWith('.'))
      findings.push({ cookie: cookie.name, key: 'wide_domain', level: 'warn' })

    if (hasAttribute(cookie, 'partitioned') && !hasAttribute(cookie, 'secure')) {
      findings.push({ cookie: cookie.name, key: 'partitioned_without_secure', level: 'danger' })
    }

    if (cookie.name.startsWith('__Host-')) {
      if (hasAttribute(cookie, 'secure') && attributeValue(cookie, 'path') === '/' && !domain) {
        findings.push({ cookie: cookie.name, key: 'host_prefix_ok', level: 'good' })
      } else {
        findings.push({ cookie: cookie.name, key: 'host_prefix_invalid', level: 'danger' })
      }
    }

    if (cookie.name.startsWith('__Secure-') && !hasAttribute(cookie, 'secure')) {
      findings.push({ cookie: cookie.name, key: 'secure_prefix_invalid', level: 'danger' })
    }

    if (maxAge === '0' || /1970/u.test(attributeValue(cookie, 'expires'))) {
      findings.push({ cookie: cookie.name, key: 'deletion_cookie', level: 'good' })
    } else if (!maxAge && !hasAttribute(cookie, 'expires')) {
      findings.push({ cookie: cookie.name, key: 'session_lifetime', level: 'warn' })
    }
  }

  return findings.length ? findings : [{ cookie: '-', key: 'empty', level: 'warn' }]
}

const buildOutput = (draft: CookieDraft, outputType: OutputType) => {
  const header = buildSetCookie(draft)
  const safeName = normalizeName(draft.name) || 'cookie'

  switch (outputType) {
    case 'document':
      return `document.cookie = ${JSON.stringify(header.replace(/; HttpOnly/giu, ''))}`
    case 'express':
      return `res.cookie(${JSON.stringify(safeName)}, ${JSON.stringify(draft.value)}, {
  httpOnly: ${draft.httpOnly},
  secure: ${draft.secure},
  sameSite: ${JSON.stringify(draft.sameSite.toLowerCase())},
  path: ${JSON.stringify(draft.path || '/')}${draft.domain ? `,\n  domain: ${JSON.stringify(draft.domain)}` : ''}${
    draft.maxAge ? `,\n  maxAge: ${Number(draft.maxAge) * 1000}` : ''
  }
})`
    case 'json':
      return JSON.stringify(draft, null, 2)
    case 'next':
      return `response.cookies.set(${JSON.stringify(safeName)}, ${JSON.stringify(draft.value)}, {
  httpOnly: ${draft.httpOnly},
  secure: ${draft.secure},
  sameSite: ${JSON.stringify(draft.sameSite.toLowerCase())},
  path: ${JSON.stringify(draft.path || '/')}${draft.domain ? `,\n  domain: ${JSON.stringify(draft.domain)}` : ''}${
    draft.maxAge ? `,\n  maxAge: ${draft.maxAge}` : ''
  }
})`
    case 'nginx':
      return `add_header Set-Cookie "${header.replaceAll('"', '\\"')}" always;`
    case 'raw':
    default:
      return `Set-Cookie: ${header}`
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

export default function CookieClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CookieDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('raw')
  const [query, setQuery] = useState('security')
  const [group, setGroup] = useState<AttributeGroup>('all')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredQuery = useDeferredValue(query)
  const deferredWorkspace = useDeferredValue(workspace)

  const generatedHeader = useMemo(() => buildSetCookie(draft), [draft])
  const output = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const parsedCookies = useMemo(() => parseCookieWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditCookies(parsedCookies), [parsedCookies])
  const filteredAttributes = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return ATTRIBUTE_REFERENCE.filter(attribute => {
      const matchesGroup = group === 'all' || attribute.group === group
      const matchesQuery =
        !normalized ||
        attribute.name.toLowerCase().includes(normalized) ||
        attribute.example.toLowerCase().includes(normalized) ||
        attribute.note.toLowerCase().includes(normalized) ||
        attribute.group.includes(normalized)

      return matchesGroup && matchesQuery
    })
  }, [deferredQuery, group])
  const metrics = useMemo(() => {
    const secure = parsedCookies.filter(cookie => hasAttribute(cookie, 'secure')).length
    const httpOnly = parsedCookies.filter(cookie => hasAttribute(cookie, 'httponly')).length
    const persistent = parsedCookies.filter(
      cookie => hasAttribute(cookie, 'max-age') || hasAttribute(cookie, 'expires')
    ).length
    const dangerous = findings.filter(finding => finding.level === 'danger').length

    return { dangerous, httpOnly, persistent, secure, total: parsedCookies.length }
  }, [findings, parsedCookies])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          metrics,
          cookies: parsedCookies,
          findings
        },
        null,
        2
      ),
    [findings, metrics, parsedCookies]
  )
  const exportCsv = useMemo(
    () =>
      [
        'name,value,secure,httpOnly,sameSite,path,domain,maxAge',
        ...parsedCookies.map(cookie =>
          [
            cookie.name,
            cookie.value,
            hasAttribute(cookie, 'secure'),
            hasAttribute(cookie, 'httponly'),
            attributeValue(cookie, 'samesite'),
            attributeValue(cookie, 'path'),
            attributeValue(cookie, 'domain'),
            attributeValue(cookie, 'max-age')
          ]
            .map(escapeCsv)
            .join(',')
        )
      ].join('\n'),
    [parsedCookies]
  )
  const summary = useMemo(
    () =>
      [
        t('app.converter.cookie.summary_title'),
        `${t('app.converter.cookie.metric.total')}: ${metrics.total}`,
        `${t('app.converter.cookie.metric.secure')}: ${metrics.secure}`,
        `${t('app.converter.cookie.metric.httponly')}: ${metrics.httpOnly}`,
        `${t('app.converter.cookie.metric.issues')}: ${metrics.dangerous}`,
        `Set-Cookie: ${generatedHeader}`
      ].join('\n'),
    [generatedHeader, metrics, t]
  )

  const loadPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setQuery(preset.key)
    setGroup('all')
  }

  const updateDraft = <Key extends keyof CookieDraft>(key: Key, value: CookieDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Cookie className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.cookie')}
              </CardTitle>
              <CardDescription>{t('app.converter.cookie.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.cookie.copy_summary')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(output)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <CookieMetric
              label={t('app.converter.cookie.metric.total')}
              value={String(metrics.total)}
            />
            <CookieMetric
              label={t('app.converter.cookie.metric.secure')}
              value={String(metrics.secure)}
            />
            <CookieMetric
              label={t('app.converter.cookie.metric.httponly')}
              value={String(metrics.httpOnly)}
            />
            <CookieMetric
              label={t('app.converter.cookie.metric.persistent')}
              value={String(metrics.persistent)}
            />
            <CookieMetric
              label={t('app.converter.cookie.metric.issues')}
              value={String(metrics.dangerous)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FlaskConical className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.cookie.presets')}
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
                    {t(`app.converter.cookie.preset.${preset.key}`)}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.cookie.preset.${preset.key}_hint`)}
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
            <CardTitle className="text-base">{t('app.converter.cookie.builder')}</CardTitle>
            <CardDescription>{t('app.converter.cookie.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CookieInput
                label={t('app.converter.cookie.name')}
                value={draft.name}
                onChange={value => updateDraft('name', value)}
              />
              <CookieInput
                label={t('app.converter.cookie.value')}
                value={draft.value}
                onChange={value => updateDraft('value', value)}
              />
              <CookieInput
                label={t('app.converter.cookie.domain')}
                value={draft.domain}
                onChange={value => updateDraft('domain', value)}
              />
              <CookieInput
                label={t('app.converter.cookie.path')}
                value={draft.path}
                onChange={value => updateDraft('path', value)}
              />
              <CookieInput
                label={t('app.converter.cookie.max_age')}
                value={draft.maxAge}
                onChange={value => updateDraft('maxAge', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="cookie-samesite">{t('app.converter.cookie.same_site')}</Label>
                <Select
                  id="cookie-samesite"
                  value={draft.sameSite}
                  onChange={event => updateDraft('sameSite', event.target.value as SameSiteValue)}
                >
                  {SAME_SITE_VALUES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <CookieBoolean
                label={t('app.converter.cookie.secure')}
                value={draft.secure}
                onChange={value => updateDraft('secure', value)}
              />
              <CookieBoolean
                label={t('app.converter.cookie.http_only')}
                value={draft.httpOnly}
                onChange={value => updateDraft('httpOnly', value)}
              />
              <CookieBoolean
                label={t('app.converter.cookie.partitioned')}
                value={draft.partitioned}
                onChange={value => updateDraft('partitioned', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="cookie-output-type">{t('app.converter.cookie.output_type')}</Label>
                <Select
                  id="cookie-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.cookie.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cookie.output_preview')}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setWorkspace(`Set-Cookie: ${generatedHeader}`)}
              >
                {t('app.converter.cookie.use_output')}
              </Button>
            </div>
            <Textarea
              value={output}
              readOnly
              rows={8}
              className="min-h-[190px] resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">{t('app.converter.cookie.workspace')}</CardTitle>
                <CardDescription>{t('app.converter.cookie.workspace_hint')}</CardDescription>
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
              onChange={event => setWorkspace(event.target.value.slice(0, COOKIE_INPUT_LIMIT))}
              rows={10}
              className="min-h-[220px] resize-y font-mono"
            />

            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.cookie.audit')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {findings.slice(0, 8).map((finding, index) => (
                  <div
                    key={`${finding.cookie}:${finding.key}:${index}`}
                    className="glass-input rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span
                      className={`mr-2 inline-block h-2 w-2 rounded-full ${findingColor(finding.level)}`}
                    />
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {finding.cookie}
                    </span>
                    <span className="mx-2 text-[var(--text-tertiary)]">/</span>
                    {t(`app.converter.cookie.audit.${finding.key}`)}
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
                {t('app.converter.cookie.parsed')}
              </CardTitle>
              <CardDescription>{t('app.converter.cookie.parsed_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(exportJson)}
              >
                {t('app.converter.cookie.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(exportCsv, 'daily-tools-cookies.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.converter.cookie.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="space-y-3">
              <Label htmlFor="cookie-search">{t('app.converter.cookie.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="cookie-search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Secure, SameSite, Max-Age"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="cookie-group">{t('app.converter.cookie.group')}</Label>
              <Select
                id="cookie-group"
                value={group}
                onChange={event => setGroup(event.target.value as AttributeGroup)}
              >
                {ATTRIBUTE_GROUPS.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.cookie.group.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filteredAttributes.map(attribute => (
              <button
                key={attribute.name}
                type="button"
                onClick={() => setQuery(attribute.name)}
                className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {attribute.name}
                  </p>
                  <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                    {t(`app.converter.cookie.group.${attribute.group}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {attribute.note}
                </p>
                <p className="mt-2 break-all rounded-lg bg-[var(--bg-muted)] px-2 py-1 font-mono text-xs text-[var(--text-secondary)]">
                  {attribute.example}
                </p>
              </button>
            ))}
          </div>

          {parsedCookies.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedCookies.map(cookie => (
                <div key={cookie.raw} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {cookie.name}
                    </p>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {Object.keys(cookie.attributes).length}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {cookie.value || '-'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.keys(cookie.attributes).map(attribute => (
                      <span
                        key={attribute}
                        className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                      >
                        {attribute}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.cookie.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const CookieMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const CookieInput = ({
  label,
  onChange,
  value
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) => {
  const id = `cookie-${label.replace(/\W+/gu, '-').toLowerCase()}`

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
    </div>
  )
}

const CookieBoolean = ({
  label,
  onChange,
  value
}: {
  label: string
  onChange: (value: boolean) => void
  value: boolean
}) => {
  const { t } = useTranslation()
  const id = `cookie-${label.replace(/\W+/gu, '-').toLowerCase()}`

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
