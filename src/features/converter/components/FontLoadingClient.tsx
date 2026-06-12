'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Type,
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

const FONT_FORMATS = ['woff2', 'woff', 'ttf', 'otf', 'variable'] as const
const FONT_DISPLAYS = ['swap', 'optional', 'fallback', 'block', 'auto'] as const
const OUTPUT_TYPES = ['css', 'preload', 'next', 'fallback', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 70000
const FONT_LIMIT = 180
const UNICODE_RANGE_FIELD_LIMIT = 512

type FontFormat = (typeof FONT_FORMATS)[number]
type FontDisplay = (typeof FONT_DISPLAYS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type FontSource = 'css' | 'json' | 'link' | 'manual' | 'text'

interface FontDraft {
  clsRisk: string
  crossOrigin: 'no' | 'yes'
  display: FontDisplay
  fallbackStack: string
  family: string
  format: FontFormat
  preload: 'no' | 'yes'
  routePattern: string
  style: string
  subsetKb: string
  transferKb: string
  unicodeRange: string
  url: string
  weight: string
}

interface ParsedFont {
  clsRisk: number
  crossOrigin: boolean
  display: FontDisplay | 'unknown'
  family: string
  format: FontFormat | 'unknown'
  id: string
  preload: boolean
  raw: string
  source: FontSource
  style: string
  transferKb: number
  unicodeRange: string
  url: string
  valid: boolean
  weight: string
}

interface ParsedWorkspace {
  errors: string[]
  fonts: ParsedFont[]
}

interface Preset {
  draft: FontDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: FontDraft = {
  clsRisk: '0.02',
  crossOrigin: 'yes',
  display: 'swap',
  fallbackStack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  family: 'Inter',
  format: 'woff2',
  preload: 'yes',
  routePattern: '/*',
  style: 'normal',
  subsetKb: '38',
  transferKb: '54',
  unicodeRange: 'U+000-5FF',
  url: 'https://cdn.example.com/fonts/inter-var.woff2',
  weight: '100 900'
}

const PRESETS: Preset[] = [
  {
    key: 'brand',
    draft: DEFAULT_DRAFT,
    workspace: [
      '<link rel="preload" href="https://cdn.example.com/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>',
      '@font-face { font-family: "Inter"; src: url("https://cdn.example.com/fonts/inter-var.woff2") format("woff2"); font-weight: 100 900; font-style: normal; font-display: swap; unicode-range: U+000-5FF; }'
    ].join('\n')
  },
  {
    key: 'local',
    draft: {
      ...DEFAULT_DRAFT,
      crossOrigin: 'no',
      family: 'Brand Sans',
      transferKb: '42',
      url: '/fonts/brand-sans.woff2',
      weight: '400 700'
    },
    workspace: [
      '<link rel="preload" href="/fonts/brand-sans.woff2" as="font" type="font/woff2">',
      '@font-face { font-family: "Brand Sans"; src: url("/fonts/brand-sans.woff2") format("woff2"); font-weight: 400 700; font-display: optional; }'
    ].join('\n')
  },
  {
    key: 'editorial',
    draft: {
      ...DEFAULT_DRAFT,
      clsRisk: '0.04',
      display: 'fallback',
      family: 'Editorial Serif',
      fallbackStack: 'Georgia, "Times New Roman", serif',
      style: 'normal',
      subsetKb: '72',
      transferKb: '118',
      unicodeRange: 'U+000-5FF, U+2010-205E',
      url: '/fonts/editorial-serif.woff2',
      weight: '400'
    },
    workspace: [
      '@font-face { font-family: "Editorial Serif"; src: url("/fonts/editorial-serif.woff2") format("woff2"); font-weight: 400; font-display: fallback; unicode-range: U+000-5FF, U+2010-205E; }',
      'font=/fonts/editorial-serif-bold.woff2 family="Editorial Serif" weight=700 display=fallback size=96KB subset=58KB preload=false'
    ].join('\n')
  },
  {
    key: 'commerce',
    draft: {
      ...DEFAULT_DRAFT,
      family: 'Checkout UI',
      routePattern: '/checkout',
      subsetKb: '26',
      transferKb: '34',
      url: '/fonts/checkout-ui.woff2',
      weight: '400 700'
    },
    workspace: [
      '{"family":"Checkout UI","url":"/fonts/checkout-ui.woff2","display":"swap","preload":true,"crossOrigin":false,"format":"woff2","weight":"400 700","transferKb":34,"subsetKb":26,"clsRisk":0.01}',
      '<link rel="preload" href="/fonts/checkout-ui.woff2" as="font" type="font/woff2">'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      clsRisk: '0.21',
      crossOrigin: 'no',
      display: 'block',
      fallbackStack: '',
      family: 'Marketing Display',
      format: 'ttf',
      preload: 'no',
      routePattern: '/landing',
      style: 'normal',
      subsetKb: '260',
      transferKb: '420',
      unicodeRange: '',
      url: 'http://fonts.example.com/marketing.ttf?token=abc',
      weight: '400'
    },
    workspace: [
      '@font-face { font-family: "Marketing Display"; src: url("http://fonts.example.com/marketing.ttf?token=abc") format("truetype"); font-display: block; font-weight: 400; }',
      '@font-face { font-family: "Marketing Display"; src: url("http://fonts.example.com/marketing.ttf?token=abc") format("truetype"); font-display: auto; font-weight: 700; }',
      '<link rel="preload" href="http://fonts.example.com/marketing.ttf?token=abc" as="font" type="font/ttf">',
      'font=https://cdn.example.com/heavy-serif.woff2 family="Heavy Serif" display=block size=260KB subset=190KB preload=false crossorigin=false cls=0.18'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = [
  'display',
  'preload',
  'subset',
  'fallback',
  'variable',
  'crossorigin',
  'measure'
] as const
const CHECKLIST_ITEMS = ['critical', 'display', 'fallback', 'measure'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCss = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const getAttr = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? ''
}

const hasAttr = (tag: string, attr: string) => new RegExp(`\\b${attr}(?:\\s|=|>|/)`, 'iu').test(tag)

const safeUrl = (value: string) => {
  try {
    return new URL(value.trim(), 'https://www.example.com')
  } catch {
    return null
  }
}

const isCrossOrigin = (value: string) => {
  const parsed = safeUrl(value)
  if (!parsed) return false
  return parsed.origin !== 'https://www.example.com'
}

const normalizeDisplay = (value: string): FontDisplay | 'unknown' => {
  const next = value.trim().toLowerCase()
  return FONT_DISPLAYS.includes(next as FontDisplay) ? (next as FontDisplay) : 'unknown'
}

const normalizeFormat = (value: string): FontFormat | 'unknown' => {
  const next = value.trim().toLowerCase()
  if (next === 'truetype') return 'ttf'
  if (next === 'opentype') return 'otf'
  return FONT_FORMATS.includes(next as FontFormat) ? (next as FontFormat) : 'unknown'
}

const inferFormat = (url: string, raw = ''): FontFormat | 'unknown' => {
  const sample = `${url} ${raw}`.toLowerCase()
  if (/woff2|format\(["']?woff2/.test(sample)) return 'woff2'
  if (/woff|format\(["']?woff/.test(sample)) return 'woff'
  if (/ttf|truetype/.test(sample)) return 'ttf'
  if (/otf|opentype/.test(sample)) return 'otf'
  if (/variable|var\./.test(sample)) return 'variable'
  return 'unknown'
}

const compactText = (value: string) => value.replace(/\s+/gu, ' ').trim()

const declarationValue = (block: string, property: string) => {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'iu'))
  return match?.[1]?.trim().replace(/^["']|["']$/gu, '') ?? ''
}

const parseCompactTokens = (line: string) => {
  const result = new Map<string, string>()
  const tokenPattern = /([a-zA-Z][\w-]*)=("[^"]*"|'[^']*'|[^\s]+)/gu
  for (const match of line.matchAll(tokenPattern)) {
    result.set(match[1].toLowerCase(), (match[2] ?? '').replace(/^["']|["']$/gu, ''))
  }
  return result
}

const parsedFromDraft = (draft: FontDraft): ParsedFont => ({
  clsRisk: numberFromInput(draft.clsRisk),
  crossOrigin: draft.crossOrigin === 'yes',
  display: draft.display,
  family: draft.family.trim() || 'Font',
  format: draft.format,
  id: 'manual',
  preload: draft.preload === 'yes',
  raw: '',
  source: 'manual',
  style: draft.style.trim() || 'normal',
  transferKb: numberFromInput(draft.transferKb),
  unicodeRange: draft.unicodeRange.trim(),
  url: draft.url.trim(),
  valid: Boolean(draft.url.trim()),
  weight: draft.weight.trim() || '400'
})

const parseCssBlocks = (input: string): ParsedFont[] => {
  const fonts: ParsedFont[] = []
  const blocks = input.match(/@font-face\s*\{[^}]*\}/giu) ?? []

  blocks.forEach((block, index) => {
    const urlMatch = block.match(/url\((?:"([^"]+)"|'([^']+)'|([^)]+))\)/iu)
    const formatMatch = block.match(/format\((?:"([^"]+)"|'([^']+)'|([^)]+))\)/iu)
    const url = urlMatch?.[1] ?? urlMatch?.[2] ?? urlMatch?.[3] ?? ''
    const display = normalizeDisplay(declarationValue(block, 'font-display'))
    const format = normalizeFormat(formatMatch?.[1] ?? formatMatch?.[2] ?? formatMatch?.[3] ?? '')

    fonts.push({
      clsRisk: 0,
      crossOrigin: /crossorigin/iu.test(block),
      display,
      family: declarationValue(block, 'font-family') || 'font-face',
      format: format === 'unknown' ? inferFormat(url, block) : format,
      id: `css-${index}`,
      preload: false,
      raw: compactText(block),
      source: 'css',
      style: declarationValue(block, 'font-style') || 'normal',
      transferKb: 0,
      unicodeRange: declarationValue(block, 'unicode-range'),
      url: url.trim(),
      valid: Boolean(url.trim()),
      weight: declarationValue(block, 'font-weight') || '400'
    })
  })

  return fonts
}

const parseLinkTags = (input: string): ParsedFont[] => {
  const tags = input.match(/<link\b[^>]*>/giu) ?? []

  return tags
    .map((tag, index): ParsedFont | null => {
      const rel = getAttr(tag, 'rel').toLowerCase()
      const asValue = getAttr(tag, 'as').toLowerCase()
      const href = getAttr(tag, 'href')
      const type = getAttr(tag, 'type').toLowerCase()
      if (!href || (!/preload/u.test(rel) && asValue !== 'font' && !/font/u.test(type))) return null
      const file = safeUrl(href)?.pathname.split('/').pop() ?? href.split('/').pop() ?? 'font'
      const family = file.replace(/\.(woff2?|ttf|otf)$/iu, '').replace(/[-_]+/gu, ' ')

      return {
        clsRisk: 0,
        crossOrigin: hasAttr(tag, 'crossorigin'),
        display: 'unknown',
        family,
        format: inferFormat(href, tag),
        id: `link-${index}`,
        preload: /preload/u.test(rel),
        raw: compactText(tag),
        source: 'link',
        style: 'normal',
        transferKb: 0,
        unicodeRange: '',
        url: href.trim(),
        valid: Boolean(href.trim()),
        weight: '400'
      }
    })
    .filter((font): font is ParsedFont => Boolean(font))
}

const parseJsonFonts = (input: string): { errors: string[]; fonts: ParsedFont[] } => {
  const errors: string[] = []
  const fonts: ParsedFont[] = []
  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, rowIndex) => {
    try {
      const parsed = JSON.parse(row) as unknown
      const values = Array.isArray(parsed) ? parsed : [parsed]
      values.forEach((item, index) => {
        if (!item || typeof item !== 'object') return
        const record = item as Record<string, unknown>
        const url = String(record.url ?? record.href ?? record.src ?? '')
        const family = String(record.family ?? record.fontFamily ?? record.name ?? 'Font')
        fonts.push({
          clsRisk: Number(record.clsRisk ?? record.cls ?? 0) || 0,
          crossOrigin: Boolean(record.crossOrigin ?? record.crossorigin),
          display: normalizeDisplay(String(record.display ?? record.fontDisplay ?? 'unknown')),
          family,
          format: normalizeFormat(String(record.format ?? inferFormat(url))),
          id: `json-${rowIndex}-${index}`,
          preload: Boolean(record.preload ?? record.preloaded),
          raw: compactText(row),
          source: 'json',
          style: String(record.style ?? record.fontStyle ?? 'normal'),
          transferKb: Number(record.transferKb ?? record.sizeKb ?? record.kb ?? 0) || 0,
          unicodeRange: String(record.unicodeRange ?? record.range ?? ''),
          url,
          valid: Boolean(url),
          weight: String(record.weight ?? record.fontWeight ?? '400')
        })
      })
    } catch {
      errors.push(`json:${rowIndex + 1}`)
    }
  })

  return { errors, fonts }
}

const parseCompactRows = (input: string): ParsedFont[] =>
  input
    .split(/\n+/u)
    .map((line, index): ParsedFont | null => {
      const trimmed = line.trim()
      if (!/^font\s*=|^family\s*=|^url\s*=/iu.test(trimmed)) return null
      const tokens = parseCompactTokens(trimmed)
      const url = tokens.get('font') ?? tokens.get('url') ?? tokens.get('src') ?? ''
      const family = tokens.get('family') ?? tokens.get('name') ?? 'Font'

      return {
        clsRisk: Number(tokens.get('cls') ?? tokens.get('clsrisk') ?? 0) || 0,
        crossOrigin: /true|yes|anonymous/iu.test(
          tokens.get('crossorigin') ?? tokens.get('cross-origin') ?? ''
        ),
        display: normalizeDisplay(tokens.get('display') ?? ''),
        family,
        format: normalizeFormat(tokens.get('format') ?? inferFormat(url)),
        id: `text-${index}`,
        preload: /true|yes|preload/iu.test(tokens.get('preload') ?? ''),
        raw: trimmed,
        source: 'text',
        style: tokens.get('style') ?? 'normal',
        transferKb:
          Number(
            (tokens.get('size') ?? tokens.get('transfer') ?? tokens.get('kb') ?? '0').replace(
              /kb$/iu,
              ''
            )
          ) || 0,
        unicodeRange: tokens.get('range') ?? tokens.get('unicode') ?? '',
        url,
        valid: Boolean(url),
        weight: tokens.get('weight') ?? '400'
      }
    })
    .filter((font): font is ParsedFont => Boolean(font))

const mergePreloadSignals = (fonts: ParsedFont[]) => {
  const preloadedUrls = new Set(fonts.filter(font => font.preload).map(font => font.url))
  return fonts.map(font => {
    if (font.preload || !preloadedUrls.has(font.url)) return font
    return {
      ...font,
      crossOrigin:
        font.crossOrigin || fonts.some(item => item.url === font.url && item.crossOrigin),
      preload: true
    }
  })
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length >= WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonFonts(source)
  const fonts = mergePreloadSignals([
    ...parseCssBlocks(source),
    ...parseLinkTags(source),
    ...json.fonts,
    ...parseCompactRows(source)
  ]).slice(0, FONT_LIMIT)

  return {
    errors: [...json.errors, ...(input.length >= WORKSPACE_LIMIT ? ['capped_input'] : [])],
    fonts
  }
}

const declarationKey = (font: ParsedFont) =>
  `${font.family.toLowerCase()}|${font.url.toLowerCase()}`

const auditFonts = (draft: FontDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const manual = parsedFromDraft(draft)
  const fonts = [manual, ...parsed.fonts]
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const url = safeUrl(manual.url)

  if (!manual.url) add('danger', 'missing_url', manual.family)
  else if (!url) add('danger', 'invalid_url', manual.url)
  else if (url.protocol === 'http:') add('danger', 'http_url', manual.url)
  if (manual.format !== 'woff2' && manual.format !== 'variable')
    add('warn', 'non_woff2', manual.format)
  if (manual.display === 'block') add('danger', 'display_block', manual.family)
  if (manual.display === 'auto') add('warn', 'display_auto', manual.family)
  if (manual.preload === false && numberFromInput(draft.transferKb) <= 120)
    add('warn', 'no_preload', manual.family)
  if (manual.preload && isCrossOrigin(manual.url) && !manual.crossOrigin)
    add('danger', 'missing_crossorigin', manual.url)
  if (manual.transferKb > 220) add('danger', 'severe_transfer', `${manual.transferKb} KB`)
  else if (manual.transferKb > 120) add('warn', 'high_transfer', `${manual.transferKb} KB`)
  if (numberFromInput(draft.subsetKb) > 120) add('warn', 'subset_too_large', `${draft.subsetKb} KB`)
  if (!draft.fallbackStack.trim()) add('danger', 'missing_fallback', manual.family)
  if (manual.clsRisk >= 0.15) add('danger', 'cls_risk', String(manual.clsRisk))
  else if (manual.clsRisk >= 0.08) add('warn', 'cls_risk', String(manual.clsRisk))
  if (!manual.unicodeRange && manual.transferKb > 80) add('warn', 'no_unicode_range', manual.family)

  const counts = new Map<string, number>()
  fonts
    .filter(font => font.source !== 'link' && font.source !== 'manual')
    .forEach(font => counts.set(declarationKey(font), (counts.get(declarationKey(font)) ?? 0) + 1))
  counts.forEach((count, key) => {
    if (count > 1) add('warn', 'duplicate_font', key.split('|')[0])
  })
  if (parsed.fonts.length > 6) add('warn', 'too_many_fonts', String(parsed.fonts.length))

  parsed.fonts.forEach(font => {
    const parsedUrl = safeUrl(font.url)
    if (!font.valid) add('danger', 'missing_url', font.family)
    if (parsedUrl?.protocol === 'http:') add('danger', 'parsed_http', font.url)
    if (font.display === 'block' || font.display === 'auto')
      add(font.display === 'block' ? 'danger' : 'warn', 'parsed_block', font.family)
    if (font.preload && isCrossOrigin(font.url) && !font.crossOrigin)
      add('danger', 'parsed_missing_crossorigin', font.url)
    if (font.transferKb > 220)
      add('danger', 'parsed_large', `${font.family}: ${font.transferKb} KB`)
    else if (font.transferKb > 120)
      add('warn', 'parsed_large', `${font.family}: ${font.transferKb} KB`)
  })
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    if (manual.display === 'optional' || manual.display === 'swap')
      add('good', 'optional_ok', manual.display)
    if (draft.fallbackStack.trim()) add('good', 'fallback_ok', manual.family)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 18 : finding.level === 'warn' ? 8 : 0),
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

const buildCss = (draft: FontDraft) => {
  const family = escapeCss(draft.family || 'Font')
  const format = draft.format === 'variable' ? 'woff2' : draft.format
  return [
    '@font-face {',
    `  font-family: "${family}";`,
    `  src: url("${escapeCss(draft.url)}") format("${format}");`,
    `  font-weight: ${draft.weight || '400'};`,
    `  font-style: ${draft.style || 'normal'};`,
    `  font-display: ${draft.display};`,
    draft.unicodeRange ? `  unicode-range: ${draft.unicodeRange};` : '',
    '}',
    '',
    ':root {',
    `  --font-brand: "${family}", ${draft.fallbackStack || 'system-ui, sans-serif'};`,
    '}'
  ]
    .filter(Boolean)
    .join('\n')
}

const buildPreload = (draft: FontDraft) => {
  const type = draft.format === 'variable' ? 'font/woff2' : `font/${draft.format}`
  const crossorigin = draft.crossOrigin === 'yes' ? ' crossorigin' : ''
  return `<link rel="preload" href="${escapeHtml(draft.url)}" as="font" type="${type}"${crossorigin}>`
}

const buildNextFont = (draft: FontDraft) => {
  const variableName =
    draft.family
      .replace(/[^a-z0-9]+/giu, ' ')
      .trim()
      .replace(/\s+([a-z0-9])/giu, (_, char: string) => char.toUpperCase())
      .replace(/^[A-Z]/u, char => char.toLowerCase()) || 'brandFont'
  return [
    "import localFont from 'next/font/local'",
    '',
    `export const ${variableName} = localFont({`,
    `  src: '${escapeJs(draft.url)}',`,
    `  display: '${draft.display}',`,
    `  weight: '${escapeJs(draft.weight || '400')}',`,
    `  style: '${escapeJs(draft.style || 'normal')}',`,
    `  fallback: ${JSON.stringify(
      draft.fallbackStack
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    )},`,
    `  preload: ${draft.preload === 'yes'},`,
    `  variable: '--font-${variableName}'`,
    '})'
  ].join('\n')
}

const buildFallbackCss = (draft: FontDraft) =>
  [
    `.${draft.family.toLowerCase().replace(/[^a-z0-9]+/gu, '-') || 'font'}-fallback {`,
    `  font-family: "${escapeCss(draft.family)}", ${draft.fallbackStack || 'system-ui, sans-serif'};`,
    `  font-size-adjust: ${Math.max(0.42, Math.min(0.62, 0.52 - numberFromInput(draft.clsRisk) / 4)).toFixed(2)};`,
    '  text-rendering: optimizeLegibility;',
    '  -webkit-font-smoothing: antialiased;',
    '}'
  ].join('\n')

const buildJson = (draft: FontDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify({ draft, findings, parsedFonts: parsed.fonts }, null, 2)

const buildCsv = (draft: FontDraft, parsed: ParsedWorkspace) => {
  const rows = [parsedFromDraft(draft), ...parsed.fonts]
  return [
    [
      'family',
      'url',
      'format',
      'display',
      'preload',
      'crossOrigin',
      'transferKb',
      'clsRisk',
      'weight',
      'source'
    ]
      .map(escapeCsv)
      .join(','),
    ...rows.map(font =>
      [
        font.family,
        font.url,
        font.format,
        font.display,
        font.preload,
        font.crossOrigin,
        font.transferKb,
        font.clsRisk,
        font.weight,
        font.source
      ]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: FontDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'css') return buildCss(draft)
  if (outputType === 'preload') return buildPreload(draft)
  if (outputType === 'next') return buildNextFont(draft)
  if (outputType === 'fallback') return buildFallbackCss(draft)
  if (outputType === 'json') return buildJson(draft, parsed, findings)
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

export default function FontLoadingClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<FontDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('css')
  const [auditQuery, setAuditQuery] = useState('')
  const [fontQuery, setFontQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredFontQuery = useDeferredValue(fontQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditFonts(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      fonts: parsed.fonts.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.errors, parsed.fonts]
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
  const outputPreviewUsesParsedRows = outputType === 'json' || outputType === 'csv'
  const outputPreviewUsesFindings = outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesParsedRows ? outputPreviewParsed.fonts.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.fonts.length : 0) +
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
      `${item.key} ${item.subject} ${t(`app.converter.font_loading.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredFonts = useMemo(() => {
    const query = deferredFontQuery.trim().toLowerCase()
    if (!query) return parsed.fonts
    return parsed.fonts.filter(font =>
      `${font.family} ${font.url} ${font.display} ${font.format} ${font.weight} ${font.source}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredFontQuery, parsed.fonts])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      fonts: parsed.fonts.length,
      preloads: new Set(
        [parsedFromDraft(draft), ...parsed.fonts].filter(font => font.preload).map(font => font.url)
      ).size,
      score,
      transfer: `${numberFromInput(draft.transferKb)} KB`,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft, findings, parsed.fonts, score]
  )

  const updateDraft = <Key extends keyof FontDraft>(key: Key, value: FontDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('css')
    setAuditQuery('')
    setFontQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.font_loading.summary_title'),
        `${t('app.converter.font_loading.metric.score')}: ${metrics.score}`,
        `${t('app.converter.font_loading.metric.transfer')}: ${metrics.transfer}`,
        `${t('app.converter.font_loading.metric.fonts')}: ${metrics.fonts}`,
        `${t('app.converter.font_loading.metric.preloads')}: ${metrics.preloads}`,
        `${t('app.converter.font_loading.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.font_loading.metric.critical')}: ${metrics.critical}`
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
                <Type className="h-4 w-4" />
                {t('app.converter.font-loading')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.font-loading')}</CardTitle>
              <CardDescription>{t('app.converter.font_loading.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.font_loading.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.font_loading.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.font_loading.metric.transfer')}
              value={metrics.transfer}
            />
            <Metric label={t('app.converter.font_loading.metric.fonts')} value={metrics.fonts} />
            <Metric
              label={t('app.converter.font_loading.metric.preloads')}
              value={metrics.preloads}
            />
            <Metric
              label={t('app.converter.font_loading.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.font_loading.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.font_loading.presets')}</CardTitle>
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
                {t(`app.converter.font_loading.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.font_loading.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.font_loading.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.font_loading.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="font-route">{t('app.converter.font_loading.route_pattern')}</Label>
                <Input
                  id="font-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-family">{t('app.converter.font_loading.family')}</Label>
                <Input
                  id="font-family"
                  value={draft.family}
                  onChange={event => updateDraft('family', event.target.value.slice(0, 120))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="font-url">{t('app.converter.font_loading.url')}</Label>
                <Input
                  id="font-url"
                  value={draft.url}
                  onChange={event => updateDraft('url', event.target.value.slice(0, 280))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-format">{t('app.converter.font_loading.format')}</Label>
                <Select
                  id="font-format"
                  value={draft.format}
                  onChange={event => updateDraft('format', event.target.value as FontFormat)}
                >
                  {FONT_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.converter.font_loading.format.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-display">{t('app.converter.font_loading.display')}</Label>
                <Select
                  id="font-display"
                  value={draft.display}
                  onChange={event => updateDraft('display', event.target.value as FontDisplay)}
                >
                  {FONT_DISPLAYS.map(display => (
                    <option key={display} value={display}>
                      {t(`app.converter.font_loading.display.${display}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-weight">{t('app.converter.font_loading.weight')}</Label>
                <Input
                  id="font-weight"
                  value={draft.weight}
                  onChange={event => updateDraft('weight', event.target.value.slice(0, 32))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-style">{t('app.converter.font_loading.style')}</Label>
                <Input
                  id="font-style"
                  value={draft.style}
                  onChange={event => updateDraft('style', event.target.value.slice(0, 40))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-transfer">{t('app.converter.font_loading.transfer_kb')}</Label>
                <Input
                  id="font-transfer"
                  value={draft.transferKb}
                  onChange={event => updateDraft('transferKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-subset">{t('app.converter.font_loading.subset_kb')}</Label>
                <Input
                  id="font-subset"
                  value={draft.subsetKb}
                  onChange={event => updateDraft('subsetKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-preload">{t('app.converter.font_loading.preload')}</Label>
                <Select
                  id="font-preload"
                  value={draft.preload}
                  onChange={event =>
                    updateDraft('preload', event.target.value as FontDraft['preload'])
                  }
                >
                  <option value="yes">{t('app.converter.font_loading.boolean.yes')}</option>
                  <option value="no">{t('app.converter.font_loading.boolean.no')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-crossorigin">
                  {t('app.converter.font_loading.crossorigin')}
                </Label>
                <Select
                  id="font-crossorigin"
                  value={draft.crossOrigin}
                  onChange={event =>
                    updateDraft('crossOrigin', event.target.value as FontDraft['crossOrigin'])
                  }
                >
                  <option value="yes">{t('app.converter.font_loading.boolean.yes')}</option>
                  <option value="no">{t('app.converter.font_loading.boolean.no')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-cls">{t('app.converter.font_loading.cls_risk')}</Label>
                <Input
                  id="font-cls"
                  value={draft.clsRisk}
                  onChange={event => updateDraft('clsRisk', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-range">{t('app.converter.font_loading.unicode_range')}</Label>
                <Input
                  id="font-range"
                  value={draft.unicodeRange}
                  onChange={event =>
                    updateDraft(
                      'unicodeRange',
                      event.target.value.slice(0, UNICODE_RANGE_FIELD_LIMIT)
                    )
                  }
                  maxLength={UNICODE_RANGE_FIELD_LIMIT}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="font-fallback">{t('app.converter.font_loading.fallback')}</Label>
                <Input
                  id="font-fallback"
                  value={draft.fallbackStack}
                  onChange={event => updateDraft('fallbackStack', event.target.value.slice(0, 260))}
                  className="font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.font_loading.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.font_loading.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.font_loading.workspace_placeholder')}
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
              <CardTitle className="text-base">{t('app.converter.font_loading.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.font_loading.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 36).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.font_loading.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.font_loading.level.${finding.level}`)}
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
                  {t('app.converter.font_loading.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.font_loading.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="font-output">{t('app.converter.font_loading.output_type')}</Label>
                <Select
                  id="font-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.font_loading.output.${type}`)}
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
                {t('app.converter.font_loading.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'font-loading-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.font_loading.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentCsv(), 'font-loading.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.font_loading.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.font_loading.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={fontQuery}
                onChange={event => setFontQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.font_loading.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredFonts.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredFonts.slice(0, 54).map(font => (
                  <div
                    key={`${font.id}:${font.url}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {font.family}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(font.display === 'block' || font.transferKb > 220 ? 'danger' : font.display === 'auto' || font.transferKb > 120 ? 'warn' : 'good')}`}
                      >
                        {font.display}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {font.url}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {font.format} / {font.weight} / {font.transferKb} KB / {font.source}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.font_loading.empty')}
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
                  {t('app.converter.font_loading.reference')}
                </CardTitle>
              </div>
              <CardDescription>{t('app.converter.font_loading.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.font_loading.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.font_loading.reference.${item}_hint`)}
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
                  {t('app.converter.font_loading.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.font_loading.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.font_loading.checklist.${item}.body`)}
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
