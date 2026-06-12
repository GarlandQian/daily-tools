'use client'

import {
  ClipboardList,
  Copy,
  Download,
  FileCode2,
  FileText,
  FlaskConical,
  ListChecks,
  Search,
  Sparkles
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

const MIME_CATEGORIES = [
  'all',
  'text',
  'image',
  'audio',
  'video',
  'application',
  'font',
  'archive'
] as const
const HEADER_TYPES = ['content_type', 'accept', 'curl', 'html', 'next'] as const
const BATCH_INPUT_LIMIT = 24000
const BATCH_ITEM_LIMIT = 220
const QUERY_INPUT_LIMIT = 160

type MimeCategory = (typeof MIME_CATEGORIES)[number]
type HeaderType = (typeof HEADER_TYPES)[number]
type ScenarioKey = 'web' | 'api' | 'image' | 'office' | 'archive' | 'media'

interface MimeInfo {
  category: Exclude<MimeCategory, 'all'>
  extensions: string[]
  mime: string
  note: string
  sniff: string
}

interface ScenarioPreset {
  category: MimeCategory
  key: ScenarioKey
  query: string
  sample: string
}

interface BatchRow {
  category: string
  count: number
  extension: string
  known: boolean
  mime: string
}

interface BatchAnalysis {
  capped: boolean
  categoryCounts: Record<Exclude<MimeCategory, 'all'>, number>
  exportCsv: string
  exportJson: string
  known: number
  rows: BatchRow[]
  total: number
  unknown: number
  unique: number
}

const MIME_TYPES: MimeInfo[] = [
  {
    mime: 'text/html',
    extensions: ['html', 'htm'],
    category: 'text',
    sniff: 'May execute scripts',
    note: 'HTML documents and server-rendered pages.'
  },
  {
    mime: 'text/css',
    extensions: ['css'],
    category: 'text',
    sniff: 'Stylesheet',
    note: 'CSS stylesheets loaded by browsers.'
  },
  {
    mime: 'text/csv',
    extensions: ['csv'],
    category: 'text',
    sniff: 'Spreadsheet data',
    note: 'Comma-separated values for tabular exports.'
  },
  {
    mime: 'text/markdown',
    extensions: ['md', 'markdown'],
    category: 'text',
    sniff: 'Plain text',
    note: 'Markdown documents and README files.'
  },
  {
    mime: 'text/plain',
    extensions: ['txt', 'log', 'text'],
    category: 'text',
    sniff: 'Plain text',
    note: 'Plain text, logs, and fallback text responses.'
  },
  {
    mime: 'application/json',
    extensions: ['json', 'map'],
    category: 'application',
    sniff: 'Structured data',
    note: 'JSON APIs, source maps, and config payloads.'
  },
  {
    mime: 'application/ld+json',
    extensions: ['jsonld'],
    category: 'application',
    sniff: 'Structured data',
    note: 'Linked data and SEO schema payloads.'
  },
  {
    mime: 'application/xml',
    extensions: ['xml', 'xsl'],
    category: 'application',
    sniff: 'Structured data',
    note: 'XML documents, feeds, and integration payloads.'
  },
  {
    mime: 'application/javascript',
    extensions: ['js', 'mjs'],
    category: 'application',
    sniff: 'Executable script',
    note: 'JavaScript modules and scripts.'
  },
  {
    mime: 'application/wasm',
    extensions: ['wasm'],
    category: 'application',
    sniff: 'Executable binary',
    note: 'WebAssembly modules.'
  },
  {
    mime: 'application/pdf',
    extensions: ['pdf'],
    category: 'application',
    sniff: 'Document',
    note: 'PDF documents and printable exports.'
  },
  {
    mime: 'application/zip',
    extensions: ['zip'],
    category: 'archive',
    sniff: 'Archive',
    note: 'ZIP archives and many zipped package formats.'
  },
  {
    mime: 'application/gzip',
    extensions: ['gz', 'gzip'],
    category: 'archive',
    sniff: 'Compressed archive',
    note: 'Gzip-compressed assets and backups.'
  },
  {
    mime: 'application/x-tar',
    extensions: ['tar'],
    category: 'archive',
    sniff: 'Archive',
    note: 'TAR archives, often compressed separately.'
  },
  {
    mime: 'application/x-7z-compressed',
    extensions: ['7z'],
    category: 'archive',
    sniff: 'Archive',
    note: '7-Zip archives.'
  },
  {
    mime: 'application/vnd.rar',
    extensions: ['rar'],
    category: 'archive',
    sniff: 'Archive',
    note: 'RAR archive files.'
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    category: 'application',
    sniff: 'Office document',
    note: 'Microsoft Word Open XML document.'
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    category: 'application',
    sniff: 'Office spreadsheet',
    note: 'Microsoft Excel Open XML workbook.'
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    category: 'application',
    sniff: 'Office presentation',
    note: 'Microsoft PowerPoint Open XML deck.'
  },
  {
    mime: 'application/msword',
    extensions: ['doc'],
    category: 'application',
    sniff: 'Legacy Office',
    note: 'Legacy Microsoft Word document.'
  },
  {
    mime: 'application/vnd.ms-excel',
    extensions: ['xls'],
    category: 'application',
    sniff: 'Legacy Office',
    note: 'Legacy Microsoft Excel workbook.'
  },
  {
    mime: 'application/vnd.ms-powerpoint',
    extensions: ['ppt'],
    category: 'application',
    sniff: 'Legacy Office',
    note: 'Legacy Microsoft PowerPoint deck.'
  },
  {
    mime: 'image/png',
    extensions: ['png'],
    category: 'image',
    sniff: 'Image',
    note: 'PNG images with transparency support.'
  },
  {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg', 'jfif'],
    category: 'image',
    sniff: 'Image',
    note: 'JPEG photos and compressed raster images.'
  },
  {
    mime: 'image/gif',
    extensions: ['gif'],
    category: 'image',
    sniff: 'Image',
    note: 'GIF images and simple animations.'
  },
  {
    mime: 'image/webp',
    extensions: ['webp'],
    category: 'image',
    sniff: 'Image',
    note: 'Modern web raster images.'
  },
  {
    mime: 'image/avif',
    extensions: ['avif'],
    category: 'image',
    sniff: 'Image',
    note: 'AVIF images with high compression.'
  },
  {
    mime: 'image/svg+xml',
    extensions: ['svg'],
    category: 'image',
    sniff: 'Vector image',
    note: 'SVG vector images. Treat untrusted SVG as active content.'
  },
  {
    mime: 'image/x-icon',
    extensions: ['ico'],
    category: 'image',
    sniff: 'Icon',
    note: 'Favicon icon files.'
  },
  {
    mime: 'audio/mpeg',
    extensions: ['mp3'],
    category: 'audio',
    sniff: 'Audio',
    note: 'MP3 audio streams.'
  },
  {
    mime: 'audio/wav',
    extensions: ['wav'],
    category: 'audio',
    sniff: 'Audio',
    note: 'WAV audio files.'
  },
  {
    mime: 'audio/ogg',
    extensions: ['oga', 'ogg'],
    category: 'audio',
    sniff: 'Audio',
    note: 'Ogg audio streams.'
  },
  {
    mime: 'video/mp4',
    extensions: ['mp4', 'm4v'],
    category: 'video',
    sniff: 'Video',
    note: 'MP4 video files and streams.'
  },
  {
    mime: 'video/webm',
    extensions: ['webm'],
    category: 'video',
    sniff: 'Video',
    note: 'WebM video files.'
  },
  {
    mime: 'video/quicktime',
    extensions: ['mov'],
    category: 'video',
    sniff: 'Video',
    note: 'QuickTime video files.'
  },
  {
    mime: 'font/woff2',
    extensions: ['woff2'],
    category: 'font',
    sniff: 'Font',
    note: 'Modern compressed web fonts.'
  },
  {
    mime: 'font/woff',
    extensions: ['woff'],
    category: 'font',
    sniff: 'Font',
    note: 'Compressed web fonts.'
  },
  {
    mime: 'font/ttf',
    extensions: ['ttf'],
    category: 'font',
    sniff: 'Font',
    note: 'TrueType font files.'
  },
  {
    mime: 'font/otf',
    extensions: ['otf'],
    category: 'font',
    sniff: 'Font',
    note: 'OpenType font files.'
  }
]

const SCENARIOS: ScenarioPreset[] = [
  {
    key: 'web',
    category: 'text',
    query: 'html css js svg',
    sample: 'index.html\nstyles.css\napp.js\nfavicon.ico\nlogo.svg'
  },
  {
    key: 'api',
    category: 'application',
    query: 'json xml pdf',
    sample:
      'Content-Type: application/json; charset=utf-8\nAccept: application/problem+json\nreport.pdf'
  },
  {
    key: 'image',
    category: 'image',
    query: 'png jpeg webp avif',
    sample: 'hero.webp\navatar.png\nproduct.avif\nfallback.jpg'
  },
  {
    key: 'office',
    category: 'application',
    query: 'docx xlsx pptx',
    sample: 'proposal.docx\nbudget.xlsx\nroadmap.pptx\narchive.zip'
  },
  {
    key: 'archive',
    category: 'archive',
    query: 'zip gzip tar',
    sample: 'release.zip\nbackup.tar.gz\nlogs.gz\npackage.7z'
  },
  {
    key: 'media',
    category: 'video',
    query: 'mp4 webm mp3 wav',
    sample: 'intro.mp4\nclip.webm\nvoice.mp3\nnotification.wav'
  }
]

const EXTENSION_MAP = new Map<string, MimeInfo>()
const MIME_MAP = new Map<string, MimeInfo>()

for (const item of MIME_TYPES) {
  MIME_MAP.set(item.mime, item)
  for (const extension of item.extensions) {
    EXTENSION_MAP.set(extension, item)
  }
}

const createCategoryCounts = (): Record<Exclude<MimeCategory, 'all'>, number> => ({
  application: 0,
  archive: 0,
  audio: 0,
  font: 0,
  image: 0,
  text: 0,
  video: 0
})

const normalizeExtension = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[.*]+/u, '')

const findMime = (value: string) => {
  const normalized = value.trim().toLowerCase()

  if (!normalized) return undefined
  if (MIME_MAP.has(normalized)) return MIME_MAP.get(normalized)

  return EXTENSION_MAP.get(normalizeExtension(normalized))
}

const extractBatchTokens = (input: string) => {
  const truncated = input.slice(0, BATCH_INPUT_LIMIT)
  const tokens = new Set<string>()
  const ordered: string[] = []
  let limited = input.length > BATCH_INPUT_LIMIT
  const addToken = (token: string) => {
    const normalized = token.toLowerCase()
    if (!normalized || tokens.has(normalized)) return true
    if (ordered.length >= BATCH_ITEM_LIMIT) {
      limited = true
      return false
    }
    tokens.add(normalized)
    ordered.push(normalized)

    return true
  }

  const mimePattern = /\b[a-z][a-z0-9.+-]+\/[a-z0-9.+-]+\b/giu
  let match: RegExpExecArray | null
  while ((match = mimePattern.exec(truncated))) {
    if (!addToken(match[0])) break
  }

  const extensionPattern = /\.([a-z0-9]{1,12})(?=$|[\s?#);,"'])/giu
  while (!limited && (match = extensionPattern.exec(truncated))) {
    if (!addToken(match[1])) break
  }

  return { limited, tokens: ordered }
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const analyzeBatch = (input: string, inputCapped = false): BatchAnalysis => {
  const { limited, tokens } = extractBatchTokens(input)
  const grouped = new Map<string, BatchRow>()
  const categoryCounts = createCategoryCounts()
  let known = 0

  for (const token of tokens) {
    const info = findMime(token)
    const extension = token.includes('/') ? (info?.extensions[0] ?? '-') : normalizeExtension(token)
    const key = info?.mime ?? token
    const existing = grouped.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    if (info) {
      known += 1
      categoryCounts[info.category] += 1
    }

    grouped.set(key, {
      category: info?.category ?? '-',
      count: 1,
      extension,
      known: Boolean(info),
      mime: info?.mime ?? token
    })
  }

  const rows = Array.from(grouped.values()).sort((a, b) => {
    if (a.known !== b.known) return a.known ? -1 : 1
    return a.mime.localeCompare(b.mime)
  })
  const exportRows = rows.map(row => ({
    extension: row.extension,
    mime: row.mime,
    category: row.category,
    count: row.count,
    known: row.known
  }))
  const exportCsv = [
    'extension,mime,category,count,known',
    ...exportRows.map(row =>
      [row.extension, row.mime, row.category, row.count, row.known].map(escapeCsv).join(',')
    )
  ].join('\n')

  return {
    capped: inputCapped || limited,
    categoryCounts,
    exportCsv,
    exportJson: JSON.stringify(
      {
        total: tokens.length,
        unique: rows.length,
        known,
        unknown: tokens.length - known,
        categories: categoryCounts,
        rows: exportRows
      },
      null,
      2
    ),
    known,
    rows,
    total: tokens.length,
    unknown: tokens.length - known,
    unique: rows.length
  }
}

const buildHeaderSnippet = (item: MimeInfo, headerType: HeaderType) => {
  switch (headerType) {
    case 'accept':
      return `Accept: ${item.mime}`
    case 'curl':
      return `curl -H "Accept: ${item.mime}" https://api.example.com/resource`
    case 'html':
      return `<link rel="preload" href="/asset.${item.extensions[0]}" as="${item.category}" type="${item.mime}">`
    case 'next':
      return `return new Response(body, {
  headers: {
    'Content-Type': '${item.mime}; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  }
})`
    case 'content_type':
    default:
      return `Content-Type: ${item.mime}`
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

export default function MimeClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [query, setQuery] = useState('json')
  const [category, setCategory] = useState<MimeCategory>('all')
  const [headerType, setHeaderType] = useState<HeaderType>('content_type')
  const [batchInput, setBatchInput] = useState(SCENARIOS[0].sample)
  const [isBatchInputCapped, setIsBatchInputCapped] = useState(false)
  const deferredQuery = useDeferredValue(query)
  const deferredBatchInput = useDeferredValue(batchInput)

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    return MIME_TYPES.filter(item => {
      const matchesCategory = category === 'all' || item.category === category
      const matchesQuery =
        !normalized ||
        item.mime.includes(normalized) ||
        item.extensions.some(extension => extension.includes(normalizeExtension(normalized))) ||
        item.note.toLowerCase().includes(normalized) ||
        item.sniff.toLowerCase().includes(normalized)

      return matchesCategory && matchesQuery
    })
  }, [category, deferredQuery])

  const selected = results[0] ?? findMime('json') ?? MIME_TYPES[0]
  const headerSnippet = useMemo(
    () => buildHeaderSnippet(selected, headerType),
    [headerType, selected]
  )
  const batchAnalysis = useMemo(
    () => analyzeBatch(deferredBatchInput, isBatchInputCapped),
    [deferredBatchInput, isBatchInputCapped]
  )
  const categoryCounts = useMemo(
    () =>
      MIME_CATEGORIES.filter(item => item !== 'all').map(item => ({
        category: item,
        count: MIME_TYPES.filter(mime => mime.category === item).length
      })),
    []
  )
  const summary = useMemo(
    () =>
      [
        selected.mime,
        `${t('app.converter.mime.extensions')}: ${selected.extensions.map(item => `.${item}`).join(', ')}`,
        `${t('app.converter.mime.category')}: ${t(`app.converter.mime.category.${selected.category}`)}`,
        `${t('app.converter.mime.sniff')}: ${selected.sniff}`,
        selected.note
      ].join('\n'),
    [selected, t]
  )

  const loadScenario = (scenario: ScenarioPreset) => {
    updateQuery(scenario.query)
    setCategory(scenario.category)
    updateBatchInput(scenario.sample)
  }

  function updateQuery(value: string) {
    setQuery(value.slice(0, QUERY_INPUT_LIMIT))
  }

  function updateBatchInput(value: string) {
    const capped = value.length > BATCH_INPUT_LIMIT

    setIsBatchInputCapped(capped)
    setBatchInput(capped ? value.slice(0, BATCH_INPUT_LIMIT) : value)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.mime')}
              </CardTitle>
              <CardDescription>{t('app.converter.mime.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ClipboardList className="h-4 w-4" />}
                onClick={() => copy(summary)}
              >
                {t('app.converter.mime.copy_summary')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(headerSnippet)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {categoryCounts.map(item => {
              const active = category === item.category

              return (
                <button
                  key={item.category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(item.category)}
                  className={`glass-input rounded-xl p-3 text-left transition hover:scale-[1.01] ${
                    active ? 'ring-2 ring-[var(--primary)]/40' : ''
                  }`}
                >
                  <div className="text-xs text-[var(--text-secondary)]">
                    {t(`app.converter.mime.category.${item.category}`)}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</div>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.mime.scenarios')}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.map(scenario => (
                <button
                  key={scenario.key}
                  type="button"
                  onClick={() => loadScenario(scenario)}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {t(`app.converter.mime.scenario.${scenario.key}`)}
                    </span>
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.mime.category.${scenario.category}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.mime.scenario.${scenario.key}_hint`)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_190px]">
            <div className="space-y-3">
              <Label htmlFor="mime-search">{t('app.converter.mime.search')}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  id="mime-search"
                  value={query}
                  onChange={event => updateQuery(event.target.value)}
                  placeholder="json, .png, text/html"
                  maxLength={QUERY_INPUT_LIMIT}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="mime-category">{t('app.converter.mime.category')}</Label>
              <Select
                id="mime-category"
                value={category}
                onChange={event => setCategory(event.target.value as MimeCategory)}
              >
                {MIME_CATEGORIES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.mime.category.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="mime-header">{t('app.converter.mime.header_type')}</Label>
              <Select
                id="mime-header"
                value={headerType}
                onChange={event => setHeaderType(event.target.value as HeaderType)}
              >
                {HEADER_TYPES.map(value => (
                  <option key={value} value={value}>
                    {t(`app.converter.mime.header.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{t('app.converter.mime.results')}</CardTitle>
              <span className="text-sm text-[var(--text-secondary)]">
                {t('app.converter.mime.result_count', { count: results.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {results.length ? (
              results.map(item => (
                <button
                  key={item.mime}
                  type="button"
                  onClick={() => setQuery(item.mime)}
                  className="glass-input rounded-xl p-4 text-left transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {item.mime}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs text-[var(--primary)]">
                      {t(`app.converter.mime.category.${item.category}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.extensions.map(extension => (
                      <span
                        key={extension}
                        className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]"
                      >
                        .{extension}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)] md:col-span-2">
                {t('app.converter.mime.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.mime.detail')}</CardTitle>
            <CardDescription>{selected.mime}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MimeMetric
                label={t('app.converter.mime.category')}
                value={t(`app.converter.mime.category.${selected.category}`)}
              />
              <MimeMetric label={t('app.converter.mime.sniff')} value={selected.sniff} />
              <MimeMetric
                label={t('app.converter.mime.extensions')}
                value={selected.extensions.map(extension => `.${extension}`).join(', ')}
              />
              <MimeMetric
                label={t('app.converter.mime.primary_ext')}
                value={`.${selected.extensions[0]}`}
              />
            </div>

            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">{t('app.converter.mime.note')}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-primary)]">{selected.note}</p>
              {selected.mime === 'image/svg+xml' && (
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('app.converter.mime.svg_warning')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.mime.header_snippet')}
            </div>
            <Textarea
              value={headerSnippet}
              readOnly
              rows={9}
              className="min-h-[210px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.mime.batch')}
              </CardTitle>
              <CardDescription>{t('app.converter.mime.batch_description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => loadScenario(SCENARIOS[3])}
              >
                {t('app.converter.mime.sample')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(batchAnalysis.exportJson)}
              >
                {t('app.converter.mime.copy_json')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    batchAnalysis.exportCsv,
                    'daily-tools-mime-types.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.converter.mime.download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <Label htmlFor="mime-batch">{t('app.converter.mime.batch_input')}</Label>
              <Textarea
                id="mime-batch"
                value={batchInput}
                onChange={event => updateBatchInput(event.target.value)}
                placeholder={t('app.converter.mime.batch_placeholder')}
                maxLength={BATCH_INPUT_LIMIT}
                rows={9}
                className="min-h-[220px] resize-y font-mono"
              />
              {batchAnalysis.capped && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.mime.input_capped', { count: BATCH_ITEM_LIMIT })}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 self-start">
              <MimeMetric
                label={t('app.converter.mime.metric.total')}
                value={String(batchAnalysis.total)}
              />
              <MimeMetric
                label={t('app.converter.mime.metric.unique')}
                value={String(batchAnalysis.unique)}
              />
              <MimeMetric
                label={t('app.converter.mime.metric.known')}
                value={String(batchAnalysis.known)}
              />
              <MimeMetric
                label={t('app.converter.mime.metric.unknown')}
                value={String(batchAnalysis.unknown)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {categoryCounts.map(item => (
              <div key={item.category} className="glass-input rounded-xl p-3">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t(`app.converter.mime.category.${item.category}`)}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                  {batchAnalysis.categoryCounts[item.category]}
                </p>
              </div>
            ))}
          </div>

          {batchAnalysis.rows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {batchAnalysis.rows.map(row => (
                <button
                  key={row.mime}
                  type="button"
                  onClick={() => {
                    setQuery(row.mime)
                    setCategory('all')
                  }}
                  className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {row.mime}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                        {row.extension === '-' ? '-' : `.${row.extension}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                      x{row.count}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-[var(--primary)]">
                      {row.known
                        ? t(`app.converter.mime.category.${row.category}`)
                        : t('app.converter.mime.unknown')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.converter.mime.batch_empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const MimeMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)
