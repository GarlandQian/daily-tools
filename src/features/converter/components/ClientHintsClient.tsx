'use client'

import {
  Copy,
  Download,
  FileJson,
  Fingerprint,
  Gauge,
  RotateCcw,
  ShieldCheck,
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

type AuditSeverity = 'error' | 'ok' | 'warn'
type HintGroup = 'device' | 'network' | 'preference' | 'ua' | 'viewport'
type OutputFormat = 'cloudflare' | 'csv' | 'headers' | 'json' | 'next' | 'nginx'

interface HintDefinition {
  deprecated?: boolean
  group: HintGroup
  highEntropy?: boolean
  legacyAlias?: boolean
  policy: string
  token: string
}

interface ClientHintsDraft {
  critical: string[]
  includeClearClientHints: boolean
  includePermissions: boolean
  includeVary: boolean
  origins: string
  routePattern: string
  selected: string[]
  siteOrigin: string
}

interface ClientHintsPreset {
  key: string
  value: ClientHintsDraft
  workspace: string
}

interface AuditItem {
  detail?: string
  key: string
  severity: AuditSeverity
  title: string
}

interface ParsedHeaders {
  acceptCh: string[]
  acceptChLifetime: string
  clearSiteData: string
  criticalCh: string[]
  permissionsPolicy: string
  raw: Array<{ name: string; value: string }>
  requestHints: Array<{ name: string; value: string }>
  vary: string[]
}

const MAX_WORKSPACE_LENGTH = 14000

const HINTS: HintDefinition[] = [
  { group: 'ua', policy: 'ch-ua', token: 'Sec-CH-UA' },
  { group: 'ua', policy: 'ch-ua-mobile', token: 'Sec-CH-UA-Mobile' },
  { group: 'ua', policy: 'ch-ua-platform', token: 'Sec-CH-UA-Platform' },
  { group: 'ua', highEntropy: true, policy: 'ch-ua-arch', token: 'Sec-CH-UA-Arch' },
  { group: 'ua', highEntropy: true, policy: 'ch-ua-bitness', token: 'Sec-CH-UA-Bitness' },
  {
    group: 'ua',
    deprecated: true,
    highEntropy: true,
    policy: 'ch-ua-full-version',
    token: 'Sec-CH-UA-Full-Version'
  },
  {
    group: 'ua',
    highEntropy: true,
    policy: 'ch-ua-full-version-list',
    token: 'Sec-CH-UA-Full-Version-List'
  },
  { group: 'ua', highEntropy: true, policy: 'ch-ua-model', token: 'Sec-CH-UA-Model' },
  {
    group: 'ua',
    highEntropy: true,
    policy: 'ch-ua-platform-version',
    token: 'Sec-CH-UA-Platform-Version'
  },
  { group: 'ua', highEntropy: true, policy: 'ch-ua-wow64', token: 'Sec-CH-UA-WoW64' },
  { group: 'ua', highEntropy: true, policy: 'ch-ua-form-factors', token: 'Sec-CH-UA-Form-Factors' },
  { group: 'viewport', legacyAlias: true, policy: 'ch-dpr', token: 'DPR' },
  { group: 'viewport', policy: 'ch-dpr', token: 'Sec-CH-DPR' },
  { group: 'viewport', legacyAlias: true, policy: 'ch-width', token: 'Width' },
  { group: 'viewport', policy: 'ch-width', token: 'Sec-CH-Width' },
  { group: 'viewport', legacyAlias: true, policy: 'ch-viewport-width', token: 'Viewport-Width' },
  { group: 'viewport', policy: 'ch-viewport-width', token: 'Sec-CH-Viewport-Width' },
  {
    group: 'viewport',
    highEntropy: true,
    policy: 'ch-viewport-height',
    token: 'Sec-CH-Viewport-Height'
  },
  {
    group: 'device',
    highEntropy: true,
    legacyAlias: true,
    policy: 'ch-device-memory',
    token: 'Device-Memory'
  },
  { group: 'device', highEntropy: true, policy: 'ch-device-memory', token: 'Sec-CH-Device-Memory' },
  { group: 'network', highEntropy: true, policy: 'ch-downlink', token: 'Downlink' },
  { group: 'network', highEntropy: true, policy: 'ch-ect', token: 'ECT' },
  { group: 'network', highEntropy: true, policy: 'ch-rtt', token: 'RTT' },
  { group: 'network', policy: 'ch-save-data', token: 'Save-Data' },
  { group: 'preference', policy: 'ch-prefers-color-scheme', token: 'Sec-CH-Prefers-Color-Scheme' },
  {
    group: 'preference',
    policy: 'ch-prefers-reduced-motion',
    token: 'Sec-CH-Prefers-Reduced-Motion'
  },
  {
    group: 'preference',
    policy: 'ch-prefers-reduced-transparency',
    token: 'Sec-CH-Prefers-Reduced-Transparency'
  },
  { group: 'preference', policy: 'ch-prefers-contrast', token: 'Sec-CH-Prefers-Contrast' },
  { group: 'preference', policy: 'ch-forced-colors', token: 'Sec-CH-Forced-Colors' }
]

const HINT_BY_TOKEN = new Map(HINTS.map(hint => [hint.token.toLowerCase(), hint]))
const OUTPUT_FORMATS: OutputFormat[] = ['headers', 'next', 'nginx', 'cloudflare', 'json', 'csv']

const DEFAULT_DRAFT: ClientHintsDraft = {
  critical: ['Viewport-Width', 'DPR'],
  includeClearClientHints: false,
  includePermissions: true,
  includeVary: true,
  origins: 'self\nhttps://cdn.example.com',
  routePattern: '/images/*',
  selected: [
    'Sec-CH-UA',
    'Sec-CH-UA-Mobile',
    'Sec-CH-UA-Platform',
    'Viewport-Width',
    'DPR',
    'Width'
  ],
  siteOrigin: 'https://example.com'
}

const PRESETS: ClientHintsPreset[] = [
  {
    key: 'responsive_images',
    value: DEFAULT_DRAFT,
    workspace: [
      'Accept-CH: Viewport-Width, DPR, Width',
      'Critical-CH: Viewport-Width, DPR',
      'Vary: Viewport-Width, DPR, Width',
      'Permissions-Policy: ch-viewport-width=(self "https://cdn.example.com"), ch-dpr=(self "https://cdn.example.com"), ch-width=(self "https://cdn.example.com")'
    ].join('\n')
  },
  {
    key: 'ua_reduction',
    value: {
      critical: [],
      includeClearClientHints: false,
      includePermissions: false,
      includeVary: true,
      origins: 'self',
      routePattern: '/app/*',
      selected: ['Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform'],
      siteOrigin: 'https://example.com'
    },
    workspace: [
      'Accept-CH: Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform',
      'Vary: Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform',
      'Sec-CH-UA: "Chromium";v="126", "Not A Brand";v="99"',
      'Sec-CH-UA-Mobile: ?0',
      'Sec-CH-UA-Platform: "macOS"'
    ].join('\n')
  },
  {
    key: 'preference',
    value: {
      critical: ['Sec-CH-Prefers-Color-Scheme'],
      includeClearClientHints: false,
      includePermissions: true,
      includeVary: true,
      origins: 'self',
      routePattern: '/theme/*',
      selected: [
        'Sec-CH-Prefers-Color-Scheme',
        'Sec-CH-Prefers-Reduced-Motion',
        'Sec-CH-Prefers-Contrast'
      ],
      siteOrigin: 'https://example.com'
    },
    workspace: [
      'Accept-CH: Sec-CH-Prefers-Color-Scheme, Sec-CH-Prefers-Reduced-Motion, Sec-CH-Prefers-Contrast',
      'Critical-CH: Sec-CH-Prefers-Color-Scheme',
      'Vary: Sec-CH-Prefers-Color-Scheme, Sec-CH-Prefers-Reduced-Motion, Sec-CH-Prefers-Contrast'
    ].join('\n')
  },
  {
    key: 'cdn_delegation',
    value: {
      critical: ['Viewport-Width'],
      includeClearClientHints: false,
      includePermissions: true,
      includeVary: true,
      origins: 'self\nhttps://img.example-cdn.com',
      routePattern: '/_next/image*',
      selected: ['Viewport-Width', 'DPR', 'Width', 'Save-Data'],
      siteOrigin: 'https://shop.example'
    },
    workspace: [
      'Accept-CH: Viewport-Width, DPR, Width, Save-Data',
      'Critical-CH: Viewport-Width',
      'Vary: Viewport-Width, DPR, Width, Save-Data',
      'Permissions-Policy: ch-viewport-width=(self "https://img.example-cdn.com"), ch-dpr=(self "https://img.example-cdn.com"), ch-width=(self "https://img.example-cdn.com"), ch-save-data=(self "https://img.example-cdn.com")'
    ].join('\n')
  },
  {
    key: 'fingerprint_risk',
    value: {
      critical: ['Sec-CH-UA-Full-Version-List', 'Sec-CH-UA-Model'],
      includeClearClientHints: true,
      includePermissions: true,
      includeVary: false,
      origins: '*',
      routePattern: '/tracking/*',
      selected: [
        'Sec-CH-UA-Full-Version-List',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Arch',
        'Sec-CH-UA-WoW64',
        'Sec-CH-Device-Memory',
        'Downlink',
        'Sec-CH-UA-Full-Version'
      ],
      siteOrigin: 'http://example.com'
    },
    workspace: [
      'Accept-CH: Sec-CH-UA-Full-Version-List, Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Sec-CH-Device-Memory, Downlink, Sec-CH-UA-Full-Version',
      'Critical-CH: Sec-CH-UA-Full-Version-List, Sec-CH-UA-Model, Sec-CH-UA-WoW64',
      'Accept-CH-Lifetime: 86400',
      'Clear-Site-Data: "clientHints"',
      'Permissions-Policy: ch-ua-model=*, ch-device-memory=*'
    ].join('\n')
  }
]

const splitList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const splitOrigins = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)

const normalizeHeaderName = (value: string) => value.toLowerCase()

const quotePermissionOrigin = (origin: string) => {
  if (origin === 'self' || origin === "'self'") return 'self'
  if (origin === '*') return '*'
  return `"${origin.replace(/"/g, '')}"`
}

const buildPermissionsPolicy = (tokens: string[], origins: string) => {
  const allowlist = splitOrigins(origins).map(quotePermissionOrigin)
  if (!allowlist.length) return ''

  return tokens
    .map(token => HINT_BY_TOKEN.get(token.toLowerCase()))
    .filter((hint): hint is HintDefinition => Boolean(hint))
    .map(hint => `${hint.policy}=(${allowlist.join(' ')})`)
    .join(', ')
}

const buildHeaders = (draft: ClientHintsDraft) => {
  const lines = [`Accept-CH: ${draft.selected.join(', ')}`]

  if (draft.critical.length) {
    lines.push(`Critical-CH: ${draft.critical.join(', ')}`)
  }

  if (draft.includeVary && draft.selected.length) {
    lines.push(`Vary: ${draft.selected.join(', ')}`)
  }

  if (draft.includeClearClientHints) {
    lines.push('Clear-Site-Data: "clientHints"')
  }

  if (draft.includePermissions) {
    const permissions = buildPermissionsPolicy(draft.selected, draft.origins)
    if (permissions) lines.push(`Permissions-Policy: ${permissions}`)
  }

  return lines
}

const buildOutput = (draft: ClientHintsDraft, format: OutputFormat) => {
  const lines = buildHeaders(draft)
  const headerObjects = lines.map(line => {
    const [name, ...valueParts] = line.split(':')
    return { key: name.trim(), value: valueParts.join(':').trim() }
  })

  if (format === 'next') {
    return [
      'export async function headers() {',
      '  return [',
      '    {',
      `      source: ${JSON.stringify(draft.routePattern || '/:path*')},`,
      `      headers: ${JSON.stringify(headerObjects, null, 8).replace(/\n/g, '\n      ')}`,
      '    }',
      '  ]',
      '}'
    ].join('\n')
  }

  if (format === 'nginx') {
    return headerObjects
      .map(header => `add_header ${header.key} ${JSON.stringify(header.value)} always;`)
      .join('\n')
  }

  if (format === 'cloudflare') {
    return [
      'export default {',
      '  async fetch(request, env, ctx) {',
      '    const response = await env.ASSETS.fetch(request)',
      '    const next = new Response(response.body, response)',
      ...headerObjects.map(
        header =>
          `    next.headers.set(${JSON.stringify(header.key)}, ${JSON.stringify(header.value)})`
      ),
      '    return next',
      '  }',
      '}'
    ].join('\n')
  }

  if (format === 'json') {
    return JSON.stringify(
      {
        headers: Object.fromEntries(headerObjects.map(header => [header.key, header.value])),
        highEntropy: draft.selected.filter(
          token => HINT_BY_TOKEN.get(token.toLowerCase())?.highEntropy
        ),
        routePattern: draft.routePattern,
        siteOrigin: draft.siteOrigin
      },
      null,
      2
    )
  }

  if (format === 'csv') {
    return [
      'name,value',
      ...headerObjects.map(
        header => `"${header.key.replace(/"/g, '""')}","${header.value.replace(/"/g, '""')}"`
      )
    ].join('\n')
  }

  return lines.join('\n')
}

const parseHeaders = (workspace: string): ParsedHeaders => {
  const raw: ParsedHeaders['raw'] = []
  const requestHints: ParsedHeaders['requestHints'] = []
  let acceptCh: string[] = []
  let acceptChLifetime = ''
  let clearSiteData = ''
  let criticalCh: string[] = []
  let permissionsPolicy = ''
  let vary: string[] = []

  workspace.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([^:#]+)\s*:\s*(.+)\s*$/)
    if (!match?.[1] || !match[2]) return

    const name = match[1].trim()
    const value = match[2].trim()
    const normalized = normalizeHeaderName(name)
    raw.push({ name, value })

    if (normalized === 'accept-ch') acceptCh = splitList(value)
    if (normalized === 'accept-ch-lifetime') acceptChLifetime = value
    if (normalized === 'clear-site-data') clearSiteData = value
    if (normalized === 'critical-ch') criticalCh = splitList(value)
    if (normalized === 'permissions-policy') permissionsPolicy = value
    if (normalized === 'vary') vary = splitList(value)
    if (
      normalized.startsWith('sec-ch-') ||
      [
        'device-memory',
        'downlink',
        'dpr',
        'ect',
        'rtt',
        'save-data',
        'viewport-width',
        'width'
      ].includes(normalized)
    ) {
      requestHints.push({ name, value })
    }
  })

  return {
    acceptCh,
    acceptChLifetime,
    clearSiteData,
    criticalCh,
    permissionsPolicy,
    raw,
    requestHints,
    vary
  }
}

const isHttpsOrigin = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
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

const ClientHintsClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ClientHintsDraft>(DEFAULT_DRAFT)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('headers')
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const deferredWorkspace = useDeferredValue(workspace)

  const output = useMemo(() => buildOutput(draft, outputFormat), [draft, outputFormat])
  const parsed = useMemo(() => parseHeaders(deferredWorkspace), [deferredWorkspace])
  const selectedSet = useMemo(() => new Set(draft.selected), [draft.selected])
  const criticalSet = useMemo(() => new Set(draft.critical), [draft.critical])
  const highEntropyCount = useMemo(
    () =>
      draft.selected.filter(token => HINT_BY_TOKEN.get(token.toLowerCase())?.highEntropy).length,
    [draft.selected]
  )
  const workspaceTruncated = workspace.length >= MAX_WORKSPACE_LENGTH

  const audits = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = []
    const selectedLower = new Set(draft.selected.map(token => token.toLowerCase()))
    const criticalMissing = draft.critical.filter(token => !selectedLower.has(token.toLowerCase()))
    const parsedAcceptLower = new Set(parsed.acceptCh.map(token => token.toLowerCase()))
    const parsedCriticalMissing = parsed.criticalCh.filter(
      token => !parsedAcceptLower.has(token.toLowerCase())
    )
    const parsedVaryLower = new Set(parsed.vary.map(token => token.toLowerCase()))
    const parsedVaryMissing = parsed.acceptCh.filter(
      token => !parsedVaryLower.has(token.toLowerCase())
    )
    const parsedCriticalVaryMissing = parsed.criticalCh.filter(
      token => !parsedVaryLower.has(token.toLowerCase())
    )
    const unknownAccept = parsed.acceptCh.filter(token => !HINT_BY_TOKEN.has(token.toLowerCase()))
    const deprecatedSelected = draft.selected.filter(
      token => HINT_BY_TOKEN.get(token.toLowerCase())?.deprecated
    )
    const cacheFragmentTokens = draft.selected.filter(token =>
      /Full-Version|Model|Device-Memory|Viewport|Width|DPR/.test(token)
    )

    if (!draft.selected.length) {
      items.push({
        key: 'none_selected',
        severity: 'error',
        title: t('app.converter.client_hints.audit.none_selected')
      })
    }

    if (!isHttpsOrigin(draft.siteOrigin)) {
      items.push({
        key: 'https',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.https_required'),
        detail: draft.siteOrigin
      })
    }

    if (highEntropyCount > 3) {
      items.push({
        key: 'high_entropy_count',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.high_entropy_count'),
        detail: `${highEntropyCount}`
      })
    }

    if (
      draft.selected.some(token => /Full-Version|Model|Platform-Version|Arch|Bitness/.test(token))
    ) {
      items.push({
        key: 'fingerprint',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.fingerprint')
      })
    }

    if (deprecatedSelected.length) {
      items.push({
        key: 'deprecated_hints',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.deprecated_hints'),
        detail: deprecatedSelected.join(', ')
      })
    }

    if (cacheFragmentTokens.length > 4) {
      items.push({
        key: 'cache_fragmentation',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.cache_fragmentation'),
        detail: cacheFragmentTokens.join(', ')
      })
    }

    if (criticalMissing.length) {
      items.push({
        key: 'critical_missing',
        severity: 'error',
        title: t('app.converter.client_hints.audit.critical_missing'),
        detail: criticalMissing.join(', ')
      })
    }

    if (draft.critical.length > 3) {
      items.push({
        key: 'too_many_critical',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.too_many_critical')
      })
    }

    if (!draft.includeVary && draft.selected.length) {
      items.push({
        key: 'vary_disabled',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.vary_disabled')
      })
    }

    if (draft.critical.length && draft.includeVary) {
      const selectedVary = new Set(draft.selected.map(token => token.toLowerCase()))
      const criticalVaryMissing = draft.critical.filter(
        token => !selectedVary.has(token.toLowerCase())
      )
      if (criticalVaryMissing.length) {
        items.push({
          key: 'critical_vary_missing',
          severity: 'error',
          title: t('app.converter.client_hints.audit.critical_vary_missing'),
          detail: criticalVaryMissing.join(', ')
        })
      }
    }

    if (draft.includePermissions && splitOrigins(draft.origins).includes('*')) {
      items.push({
        key: 'wildcard_policy',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.wildcard_policy')
      })
    }

    if (!draft.includePermissions && draft.origins.includes('http')) {
      items.push({
        key: 'delegation_missing',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.delegation_missing')
      })
    }

    if (parsed.acceptChLifetime) {
      items.push({
        key: 'lifetime_deprecated',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.lifetime_deprecated'),
        detail: parsed.acceptChLifetime
      })
    }

    if (draft.includeClearClientHints || /clientHints/i.test(parsed.clearSiteData)) {
      items.push({
        key: 'clear_client_hints',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.clear_client_hints')
      })
    }

    if (parsedCriticalMissing.length) {
      items.push({
        key: 'parsed_critical_missing',
        severity: 'error',
        title: t('app.converter.client_hints.audit.parsed_critical_missing'),
        detail: parsedCriticalMissing.join(', ')
      })
    }

    if (parsedVaryMissing.length) {
      items.push({
        key: 'parsed_vary_missing',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.parsed_vary_missing'),
        detail: parsedVaryMissing.join(', ')
      })
    }

    if (parsedCriticalVaryMissing.length) {
      items.push({
        key: 'parsed_critical_vary_missing',
        severity: 'error',
        title: t('app.converter.client_hints.audit.parsed_critical_vary_missing'),
        detail: parsedCriticalVaryMissing.join(', ')
      })
    }

    if (unknownAccept.length) {
      items.push({
        key: 'unknown_accept',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.unknown_accept'),
        detail: unknownAccept.join(', ')
      })
    }

    if (parsed.requestHints.length && !parsed.acceptCh.length) {
      items.push({
        key: 'request_only',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.request_only')
      })
    }

    if (!parsed.raw.length) {
      items.push({
        key: 'parse_missing',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.parse_missing')
      })
    } else {
      items.push({
        key: 'parse_ok',
        severity: 'ok',
        title: t('app.converter.client_hints.audit.parse_ok'),
        detail: `${parsed.raw.length}`
      })
    }

    if (workspaceTruncated) {
      items.push({
        key: 'workspace_truncated',
        severity: 'warn',
        title: t('app.converter.client_hints.audit.workspace_truncated'),
        detail: `${MAX_WORKSPACE_LENGTH}`
      })
    }

    if (!items.some(item => item.severity !== 'ok')) {
      items.push({
        key: 'baseline',
        severity: 'ok',
        title: t('app.converter.client_hints.audit.baseline_ok')
      })
    }

    return items
  }, [draft, highEntropyCount, parsed, t, workspaceTruncated])

  const counts = useMemo(
    () => ({
      error: audits.filter(item => item.severity === 'error').length,
      highEntropy: highEntropyCount,
      parsed: parsed.raw.length,
      selected: draft.selected.length,
      warn: audits.filter(item => item.severity === 'warn').length
    }),
    [audits, draft.selected.length, highEntropyCount, parsed.raw.length]
  )

  const handleToggleHint = useCallback((token: string) => {
    setDraft(prev => {
      const selected = prev.selected.includes(token)
        ? prev.selected.filter(item => item !== token)
        : [...prev.selected, token]
      const critical = prev.critical.filter(item => selected.includes(item))
      return { ...prev, critical, selected }
    })
  }, [])

  const handleToggleCritical = useCallback((token: string) => {
    setDraft(prev => ({
      ...prev,
      critical: prev.critical.includes(token)
        ? prev.critical.filter(item => item !== token)
        : prev.selected.includes(token)
          ? [...prev.critical, token]
          : prev.critical
    }))
  }, [])

  const handlePreset = useCallback((preset: ClientHintsPreset) => {
    setDraft(preset.value)
    setWorkspace(preset.workspace)
  }, [])

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setOutputFormat('headers')
    setWorkspace(PRESETS[0]?.workspace ?? '')
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.client_hints')}
              </CardTitle>
              <CardDescription>{t('app.converter.client_hints.description')}</CardDescription>
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
              label={t('app.converter.client_hints.metric.status')}
              value={
                counts.error
                  ? t('app.converter.client_hints.status.error')
                  : counts.warn
                    ? t('app.converter.client_hints.status.warn')
                    : t('app.converter.client_hints.status.ok')
              }
            />
            <Metric label={t('app.converter.client_hints.metric.hints')} value={counts.selected} />
            <Metric
              label={t('app.converter.client_hints.metric.high_entropy')}
              value={counts.highEntropy}
            />
            <Metric label={t('app.converter.client_hints.metric.parsed')} value={counts.parsed} />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handlePreset(preset)}
              >
                {t(`app.converter.client_hints.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.client_hints.builder')}</CardTitle>
            <CardDescription>{t('app.converter.client_hints.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="client-hints-origin">
                  {t('app.converter.client_hints.site_origin')}
                </Label>
                <Input
                  id="client-hints-origin"
                  value={draft.siteOrigin}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, siteOrigin: event.target.value.slice(0, 140) }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="client-hints-route">
                  {t('app.converter.client_hints.route_pattern')}
                </Label>
                <Input
                  id="client-hints-route"
                  value={draft.routePattern}
                  onChange={event =>
                    setDraft(prev => ({ ...prev, routePattern: event.target.value.slice(0, 120) }))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Checkbox
                checked={draft.includeVary}
                onChange={event =>
                  setDraft(prev => ({ ...prev, includeVary: event.target.checked }))
                }
                label={t('app.converter.client_hints.include_vary')}
              />
              <Checkbox
                checked={draft.includePermissions}
                onChange={event =>
                  setDraft(prev => ({ ...prev, includePermissions: event.target.checked }))
                }
                label={t('app.converter.client_hints.include_permissions')}
              />
              <Checkbox
                checked={draft.includeClearClientHints}
                onChange={event =>
                  setDraft(prev => ({ ...prev, includeClearClientHints: event.target.checked }))
                }
                label={t('app.converter.client_hints.include_clear')}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="client-hints-origins">
                {t('app.converter.client_hints.origins')}
              </Label>
              <Textarea
                id="client-hints-origins"
                value={draft.origins}
                onChange={event =>
                  setDraft(prev => ({ ...prev, origins: event.target.value.slice(0, 1800) }))
                }
                className="min-h-[110px] font-mono"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.client_hints.hints')}</Label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {HINTS.map(hint => {
                  const checked = selectedSet.has(hint.token)
                  return (
                    <div
                      key={hint.token}
                      className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Checkbox
                          checked={checked}
                          onChange={() => handleToggleHint(hint.token)}
                          label={hint.token}
                        />
                        <span className="rounded-full bg-[var(--glass-surface)] px-2 py-1 text-[10px] font-medium uppercase text-[var(--text-tertiary)]">
                          {t(`app.converter.client_hints.group.${hint.group}`)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Checkbox
                          checked={criticalSet.has(hint.token)}
                          disabled={!checked}
                          onChange={() => handleToggleCritical(hint.token)}
                          label={t('app.converter.client_hints.critical')}
                        />
                        {hint.highEntropy ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-600">
                            {t('app.converter.client_hints.high_entropy')}
                          </span>
                        ) : null}
                        {hint.deprecated ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-medium text-red-500">
                            {t('app.converter.client_hints.deprecated')}
                          </span>
                        ) : null}
                        {hint.legacyAlias ? (
                          <span className="rounded-full bg-[var(--glass-surface)] px-2 py-1 text-[10px] font-medium text-[var(--text-tertiary)]">
                            {t('app.converter.client_hints.legacy_alias')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.client_hints.workspace')}</CardTitle>
            <CardDescription>{t('app.converter.client_hints.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, MAX_WORKSPACE_LENGTH))}
              className="min-h-[300px] font-mono"
              spellCheck={false}
              placeholder={t('app.converter.client_hints.workspace_placeholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => setWorkspace(buildOutput(draft, 'headers'))}
              >
                {t('app.converter.client_hints.use_output')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setWorkspace('')}>
                {t('public.clear')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParsedBlock label="Accept-CH" value={parsed.acceptCh.join(', ') || '-'} />
              <ParsedBlock label="Critical-CH" value={parsed.criticalCh.join(', ') || '-'} />
              <ParsedBlock label="Vary" value={parsed.vary.join(', ') || '-'} />
              <ParsedBlock label="Clear-Site-Data" value={parsed.clearSiteData || '-'} />
              <ParsedBlock
                label={t('app.converter.client_hints.request_hints')}
                value={parsed.requestHints.map(item => item.name).join(', ') || '-'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.converter.client_hints.audit')}</CardTitle>
            <CardDescription>{t('app.converter.client_hints.audit_hint')}</CardDescription>
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
                    {t(`app.converter.client_hints.severity.${item.severity}`)}
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
            <CardTitle>{t('app.converter.client_hints.output')}</CardTitle>
            <CardDescription>{t('app.converter.client_hints.output_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="space-y-3">
                <Label htmlFor="client-hints-output">
                  {t('app.converter.client_hints.output_format')}
                </Label>
                <Select
                  id="client-hints-output"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  {OUTPUT_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.converter.client_hints.output.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(output)}
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
                    output,
                    outputFormat === 'csv' ? 'client-hints.csv' : 'client-hints.txt',
                    outputFormat === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'
                  )
                }
                className="self-end"
              >
                {t('app.converter.client_hints.download')}
              </Button>
            </div>

            <div className="glass-input min-h-[320px] rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <FileJson className="h-4 w-4" />
                {t(`app.converter.client_hints.output.${outputFormat}`)}
              </div>
              <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {output}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('app.converter.client_hints.reference')}</CardTitle>
          <CardDescription>{t('app.converter.client_hints.reference_hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(['accept_ch', 'critical_ch', 'vary', 'permissions', 'clear_site_data'] as const).map(
              key => (
                <div
                  key={key}
                  className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                    {t(`app.converter.client_hints.reference.${key}`)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {t(`app.converter.client_hints.reference.${key}_hint`)}
                  </p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
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

const ParsedBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3">
    <div className="text-xs font-medium text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">{value}</div>
  </div>
)

export default ClientHintsClient
