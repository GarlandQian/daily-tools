'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Globe2,
  Languages,
  Link2,
  ListChecks,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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

const QUERY_POLICIES = ['preserve', 'strip_tracking', 'strip_all', 'allowlist'] as const
const SLASH_POLICIES = ['ignore', 'remove', 'add'] as const
const OUTPUT_TYPES = ['html', 'headers', 'next', 'sitemap', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 80000
const ALTERNATE_INPUT_LIMIT = 24000
const ALTERNATE_LIMIT = 120
const CANONICAL_LINK_LIMIT = 120
const OUTPUT_PREVIEW_ALTERNATE_LIMIT = 60
const OUTPUT_PREVIEW_FINDING_LIMIT = 40
const OUTPUT_PREVIEW_CANONICAL_LIMIT = 8
const VISIBLE_FINDING_LIMIT = 22
const VISIBLE_ALTERNATE_LIMIT = 16
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'vero_id'
])

type QueryPolicy = (typeof QUERY_POLICIES)[number]
type SlashPolicy = (typeof SLASH_POLICIES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey = 'self' | 'query_cleanup' | 'hreflang' | 'pagination' | 'migration' | 'legacy_risk'
type AlternateSource = 'manual' | 'html' | 'http' | 'sitemap'

interface CanonicalDraft {
  allowedParams: string
  canonicalUrl: string
  defaultLocale: string
  locale: string
  noindex: boolean
  ogUrl: string
  pageUrl: string
  queryPolicy: QueryPolicy
  redirectedHint: boolean
  robotsBlocked: boolean
  slashPolicy: SlashPolicy
}

interface AlternateDraft {
  code: string
  url: string
}

interface AlternateRow {
  code: string
  raw: string
  source: AlternateSource
  url: string
  valid: boolean
}

interface ParsedLink {
  href: string
  raw: string
  source: 'html' | 'http'
}

interface ParsedWorkspace {
  alternates: AlternateRow[]
  canonicalLinks: ParsedLink[]
  ogUrl: string
  robotsNoindex: boolean
  sitemapUrls: string[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

interface Preset {
  alternates: string
  draft: CanonicalDraft
  key: PresetKey
  workspace: string
}

const DEFAULT_DRAFT: CanonicalDraft = {
  allowedParams: 'page, sort, q',
  canonicalUrl: 'https://www.example.com/docs/canonical-url',
  defaultLocale: 'en',
  locale: 'en',
  noindex: false,
  ogUrl: 'https://www.example.com/docs/canonical-url',
  pageUrl: 'https://www.example.com/docs/canonical-url',
  queryPolicy: 'strip_tracking',
  redirectedHint: false,
  robotsBlocked: false,
  slashPolicy: 'remove'
}

const PRESETS: Preset[] = [
  {
    key: 'self',
    draft: DEFAULT_DRAFT,
    alternates: [
      'en https://www.example.com/docs/canonical-url',
      'x-default https://www.example.com/docs/canonical-url'
    ].join('\n'),
    workspace: [
      '<link rel="canonical" href="https://www.example.com/docs/canonical-url">',
      '<link rel="alternate" hreflang="en" href="https://www.example.com/docs/canonical-url">',
      '<link rel="alternate" hreflang="x-default" href="https://www.example.com/docs/canonical-url">',
      '<meta property="og:url" content="https://www.example.com/docs/canonical-url">'
    ].join('\n')
  },
  {
    key: 'query_cleanup',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'https://www.example.com/products/widget?color=blue',
      ogUrl: 'https://www.example.com/products/widget?color=blue',
      pageUrl:
        'https://www.example.com/products/widget?utm_source=newsletter&fbclid=abc123&color=blue',
      queryPolicy: 'allowlist'
    },
    alternates: [
      'en https://www.example.com/products/widget?color=blue',
      'x-default https://www.example.com/products/widget?color=blue'
    ].join('\n'),
    workspace: [
      '<link rel="canonical" href="https://www.example.com/products/widget?utm_campaign=spring&color=blue">',
      '<meta property="og:url" content="https://www.example.com/products/widget?color=blue">'
    ].join('\n')
  },
  {
    key: 'hreflang',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'https://www.example.com/en/pricing',
      defaultLocale: 'en',
      locale: 'en',
      ogUrl: 'https://www.example.com/en/pricing',
      pageUrl: 'https://www.example.com/en/pricing'
    },
    alternates: [
      'en https://www.example.com/en/pricing',
      'zh-CN https://www.example.com/zh-cn/pricing',
      'ja https://www.example.com/ja/pricing',
      'x-default https://www.example.com/pricing'
    ].join('\n'),
    workspace: [
      '<link rel="canonical" href="https://www.example.com/en/pricing">',
      '<link rel="alternate" hreflang="en" href="https://www.example.com/en/pricing">',
      '<link rel="alternate" hreflang="zh-CN" href="https://www.example.com/zh-cn/pricing">',
      '<link rel="alternate" hreflang="ja" href="https://www.example.com/ja/pricing">',
      '<link rel="alternate" hreflang="x-default" href="https://www.example.com/pricing">'
    ].join('\n')
  },
  {
    key: 'pagination',
    draft: {
      ...DEFAULT_DRAFT,
      allowedParams: 'page',
      canonicalUrl: 'https://www.example.com/blog?page=2',
      ogUrl: 'https://www.example.com/blog?page=2',
      pageUrl: 'https://www.example.com/blog?page=2&utm_medium=email',
      queryPolicy: 'allowlist',
      slashPolicy: 'ignore'
    },
    alternates: [
      'en https://www.example.com/blog?page=2',
      'x-default https://www.example.com/blog?page=2'
    ].join('\n'),
    workspace: '<https://www.example.com/blog?page=2>; rel="canonical"'
  },
  {
    key: 'migration',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'https://www.example.com/docs/getting-started',
      defaultLocale: 'en',
      locale: 'en',
      ogUrl: 'https://www.example.com/docs/getting-started',
      pageUrl: 'https://old.example.com/docs/start.html',
      redirectedHint: true
    },
    alternates: [
      'en https://www.example.com/docs/getting-started',
      'de https://www.example.com/de/docs/getting-started',
      'x-default https://www.example.com/docs/getting-started'
    ].join('\n'),
    workspace: [
      '<link rel="canonical" href="https://old.example.com/docs/start.html">',
      '<link rel="alternate" hreflang="en" href="/docs/getting-started">'
    ].join('\n')
  },
  {
    key: 'legacy_risk',
    draft: {
      ...DEFAULT_DRAFT,
      canonicalUrl: 'http://Example.com/Product/?utm_source=ad#details',
      locale: 'en_US',
      noindex: true,
      ogUrl: 'https://example.com/product',
      pageUrl: 'https://example.com/Product/?utm_source=ad',
      queryPolicy: 'strip_all',
      robotsBlocked: true
    },
    alternates: [
      'en_US /Product/',
      'en https://example.com/product',
      'en https://example.com/product-sale',
      'fr https://example.com/product',
      'x-default https://example.com/product',
      'x-default https://example.com/home'
    ].join('\n'),
    workspace: [
      '<meta name="robots" content="noindex, follow">',
      '<link rel="canonical" href="http://Example.com/Product/?utm_source=ad#details">',
      '<link rel="canonical" href="https://example.com/product">',
      '<link rel="alternate" hreflang="en_US" href="/Product/">',
      '<meta property="og:url" content="https://example.com/product">'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['absolute', 'self', 'cluster', 'queries'] as const

const isTrackingParam = (name: string) => {
  const normalized = name.toLowerCase()
  return normalized.startsWith('utm_') || TRACKING_PARAMS.has(normalized)
}

const parseAllowedParams = (value: string) =>
  new Set(
    value
      .split(/[,\s]+/u)
      .map(item => item.trim())
      .filter(Boolean)
  )

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim())
  } catch {
    return null
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//iu.test(value.trim())

const isValidHreflang = (value: string) =>
  value === 'x-default' || /^[a-z]{2,3}(?:-[a-z]{2}|-[0-9]{3})?(?:-[a-z0-9]{2,8})*$/iu.test(value)

const normalizeCompareUrl = (value: string, ignoreSlash = false) => {
  const parsed = safeUrl(value)
  if (!parsed) return value.trim()

  const next = new URL(parsed.toString())
  next.hash = ''
  next.hostname = next.hostname.toLowerCase()

  const sortedParams = Array.from(next.searchParams.entries()).sort(([left], [right]) =>
    left.localeCompare(right)
  )
  next.search = ''
  sortedParams.forEach(([key, itemValue]) => next.searchParams.append(key, itemValue))

  if (ignoreSlash && next.pathname !== '/') {
    next.pathname = next.pathname.replace(/\/+$/u, '') || '/'
  }

  return next.toString()
}

const applyUrlPolicies = (value: string, draft: CanonicalDraft) => {
  const parsed = safeUrl(value)
  if (!parsed) return value.trim()

  const next = new URL(parsed.toString())
  next.hash = ''

  if (draft.queryPolicy === 'strip_all') {
    next.search = ''
  } else if (draft.queryPolicy === 'strip_tracking') {
    Array.from(next.searchParams.keys()).forEach(key => {
      if (isTrackingParam(key)) next.searchParams.delete(key)
    })
  } else if (draft.queryPolicy === 'allowlist') {
    const allowed = parseAllowedParams(draft.allowedParams)
    const kept = Array.from(next.searchParams.entries()).filter(([key]) => allowed.has(key))
    next.search = ''
    kept.forEach(([key, itemValue]) => next.searchParams.append(key, itemValue))
  }

  if (draft.slashPolicy === 'remove' && next.pathname !== '/') {
    next.pathname = next.pathname.replace(/\/+$/u, '') || '/'
  }

  if (draft.slashPolicy === 'add' && next.pathname !== '/' && !next.pathname.endsWith('/')) {
    const lastSegment = next.pathname.split('/').at(-1) ?? ''
    if (!lastSegment.includes('.')) next.pathname = `${next.pathname}/`
  }

  return next.toString()
}

const parseAlternateLines = (input: string, source: AlternateSource): AlternateRow[] => {
  const rows: AlternateRow[] = []

  input
    .slice(0, ALTERNATE_INPUT_LIMIT)
    .split(/\r?\n/u)
    .forEach(rawLine => {
      if (rows.length >= ALTERNATE_LIMIT) return
      const raw = rawLine.trim()
      if (!raw || raw.startsWith('#')) return
      const commaParts = raw
        .split(/[,\t]/u)
        .map(part => part.trim())
        .filter(Boolean)
      const parts = commaParts.length >= 2 ? commaParts : raw.split(/\s+/u)
      const code = parts[0] ?? ''
      const url = parts.slice(1).join(' ')

      rows.push({
        code,
        raw,
        source,
        url,
        valid: Boolean(code && url && isValidHreflang(code) && isAbsoluteHttpUrl(url))
      })
    })

  return rows
}

const sortAlternates = (rows: AlternateRow[]) =>
  [...rows].sort((left, right) => {
    if (left.code === 'x-default') return 1
    if (right.code === 'x-default') return -1
    return left.code.localeCompare(right.code)
  })

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const canonicalLinks: ParsedLink[] = []
  const alternates: AlternateRow[] = []
  const sitemapUrls: string[] = []
  let ogUrl = ''
  let robotsNoindex = false

  for (const match of source.matchAll(/<link\b[^>]*>/giu)) {
    const raw = match[0]
    const rel = getAttr(raw, 'rel').toLowerCase()
    const href = getAttr(raw, 'href')
    if (rel.includes('canonical') && canonicalLinks.length < CANONICAL_LINK_LIMIT) {
      canonicalLinks.push({ href, raw, source: 'html' })
    }
    if (rel.includes('alternate')) {
      const code = getAttr(raw, 'hreflang')
      if (code && href) {
        alternates.push({
          code,
          raw,
          source: 'html',
          url: href,
          valid: isValidHreflang(code) && isAbsoluteHttpUrl(href)
        })
      }
    }
    if (alternates.length >= ALTERNATE_LIMIT) break
  }

  for (const match of source.matchAll(/<meta\b[^>]*>/giu)) {
    const raw = match[0]
    const name = getAttr(raw, 'name').toLowerCase()
    const property = getAttr(raw, 'property').toLowerCase()
    const content = getAttr(raw, 'content')
    if ((name === 'robots' || name === 'googlebot') && /noindex/iu.test(content))
      robotsNoindex = true
    if (property === 'og:url' && content) ogUrl = content
  }

  for (const match of source.matchAll(/<([^>\r\n]+)>\s*;\s*rel="?([^";,\r\n]+)"?([^,\r\n]*)/giu)) {
    const href = (match[1] ?? '').trim()
    const rel = (match[2] ?? '').trim().toLowerCase()
    const tail = match[3] ?? ''
    const raw = match[0]
    if (rel === 'canonical' && canonicalLinks.length < CANONICAL_LINK_LIMIT) {
      canonicalLinks.push({ href, raw, source: 'http' })
    }
    if (rel === 'alternate') {
      const hreflang = tail.match(/hreflang="?([^";,\s]+)"?/iu)?.[1] ?? ''
      if (hreflang) {
        alternates.push({
          code: hreflang,
          raw,
          source: 'http',
          url: href,
          valid: isValidHreflang(hreflang) && isAbsoluteHttpUrl(href)
        })
      }
    }
  }

  for (const match of source.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)) {
    const url = (match[1] ?? '').trim()
    if (isAbsoluteHttpUrl(url)) sitemapUrls.push(url)
    if (sitemapUrls.length >= ALTERNATE_LIMIT) break
  }

  source.split(/\r?\n/u).forEach(line => {
    if (sitemapUrls.length >= ALTERNATE_LIMIT) return
    const trimmed = line.trim()
    if (/^https?:\/\//iu.test(trimmed)) sitemapUrls.push(trimmed)
  })

  return {
    alternates: alternates.slice(0, ALTERNATE_LIMIT),
    canonicalLinks,
    ogUrl,
    robotsNoindex,
    sitemapUrls: Array.from(new Set(sitemapUrls)).slice(0, ALTERNATE_LIMIT)
  }
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditCanonical = (
  draft: CanonicalDraft,
  canonicalUrl: string,
  alternates: AlternateRow[],
  parsed: ParsedWorkspace
): Finding[] => {
  const findings: Finding[] = []
  const sourceCanonical = safeUrl(draft.canonicalUrl || draft.pageUrl)
  const canonical = safeUrl(canonicalUrl)
  const page = safeUrl(draft.pageUrl)
  const ogUrl = draft.ogUrl.trim() || parsed.ogUrl

  if (!canonicalUrl.trim()) {
    addFinding(findings, 'danger', 'missing_canonical', '-')
  } else if (!canonical) {
    addFinding(findings, 'danger', 'invalid_canonical', canonicalUrl)
  } else {
    if (canonical.protocol !== 'http:' && canonical.protocol !== 'https:') {
      addFinding(findings, 'danger', 'invalid_scheme', canonicalUrl)
    }
    if (canonical.protocol === 'http:')
      addFinding(findings, 'danger', 'http_canonical', canonicalUrl)
    if (canonical.hash) addFinding(findings, 'warn', 'fragment', canonical.hash)
    if (Array.from(canonical.searchParams.keys()).some(isTrackingParam)) {
      addFinding(findings, 'warn', 'tracking_query', canonical.search)
    }
    if (draft.queryPolicy === 'strip_all' && canonical.search) {
      addFinding(findings, 'warn', 'query_present', canonical.search)
    }
    if (draft.queryPolicy === 'allowlist') {
      const allowed = parseAllowedParams(draft.allowedParams)
      const extraParams = Array.from(canonical.searchParams.keys()).filter(key => !allowed.has(key))
      if (extraParams.length)
        addFinding(findings, 'warn', 'query_not_allowed', extraParams.join(', '))
    }
    if (
      draft.slashPolicy === 'remove' &&
      canonical.pathname !== '/' &&
      canonical.pathname.endsWith('/')
    ) {
      addFinding(findings, 'warn', 'slash_remove', canonical.pathname)
    }
    if (
      draft.slashPolicy === 'add' &&
      canonical.pathname !== '/' &&
      !canonical.pathname.endsWith('/')
    ) {
      const lastSegment = canonical.pathname.split('/').at(-1) ?? ''
      if (!lastSegment.includes('.')) addFinding(findings, 'warn', 'slash_add', canonical.pathname)
    }
    if (/^https?:\/\/[^/\s]*[A-Z]/u.test(draft.canonicalUrl)) {
      addFinding(findings, 'warn', 'uppercase_host', draft.canonicalUrl)
    }
    if (/^https?:\/\/[^/\s]+:(80|443)(\/|$)/iu.test(draft.canonicalUrl)) {
      addFinding(findings, 'warn', 'default_port', draft.canonicalUrl)
    }
    if (page) {
      if (page.protocol === 'https:' && canonical.protocol === 'http:') {
        addFinding(findings, 'danger', 'mixed_protocol', canonicalUrl)
      }
      if (page.hostname.replace(/^www\./iu, '') !== canonical.hostname.replace(/^www\./iu, '')) {
        addFinding(findings, 'warn', 'host_mismatch', `${page.hostname} -> ${canonical.hostname}`)
      }
      if (
        normalizeCompareUrl(draft.pageUrl, draft.slashPolicy !== 'ignore') !==
        normalizeCompareUrl(canonicalUrl, draft.slashPolicy !== 'ignore')
      ) {
        addFinding(findings, 'warn', 'self_mismatch', canonicalUrl)
      } else {
        addFinding(findings, 'good', 'self_canonical', canonicalUrl)
      }
    }
  }

  if (sourceCanonical?.hash && !canonical?.hash) {
    addFinding(findings, 'warn', 'fragment', sourceCanonical.hash)
  }
  if (
    sourceCanonical &&
    Array.from(sourceCanonical.searchParams.keys()).some(isTrackingParam) &&
    !canonical?.searchParams.size
  ) {
    addFinding(findings, 'warn', 'tracking_query', sourceCanonical.search)
  }

  if (draft.noindex || parsed.robotsNoindex)
    addFinding(findings, 'warn', 'noindex_conflict', 'robots')
  if (draft.robotsBlocked) addFinding(findings, 'danger', 'robots_blocked', 'robots.txt')
  if (draft.redirectedHint) addFinding(findings, 'warn', 'redirect_hint', canonicalUrl)

  if (parsed.canonicalLinks.length > 1) {
    addFinding(findings, 'danger', 'duplicate_canonical', String(parsed.canonicalLinks.length))
  }
  parsed.canonicalLinks.forEach(link => {
    if (link.href && !isAbsoluteHttpUrl(link.href))
      addFinding(findings, 'warn', 'relative_canonical', link.href)
    if (
      link.href &&
      canonicalUrl &&
      normalizeCompareUrl(link.href, true) !== normalizeCompareUrl(canonicalUrl, true)
    ) {
      addFinding(findings, 'warn', 'parsed_canonical_conflict', link.href)
    }
  })

  if (
    ogUrl &&
    canonicalUrl &&
    normalizeCompareUrl(ogUrl, true) !== normalizeCompareUrl(canonicalUrl, true)
  ) {
    addFinding(findings, 'warn', 'og_conflict', ogUrl)
  }

  if (!alternates.length) {
    addFinding(findings, 'warn', 'hreflang_empty', '-')
  } else {
    addFinding(findings, 'good', 'hreflang_present', String(alternates.length))
  }

  const byCode = new Map<string, Set<string>>()
  const byUrl = new Map<string, Set<string>>()

  alternates.forEach(row => {
    const normalizedCode = row.code.trim()
    const normalizedUrl = normalizeCompareUrl(row.url, true)
    const codeSet = byCode.get(normalizedCode) ?? new Set<string>()
    codeSet.add(normalizedUrl)
    byCode.set(normalizedCode, codeSet)

    const urlSet = byUrl.get(normalizedUrl) ?? new Set<string>()
    urlSet.add(normalizedCode)
    byUrl.set(normalizedUrl, urlSet)

    if (!isValidHreflang(normalizedCode))
      addFinding(findings, 'danger', 'invalid_hreflang', normalizedCode || row.raw)
    if (normalizedCode.includes('_'))
      addFinding(findings, 'warn', 'underscore_hreflang', normalizedCode)
    if (!isAbsoluteHttpUrl(row.url))
      addFinding(findings, 'danger', 'alternate_relative', row.url || row.raw)
    if (safeUrl(row.url)?.protocol === 'http:')
      addFinding(findings, 'warn', 'alternate_http', row.url)
  })

  byCode.forEach((urls, code) => {
    if (urls.size > 1) addFinding(findings, 'danger', 'duplicate_hreflang', code)
  })

  byUrl.forEach((codes, url) => {
    if (codes.size > 1 && !codes.has('x-default'))
      addFinding(findings, 'warn', 'duplicate_alternate_url', url)
  })

  const xDefaultCount = alternates.filter(row => row.code === 'x-default').length
  if (alternates.length && xDefaultCount === 0)
    addFinding(findings, 'warn', 'missing_x_default', 'x-default')
  if (xDefaultCount > 1) addFinding(findings, 'danger', 'duplicate_x_default', 'x-default')

  const localeCodes = new Set(alternates.map(row => row.code))
  if (alternates.length && draft.locale && !localeCodes.has(draft.locale)) {
    addFinding(findings, 'warn', 'missing_self_hreflang', draft.locale)
  }
  if (alternates.length && canonicalUrl) {
    const canonicalCompare = normalizeCompareUrl(canonicalUrl, true)
    if (!alternates.some(row => normalizeCompareUrl(row.url, true) === canonicalCompare)) {
      addFinding(findings, 'warn', 'canonical_not_in_hreflang', canonicalUrl)
    } else {
      addFinding(findings, 'good', 'canonical_in_hreflang', canonicalUrl)
    }
  }

  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', canonicalUrl)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length

  return Math.max(0, Math.min(100, 90 + good * 2 - warn * 6 - danger * 16))
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

const buildHtml = (canonicalUrl: string, alternates: AlternateRow[]) =>
  [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    ...sortAlternates(alternates)
      .filter(row => row.url && row.code)
      .map(
        row =>
          `<link rel="alternate" hreflang="${escapeHtml(row.code)}" href="${escapeHtml(row.url)}">`
      )
  ].join('\n')

const buildHeaders = (canonicalUrl: string, alternates: AlternateRow[]) =>
  [
    `<${canonicalUrl}>; rel="canonical"`,
    ...sortAlternates(alternates)
      .filter(row => row.url && row.code)
      .map(row => `<${row.url}>; rel="alternate"; hreflang="${row.code}"`)
  ].join(',\n')

const buildNextMetadata = (
  draft: CanonicalDraft,
  canonicalUrl: string,
  alternates: AlternateRow[]
) => {
  const languageRows = sortAlternates(alternates)
    .filter(row => row.url && row.code)
    .map(row => `      '${escapeJs(row.code)}': '${escapeJs(row.url)}'`)
    .join(',\n')

  return `export const metadata = {
  alternates: {
    canonical: '${escapeJs(canonicalUrl)}',
    languages: {
${languageRows || "      'x-default': '" + escapeJs(canonicalUrl) + "'"}
    }
  },
  openGraph: {
    url: '${escapeJs(draft.ogUrl.trim() || canonicalUrl)}'
  },
  robots: {
    index: ${!draft.noindex},
    follow: true
  }
}`
}

const buildSitemap = (canonicalUrl: string, alternates: AlternateRow[]) =>
  [
    '<url>',
    `  <loc>${escapeHtml(canonicalUrl)}</loc>`,
    ...sortAlternates(alternates)
      .filter(row => row.url && row.code)
      .map(
        row =>
          `  <xhtml:link rel="alternate" hreflang="${escapeHtml(row.code)}" href="${escapeHtml(row.url)}" />`
      ),
    '</url>'
  ].join('\n')

const buildCsv = (alternates: AlternateRow[]) =>
  [
    ['hreflang', 'url', 'source', 'valid'],
    ...alternates.map(row => [row.code, row.url, row.source, String(row.valid)])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const buildOutput = (
  draft: CanonicalDraft,
  canonicalUrl: string,
  alternates: AlternateRow[],
  findings: Finding[],
  parsed: ParsedWorkspace,
  outputType: OutputType
) => {
  if (outputType === 'headers') return buildHeaders(canonicalUrl, alternates)
  if (outputType === 'next') return buildNextMetadata(draft, canonicalUrl, alternates)
  if (outputType === 'sitemap') return buildSitemap(canonicalUrl, alternates)
  if (outputType === 'json') {
    return JSON.stringify(
      {
        alternates,
        canonicalUrl,
        findings,
        pageUrl: draft.pageUrl,
        parsed,
        queryPolicy: draft.queryPolicy,
        slashPolicy: draft.slashPolicy
      },
      null,
      2
    )
  }
  if (outputType === 'csv') return buildCsv(alternates)
  return buildHtml(canonicalUrl, alternates)
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

export default function CanonicalUrlClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CanonicalDraft>(DEFAULT_DRAFT)
  const [alternateDraft, setAlternateDraft] = useState<AlternateDraft>({
    code: 'en',
    url: 'https://www.example.com/docs/canonical-url'
  })
  const [alternateInput, setAlternateInput] = useState(PRESETS[0].alternates)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')

  const deferredAlternates = useDeferredValue(alternateInput)
  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)

  const parsedWorkspace = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const manualAlternates = useMemo(
    () => parseAlternateLines(deferredAlternates, 'manual'),
    [deferredAlternates]
  )
  const activeAlternates = manualAlternates.length ? manualAlternates : parsedWorkspace.alternates
  const canonicalUrl = useMemo(
    () => applyUrlPolicies(draft.canonicalUrl || draft.pageUrl, draft),
    [draft]
  )
  const findings = useMemo(
    () => auditCanonical(draft, canonicalUrl, activeAlternates, parsedWorkspace),
    [activeAlternates, canonicalUrl, draft, parsedWorkspace]
  )
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewAlternates = useMemo(
    () => activeAlternates.slice(0, OUTPUT_PREVIEW_ALTERNATE_LIMIT),
    [activeAlternates]
  )
  const outputPreviewFindings = useMemo(
    () => findings.slice(0, OUTPUT_PREVIEW_FINDING_LIMIT),
    [findings]
  )
  const outputPreviewParsedWorkspace = useMemo<ParsedWorkspace>(
    () => ({
      alternates: parsedWorkspace.alternates.slice(0, OUTPUT_PREVIEW_ALTERNATE_LIMIT),
      canonicalLinks: parsedWorkspace.canonicalLinks.slice(0, OUTPUT_PREVIEW_CANONICAL_LIMIT),
      ogUrl: parsedWorkspace.ogUrl,
      robotsNoindex: parsedWorkspace.robotsNoindex,
      sitemapUrls: parsedWorkspace.sitemapUrls.slice(0, OUTPUT_PREVIEW_ALTERNATE_LIMIT)
    }),
    [parsedWorkspace]
  )
  const outputPreviewSource = useMemo(
    () =>
      buildOutput(
        draft,
        canonicalUrl,
        outputPreviewAlternates,
        outputPreviewFindings,
        outputPreviewParsedWorkspace,
        outputType
      ),
    [
      canonicalUrl,
      draft,
      outputPreviewAlternates,
      outputPreviewFindings,
      outputPreviewParsedWorkspace,
      outputType
    ]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited =
    activeAlternates.length > outputPreviewAlternates.length ||
    findings.length > outputPreviewFindings.length ||
    parsedWorkspace.alternates.length > outputPreviewParsedWorkspace.alternates.length ||
    parsedWorkspace.canonicalLinks.length > outputPreviewParsedWorkspace.canonicalLinks.length ||
    parsedWorkspace.sitemapUrls.length > outputPreviewParsedWorkspace.sitemapUrls.length
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, canonicalUrl, activeAlternates, findings, parsedWorkspace, outputType),
    [activeAlternates, canonicalUrl, draft, findings, outputType, parsedWorkspace]
  )
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.subject} ${item.key} ${t(`app.converter.canonical_url.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, VISIBLE_FINDING_LIMIT),
    [filteredFindings]
  )
  const findingsLimited = filteredFindings.length > visibleFindings.length
  const visibleAlternates = useMemo(
    () => activeAlternates.slice(0, VISIBLE_ALTERNATE_LIMIT),
    [activeAlternates]
  )
  const alternatesLimited = activeAlternates.length > visibleAlternates.length
  const metrics = useMemo(
    () => ({
      alternates: String(activeAlternates.length),
      canonical: String(parsedWorkspace.canonicalLinks.length || 1),
      critical: String(findings.filter(item => item.level === 'danger').length),
      score: String(score),
      urls: String(parsedWorkspace.sitemapUrls.length),
      warnings: String(findings.filter(item => item.level === 'warn').length)
    }),
    [
      activeAlternates.length,
      findings,
      parsedWorkspace.canonicalLinks.length,
      parsedWorkspace.sitemapUrls.length,
      score
    ]
  )

  const updateDraft = <Key extends keyof CanonicalDraft>(key: Key, value: CanonicalDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setAlternateInput(preset.alternates)
    setWorkspace(preset.workspace)
    const firstAlternate = parseAlternateLines(preset.alternates, 'manual')[0]
    if (firstAlternate) setAlternateDraft({ code: firstAlternate.code, url: firstAlternate.url })
  }

  const appendAlternate = () => {
    const line = `${alternateDraft.code.trim()} ${alternateDraft.url.trim()}`
    setAlternateInput(current =>
      [current.trim(), line].filter(Boolean).join('\n').slice(0, ALTERNATE_INPUT_LIMIT)
    )
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.canonical_url.summary_title'),
        `${t('app.converter.canonical_url.metric.score')}: ${metrics.score}`,
        `${t('app.converter.canonical_url.metric.alternates')}: ${metrics.alternates}`,
        `${t('app.converter.canonical_url.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.canonical_url.metric.critical')}: ${metrics.critical}`
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
                <Globe2 className="h-4 w-4" />
                {t('app.converter.canonical-url')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.canonical-url')}</CardTitle>
              <CardDescription>{t('app.converter.canonical_url.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={copySummary}
              className="w-full shrink-0 sm:w-auto"
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.canonical_url.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.canonical_url.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.canonical_url.metric.canonical')}
              value={metrics.canonical}
            />
            <Metric
              label={t('app.converter.canonical_url.metric.alternates')}
              value={metrics.alternates}
            />
            <Metric label={t('app.converter.canonical_url.metric.urls')} value={metrics.urls} />
            <Metric
              label={t('app.converter.canonical_url.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.canonical_url.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.canonical_url.presets')}</CardTitle>
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
                {t(`app.converter.canonical_url.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.canonical_url.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(380px,1.04fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.canonical_url.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.canonical_url.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="canonical-page">{t('app.converter.canonical_url.page_url')}</Label>
                <Input
                  id="canonical-page"
                  value={draft.pageUrl}
                  onChange={event => updateDraft('pageUrl', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="canonical-target">
                  {t('app.converter.canonical_url.canonical_url')}
                </Label>
                <Input
                  id="canonical-target"
                  value={draft.canonicalUrl}
                  onChange={event => updateDraft('canonicalUrl', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical-locale">{t('app.converter.canonical_url.locale')}</Label>
                <Input
                  id="canonical-locale"
                  value={draft.locale}
                  onChange={event => updateDraft('locale', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical-default-locale">
                  {t('app.converter.canonical_url.default_locale')}
                </Label>
                <Input
                  id="canonical-default-locale"
                  value={draft.defaultLocale}
                  onChange={event => updateDraft('defaultLocale', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="canonical-og">{t('app.converter.canonical_url.og_url')}</Label>
                <Input
                  id="canonical-og"
                  value={draft.ogUrl}
                  onChange={event => updateDraft('ogUrl', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical-query-policy">
                  {t('app.converter.canonical_url.query_policy')}
                </Label>
                <Select
                  id="canonical-query-policy"
                  value={draft.queryPolicy}
                  onChange={event => updateDraft('queryPolicy', event.target.value as QueryPolicy)}
                >
                  {QUERY_POLICIES.map(policy => (
                    <option key={policy} value={policy}>
                      {t(`app.converter.canonical_url.query.${policy}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical-slash-policy">
                  {t('app.converter.canonical_url.slash_policy')}
                </Label>
                <Select
                  id="canonical-slash-policy"
                  value={draft.slashPolicy}
                  onChange={event => updateDraft('slashPolicy', event.target.value as SlashPolicy)}
                >
                  {SLASH_POLICIES.map(policy => (
                    <option key={policy} value={policy}>
                      {t(`app.converter.canonical_url.slash.${policy}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="canonical-allowed">
                  {t('app.converter.canonical_url.allowed_params')}
                </Label>
                <Input
                  id="canonical-allowed"
                  value={draft.allowedParams}
                  onChange={event => updateDraft('allowedParams', event.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.noindex}
                  onChange={event => updateDraft('noindex', event.target.checked)}
                  label={t('app.converter.canonical_url.noindex')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.robotsBlocked}
                  onChange={event => updateDraft('robotsBlocked', event.target.checked)}
                  label={t('app.converter.canonical_url.robots_blocked')}
                />
              </div>
              <div className="glass-input rounded-xl px-3">
                <Checkbox
                  checked={draft.redirectedHint}
                  onChange={event => updateDraft('redirectedHint', event.target.checked)}
                  label={t('app.converter.canonical_url.redirected_hint')}
                />
              </div>
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.canonical_url.generated_canonical')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {canonicalUrl}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => copy(canonicalUrl)} className="w-full sm:w-auto">
                <Copy className="h-4 w-4" />
                {t('app.converter.canonical_url.copy_canonical')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAlternateInput(current =>
                    [current.trim(), `${draft.locale} ${canonicalUrl}`].filter(Boolean).join('\n')
                  )
                }
                className="w-full sm:w-auto"
              >
                <Languages className="h-4 w-4" />
                {t('app.converter.canonical_url.add_self')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.canonical_url.alternates')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.canonical_url.alternates_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[140px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="canonical-alt-code">
                  {t('app.converter.canonical_url.hreflang')}
                </Label>
                <Input
                  id="canonical-alt-code"
                  value={alternateDraft.code}
                  onChange={event =>
                    setAlternateDraft(current => ({ ...current, code: event.target.value }))
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canonical-alt-url">
                  {t('app.converter.canonical_url.alternate_url')}
                </Label>
                <Input
                  id="canonical-alt-url"
                  value={alternateDraft.url}
                  onChange={event =>
                    setAlternateDraft(current => ({ ...current, url: event.target.value }))
                  }
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendAlternate} className="w-full sm:w-auto">
                <Link2 className="h-4 w-4" />
                {t('app.converter.canonical_url.add_alternate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildHtml(canonicalUrl, activeAlternates))}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.canonical_url.copy_cluster')}
              </Button>
            </div>
            <Textarea
              value={alternateInput}
              onChange={event =>
                setAlternateInput(event.target.value.slice(0, ALTERNATE_INPUT_LIMIT))
              }
              placeholder={t('app.converter.canonical_url.alternates_placeholder')}
              className="min-h-[260px] font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.canonical_url.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.canonical_url.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.canonical_url.workspace_placeholder')}
              className="min-h-[320px] font-mono"
            />
            <InputCapNotice visible={workspace.length >= WORKSPACE_LIMIT} limit={WORKSPACE_LIMIT} />
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

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.canonical_url.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.canonical_url.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {visibleFindings.map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.canonical_url.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.canonical_url.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {findingsLimited && (
              <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                {t('public.rows_render_limited', {
                  total: filteredFindings.length,
                  visible: visibleFindings.length
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.canonical_url.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.canonical_url.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="canonical-output-type">
                  {t('app.converter.canonical_url.output_type')}
                </Label>
                <Select
                  id="canonical-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.canonical_url.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[320px] font-mono" />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            {outputPreviewRowsLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_rows_limited', {
                  total: (
                    activeAlternates.length +
                    findings.length +
                    parsedWorkspace.canonicalLinks.length +
                    parsedWorkspace.sitemapUrls.length
                  ).toLocaleString(),
                  visible: (
                    outputPreviewAlternates.length +
                    outputPreviewFindings.length +
                    outputPreviewParsedWorkspace.canonicalLinks.length +
                    outputPreviewParsedWorkspace.sitemapUrls.length
                  ).toLocaleString()
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildCurrentOutput())}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.canonical_url.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'canonical-url.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.canonical_url.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCsv(activeAlternates),
                    'hreflang-cluster.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.canonical_url.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.canonical_url.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {parsedWorkspace.canonicalLinks.slice(0, 4).map((link, index) => (
                <div key={`${link.href}:${index}`} className="glass-input min-w-0 rounded-xl p-3">
                  <p className="text-xs font-medium uppercase text-[var(--text-tertiary)]">
                    {link.source}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">
                    {link.href || '-'}
                  </p>
                </div>
              ))}
              {!parsedWorkspace.canonicalLinks.length ? (
                <div className="glass-input rounded-xl p-4 text-sm text-[var(--text-secondary)]">
                  {t('app.converter.canonical_url.empty_canonical')}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              {visibleAlternates.map((row, index) => (
                <div
                  key={`${row.code}:${row.url}:${index}`}
                  className="glass-input min-w-0 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {row.code || '-'}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                      {row.source}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                    {row.url || '-'}
                  </p>
                </div>
              ))}
              {alternatesLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.rows_render_limited', {
                    total: activeAlternates.length,
                    visible: visibleAlternates.length
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.canonical_url.checklist')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {item === 'cluster' ? (
                  <Tags className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.canonical_url.checklist.${item}.title`)}
              </div>
              {t(`app.converter.canonical_url.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
