'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ImageIcon,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'
import { collectBoundedNonEmptyLines } from '@/utils/textScan'

const FORMATS = ['avif', 'webp', 'jpeg', 'png'] as const
const LOADING_MODES = ['eager', 'lazy', 'auto'] as const
const PRIORITIES = ['high', 'auto', 'low'] as const
const DECODING_MODES = ['async', 'auto', 'sync'] as const
const FIT_MODES = ['cover', 'contain', 'fill'] as const
const OUTPUT_TYPES = ['picture', 'next', 'preload', 'cdn', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const IMAGE_LIMIT = 180
const ALT_TEXT_FIELD_LIMIT = 320
const JSON_LINE_SCAN_LIMIT = 220
const TEXT_LINE_SCAN_LIMIT = 360
const VISIBLE_FINDINGS_LIMIT = 44
const VISIBLE_IMAGES_LIMIT = 60

type Format = (typeof FORMATS)[number]
type LoadingMode = (typeof LOADING_MODES)[number]
type Priority = (typeof PRIORITIES)[number]
type DecodingMode = (typeof DECODING_MODES)[number]
type FitMode = (typeof FIT_MODES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ImageSource = 'html' | 'json' | 'next' | 'text'

interface ImageDraft {
  altText: string
  bytesPerCandidateKb: string
  cdnBase: string
  decoding: DecodingMode
  dprMax: string
  fit: FitMode
  formats: Format[]
  height: string
  imageUrl: string
  isLcp: 'no' | 'yes'
  loading: LoadingMode
  priority: Priority
  quality: string
  routePattern: string
  sizes: string
  slotWidth: string
  width: string
}

interface ParsedImage {
  alt: string
  bytesKb: number
  decoding: DecodingMode
  format: string
  height: number
  id: string
  isLcp: boolean
  loading: LoadingMode
  priority: Priority
  sizes: string
  source: ImageSource
  srcsetCount: number
  srcsetHasDataUri: boolean
  url: string
  width: number
}

interface ParsedWorkspace {
  errors: string[]
  images: ParsedImage[]
  limits: {
    htmlTags: boolean
    jsonLines: boolean
    textLines: boolean
  }
}

interface Preset {
  draft: ImageDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: ImageDraft = {
  altText: 'Product hero',
  bytesPerCandidateKb: '148',
  cdnBase: 'https://images.example.com/cdn',
  decoding: 'async',
  dprMax: '2',
  fit: 'cover',
  formats: ['avif', 'webp', 'jpeg'],
  height: '720',
  imageUrl: 'https://cdn.example.com/images/product-hero.jpg',
  isLcp: 'yes',
  loading: 'eager',
  priority: 'high',
  quality: '78',
  routePattern: '/products/:slug',
  sizes: '(min-width: 1024px) 960px, 100vw',
  slotWidth: '960',
  width: '1280'
}

const PRESETS: Preset[] = [
  {
    key: 'lcp_hero',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<picture>',
      '  <source type="image/avif" srcset="/images/product-hero-640.avif 640w, /images/product-hero-1280.avif 1280w" sizes="(min-width: 1024px) 960px, 100vw">',
      '  <source type="image/webp" srcset="/images/product-hero-640.webp 640w, /images/product-hero-1280.webp 1280w" sizes="(min-width: 1024px) 960px, 100vw">',
      '  <img src="/images/product-hero-1280.jpg" width="1280" height="720" loading="eager" decoding="async" fetchpriority="high" alt="Product hero">',
      '</picture>'
    ].join('\n')
  },
  {
    key: 'responsive_picture',
    draft: {
      ...DEFAULT_DRAFT,
      altText: 'Editorial cover',
      bytesPerCandidateKb: '96',
      imageUrl: '/media/editorial-cover.jpg',
      isLcp: 'no',
      loading: 'lazy',
      priority: 'auto',
      routePattern: '/blog/:slug',
      sizes: '(min-width: 768px) 720px, calc(100vw - 32px)',
      slotWidth: '720'
    },
    workspace: [
      '<img src="/media/editorial-cover.jpg" srcset="/media/editorial-cover-480.webp 480w, /media/editorial-cover-960.webp 960w, /media/editorial-cover-1440.webp 1440w" sizes="(min-width: 768px) 720px, calc(100vw - 32px)" width="1440" height="960" loading="lazy" decoding="async" alt="Editorial cover">'
    ].join('\n')
  },
  {
    key: 'cdn_variants',
    draft: {
      ...DEFAULT_DRAFT,
      bytesPerCandidateKb: '82',
      cdnBase: 'https://img.example.com/_next/image',
      imageUrl: 'https://assets.example.com/catalog/card.jpg',
      isLcp: 'no',
      loading: 'lazy',
      priority: 'low',
      routePattern: '/catalog',
      sizes: '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw',
      slotWidth: '360',
      width: '900'
    },
    workspace: [
      '{"url":"https://assets.example.com/catalog/card.jpg","width":900,"height":600,"sizes":"(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw","loading":"lazy","priority":"low","format":"webp","bytesKb":82}',
      'image=https://assets.example.com/catalog/card.jpg width=900 height=600 sizes="(min-width: 1280px) 25vw, 50vw" format=avif bytes=68KB loading=lazy priority=low'
    ].join('\n')
  },
  {
    key: 'gallery',
    draft: {
      ...DEFAULT_DRAFT,
      altText: 'Gallery image',
      bytesPerCandidateKb: '74',
      imageUrl: '/gallery/loft-01.jpg',
      isLcp: 'no',
      loading: 'lazy',
      priority: 'low',
      routePattern: '/gallery',
      sizes: '(min-width: 1024px) 33vw, 50vw',
      slotWidth: '420',
      width: '840'
    },
    workspace: [
      'image=/gallery/loft-01.jpg width=840 height=560 sizes="(min-width: 1024px) 33vw, 50vw" format=webp bytes=74KB loading=lazy priority=low',
      'image=/gallery/loft-02.jpg width=840 height=560 sizes="(min-width: 1024px) 33vw, 50vw" format=webp bytes=79KB loading=lazy priority=low',
      'image=/gallery/loft-03.jpg width=840 height=560 sizes="(min-width: 1024px) 33vw, 50vw" format=webp bytes=72KB loading=lazy priority=low'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      altText: '',
      bytesPerCandidateKb: '1850',
      cdnBase: 'http://images.example.com/cdn',
      decoding: 'sync',
      dprMax: '4',
      fit: 'cover',
      formats: ['jpeg', 'png'],
      height: '',
      imageUrl: 'http://cdn.example.com/private/hero.jpg?token=abc&email=buyer@example.com',
      isLcp: 'yes',
      loading: 'lazy',
      priority: 'low',
      quality: '96',
      routePattern: '/checkout',
      sizes: '100vw',
      slotWidth: '390',
      width: ''
    },
    workspace: [
      '<img src="http://cdn.example.com/private/hero.jpg?token=abc&email=buyer@example.com" srcset="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD 320w, http://cdn.example.com/private/hero-4000.jpg 4000w, http://cdn.example.com/private/hero-8000.jpg 8000w" sizes="100vw" loading="lazy" decoding="sync" fetchpriority="low" alt="">',
      '<Image src="http://cdn.example.com/private/card.png?session=abc" width={0} height={0} priority loading="lazy" sizes="100vw" />',
      'image=http://cdn.example.com/private/gallery.png?secret=abc width=4200 height=2800 sizes=100vw format=png bytes=2400KB loading=eager priority=high lcp=true'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['lcp', 'sizes', 'formats', 'dimensions', 'cdn', 'privacy'] as const
const CHECKLIST_ITEMS = ['hero', 'variants', 'cache', 'measure'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(
    new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|\\{([^}]*)\\}|([^\\s>/]+))`, 'iu')
  )
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? match?.[5] ?? ''
}

const hasAttr = (tag: string, attr: string) => new RegExp(`\\b${attr}(?:\\s|=|>|/)`, 'iu').test(tag)

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const normalizeLoading = (value: unknown): LoadingMode => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return LOADING_MODES.includes(token as LoadingMode) ? (token as LoadingMode) : 'auto'
}

const normalizePriority = (value: unknown): Priority => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  if (/true|priority|high/iu.test(token)) return 'high'
  if (/low/iu.test(token)) return 'low'
  return 'auto'
}

const normalizeDecoding = (value: unknown): DecodingMode => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
  return DECODING_MODES.includes(token as DecodingMode) ? (token as DecodingMode) : 'auto'
}

const numberFromUnknown = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const match = String(value ?? '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/u)
  return match ? Math.round(Number(match[0])) : 0
}

const toKb = (value: unknown) => {
  if (typeof value === 'number') return value > 8192 ? Math.round(value / 1024) : Math.round(value)
  const text = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  const number = Number(text.replace(/kb|kib|mb|mib|bytes?|b$/giu, ''))
  if (!Number.isFinite(number)) return 0
  if (/mb|mib/iu.test(text)) return Math.round(number * 1024)
  if (/\bb|bytes?/iu.test(text) || number > 8192) return Math.round(number / 1024)
  return Math.round(number)
}

const getFormatFromUrl = (url: string) =>
  safeUrl(url)
    ?.pathname.match(/\.([a-z0-9]+)$/iu)?.[1]
    ?.toLowerCase() ?? ''
const hasPrivateQuery = (url: string) =>
  /[?&](token|auth|session|email|user|key|secret|account)=/iu.test(url)
const isDataUri = (url: string) => /^data:/iu.test(url)
const isModernFormat = (format: string) => /avif|webp/iu.test(format)

const parseSrcsetCount = (srcset: string) =>
  srcset
    .split(',')
    .map(item => item.trim())
    .filter(Boolean).length

const parseHtmlWorkspace = (input: string): { images: ParsedImage[]; limited: boolean } => {
  const images: ParsedImage[] = []
  const sourceFormats: string[] = []
  let htmlTagsLimited = false
  let imageMatch: RegExpExecArray | null
  const sourcePattern = /<source\b[^>]*>/giu
  const imagePattern = /<(img|Image)\b[^>]*>/gu

  while (true) {
    const sourceMatch = sourcePattern.exec(input)
    if (!sourceMatch) break
    if (sourceFormats.length >= IMAGE_LIMIT) {
      htmlTagsLimited = true
      break
    }
    sourceFormats.push(getAttr(sourceMatch[0], 'type') || getAttr(sourceMatch[0], 'srcset'))
  }

  while ((imageMatch = imagePattern.exec(input))) {
    if (images.length >= IMAGE_LIMIT) {
      htmlTagsLimited = true
      break
    }
    const tag = imageMatch[0]
    const isNext = imageMatch[1] === 'Image'
    const url = getAttr(tag, 'src') || getAttr(tag, 'href')
    if (!url) continue
    const srcset = getAttr(tag, 'srcset') || getAttr(tag, 'imagesrcset')
    const format =
      getFormatFromUrl(url) ||
      sourceFormats.map(getFormatFromUrl).find(Boolean) ||
      (isDataUri(url) ? 'data' : 'unknown')

    images.push({
      alt: getAttr(tag, 'alt'),
      bytesKb: toKb(getAttr(tag, 'bytes') || getAttr(tag, 'size')),
      decoding: normalizeDecoding(getAttr(tag, 'decoding')),
      format,
      height: numberFromUnknown(getAttr(tag, 'height')),
      id: `${isNext ? 'next' : 'html'}-${images.length}`,
      isLcp:
        hasAttr(tag, 'priority') ||
        /fetchpriority\s*=\s*["']?high/iu.test(tag) ||
        /\blcp\b|hero/iu.test(tag),
      loading: normalizeLoading(
        getAttr(tag, 'loading') || (hasAttr(tag, 'priority') ? 'eager' : 'auto')
      ),
      priority: normalizePriority(
        getAttr(tag, 'fetchpriority') || (hasAttr(tag, 'priority') ? 'priority' : 'auto')
      ),
      sizes: getAttr(tag, 'sizes'),
      source: isNext ? 'next' : 'html',
      srcsetCount: parseSrcsetCount(srcset),
      srcsetHasDataUri: /(?:^|,)\s*data:/iu.test(srcset),
      url,
      width: numberFromUnknown(getAttr(tag, 'width'))
    })
  }

  return { images, limited: htmlTagsLimited }
}

const getObjectValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key]
  }
  return undefined
}

const parseImageObject = (record: Record<string, unknown>, index: number): ParsedImage | null => {
  const url = String(getObjectValue(record, ['url', 'src', 'href', 'image', 'imageUrl']) ?? '')
  if (!url) return null
  const srcset = String(getObjectValue(record, ['srcset', 'imageSrcSet']) ?? '')
  const format = String(
    getObjectValue(record, ['format', 'type', 'mimeType']) ?? getFormatFromUrl(url)
  )
    .replace(/^image\//u, '')
    .toLowerCase()

  return {
    alt: String(record.alt ?? record.altText ?? ''),
    bytesKb: toKb(getObjectValue(record, ['bytesKb', 'transferKb', 'sizeKb', 'bytes', 'size'])),
    decoding: normalizeDecoding(record.decoding),
    format: format || 'unknown',
    height: numberFromUnknown(record.height),
    id: `json-${index}`,
    isLcp: Boolean(record.isLcp ?? record.lcp ?? record.priority === true),
    loading: normalizeLoading(record.loading),
    priority: normalizePriority(
      getObjectValue(record, ['priority', 'fetchPriority', 'fetchpriority'])
    ),
    sizes: String(record.sizes ?? ''),
    source: 'json',
    srcsetCount: parseSrcsetCount(srcset),
    srcsetHasDataUri: /(?:^|,)\s*data:/iu.test(srcset),
    url,
    width: numberFromUnknown(record.width)
  }
}

const parseJsonWorkspace = (
  input: string,
  remainingLimit = IMAGE_LIMIT
): { errors: string[]; images: ParsedImage[]; linesLimited: boolean } => {
  if (remainingLimit <= 0) return { errors: [], images: [], linesLimited: input.trim().length > 0 }

  const errors: string[] = []
  const images: ParsedImage[] = []
  const rows = collectBoundedNonEmptyLines(input, JSON_LINE_SCAN_LIMIT)

  rows.lines.forEach((row, rowIndex) => {
    if (images.length >= remainingLimit) return
    if (!row.startsWith('{') && !row.startsWith('[')) return
    try {
      const parsed = JSON.parse(row) as unknown
      const records = Array.isArray(parsed) ? parsed : [parsed]
      records.forEach((item, index) => {
        if (images.length >= remainingLimit) return
        if (!item || typeof item !== 'object') return
        const parsedImage = parseImageObject(item as Record<string, unknown>, images.length + index)
        if (parsedImage) images.push(parsedImage)
      })
    } catch {
      errors.push(`json:${rowIndex + 1}`)
    }
  })

  return { errors, images, linesLimited: rows.limited }
}

const parseTextWorkspace = (
  input: string,
  remainingLimit = IMAGE_LIMIT
): { images: ParsedImage[]; linesLimited: boolean } => {
  if (remainingLimit <= 0) return { images: [], linesLimited: input.trim().length > 0 }

  const rows = collectBoundedNonEmptyLines(input, TEXT_LINE_SCAN_LIMIT)
  const images: ParsedImage[] = []

  rows.lines.forEach((line, index) => {
    if (images.length >= remainingLimit) return
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || /^<|^#/u.test(trimmed))
      return
    const url =
      tokenValue(trimmed, 'image') ||
      tokenValue(trimmed, 'url') ||
      tokenValue(trimmed, 'src') ||
      (trimmed.match(/(?:https?:\/\/|data:|\/)[^\s,]+/iu)?.[0] ?? '')
    if (!url) return
    const format =
      tokenValue(trimmed, 'format') ||
      tokenValue(trimmed, 'type') ||
      getFormatFromUrl(url) ||
      (isDataUri(url) ? 'data' : 'unknown')

    images.push({
      alt: tokenValue(trimmed, 'alt'),
      bytesKb: toKb(
        tokenValue(trimmed, 'bytes') || tokenValue(trimmed, 'size') || tokenValue(trimmed, 'kb')
      ),
      decoding: normalizeDecoding(tokenValue(trimmed, 'decoding')),
      format: format.replace(/^image\//u, '').toLowerCase(),
      height: numberFromUnknown(tokenValue(trimmed, 'height')),
      id: `text-${index}`,
      isLcp: /lcp\s*=\s*(true|yes)|\blcp\b|hero/iu.test(trimmed),
      loading: normalizeLoading(tokenValue(trimmed, 'loading')),
      priority: normalizePriority(
        tokenValue(trimmed, 'priority') || tokenValue(trimmed, 'fetchpriority')
      ),
      sizes: tokenValue(trimmed, 'sizes'),
      source: 'text',
      srcsetCount: numberFromUnknown(
        tokenValue(trimmed, 'srcset') || tokenValue(trimmed, 'variants')
      ),
      srcsetHasDataUri: /(?:^|,)\s*data:/iu.test(tokenValue(trimmed, 'srcset')),
      url,
      width: numberFromUnknown(tokenValue(trimmed, 'width'))
    })
  })

  return { images, linesLimited: rows.limited }
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const html = parseHtmlWorkspace(source)
  const json = parseJsonWorkspace(source, IMAGE_LIMIT - html.images.length)
  const text = parseTextWorkspace(source, IMAGE_LIMIT - html.images.length - json.images.length)
  const images = [...html.images, ...json.images, ...text.images]
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    images,
    limits: {
      htmlTags: html.limited,
      jsonLines: json.linesLimited,
      textLines: text.linesLimited
    }
  }
}

const draftAsImage = (draft: ImageDraft): ParsedImage => ({
  alt: draft.altText,
  bytesKb: numberFromInput(draft.bytesPerCandidateKb),
  decoding: draft.decoding,
  format: draft.formats[0] ?? 'jpeg',
  height: numberFromInput(draft.height),
  id: 'manual-image',
  isLcp: draft.isLcp === 'yes',
  loading: draft.loading,
  priority: draft.priority,
  sizes: draft.sizes,
  source: 'text',
  srcsetCount: FORMATS.length * Math.max(1, Math.min(4, Math.ceil(numberFromInput(draft.dprMax)))),
  srcsetHasDataUri: false,
  url: draft.imageUrl,
  width: numberFromInput(draft.width)
})

const auditImage = (draft: ImageDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const width = numberFromInput(draft.width)
  const height = numberFromInput(draft.height)
  const slot = numberFromInput(draft.slotWidth)
  const dprMax = numberFromInput(draft.dprMax)
  const bytes = numberFromInput(draft.bytesPerCandidateKb)
  const quality = numberFromInput(draft.quality)
  const url = safeUrl(draft.imageUrl)

  if (!draft.imageUrl.trim()) add('danger', 'missing_url', draft.routePattern)
  else if (!url && !isDataUri(draft.imageUrl)) add('danger', 'invalid_url', draft.imageUrl)
  else if (url?.protocol === 'http:') add('danger', 'http_url', draft.imageUrl)
  if (hasPrivateQuery(draft.imageUrl)) add('danger', 'private_query', draft.imageUrl)
  if (isDataUri(draft.imageUrl)) add('danger', 'data_uri', draft.routePattern)
  if (draft.isLcp === 'yes' && draft.loading === 'lazy')
    add('danger', 'lcp_lazy', draft.routePattern)
  if (draft.isLcp === 'yes' && draft.priority !== 'high')
    add('danger', 'lcp_low_priority', draft.priority)
  if (draft.isLcp === 'yes' && draft.decoding === 'sync')
    add('warn', 'sync_lcp_decode', draft.routePattern)
  if (!width || !height) add('danger', 'missing_dimensions', draft.imageUrl || draft.routePattern)
  if (!draft.altText.trim()) add('warn', 'missing_alt', draft.imageUrl || draft.routePattern)
  if (!draft.sizes.trim()) add('danger', 'missing_sizes', draft.routePattern)
  else if (draft.sizes.trim() === '100vw' && slot && slot < 640)
    add('warn', 'oversized_sizes', draft.sizes)
  if (!draft.formats.some(isModernFormat))
    add('danger', 'missing_modern_format', draft.formats.join(', '))
  if (draft.formats.length < 2) add('warn', 'single_format', draft.formats.join(', '))
  if (bytes > 1200) add('danger', 'huge_candidate', `${bytes} KB`)
  else if (bytes > 420) add('warn', 'heavy_candidate', `${bytes} KB`)
  if (width && slot && width > slot * Math.max(1.5, dprMax + 0.8))
    add('warn', 'oversized_intrinsic', `${width}px / ${slot}px`)
  if (quality > 92) add('warn', 'quality_high', String(quality))
  if (dprMax > 3) add('warn', 'too_many_dpr', `${dprMax}x`)
  if (draft.priority === 'high' && draft.isLcp === 'no' && draft.loading === 'lazy')
    add('warn', 'lazy_high_priority', draft.imageUrl)
  if (safeUrl(draft.cdnBase)?.protocol === 'http:') add('warn', 'http_cdn', draft.cdnBase)

  parsed.images.forEach(image => {
    const parsedUrl = safeUrl(image.url)
    if (parsedUrl?.protocol === 'http:') add('danger', 'parsed_http', image.url)
    if (hasPrivateQuery(image.url)) add('danger', 'parsed_private_query', image.url)
    if (isDataUri(image.url) || image.srcsetHasDataUri)
      add('danger', 'parsed_data_uri', image.url.slice(0, 80))
    if (image.isLcp && image.loading === 'lazy') add('danger', 'parsed_lcp_lazy', image.url)
    if (image.isLcp && image.priority !== 'high')
      add('danger', 'parsed_lcp_low_priority', image.url)
    if (!image.width || !image.height) add('danger', 'parsed_missing_dimensions', image.url)
    if (!image.sizes && image.srcsetCount > 1) add('warn', 'parsed_missing_sizes', image.url)
    if (image.sizes === '100vw' && image.width && image.width < 900)
      add('warn', 'parsed_oversized_sizes', image.url)
    if (!isModernFormat(image.format) && !/svg|gif|data/iu.test(image.format))
      add('warn', 'parsed_legacy_format', `${image.format}: ${image.url}`)
    if (image.bytesKb > 1400)
      add('danger', 'parsed_huge_transfer', `${image.url}: ${image.bytesKb} KB`)
    else if (image.bytesKb > 480)
      add('warn', 'parsed_heavy_transfer', `${image.url}: ${image.bytesKb} KB`)
    if (image.srcsetCount > 10)
      add('warn', 'parsed_too_many_variants', `${image.url}: ${image.srcsetCount}`)
    if (image.decoding === 'sync' && !image.isLcp) add('warn', 'parsed_sync_decoding', image.url)
  })

  const highPriorityCount =
    parsed.images.filter(image => image.priority === 'high').length +
    (draft.priority === 'high' ? 1 : 0)
  if (highPriorityCount > 4) add('warn', 'too_many_high_priority', String(highPriorityCount))
  if (
    parsed.limits.htmlTags ||
    parsed.limits.jsonLines ||
    parsed.limits.textLines ||
    parsed.images.length >= IMAGE_LIMIT
  ) {
    add('warn', 'scan_limited', String(IMAGE_LIMIT))
  }
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'modern_ok', draft.formats.join(', '))
    add('good', 'dimensions_ok', `${width}x${height}`)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 15 : finding.level === 'warn' ? 6 : 0),
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

const getCandidateWidths = (draft: ImageDraft) => {
  const slot = numberFromInput(draft.slotWidth) || numberFromInput(draft.width) || 960
  const maxWidth = numberFromInput(draft.width) || slot * 2
  const dprMax = Math.max(1, Math.min(4, Math.ceil(numberFromInput(draft.dprMax) || 2)))
  return Array.from(
    new Set(
      [1, 1.5, 2, 3, 4]
        .slice(0, dprMax + 1)
        .map(scale => Math.min(maxWidth, Math.round(slot * scale)))
    )
  )
}

const cdnUrl = (draft: ImageDraft, format: Format, width: number) => {
  const base = draft.cdnBase.trim() || 'https://images.example.com/cdn'
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}url=${encodeURIComponent(draft.imageUrl)}&w=${width}&q=${numberFromInput(draft.quality) || 78}&fm=${format}&fit=${draft.fit}`
}

const buildPicture = (draft: ImageDraft) => {
  const widths = getCandidateWidths(draft)
  const fallbackFormat = draft.formats.includes('jpeg')
    ? 'jpeg'
    : (draft.formats[draft.formats.length - 1] ?? 'jpeg')
  const sources = draft.formats
    .filter(format => format !== fallbackFormat)
    .map(format => {
      const srcset = widths
        .map(width => `${escapeHtml(cdnUrl(draft, format, width))} ${width}w`)
        .join(', ')
      return `<source type="image/${format}" srcset="${srcset}" sizes="${escapeHtml(draft.sizes)}">`
    })
  const fallbackWidth = numberFromInput(draft.width) || widths[widths.length - 1] || 1280
  const fallbackHeight = numberFromInput(draft.height) || Math.round(fallbackWidth * 0.5625)
  const fallbackSrc = cdnUrl(draft, fallbackFormat, fallbackWidth)

  return [
    '<picture>',
    ...sources.map(source => `  ${source}`),
    `  <img src="${escapeHtml(fallbackSrc)}" width="${fallbackWidth}" height="${fallbackHeight}" loading="${draft.loading}" decoding="${draft.decoding}" fetchpriority="${draft.priority}" alt="${escapeHtml(draft.altText)}">`,
    '</picture>'
  ].join('\n')
}

const buildNextImage = (draft: ImageDraft) => {
  const width = numberFromInput(draft.width) || 1280
  const height = numberFromInput(draft.height) || 720
  return [
    "import Image from 'next/image'",
    '',
    '<Image',
    `  src="${escapeJs(draft.imageUrl)}"`,
    `  alt="${escapeJs(draft.altText)}"`,
    `  width={${width}}`,
    `  height={${height}}`,
    `  sizes="${escapeJs(draft.sizes)}"`,
    `  quality={${numberFromInput(draft.quality) || 78}}`,
    draft.isLcp === 'yes' ? '  priority' : `  loading="${draft.loading}"`,
    `  fetchPriority="${draft.priority}"`,
    `  decoding="${draft.decoding}"`,
    '/>'
  ].join('\n')
}

const buildPreload = (draft: ImageDraft) => {
  const widths = getCandidateWidths(draft)
  const format = draft.formats[0] ?? 'avif'
  const srcset = widths
    .map(width => `${escapeHtml(cdnUrl(draft, format, width))} ${width}w`)
    .join(', ')
  return [
    `<link rel="preload" as="image" href="${escapeHtml(cdnUrl(draft, format, widths[0] ?? 960))}" imagesrcset="${srcset}" imagesizes="${escapeHtml(draft.sizes)}" fetchpriority="high">`,
    `Link: <${cdnUrl(draft, format, widths[0] ?? 960)}>; rel=preload; as=image; imagesrcset="${srcset}"; imagesizes="${draft.sizes}"`
  ].join('\n')
}

const buildCdnTable = (draft: ImageDraft) => {
  const widths = getCandidateWidths(draft)
  return [
    'format,width,url',
    ...draft.formats.flatMap(format =>
      widths.map(width => [format, width, cdnUrl(draft, format, width)].map(escapeCsv).join(','))
    )
  ].join('\n')
}

const buildMarkdown = (draft: ImageDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# Image delivery plan: ${draft.routePattern}`,
    '',
    `- Candidate: ${draft.imageUrl}`,
    `- Slot: ${draft.slotWidth}px`,
    `- Intrinsic: ${draft.width || '-'}x${draft.height || '-'}`,
    `- Formats: ${draft.formats.join(', ')}`,
    `- Loading: ${draft.loading}`,
    `- Priority: ${draft.priority}`,
    `- Sizes: ${draft.sizes}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 24)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed images',
    ...parsed.images
      .slice(0, 18)
      .map(
        image =>
          `- ${image.format} / ${image.width}x${image.height} / ${image.bytesKb} KB / ${image.priority}: ${image.url}`
      )
  ].join('\n')

const buildCsv = (draft: ImageDraft, parsed: ParsedWorkspace) => {
  const rows = [draftAsImage(draft), ...parsed.images]
  return [
    [
      'url',
      'source',
      'format',
      'width',
      'height',
      'sizes',
      'loading',
      'priority',
      'decoding',
      'bytesKb',
      'srcsetCount',
      'isLcp',
      'alt'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(image =>
      [
        image.url,
        image.source,
        image.format,
        image.width,
        image.height,
        image.sizes,
        image.loading,
        image.priority,
        image.decoding,
        image.bytesKb,
        image.srcsetCount,
        image.isLcp,
        image.alt
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: ImageDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'picture') return buildPicture(draft)
  if (outputType === 'next') return buildNextImage(draft)
  if (outputType === 'preload') return buildPreload(draft)
  if (outputType === 'cdn') return buildCdnTable(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, parsedImages: parsed.images }, null, 2)
  return buildCsv(draft, parsed)
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

export default function ImageDeliveryClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ImageDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('picture')
  const [auditQuery, setAuditQuery] = useState('')
  const [imageQuery, setImageQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredImageQuery = useDeferredValue(imageQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('capped_input')) return next

    return { ...next, errors: [...next.errors, 'capped_input'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditImage(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      images: parsed.images.slice(0, OUTPUT_PREVIEW_ROWS),
      limits: parsed.limits
    }),
    [parsed.errors, parsed.images, parsed.limits]
  )
  const outputPreviewFindings = useMemo(() => findings.slice(0, OUTPUT_PREVIEW_ROWS), [findings])
  const outputPreviewSource = useMemo(
    () => buildOutput(draft, outputPreviewParsed, outputPreviewFindings, outputType),
    [draft, outputPreviewFindings, outputPreviewParsed, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewUsesParsedRows =
    outputType === 'markdown' || outputType === 'json' || outputType === 'csv'
  const outputPreviewUsesFindings = outputType === 'markdown' || outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesParsedRows ? outputPreviewParsed.images.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.images.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.image_delivery.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredImages = useMemo(() => {
    const query = deferredImageQuery.trim().toLowerCase()
    if (!query) return parsed.images
    return parsed.images.filter(image =>
      `${image.url} ${image.format} ${image.loading} ${image.priority} ${image.source}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredImageQuery, parsed.images])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, VISIBLE_FINDINGS_LIMIT),
    [filteredFindings]
  )
  const visibleImages = useMemo(
    () => filteredImages.slice(0, VISIBLE_IMAGES_LIMIT),
    [filteredImages]
  )
  const findingsRenderLimited = filteredFindings.length > visibleFindings.length
  const imagesRenderLimited = filteredImages.length > visibleImages.length
  const metrics = useMemo(
    () => ({
      candidates: draft.formats.length * getCandidateWidths(draft).length,
      critical: findings.filter(item => item.level === 'danger').length,
      images: parsed.images.length,
      score,
      transfer: `${numberFromInput(draft.bytesPerCandidateKb)} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft, findings, parsed.images.length, score]
  )

  const updateDraft = <Key extends keyof ImageDraft>(key: Key, value: ImageDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const toggleFormat = (format: Format) => {
    setDraft(current => {
      const formats = current.formats.includes(format)
        ? current.formats.filter(item => item !== format)
        : [...current.formats, format]
      return { ...current, formats: formats.length ? formats : [format] }
    })
  }

  const updateWorkspace = useCallback((value: string) => {
    const capped = value.length > WORKSPACE_LIMIT

    setIsWorkspaceCapped(capped)
    setWorkspace(capped ? value.slice(0, WORKSPACE_LIMIT) : value)
  }, [])

  const applyPreset = useCallback(
    (preset: Preset) => {
      setDraft(preset.draft)
      updateWorkspace(preset.workspace)
    },
    [updateWorkspace]
  )

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    updateWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('picture')
    setAuditQuery('')
    setImageQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.image_delivery.summary_title'),
        `${t('app.converter.image_delivery.metric.score')}: ${metrics.score}`,
        `${t('app.converter.image_delivery.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.image_delivery.metric.candidates')}: ${metrics.candidates}`,
        `${t('app.converter.image_delivery.metric.images')}: ${metrics.images}`,
        `${t('app.converter.image_delivery.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.image_delivery.metric.critical')}: ${metrics.critical}`
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
                <ImageIcon className="h-4 w-4" />
                {t('app.converter.image-delivery')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.image-delivery')}</CardTitle>
              <CardDescription>{t('app.converter.image_delivery.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.image_delivery.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.image_delivery.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.image_delivery.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric
              label={t('app.converter.image_delivery.metric.candidates')}
              value={metrics.candidates}
            />
            <Metric
              label={t('app.converter.image_delivery.metric.images')}
              value={metrics.images}
            />
            <Metric
              label={t('app.converter.image_delivery.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.image_delivery.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.image_delivery.presets')}</CardTitle>
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
                {t(`app.converter.image_delivery.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.image_delivery.preset.${preset.key}_hint`)}
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
                {t('app.converter.image_delivery.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.image_delivery.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-delivery-route">
                  {t('app.converter.image_delivery.route_pattern')}
                </Label>
                <Input
                  id="image-delivery-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-lcp">
                  {t('app.converter.image_delivery.is_lcp')}
                </Label>
                <Select
                  id="image-delivery-lcp"
                  value={draft.isLcp}
                  onChange={event =>
                    updateDraft('isLcp', event.target.value as ImageDraft['isLcp'])
                  }
                >
                  <option value="yes">{t('app.converter.image_delivery.boolean.yes')}</option>
                  <option value="no">{t('app.converter.image_delivery.boolean.no')}</option>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="image-delivery-url">
                  {t('app.converter.image_delivery.image_url')}
                </Label>
                <Input
                  id="image-delivery-url"
                  value={draft.imageUrl}
                  onChange={event => updateDraft('imageUrl', event.target.value.slice(0, 360))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="image-delivery-cdn">
                  {t('app.converter.image_delivery.cdn_base')}
                </Label>
                <Input
                  id="image-delivery-cdn"
                  value={draft.cdnBase}
                  onChange={event => updateDraft('cdnBase', event.target.value.slice(0, 280))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-slot">
                  {t('app.converter.image_delivery.slot_width')}
                </Label>
                <Input
                  id="image-delivery-slot"
                  value={draft.slotWidth}
                  onChange={event => updateDraft('slotWidth', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-dpr">
                  {t('app.converter.image_delivery.dpr_max')}
                </Label>
                <Input
                  id="image-delivery-dpr"
                  value={draft.dprMax}
                  onChange={event => updateDraft('dprMax', event.target.value.slice(0, 6))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-width">
                  {t('app.converter.image_delivery.width')}
                </Label>
                <Input
                  id="image-delivery-width"
                  value={draft.width}
                  onChange={event => updateDraft('width', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-height">
                  {t('app.converter.image_delivery.height')}
                </Label>
                <Input
                  id="image-delivery-height"
                  value={draft.height}
                  onChange={event => updateDraft('height', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-quality">
                  {t('app.converter.image_delivery.quality')}
                </Label>
                <Input
                  id="image-delivery-quality"
                  value={draft.quality}
                  onChange={event => updateDraft('quality', event.target.value.slice(0, 6))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-bytes">
                  {t('app.converter.image_delivery.bytes_per_candidate')}
                </Label>
                <Input
                  id="image-delivery-bytes"
                  value={draft.bytesPerCandidateKb}
                  onChange={event =>
                    updateDraft('bytesPerCandidateKb', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-loading">
                  {t('app.converter.image_delivery.loading')}
                </Label>
                <Select
                  id="image-delivery-loading"
                  value={draft.loading}
                  onChange={event => updateDraft('loading', event.target.value as LoadingMode)}
                >
                  {LOADING_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {t(`app.converter.image_delivery.loading.${mode}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-priority">
                  {t('app.converter.image_delivery.priority')}
                </Label>
                <Select
                  id="image-delivery-priority"
                  value={draft.priority}
                  onChange={event => updateDraft('priority', event.target.value as Priority)}
                >
                  {PRIORITIES.map(priority => (
                    <option key={priority} value={priority}>
                      {t(`app.converter.image_delivery.priority.${priority}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-decoding">
                  {t('app.converter.image_delivery.decoding')}
                </Label>
                <Select
                  id="image-delivery-decoding"
                  value={draft.decoding}
                  onChange={event => updateDraft('decoding', event.target.value as DecodingMode)}
                >
                  {DECODING_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {t(`app.converter.image_delivery.decoding.${mode}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-delivery-fit">{t('app.converter.image_delivery.fit')}</Label>
                <Select
                  id="image-delivery-fit"
                  value={draft.fit}
                  onChange={event => updateDraft('fit', event.target.value as FitMode)}
                >
                  {FIT_MODES.map(mode => (
                    <option key={mode} value={mode}>
                      {t(`app.converter.image_delivery.fit.${mode}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="image-delivery-sizes">
                  {t('app.converter.image_delivery.sizes')}
                </Label>
                <Input
                  id="image-delivery-sizes"
                  value={draft.sizes}
                  onChange={event => updateDraft('sizes', event.target.value.slice(0, 260))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="image-delivery-alt">
                  {t('app.converter.image_delivery.alt_text')}
                </Label>
                <Input
                  id="image-delivery-alt"
                  value={draft.altText}
                  onChange={event =>
                    updateDraft('altText', event.target.value.slice(0, ALT_TEXT_FIELD_LIMIT))
                  }
                  maxLength={ALT_TEXT_FIELD_LIMIT}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>{t('app.converter.image_delivery.formats')}</Label>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map(format => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => toggleFormat(format)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition ${draft.formats.includes(format) ? 'border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]' : 'border-[var(--border)] bg-white/5 text-[var(--text-secondary)]'}`}
                    >
                      {t(`app.converter.image_delivery.format.${format}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.image_delivery.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.image_delivery.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.image_delivery.workspace_placeholder')}
              className="min-h-[470px] font-mono"
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
                onClick={() => updateWorkspace('')}
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
              <CardTitle className="text-base">{t('app.converter.image_delivery.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.image_delivery.audit_search')}
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
                      {t(`app.converter.image_delivery.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.image_delivery.level.${finding.level}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {findingsRenderLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.rows_render_limited', {
                  total: filteredFindings.length.toLocaleString(),
                  visible: visibleFindings.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-base">
                  {t('app.converter.image_delivery.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.image_delivery.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="image-delivery-output">
                  {t('app.converter.image_delivery.output_type')}
                </Label>
                <Select
                  id="image-delivery-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.image_delivery.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[360px] font-mono" />
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
                  total: outputPreviewTotalRows.toLocaleString(),
                  visible: outputPreviewVisibleRows.toLocaleString()
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
                {t('app.converter.image_delivery.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'image-delivery-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.image_delivery.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentCsv(), 'image-delivery.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.image_delivery.download_csv')}
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
                {t('app.converter.image_delivery.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={imageQuery}
                onChange={event => setImageQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.image_delivery.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredImages.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleImages.map(image => (
                  <div
                    key={`${image.id}:${image.url}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {image.format}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(image.isLcp && (image.loading === 'lazy' || image.priority !== 'high') ? 'danger' : image.bytesKb > 480 || !image.sizes ? 'warn' : 'good')}`}
                      >
                        {image.priority}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {image.url}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {image.width}x{image.height} / {image.bytesKb} KB / {image.loading} /{' '}
                      {image.source}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.image_delivery.empty')}
              </div>
            )}
            {imagesRenderLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.rows_render_limited', {
                  total: filteredImages.length.toLocaleString(),
                  visible: visibleImages.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.converter.image_delivery.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.image_delivery.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.image_delivery.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.image_delivery.reference.${item}_hint`)}
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
                  {t('app.converter.image_delivery.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.image_delivery.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.image_delivery.checklist.${item}.body`)}
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
