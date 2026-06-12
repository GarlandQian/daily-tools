'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const INPUT_LIMIT = 36000
const ROW_LIMIT = 220
const RENDER_LIMIT = 48
const PROFILES = ['html', 'api', 'asset'] as const

type Profile = (typeof PROFILES)[number]
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey = 'secure_html' | 'api_private' | 'cors_risk' | 'legacy' | 'asset' | 'cross_origin'

interface Preset {
  key: PresetKey
  profile: Profile
  workspace: string
}

interface ParsedHeader {
  name: string
  normalized: string
  raw: string
  value: string
}

interface Finding {
  actionPath?: string
  key: string
  level: FindingLevel
  points: number
  subject: string
}

const BUILDER_PATHS: Record<string, string> = {
  'cache-control': '/converter/cache-control',
  cookie: '/converter/cookie',
  cors: '/converter/cors',
  csp: '/converter/csp',
  hsts: '/converter/hsts',
  isolation: '/converter/cross-origin-isolation',
  permissions: '/converter/permissions-policy',
  referrer: '/converter/referrer-policy'
}

const PRESETS: Preset[] = [
  {
    key: 'secure_html',
    profile: 'html',
    workspace: `HTTP/2 200
Content-Type: text/html; charset=utf-8
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Set-Cookie: session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax`
  },
  {
    key: 'api_private',
    profile: 'api',
    workspace: `HTTP/2 200
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Set-Cookie: __Host-auth=token; Path=/; HttpOnly; Secure; SameSite=Lax`
  },
  {
    key: 'cors_risk',
    profile: 'api',
    workspace: `HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Set-Cookie: session=abc123; Path=/; SameSite=None`
  },
  {
    key: 'legacy',
    profile: 'html',
    workspace: `HTTP/1.1 200 OK
Content-Type: text/html
X-XSS-Protection: 1; mode=block
X-Frame-Options: SAMEORIGIN
Referrer-Policy: unsafe-url`
  },
  {
    key: 'asset',
    profile: 'asset',
    workspace: `HTTP/2 200
Content-Type: text/javascript; charset=utf-8
Cache-Control: public, max-age=31536000, immutable
X-Content-Type-Options: nosniff
Cross-Origin-Resource-Policy: cross-origin`
  },
  {
    key: 'cross_origin',
    profile: 'html',
    workspace: `HTTP/2 200
Content-Type: text/html; charset=utf-8
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Resource-Policy: same-origin
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin`
  }
]

const normalizeName = (value: string) => value.trim().toLowerCase()

const parseHeaders = (input: string): ParsedHeader[] => {
  const rows: ParsedHeader[] = []

  for (const line of input.slice(0, INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || /^HTTP\/\d(?:\.\d)?\s+\d+/iu.test(trimmed)) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue

    const name = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!name || !value) continue

    rows.push({ name, normalized: normalizeName(name), raw: trimmed, value })
    if (rows.length >= ROW_LIMIT) break
  }

  return rows
}

const groupHeaders = (rows: ParsedHeader[]) => {
  const groups = new Map<string, ParsedHeader[]>()

  rows.forEach(row => {
    groups.set(row.normalized, [...(groups.get(row.normalized) ?? []), row])
  })

  return groups
}

const getHeader = (groups: Map<string, ParsedHeader[]>, name: string) =>
  groups.get(normalizeName(name))?.at(-1)?.value ?? ''
const getHeaders = (groups: Map<string, ParsedHeader[]>, name: string) =>
  groups.get(normalizeName(name)) ?? []
const hasHeader = (groups: Map<string, ParsedHeader[]>, name: string) =>
  Boolean(groups.get(normalizeName(name))?.length)
const lower = (value: string) => value.toLowerCase()

const getMaxAge = (value: string) => {
  const match = /max-age\s*=\s*(\d+)/iu.exec(value)
  return match ? Number(match[1]) : null
}

const hasDirective = (value: string, pattern: RegExp) => pattern.test(value)

const cookieName = (value: string) => value.split(';')[0]?.split('=')[0]?.trim() ?? ''

const addFinding = (
  findings: Finding[],
  level: FindingLevel,
  key: string,
  subject: string,
  points: number,
  actionPath?: string
) => {
  findings.push({ actionPath, key, level, points, subject })
}

const auditHeaders = (rows: ParsedHeader[], profile: Profile): Finding[] => {
  const groups = groupHeaders(rows)
  const findings: Finding[] = []
  const hsts = getHeader(groups, 'Strict-Transport-Security')
  const csp = getHeader(groups, 'Content-Security-Policy')
  const xcto = getHeader(groups, 'X-Content-Type-Options')
  const referrer = getHeader(groups, 'Referrer-Policy')
  const permissions = getHeader(groups, 'Permissions-Policy')
  const cache = getHeader(groups, 'Cache-Control')
  const xfo = getHeader(groups, 'X-Frame-Options')
  const acao = getHeader(groups, 'Access-Control-Allow-Origin')
  const acac = getHeader(groups, 'Access-Control-Allow-Credentials')
  const vary = getHeader(groups, 'Vary')
  const coop = getHeader(groups, 'Cross-Origin-Opener-Policy')
  const coep = getHeader(groups, 'Cross-Origin-Embedder-Policy')
  const corp = getHeader(groups, 'Cross-Origin-Resource-Policy')
  const cookies = getHeaders(groups, 'Set-Cookie')

  if (!rows.length) return [{ key: 'empty', level: 'warn', points: 0, subject: '-' }]

  if (profile !== 'asset') {
    if (!hsts) {
      addFinding(
        findings,
        'danger',
        'hsts_missing',
        'Strict-Transport-Security',
        0,
        BUILDER_PATHS.hsts
      )
    } else {
      const maxAge = getMaxAge(hsts)
      if (maxAge === null)
        addFinding(
          findings,
          'danger',
          'hsts_invalid',
          'Strict-Transport-Security',
          2,
          BUILDER_PATHS.hsts
        )
      else if (maxAge < 15552000)
        addFinding(findings, 'warn', 'hsts_short', `max-age=${maxAge}`, 6, BUILDER_PATHS.hsts)
      else
        addFinding(findings, 'good', 'hsts_ok', 'Strict-Transport-Security', 12, BUILDER_PATHS.hsts)

      if (/includesubdomains/iu.test(hsts))
        addFinding(findings, 'good', 'hsts_subdomains', 'includeSubDomains', 4, BUILDER_PATHS.hsts)
      else
        addFinding(
          findings,
          'warn',
          'hsts_no_subdomains',
          'includeSubDomains',
          1,
          BUILDER_PATHS.hsts
        )
    }
  }

  if (profile === 'html') {
    if (!csp) {
      addFinding(findings, 'danger', 'csp_missing', 'Content-Security-Policy', 0, BUILDER_PATHS.csp)
    } else {
      addFinding(findings, 'good', 'csp_present', 'Content-Security-Policy', 10, BUILDER_PATHS.csp)
      if (/unsafe-inline/iu.test(csp))
        addFinding(findings, 'warn', 'csp_unsafe_inline', 'unsafe-inline', -4, BUILDER_PATHS.csp)
      if (/unsafe-eval/iu.test(csp))
        addFinding(findings, 'danger', 'csp_unsafe_eval', 'unsafe-eval', -7, BUILDER_PATHS.csp)
      if (hasDirective(csp, /object-src\s+'none'/iu))
        addFinding(findings, 'good', 'csp_object_none', 'object-src', 3, BUILDER_PATHS.csp)
      else addFinding(findings, 'warn', 'csp_object_missing', 'object-src', 0, BUILDER_PATHS.csp)
      if (/frame-ancestors/iu.test(csp))
        addFinding(findings, 'good', 'csp_frame_ancestors', 'frame-ancestors', 3, BUILDER_PATHS.csp)
      else if (xfo) addFinding(findings, 'good', 'xfo_fallback', 'X-Frame-Options', 2)
      else
        addFinding(
          findings,
          'warn',
          'frame_protection_missing',
          'frame-ancestors',
          0,
          BUILDER_PATHS.csp
        )
    }
  }

  if (lower(xcto) === 'nosniff')
    addFinding(findings, 'good', 'nosniff_ok', 'X-Content-Type-Options', 8)
  else if (xcto) addFinding(findings, 'danger', 'nosniff_wrong', 'X-Content-Type-Options', 0)
  else addFinding(findings, 'danger', 'nosniff_missing', 'X-Content-Type-Options', 0)

  if (!referrer)
    addFinding(findings, 'warn', 'referrer_missing', 'Referrer-Policy', 1, BUILDER_PATHS.referrer)
  else if (lower(referrer).includes('unsafe-url'))
    addFinding(findings, 'danger', 'referrer_unsafe', referrer, -5, BUILDER_PATHS.referrer)
  else addFinding(findings, 'good', 'referrer_ok', 'Referrer-Policy', 5, BUILDER_PATHS.referrer)

  if (!permissions)
    addFinding(
      findings,
      'warn',
      'permissions_missing',
      'Permissions-Policy',
      1,
      BUILDER_PATHS.permissions
    )
  else if (/\*/u.test(permissions))
    addFinding(
      findings,
      'warn',
      'permissions_wildcard',
      'Permissions-Policy',
      0,
      BUILDER_PATHS.permissions
    )
  else
    addFinding(
      findings,
      'good',
      'permissions_ok',
      'Permissions-Policy',
      5,
      BUILDER_PATHS.permissions
    )

  if (profile === 'api') {
    if (/no-store|private/iu.test(cache))
      addFinding(
        findings,
        'good',
        'cache_private_ok',
        'Cache-Control',
        7,
        BUILDER_PATHS['cache-control']
      )
    else
      addFinding(
        findings,
        'warn',
        'cache_private_missing',
        'Cache-Control',
        0,
        BUILDER_PATHS['cache-control']
      )
  } else if (profile === 'asset') {
    if (/immutable/iu.test(cache) && (getMaxAge(cache) ?? 0) >= 2592000) {
      addFinding(
        findings,
        'good',
        'cache_asset_ok',
        'Cache-Control',
        7,
        BUILDER_PATHS['cache-control']
      )
    } else {
      addFinding(
        findings,
        'warn',
        'cache_asset_weak',
        'Cache-Control',
        1,
        BUILDER_PATHS['cache-control']
      )
    }
  }

  if (acao) {
    if (acao.trim() === '*' && lower(acac) === 'true') {
      addFinding(findings, 'danger', 'cors_wildcard_credentials', 'CORS', -8, BUILDER_PATHS.cors)
    } else {
      addFinding(findings, 'good', 'cors_origin_ok', 'CORS', 3, BUILDER_PATHS.cors)
    }

    if (acao.trim() !== '*' && !/origin/iu.test(vary)) {
      addFinding(findings, 'warn', 'cors_vary_missing', 'Vary: Origin', 0, BUILDER_PATHS.cors)
    }
  }

  cookies.forEach(cookie => {
    const cookieLower = lower(cookie.value)
    const name = cookieName(cookie.value)
    if (/;\s*secure\b/iu.test(cookie.value))
      addFinding(findings, 'good', 'cookie_secure', name, 2, BUILDER_PATHS.cookie)
    else addFinding(findings, 'danger', 'cookie_secure_missing', name, -4, BUILDER_PATHS.cookie)
    if (/session|auth|token|jwt/iu.test(name) && !/;\s*httponly\b/iu.test(cookie.value)) {
      addFinding(findings, 'danger', 'cookie_httponly_missing', name, -4, BUILDER_PATHS.cookie)
    }
    if (!/;\s*samesite=/iu.test(cookie.value))
      addFinding(findings, 'warn', 'cookie_samesite_missing', name, -1, BUILDER_PATHS.cookie)
    if (/samesite=none/iu.test(cookie.value) && !/;\s*secure\b/iu.test(cookie.value)) {
      addFinding(findings, 'danger', 'cookie_none_without_secure', name, -5, BUILDER_PATHS.cookie)
    }
    if (/httponly/iu.test(cookieLower))
      addFinding(findings, 'good', 'cookie_httponly', name, 1, BUILDER_PATHS.cookie)
  })

  if (coop || coep || corp) {
    if (lower(coop) === 'same-origin' && /require-corp|credentialless/iu.test(coep)) {
      addFinding(findings, 'good', 'isolation_ready', 'COOP/COEP', 5, BUILDER_PATHS.isolation)
    } else {
      addFinding(findings, 'warn', 'isolation_partial', 'COOP/COEP', 0, BUILDER_PATHS.isolation)
    }

    if (coep && !corp && lower(coep) === 'require-corp') {
      addFinding(
        findings,
        'warn',
        'corp_missing',
        'Cross-Origin-Resource-Policy',
        0,
        BUILDER_PATHS.isolation
      )
    }
  }

  if (hasHeader(groups, 'X-XSS-Protection'))
    addFinding(findings, 'warn', 'xss_protection_legacy', 'X-XSS-Protection', -2)
  if (hasHeader(groups, 'Server')) addFinding(findings, 'warn', 'server_disclosure', 'Server', -1)

  return findings
}

const getScore = (findings: Finding[]) => {
  const score = findings.reduce((total, finding) => total + finding.points, 55)
  return Math.max(0, Math.min(100, score))
}

const getGrade = (score: number) => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
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

const findingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function SecurityHeadersAuditClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [profile, setProfile] = useState<Profile>('html')
  const deferredWorkspace = useDeferredValue(workspace)

  const parsedHeaders = useMemo(() => parseHeaders(deferredWorkspace), [deferredWorkspace])
  const visibleParsedHeaders = useMemo(() => parsedHeaders.slice(0, RENDER_LIMIT), [parsedHeaders])
  const parsedHeadersLimited = parsedHeaders.length > visibleParsedHeaders.length
  const findings = useMemo(() => auditHeaders(parsedHeaders, profile), [parsedHeaders, profile])
  const score = useMemo(() => getScore(findings), [findings])
  const metrics = useMemo(() => {
    const danger = findings.filter(finding => finding.level === 'danger').length
    const warn = findings.filter(finding => finding.level === 'warn').length
    const good = findings.filter(finding => finding.level === 'good').length
    const unique = new Set(parsedHeaders.map(row => row.normalized)).size

    return {
      danger: String(danger),
      grade: getGrade(score),
      good: String(good),
      score: String(score),
      total: String(parsedHeaders.length),
      unique: String(unique),
      warn: String(warn)
    }
  }, [findings, parsedHeaders, score])
  const missingHeaders = useMemo(() => {
    const groups = groupHeaders(parsedHeaders)
    const required =
      profile === 'asset'
        ? ['Cache-Control', 'X-Content-Type-Options']
        : [
            'Strict-Transport-Security',
            'Content-Security-Policy',
            'X-Content-Type-Options',
            'Referrer-Policy'
          ]

    return required.filter(header => !hasHeader(groups, header))
  }, [parsedHeaders, profile])
  const remediation = useMemo(
    () =>
      [
        'X-Content-Type-Options: nosniff',
        'Referrer-Policy: strict-origin-when-cross-origin',
        'Permissions-Policy: camera=(), microphone=(), geolocation=()',
        profile === 'asset'
          ? 'Cache-Control: public, max-age=31536000, immutable'
          : 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
        profile === 'html'
          ? "Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
          : profile === 'api'
            ? 'Cache-Control: no-store'
            : ''
      ]
        .filter(Boolean)
        .join('\n'),
    [profile]
  )
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          profile,
          score,
          grade: metrics.grade,
          parsedHeaders,
          missingHeaders,
          findings
        },
        null,
        2
      ),
    [findings, metrics.grade, missingHeaders, parsedHeaders, profile, score]
  )
  const exportCsv = useMemo(
    () =>
      [
        ['level', 'subject', 'key', 'points', 'actionPath'],
        ...findings.map(finding => [
          finding.level,
          finding.subject,
          finding.key,
          String(finding.points),
          finding.actionPath ?? ''
        ])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [findings]
  )

  const applyPreset = (preset: Preset) => {
    setWorkspace(preset.workspace)
    setProfile(preset.profile)
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.security_headers.summary_title'),
        `${t('app.converter.security_headers.metric.score')}: ${metrics.score}`,
        `${t('app.converter.security_headers.metric.grade')}: ${metrics.grade}`,
        `${t('app.converter.security_headers.metric.danger')}: ${metrics.danger}`,
        `${t('app.converter.security_headers.metric.warn')}: ${metrics.warn}`
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
                {t('app.converter.security-headers-audit')}
              </div>
              <CardTitle className="mt-2 text-2xl">
                {t('app.converter.security-headers-audit')}
              </CardTitle>
              <CardDescription>{t('app.converter.security_headers.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.security_headers.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <HeaderMetric
              label={t('app.converter.security_headers.metric.score')}
              value={metrics.score}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.grade')}
              value={metrics.grade}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.total')}
              value={metrics.total}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.unique')}
              value={metrics.unique}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.danger')}
              value={metrics.danger}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.warn')}
              value={metrics.warn}
            />
            <HeaderMetric
              label={t('app.converter.security_headers.metric.good')}
              value={metrics.good}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.security_headers.presets')}
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
                {t(`app.converter.security_headers.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.security_headers.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.security_headers.workspace')}
                </CardTitle>
                <CardDescription>
                  {t('app.converter.security_headers.workspace_hint')}
                </CardDescription>
              </div>
              <div className="w-full space-y-3 md:w-56">
                <Label htmlFor="security-header-profile">
                  {t('app.converter.security_headers.profile')}
                </Label>
                <Select
                  id="security-header-profile"
                  value={profile}
                  onChange={event => setProfile(event.target.value as Profile)}
                >
                  {PROFILES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.converter.security_headers.profile.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, INPUT_LIMIT))}
              placeholder={t('app.converter.security_headers.workspace_placeholder')}
              className="min-h-[320px] font-mono"
            />
            <InputCapNotice visible={workspace.length >= INPUT_LIMIT} limit={INPUT_LIMIT} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(exportJson)}>
                <Copy className="h-4 w-4" />
                {t('app.converter.security_headers.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(exportCsv, 'security-headers-audit.csv', 'text/csv;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.security_headers.download_csv')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.security_headers.findings')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {findings.slice(0, 14).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${findingClass(finding.level)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.security_headers.audit.${finding.key}`)}
                    </div>
                    <span className="font-mono">
                      {finding.points > 0 ? `+${finding.points}` : finding.points}
                    </span>
                  </div>
                  {finding.actionPath ? (
                    <a
                      href={finding.actionPath}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      {t('app.converter.security_headers.open_builder')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">
                {t('app.converter.security_headers.remediation')}
              </CardTitle>
              <CardDescription>
                {t('app.converter.security_headers.remediation_hint')}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => copy(remediation)}>
              <Copy className="h-4 w-4" />
              {t('public.copy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea readOnly value={remediation} className="min-h-[150px] font-mono" />
          {missingHeaders.length ? (
            <div className="flex flex-wrap gap-2">
              {missingHeaders.map(header => (
                <span
                  key={header}
                  className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700"
                >
                  {header}
                </span>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-4 text-sm text-[var(--text-secondary)]">
              {t('app.converter.security_headers.no_missing')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.security_headers.parsed')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {parsedHeaders.length ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleParsedHeaders.map((row, index) => (
                  <div key={`${row.raw}:${index}`} className="glass-input rounded-xl p-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {row.name}
                    </p>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
              {parsedHeadersLimited && (
                <p className="mt-3 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.output_preview_rows_limited', {
                    total: parsedHeaders.length.toLocaleString(),
                    visible: visibleParsedHeaders.length.toLocaleString()
                  })}
                </p>
              )}
            </>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.security_headers.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
