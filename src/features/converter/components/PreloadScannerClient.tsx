'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  Link2,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react'
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

const OUTPUT_TYPES = ['html', 'headers', 'next', 'nginx', 'markdown', 'json', 'csv'] as const
const RESOURCE_RELS = [
  'discovered',
  'preload',
  'modulepreload',
  'preconnect',
  'dns-prefetch',
  'prefetch',
  'prerender',
  'stylesheet'
] as const
const PRIORITIES = ['auto', 'high', 'low'] as const
const WORKSPACE_LIMIT = 90000
const RESOURCE_LIMIT = 220

type OutputType = (typeof OUTPUT_TYPES)[number]
type ResourceType = 'document' | 'fetch' | 'font' | 'image' | 'other' | 'script' | 'style' | 'video'
type ResourceSource = 'har' | 'header' | 'html' | 'json' | 'text'
type ResourceRel = (typeof RESOURCE_RELS)[number]
type Priority = (typeof PRIORITIES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface ScannerDraft {
  criticalCssUrl: string
  fontOrigin: string
  heroImageUrl: string
  htmlTtfbMs: string
  lcpDiscoveryMs: string
  lcpUrl: string
  maxPreconnects: string
  maxPreloads: string
  preloadBudgetKb: string
  preloadStartMs: string
  routePattern: string
  scriptUrl: string
  serverLinkHeader: boolean
  useEarlyHints: boolean
}

interface ParsedResource {
  asType: ResourceType
  crossorigin: boolean
  id: string
  loading: string
  media: string
  priority: Priority
  raw: string
  rel: ResourceRel
  source: ResourceSource
  startMs: number
  transferKb: number
  url: string
  usedAsLcp: boolean
  valid: boolean
}

interface ParsedWorkspace {
  errors: string[]
  resources: ParsedResource[]
}

interface Preset {
  draft: ScannerDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: ScannerDraft = {
  criticalCssUrl: '/assets/app.css',
  fontOrigin: 'https://fonts.example.com',
  heroImageUrl: '/images/hero.avif',
  htmlTtfbMs: '420',
  lcpDiscoveryMs: '380',
  lcpUrl: '/images/hero.avif',
  maxPreconnects: '3',
  maxPreloads: '6',
  preloadBudgetKb: '900',
  preloadStartMs: '120',
  routePattern: '/products/:slug',
  scriptUrl: '/assets/app-shell.js',
  serverLinkHeader: true,
  useEarlyHints: false
}

const PRESETS: Preset[] = [
  {
    key: 'lcp_route',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Link: </images/hero.avif>; rel=preload; as=image; fetchpriority=high',
      '<link rel="preload" href="/assets/app.css" as="style" fetchpriority="high">',
      '<img src="/images/hero.avif" width="1280" height="720" loading="eager" fetchpriority="high" data-lcp="true">'
    ].join('\n')
  },
  {
    key: 'app_shell',
    draft: {
      ...DEFAULT_DRAFT,
      criticalCssUrl: '/_next/static/css/app.css',
      heroImageUrl: '',
      lcpDiscoveryMs: '520',
      lcpUrl: '/_next/static/chunks/app-shell.js',
      routePattern: '/dashboard',
      scriptUrl: '/_next/static/chunks/app-shell.js',
      useEarlyHints: true
    },
    workspace: [
      '<link rel="modulepreload" href="/_next/static/chunks/app-shell.js" as="script" fetchpriority="high">',
      '<link rel="preload" href="/_next/static/css/app.css" as="style">',
      'resource=/_next/static/chunks/app-shell.js type=script rel=modulepreload start=190ms kb=156 priority=high'
    ].join('\n')
  },
  {
    key: 'font_stack',
    draft: {
      ...DEFAULT_DRAFT,
      fontOrigin: 'https://cdn.example.com',
      heroImageUrl: '',
      lcpDiscoveryMs: '640',
      lcpUrl: '/fonts/inter-var.woff2',
      routePattern: '/brand',
      scriptUrl: ''
    },
    workspace: [
      '<link rel="preconnect" href="https://cdn.example.com" crossorigin>',
      '<link rel="preload" href="https://cdn.example.com/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>',
      'resource=https://cdn.example.com/fonts/inter-var.woff2 type=font rel=preload start=210ms kb=84 priority=high'
    ].join('\n')
  },
  {
    key: 'har_late',
    draft: {
      ...DEFAULT_DRAFT,
      htmlTtfbMs: '980',
      lcpDiscoveryMs: '1450',
      preloadStartMs: '1210',
      routePattern: '/landing',
      serverLinkHeader: false
    },
    workspace: [
      '{"url":"/images/hero.avif","initiatorType":"img","startTime":1450,"transferSize":740000,"fetchPriority":"low","loading":"lazy","lcp":true}',
      '{"url":"/assets/app.css","initiatorType":"link","rel":"stylesheet","startTime":620,"transferSize":96000}',
      '{"url":"https://analytics.example.com/tag.js","initiatorType":"script","startTime":1680,"transferSize":210000,"fetchPriority":"high"}'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      criticalCssUrl: '/critical.css',
      fontOrigin: 'https://cdn.example.com/fonts/inter.woff2',
      heroImageUrl: 'http://cdn.example.com/private/hero.jpg?token=abc',
      htmlTtfbMs: '1780',
      lcpDiscoveryMs: '2140',
      lcpUrl: 'http://cdn.example.com/private/hero.jpg?token=abc',
      maxPreconnects: '2',
      maxPreloads: '3',
      preloadBudgetKb: '700',
      preloadStartMs: '1890',
      routePattern: '/checkout',
      scriptUrl: '/blocking.js',
      serverLinkHeader: false,
      useEarlyHints: false
    },
    workspace: [
      '<link rel="preload" href="http://cdn.example.com/private/hero.jpg?token=abc" as="image" fetchpriority="low">',
      '<link rel="preload" href="/font.woff2" as="font">',
      '<link rel="preload" href="/font.woff2" as="font">',
      '<link rel="preconnect" href="https://cdn.example.com/path/app.js">',
      '<link rel="preconnect" href="https://analytics.example.com">',
      '<link rel="preconnect" href="https://ads.example.com">',
      '<img src="http://cdn.example.com/private/hero.jpg?token=abc" loading="lazy" fetchpriority="low" data-lcp="true">',
      'resource=http://cdn.example.com/private/hero.jpg?token=abc type=image rel=preload start=1890ms kb=1260 priority=low lcp=true',
      'resource=data:image/png;base64,AAA type=image rel=preload start=90ms kb=640 priority=high'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['discovery', 'headers', 'early_hints', 'fonts', 'budget', 'lcp'] as const
const CHECKLIST_ITEMS = ['discover', 'server', 'budget', 'measure'] as const

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%a-z]+/giu, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const normalizePriority = (value: string): Priority =>
  PRIORITIES.includes(value.toLowerCase() as Priority) ? (value.toLowerCase() as Priority) : 'auto'

const normalizeRel = (value: string): ResourceRel => {
  const rel = value.trim().toLowerCase().split(/\s+/u)[0] ?? ''
  return RESOURCE_RELS.includes(rel as ResourceRel) ? (rel as ResourceRel) : 'discovered'
}

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const hasAttr = (tag: string, attr: string) => new RegExp(`\\b${attr}(?:\\s|=|>|/)`, 'iu').test(tag)

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const firstSrcsetUrl = (srcset: string) => srcset.split(',')[0]?.trim().split(/\s+/u)[0] ?? ''

const inferType = (url: string, fallback = ''): ResourceType => {
  const normalized = fallback.toLowerCase()
  if (normalized.includes('document')) return 'document'
  if (normalized.includes('style') || normalized.includes('css')) return 'style'
  if (normalized.includes('script') || normalized.includes('js')) return 'script'
  if (normalized.includes('font')) return 'font'
  if (normalized.includes('image') || normalized.includes('img')) return 'image'
  if (normalized.includes('fetch') || normalized.includes('xmlhttprequest')) return 'fetch'
  if (normalized.includes('video')) return 'video'

  const path = safeUrl(url)?.pathname.toLowerCase() ?? url.toLowerCase()
  if (/\.(css)$/u.test(path)) return 'style'
  if (/\.(m?js)$/u.test(path)) return 'script'
  if (/\.(woff2?|ttf|otf|eot)$/u.test(path)) return 'font'
  if (/\.(avif|webp|png|jpe?g|gif|svg)$/u.test(path)) return 'image'
  if (/\.(mp4|webm|mov)$/u.test(path)) return 'video'
  if (/\.(html?)$/u.test(path)) return 'document'
  return 'other'
}

const expectedTypePrefix = (asType: ResourceType) => {
  if (asType === 'style') return 'text/css'
  if (asType === 'script') return 'text/javascript'
  if (asType === 'font') return 'font/'
  if (asType === 'image') return 'image/'
  if (asType === 'document') return 'text/html'
  return ''
}

const parseMs = (value: string) => numberFromInput(value)
const parseKb = (value: string) => {
  const number = numberFromInput(value)
  if (/bytes?|b$/iu.test(value) && !/kb|kib/iu.test(value)) return Math.round(number / 1024)
  return number
}

const isPrivateQuery = (url: string) =>
  /[?&](token|secret|email|session|auth|key|password|jwt)=/iu.test(url)

const sameResource = (left: string, right: string) => {
  if (!left.trim() || !right.trim()) return false
  const a = safeUrl(left)
  const b = safeUrl(right)
  if (a && b) {
    if (a.href === b.href || a.pathname === b.pathname) return true
    return a.pathname.split('/').pop() === b.pathname.split('/').pop()
  }
  return left.trim() === right.trim()
}

const originFromUrl = (url: string) => safeUrl(url)?.origin ?? ''

const getJsonString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

const getJsonNumber = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const next = numberFromInput(value)
      if (next > 0) return next
    }
  }
  return 0
}

const addResource = (resources: ParsedResource[], resource: Omit<ParsedResource, 'id'>) => {
  resources.push({
    ...resource,
    id: `${resource.source}-${resources.length}-${resource.url || resource.raw.slice(0, 18)}`
  })
}

const parseHtmlResources = (input: string): ParsedResource[] => {
  const resources: ParsedResource[] = []
  const tags = input.matchAll(/<(link|img|script|source)\b[^>]*>/giu)

  for (const match of tags) {
    const tagName = (match[1] ?? '').toLowerCase()
    const raw = match[0]
    const rel = tagName === 'link' ? normalizeRel(getAttr(raw, 'rel')) : 'discovered'
    const href =
      getAttr(raw, 'href') ||
      getAttr(raw, 'src') ||
      firstSrcsetUrl(getAttr(raw, 'srcset')) ||
      firstSrcsetUrl(getAttr(raw, 'imagesrcset'))
    if (!href) continue
    const asType = inferType(href, getAttr(raw, 'as') || getAttr(raw, 'type') || tagName)

    addResource(resources, {
      asType,
      crossorigin: hasAttr(raw, 'crossorigin'),
      loading: getAttr(raw, 'loading'),
      media: getAttr(raw, 'media') || getAttr(raw, 'sizes'),
      priority: normalizePriority(getAttr(raw, 'fetchpriority') || getAttr(raw, 'importance')),
      raw,
      rel,
      source: 'html',
      startMs: parseMs(getAttr(raw, 'data-start') || getAttr(raw, 'start')),
      transferKb: parseKb(
        getAttr(raw, 'data-kb') || getAttr(raw, 'bytes') || getAttr(raw, 'transfer')
      ),
      url: href,
      usedAsLcp: /data-lcp|largest-contentful-paint|lcp\s*=\s*["']?true/iu.test(raw),
      valid: Boolean(safeUrl(href)) || href.startsWith('data:')
    })
  }

  return resources
}

const parseLinkParams = (part: string) => {
  const params: Record<string, string> = {}
  part
    .split(';')
    .slice(1)
    .forEach(chunk => {
      const [rawKey, ...rawValue] = chunk.trim().split('=')
      const key = rawKey?.trim().toLowerCase()
      if (!key) return
      params[key] = rawValue.join('=').trim().replace(/^"|"$/gu, '')
    })
  return params
}

const parseHeaderResources = (input: string): ParsedResource[] => {
  const resources: ParsedResource[] = []

  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (!/^link\s*:|^<[^>]+>\s*;/iu.test(trimmed)) return
    const content = trimmed.replace(/^link\s*:\s*/iu, '')
    content.split(/,\s*(?=<)/u).forEach(part => {
      const match = part.match(/<([^>]+)>\s*;/u)
      if (!match) return
      const href = match[1] ?? ''
      const params = parseLinkParams(part)
      const rel = normalizeRel(params.rel ?? '')
      const asType = inferType(href, params.as ?? params.type ?? '')
      addResource(resources, {
        asType,
        crossorigin: params.crossorigin !== undefined || /;\s*crossorigin\b/iu.test(part),
        loading: '',
        media: params.media ?? '',
        priority: normalizePriority(params.fetchpriority ?? params.importance ?? ''),
        raw: part.trim(),
        rel,
        source: 'header',
        startMs: parseMs(params.start ?? ''),
        transferKb: parseKb(params.kb ?? params.bytes ?? ''),
        url: href,
        usedAsLcp: /lcp\s*=\s*true/iu.test(part),
        valid: Boolean(safeUrl(href))
      })
    })
  })

  return resources
}

const collectJsonResources = (value: unknown, resources: ParsedResource[], index = 0) => {
  if (!value) return
  if (Array.isArray(value)) {
    value.forEach((item, itemIndex) => collectJsonResources(item, resources, index + itemIndex))
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const request =
    typeof record.request === 'object' && record.request
      ? (record.request as Record<string, unknown>)
      : null
  const url =
    getJsonString(record, ['url', 'name', 'href', 'src']) ||
    (request ? getJsonString(request, ['url']) : '')

  if (url) {
    const transferKb =
      getJsonNumber(record, ['transferKb', 'kb']) ||
      Math.round(
        getJsonNumber(record, ['transferSize', 'encodedBodySize', 'decodedBodySize', 'bytes']) /
          1024
      )
    const rel = normalizeRel(getJsonString(record, ['rel', 'relationship']))
    const source: ResourceSource = getJsonString(record, ['_fromHar', 'har']) ? 'har' : 'json'
    addResource(resources, {
      asType: inferType(
        url,
        getJsonString(record, ['as', 'asType', 'initiatorType', 'resourceType', 'type'])
      ),
      crossorigin: Boolean(record.crossorigin ?? record.crossOrigin),
      loading: getJsonString(record, ['loading']),
      media: getJsonString(record, ['media', 'sizes']),
      priority: normalizePriority(
        getJsonString(record, ['priority', 'fetchPriority', '_priority'])
      ),
      raw: JSON.stringify(record).slice(0, 800),
      rel:
        rel === 'discovered' && getJsonString(record, ['initiatorType']) === 'link'
          ? 'stylesheet'
          : rel,
      source,
      startMs: getJsonNumber(record, ['startTime', 'start', 'requestStart']),
      transferKb,
      url,
      usedAsLcp: Boolean(record.lcp ?? record.isLcp ?? record.usedAsLcp),
      valid: Boolean(safeUrl(url)) || url.startsWith('data:')
    })
  }

  ;['entries', 'resources', 'items', 'children', 'requests', 'log'].forEach(key => {
    if (record[key] !== undefined) collectJsonResources(record[key], resources, index + 1)
  })
}

const parseJsonResources = (input: string): { errors: string[]; resources: ParsedResource[] } => {
  const errors: string[] = []
  const resources: ParsedResource[] = []
  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, index) => {
    try {
      collectJsonResources(JSON.parse(row) as unknown, resources, index)
    } catch {
      errors.push(`json:${index + 1}`)
    }
  })

  return { errors, resources }
}

const parseTextResources = (input: string): ParsedResource[] => {
  const resources: ParsedResource[] = []

  input.split(/\n+/u).forEach(line => {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.startsWith('<') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      /^link\s*:/iu.test(trimmed)
    )
      return
    const href =
      tokenValue(trimmed, 'resource') ||
      tokenValue(trimmed, 'url') ||
      tokenValue(trimmed, 'href') ||
      tokenValue(trimmed, 'src')
    if (!href) return
    const rel = normalizeRel(tokenValue(trimmed, 'rel'))
    const asType = inferType(href, tokenValue(trimmed, 'type') || tokenValue(trimmed, 'as'))

    addResource(resources, {
      asType,
      crossorigin: /\bcrossorigin\s*=\s*(true|1)|\bcrossorigin\b/iu.test(trimmed),
      loading: tokenValue(trimmed, 'loading'),
      media: tokenValue(trimmed, 'media') || tokenValue(trimmed, 'sizes'),
      priority: normalizePriority(
        tokenValue(trimmed, 'priority') || tokenValue(trimmed, 'fetchpriority')
      ),
      raw: trimmed,
      rel,
      source: 'text',
      startMs: parseMs(tokenValue(trimmed, 'start') || tokenValue(trimmed, 'startTime')),
      transferKb: parseKb(
        tokenValue(trimmed, 'kb') || tokenValue(trimmed, 'bytes') || tokenValue(trimmed, 'transfer')
      ),
      url: href,
      usedAsLcp: /\blcp\s*=\s*(true|1|yes)\b/iu.test(trimmed),
      valid: Boolean(safeUrl(href)) || href.startsWith('data:')
    })
  })

  return resources
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonResources(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    resources: [
      ...parseHtmlResources(source),
      ...parseHeaderResources(source),
      ...json.resources,
      ...parseTextResources(source)
    ].slice(0, RESOURCE_LIMIT)
  }
}

const auditScanner = (draft: ScannerDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const ttfb = numberFromInput(draft.htmlTtfbMs)
  const lcpDiscovery = numberFromInput(draft.lcpDiscoveryMs)
  const preloadStart = numberFromInput(draft.preloadStartMs)
  const maxPreloads = Math.max(1, numberFromInput(draft.maxPreloads))
  const maxPreconnects = Math.max(1, numberFromInput(draft.maxPreconnects))
  const budget = Math.max(1, numberFromInput(draft.preloadBudgetKb))
  const preloads = parsed.resources.filter(
    resource => resource.rel === 'preload' || resource.rel === 'modulepreload'
  )
  const preconnects = parsed.resources.filter(resource => resource.rel === 'preconnect')
  const preloadTransfer = preloads.reduce((total, resource) => total + resource.transferKb, 0)
  const duplicateKeys = new Map<string, number>()
  const hasPreloadFor = (url: string) => preloads.some(resource => sameResource(resource.url, url))

  if (!draft.routePattern.trim()) add('danger', 'missing_route', 'route')
  if (!draft.lcpUrl.trim()) add('warn', 'missing_lcp_url', draft.routePattern)
  if (ttfb > 1500) add('danger', 'ttfb_severe', `${ttfb}ms`)
  else if (ttfb > 800) add('warn', 'ttfb_slow', `${ttfb}ms`)
  if (lcpDiscovery > 1400) add('danger', 'lcp_discovery_late', `${lcpDiscovery}ms`)
  else if (lcpDiscovery > 700) add('warn', 'lcp_discovery_slow', `${lcpDiscovery}ms`)
  if (preloadStart > 900) add('warn', 'preload_starts_late', `${preloadStart}ms`)
  if (preloadStart > 0 && lcpDiscovery > 0 && preloadStart >= lcpDiscovery)
    add('danger', 'preload_after_discovery', `${preloadStart}ms / ${lcpDiscovery}ms`)
  if (!draft.useEarlyHints && ttfb > 700 && lcpDiscovery > 700)
    add('warn', 'early_hints_candidate', draft.routePattern)
  if (!draft.serverLinkHeader && draft.lcpUrl.trim())
    add('warn', 'missing_server_link', draft.lcpUrl)
  if (draft.lcpUrl.trim() && !hasPreloadFor(draft.lcpUrl))
    add('danger', 'lcp_not_preloaded', draft.lcpUrl)
  if (draft.criticalCssUrl.trim() && !hasPreloadFor(draft.criticalCssUrl))
    add('warn', 'critical_css_not_preloaded', draft.criticalCssUrl)
  if (draft.scriptUrl.trim() && !hasPreloadFor(draft.scriptUrl))
    add('warn', 'script_not_preloaded', draft.scriptUrl)
  if (preloads.length > maxPreloads)
    add('warn', 'too_many_preloads', `${preloads.length}/${maxPreloads}`)
  if (preconnects.length > maxPreconnects)
    add('warn', 'too_many_preconnects', `${preconnects.length}/${maxPreconnects}`)
  if (preloadTransfer > budget)
    add(
      preloadTransfer > budget * 1.5 ? 'danger' : 'warn',
      'preload_budget_exceeded',
      `${Math.round(preloadTransfer)}KB/${budget}KB`
    )

  parsed.resources.forEach(resource => {
    const key = `${resource.rel}:${safeUrl(resource.url)?.href ?? resource.url}`
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1)

    if (!resource.valid) add('danger', 'invalid_url', resource.url || resource.raw)
    if (/^http:/iu.test(resource.url)) add('danger', 'http_resource', resource.url)
    if (/^data:/iu.test(resource.url) && resource.rel === 'preload')
      add('danger', 'data_uri_preload', resource.asType)
    if (isPrivateQuery(resource.url)) add('warn', 'private_query', resource.url)
    if (resource.rel === 'preconnect' && safeUrl(resource.url)?.pathname !== '/')
      add('warn', 'preconnect_has_path', resource.url)
    if (
      (resource.rel === 'preload' || resource.rel === 'modulepreload') &&
      resource.asType === 'other'
    )
      add('danger', 'preload_missing_as', resource.url)
    if (resource.rel === 'modulepreload' && resource.asType !== 'script')
      add('warn', 'modulepreload_not_script', resource.url)
    if (resource.rel === 'preload' && resource.asType === 'font' && !resource.crossorigin)
      add('warn', 'font_missing_crossorigin', resource.url)
    if (resource.rel === 'preload' && resource.priority === 'low')
      add('warn', 'low_priority_preload', resource.url)
    if (resource.transferKb > 900 && resource.rel === 'preload')
      add('danger', 'heavy_preload', `${resource.url} / ${Math.round(resource.transferKb)}KB`)
    else if (resource.transferKb > 320 && resource.rel === 'preload')
      add('warn', 'heavy_preload', `${resource.url} / ${Math.round(resource.transferKb)}KB`)
    if (
      resource.startMs > 1000 &&
      (resource.rel === 'preload' || resource.usedAsLcp || sameResource(resource.url, draft.lcpUrl))
    )
      add('warn', 'late_resource_start', `${resource.url} / ${Math.round(resource.startMs)}ms`)
    if (
      (resource.usedAsLcp || sameResource(resource.url, draft.lcpUrl)) &&
      resource.loading === 'lazy'
    )
      add('danger', 'lazy_lcp', resource.url)
    if (
      (resource.usedAsLcp || sameResource(resource.url, draft.lcpUrl)) &&
      resource.priority === 'low'
    )
      add('danger', 'low_priority_lcp', resource.url)
    if (resource.raw) {
      const declaredType = getAttr(resource.raw, 'type')
      const expected = expectedTypePrefix(resource.asType)
      if (declaredType && expected && !declaredType.toLowerCase().startsWith(expected))
        add('warn', 'type_mismatch', `${resource.url} / ${declaredType}`)
    }
  })

  duplicateKeys.forEach((count, key) => {
    if (count > 1 && !key.startsWith('discovered:')) add('warn', 'duplicate_hint', key)
  })

  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )

  if (!parsed.resources.length) add('warn', 'parser_empty', draft.routePattern)
  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'lcp_preload_ok', draft.lcpUrl)
    add('good', 'budget_ok', `${Math.round(preloadTransfer)}KB`)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 16 : finding.level === 'warn' ? 6 : 0),
    0
  )
  return Math.max(0, 100 - penalty)
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-400/35 bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'warn')
    return 'border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

const buildHtmlHints = (draft: ScannerDraft) => {
  const rows = [
    draft.criticalCssUrl
      ? `<link rel="preload" href="${escapeHtml(draft.criticalCssUrl)}" as="style" fetchpriority="high">`
      : '',
    draft.lcpUrl
      ? `<link rel="preload" href="${escapeHtml(draft.lcpUrl)}" as="${inferType(draft.lcpUrl, 'image')}" fetchpriority="high">`
      : '',
    draft.scriptUrl
      ? `<link rel="modulepreload" href="${escapeHtml(draft.scriptUrl)}" as="script" fetchpriority="high">`
      : '',
    draft.fontOrigin
      ? `<link rel="preconnect" href="${escapeHtml(originFromUrl(draft.fontOrigin) || draft.fontOrigin)}" crossorigin>`
      : ''
  ].filter(Boolean)
  return rows.join('\n')
}

const buildHeaderHints = (draft: ScannerDraft) => {
  const hints = [
    draft.criticalCssUrl
      ? `<${draft.criticalCssUrl}>; rel=preload; as=style; fetchpriority=high`
      : '',
    draft.lcpUrl
      ? `<${draft.lcpUrl}>; rel=preload; as=${inferType(draft.lcpUrl, 'image')}; fetchpriority=high`
      : '',
    draft.scriptUrl ? `<${draft.scriptUrl}>; rel=modulepreload; as=script; fetchpriority=high` : '',
    draft.fontOrigin
      ? `<${originFromUrl(draft.fontOrigin) || draft.fontOrigin}>; rel=preconnect; crossorigin`
      : ''
  ].filter(Boolean)
  return `Link: ${hints.join(', ')}`
}

const buildNextSnippet = (draft: ScannerDraft) =>
  [
    "'use client'",
    '',
    'export function RoutePreloadLinks() {',
    '  return (',
    '    <>',
    draft.criticalCssUrl
      ? `      <link rel="preload" href="${escapeHtml(draft.criticalCssUrl)}" as="style" fetchPriority="high" />`
      : '',
    draft.lcpUrl
      ? `      <link rel="preload" href="${escapeHtml(draft.lcpUrl)}" as="${inferType(draft.lcpUrl, 'image')}" fetchPriority="high" />`
      : '',
    draft.scriptUrl
      ? `      <link rel="modulepreload" href="${escapeHtml(draft.scriptUrl)}" as="script" fetchPriority="high" />`
      : '',
    draft.fontOrigin
      ? `      <link rel="preconnect" href="${escapeHtml(originFromUrl(draft.fontOrigin) || draft.fontOrigin)}" crossOrigin="" />`
      : '',
    '    </>',
    '  )',
    '}'
  ]
    .filter(Boolean)
    .join('\n')

const buildNginxSnippet = (draft: ScannerDraft) =>
  `# ${draft.routePattern}\nadd_header Link "${escapeJs(buildHeaderHints(draft).replace(/^Link:\s*/u, ''))}" always;`

const buildMarkdown = (draft: ScannerDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# Preload scan: ${draft.routePattern}`,
    '',
    `- LCP URL: ${draft.lcpUrl || '-'}`,
    `- HTML TTFB: ${draft.htmlTtfbMs}ms`,
    `- LCP discovery: ${draft.lcpDiscoveryMs}ms`,
    `- First preload start: ${draft.preloadStartMs}ms`,
    `- Parsed resources: ${parsed.resources.length}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 28)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed resources',
    ...parsed.resources
      .slice(0, 24)
      .map(
        resource =>
          `- ${resource.rel} / ${resource.asType} / ${resource.url} / ${Math.round(resource.startMs)}ms / ${Math.round(resource.transferKb)}KB`
      )
  ].join('\n')

const buildCsv = (parsed: ParsedWorkspace) =>
  [
    [
      'url',
      'rel',
      'type',
      'source',
      'priority',
      'loading',
      'start_ms',
      'transfer_kb',
      'crossorigin',
      'lcp',
      'valid'
    ]
      .map(escapeCsv)
      .join(','),
    ...parsed.resources.map(resource =>
      [
        resource.url,
        resource.rel,
        resource.asType,
        resource.source,
        resource.priority,
        resource.loading,
        Math.round(resource.startMs),
        Math.round(resource.transferKb),
        resource.crossorigin,
        resource.usedAsLcp,
        resource.valid
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')

const buildOutput = (
  draft: ScannerDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'html') return buildHtmlHints(draft)
  if (outputType === 'headers') return buildHeaderHints(draft)
  if (outputType === 'next') return buildNextSnippet(draft)
  if (outputType === 'nginx') return buildNginxSnippet(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, resources: parsed.resources }, null, 2)
  return buildCsv(parsed)
}

const downloadText = (text: string, filename: string, type: string) => {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-input min-w-0 rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function PreloadScannerClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ScannerDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('html')
  const [auditQuery, setAuditQuery] = useState('')
  const [resourceQuery, setResourceQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredResourceQuery = useDeferredValue(resourceQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditScanner(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(parsed), [parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.preload_scanner.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredResources = useMemo(() => {
    const query = deferredResourceQuery.trim().toLowerCase()
    if (!query) return parsed.resources
    return parsed.resources.filter(resource =>
      `${resource.url} ${resource.rel} ${resource.asType} ${resource.source} ${resource.raw}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredResourceQuery, parsed.resources])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      late: parsed.resources.filter(resource => resource.startMs > 900).length,
      preloads: parsed.resources.filter(
        resource => resource.rel === 'preload' || resource.rel === 'modulepreload'
      ).length,
      resources: parsed.resources.length,
      score,
      transfer: `${Math.round(parsed.resources.reduce((total, resource) => total + resource.transferKb, 0))}KB`
    }),
    [findings, parsed.resources, score]
  )

  const updateDraft = <Key extends keyof ScannerDraft>(key: Key, value: ScannerDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('html')
    setAuditQuery('')
    setResourceQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.preload_scanner.summary_title'),
        `${t('app.converter.preload_scanner.metric.score')}: ${metrics.score}`,
        `${t('app.converter.preload_scanner.metric.resources')}: ${metrics.resources}`,
        `${t('app.converter.preload_scanner.metric.preloads')}: ${metrics.preloads}`,
        `${t('app.converter.preload_scanner.metric.late')}: ${metrics.late}`,
        `${t('app.converter.preload_scanner.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.preload_scanner.metric.critical')}: ${metrics.critical}`
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
                <Link2 className="h-4 w-4" />
                {t('app.converter.preload-scanner')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.preload-scanner')}</CardTitle>
              <CardDescription>{t('app.converter.preload_scanner.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.preload_scanner.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.preload_scanner.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.preload_scanner.metric.resources')}
              value={metrics.resources}
            />
            <Metric
              label={t('app.converter.preload_scanner.metric.preloads')}
              value={metrics.preloads}
            />
            <Metric label={t('app.converter.preload_scanner.metric.late')} value={metrics.late} />
            <Metric
              label={t('app.converter.preload_scanner.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric
              label={t('app.converter.preload_scanner.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.converter.preload_scanner.presets')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input min-w-0 rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.preload_scanner.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.preload_scanner.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.preload_scanner.model')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.preload_scanner.model_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preload-route">
                  {t('app.converter.preload_scanner.route_pattern')}
                </Label>
                <Input
                  id="preload-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-lcp">{t('app.converter.preload_scanner.lcp_url')}</Label>
                <Input
                  id="preload-lcp"
                  value={draft.lcpUrl}
                  onChange={event => updateDraft('lcpUrl', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-css">
                  {t('app.converter.preload_scanner.critical_css')}
                </Label>
                <Input
                  id="preload-css"
                  value={draft.criticalCssUrl}
                  onChange={event =>
                    updateDraft('criticalCssUrl', event.target.value.slice(0, 260))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-script">
                  {t('app.converter.preload_scanner.app_script')}
                </Label>
                <Input
                  id="preload-script"
                  value={draft.scriptUrl}
                  onChange={event => updateDraft('scriptUrl', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-hero">
                  {t('app.converter.preload_scanner.hero_image')}
                </Label>
                <Input
                  id="preload-hero"
                  value={draft.heroImageUrl}
                  onChange={event => updateDraft('heroImageUrl', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-font-origin">
                  {t('app.converter.preload_scanner.font_origin')}
                </Label>
                <Input
                  id="preload-font-origin"
                  value={draft.fontOrigin}
                  onChange={event => updateDraft('fontOrigin', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-ttfb">{t('app.converter.preload_scanner.html_ttfb')}</Label>
                <Input
                  id="preload-ttfb"
                  value={draft.htmlTtfbMs}
                  onChange={event => updateDraft('htmlTtfbMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-discovery">
                  {t('app.converter.preload_scanner.lcp_discovery')}
                </Label>
                <Input
                  id="preload-discovery"
                  value={draft.lcpDiscoveryMs}
                  onChange={event => updateDraft('lcpDiscoveryMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-start">
                  {t('app.converter.preload_scanner.preload_start')}
                </Label>
                <Input
                  id="preload-start"
                  value={draft.preloadStartMs}
                  onChange={event => updateDraft('preloadStartMs', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-budget">
                  {t('app.converter.preload_scanner.preload_budget')}
                </Label>
                <Input
                  id="preload-budget"
                  value={draft.preloadBudgetKb}
                  onChange={event => updateDraft('preloadBudgetKb', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preload-max">
                  {t('app.converter.preload_scanner.max_preloads')}
                </Label>
                <Input
                  id="preload-max"
                  value={draft.maxPreloads}
                  onChange={event => updateDraft('maxPreloads', event.target.value.slice(0, 5))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preconnect-max">
                  {t('app.converter.preload_scanner.max_preconnects')}
                </Label>
                <Input
                  id="preconnect-max"
                  value={draft.maxPreconnects}
                  onChange={event => updateDraft('maxPreconnects', event.target.value.slice(0, 5))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Checkbox
                checked={draft.useEarlyHints}
                onChange={event => updateDraft('useEarlyHints', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.preload_scanner.early_hints')}
              />
              <Checkbox
                checked={draft.serverLinkHeader}
                onChange={event => updateDraft('serverLinkHeader', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.converter.preload_scanner.link_header')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.preload_scanner.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.preload_scanner.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.preload_scanner.workspace_placeholder')}
              className="min-h-[520px] font-mono"
              spellCheck={false}
            />
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.preload_scanner.audit')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.preload_scanner.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 54).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.preload_scanner.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.preload_scanner.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.preload_scanner.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.preload_scanner.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="preload-output">
                  {t('app.converter.preload_scanner.output_type')}
                </Label>
                <Select
                  id="preload-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.preload_scanner.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[360px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.preload_scanner.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'preload-scanner-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.preload_scanner.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'preload-scanner.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.preload_scanner.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.preload_scanner.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={resourceQuery}
                onChange={event => setResourceQuery(event.target.value)}
                placeholder={t('app.converter.preload_scanner.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredResources.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredResources.slice(0, 72).map(resource => (
                  <div key={resource.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {resource.url}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${resource.valid ? levelClass('good') : levelClass('danger')}`}
                      >
                        {t(`app.converter.preload_scanner.${resource.valid ? 'valid' : 'invalid'}`)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t(`app.converter.preload_scanner.rel.${resource.rel}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.preload_scanner.type.${resource.asType}`)}
                      <span className="mx-1">/</span>
                      {t(`app.converter.preload_scanner.source.${resource.source}`)}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {Math.round(resource.startMs)}ms / {Math.round(resource.transferKb)}KB /{' '}
                      {resource.priority}
                      {resource.loading ? ` / ${resource.loading}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.preload_scanner.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.preload_scanner.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.preload_scanner.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.preload_scanner.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.preload_scanner.reference.${item}_hint`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.preload_scanner.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.preload_scanner.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.preload_scanner.checklist.${item}.body`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
