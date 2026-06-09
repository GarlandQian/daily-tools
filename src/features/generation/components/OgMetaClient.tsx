'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  ImageIcon,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Tags,
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

type OgPreset = 'article' | 'product' | 'tool'
type OgType = 'article' | 'product' | 'profile' | 'website'
type FindingLevel = 'danger' | 'good' | 'warn'

interface OgFormData {
  author: string
  description: string
  image: string
  imageAlt: string
  locale: string
  price: string
  publishedTime: string
  section: string
  siteName: string
  title: string
  twitter: string
  type: OgType
  url: string
}

interface ParsedOgMeta {
  author: string
  canonical: string
  capped: boolean
  description: string
  duplicates: string[]
  hasJsonLd: boolean
  hasOg: boolean
  hasTwitter: boolean
  image: string
  imageAlt: string
  jsonLdType: string
  locale: string
  metaCount: number
  price: string
  publishedTime: string
  section: string
  siteName: string
  title: string
  twitterDescription: string
  twitterImage: string
  twitterImageAlt: string
  twitterSite: string
  twitterTitle: string
  type: string
}

interface OgFinding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DATA: OgFormData = {
  author: 'Daily Tools',
  description:
    'A fast, local-first daily tools collection for developers, creators, and operators.',
  image: 'https://daily-tools.vercel.app/og.png',
  imageAlt: 'Daily Tools interface preview',
  locale: 'en_US',
  price: '',
  publishedTime: '',
  section: 'Tools',
  siteName: 'Daily Tools',
  title: 'Daily Tools',
  twitter: '@dailytools',
  type: 'website',
  url: 'https://daily-tools.vercel.app'
}

const OG_WORKSPACE_LIMIT = 40000

const PRESETS: Record<OgPreset, OgFormData> = {
  tool: DEFAULT_DATA,
  article: {
    ...DEFAULT_DATA,
    author: 'Garland Qian',
    description: 'A practical guide for designing and shipping local-first utility tools.',
    publishedTime: '2026-06-08T00:00:00.000Z',
    section: 'Engineering',
    title: 'Designing Useful Daily Tools',
    type: 'article',
    url: 'https://daily-tools.vercel.app/blog/designing-tools'
  },
  product: {
    ...DEFAULT_DATA,
    description:
      'A polished local-first toolkit with fast converters, generators, formatters, and previews.',
    price: 'Free',
    section: 'Productivity',
    title: 'Daily Tools Local Toolkit',
    type: 'product',
    url: 'https://daily-tools.vercel.app'
  }
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const getHttpUrl = (value: string) => {
  try {
    const url = new URL(normalizeUrl(value))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

const normalizeTwitter = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

const buildMetaTags = (data: OgFormData) => {
  const url = getHttpUrl(data.url)
  const image = getHttpUrl(data.image)
  const twitter = normalizeTwitter(data.twitter)
  const title = data.title.trim()
  const description = data.description.trim()
  const siteName = data.siteName.trim()
  const imageAlt = data.imageAlt.trim()
  const locale = data.locale.trim()

  const tags = [
    title && `<title>${escapeHtml(title)}</title>`,
    description && `<meta name="description" content="${escapeHtml(description)}">`,
    url && `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${data.type}">`,
    title && `<meta property="og:title" content="${escapeHtml(title)}">`,
    description && `<meta property="og:description" content="${escapeHtml(description)}">`,
    url && `<meta property="og:url" content="${escapeHtml(url)}">`,
    siteName && `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    locale && `<meta property="og:locale" content="${escapeHtml(locale)}">`,
    image && `<meta property="og:image" content="${escapeHtml(image)}">`,
    imageAlt && `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    data.type === 'article' &&
      data.publishedTime &&
      `<meta property="article:published_time" content="${escapeHtml(data.publishedTime)}">`,
    data.type === 'article' &&
      data.author &&
      `<meta property="article:author" content="${escapeHtml(data.author)}">`,
    data.type === 'article' &&
      data.section &&
      `<meta property="article:section" content="${escapeHtml(data.section)}">`,
    data.type === 'product' &&
      data.price &&
      `<meta property="product:price:amount" content="${escapeHtml(data.price)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    twitter && `<meta name="twitter:site" content="${escapeHtml(twitter)}">`,
    title && `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    description && `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image && `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    imageAlt && `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">`
  ].filter(Boolean)

  return tags.join('\n')
}

const buildJsonLd = (data: OgFormData) => {
  const url = getHttpUrl(data.url)
  const image = getHttpUrl(data.image)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': data.type === 'article' ? 'Article' : data.type === 'product' ? 'Product' : 'WebSite',
    author: data.author.trim() || undefined,
    datePublished: data.publishedTime.trim() || undefined,
    description: data.description.trim(),
    image: image || undefined,
    name: data.title.trim(),
    offers:
      data.type === 'product' && data.price.trim()
        ? {
            '@type': 'Offer',
            price: data.price.trim()
          }
        : undefined,
    url: url || undefined
  }

  return `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`
}

const buildNextMetadata = (data: OgFormData) =>
  `export const metadata = {\n  title: ${JSON.stringify(data.title.trim())},\n  description: ${JSON.stringify(data.description.trim())},\n  alternates: {\n    canonical: ${JSON.stringify(getHttpUrl(data.url))}\n  },\n  openGraph: {\n    title: ${JSON.stringify(data.title.trim())},\n    description: ${JSON.stringify(data.description.trim())},\n    type: ${JSON.stringify(data.type)},\n    url: ${JSON.stringify(getHttpUrl(data.url))},\n    siteName: ${JSON.stringify(data.siteName.trim())},\n    locale: ${JSON.stringify(data.locale.trim())},\n    images: [{ url: ${JSON.stringify(getHttpUrl(data.image))}, alt: ${JSON.stringify(data.imageAlt.trim())} }]\n  },\n  twitter: {\n    card: 'summary_large_image',\n    site: ${JSON.stringify(normalizeTwitter(data.twitter))},\n    title: ${JSON.stringify(data.title.trim())},\n    description: ${JSON.stringify(data.description.trim())},\n    images: [${JSON.stringify(getHttpUrl(data.image))}]\n  }\n}`

const getDefaultWorkspace = () => `${buildMetaTags(DEFAULT_DATA)}\n\n${buildJsonLd(DEFAULT_DATA)}`

const isOgType = (value: string): value is OgType =>
  value === 'article' || value === 'product' || value === 'profile' || value === 'website'

const getUrlProtocol = (value: string) => {
  try {
    return new URL(normalizeUrl(value)).protocol
  } catch {
    return ''
  }
}

const getMetaKey = (meta: HTMLMetaElement) =>
  (meta.getAttribute('property') || meta.getAttribute('name') || '').trim().toLowerCase()

const getMetaContent = (metas: HTMLMetaElement[], key: string) =>
  metas
    .find(meta => getMetaKey(meta) === key)
    ?.getAttribute('content')
    ?.trim() ?? ''

const parseJsonLdType = (scripts: HTMLScriptElement[]) => {
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || '{}') as { '@type'?: string | string[] }
      const type = parsed['@type']
      if (Array.isArray(type)) return type.join(', ')
      if (typeof type === 'string') return type
    } catch {
      continue
    }
  }

  return ''
}

const parseOgWorkspace = (input: string): ParsedOgMeta => {
  const capped = input.length > OG_WORKSPACE_LIMIT
  const safeInput = input.slice(0, OG_WORKSPACE_LIMIT)
  const empty: ParsedOgMeta = {
    author: '',
    canonical: '',
    capped,
    description: '',
    duplicates: [],
    hasJsonLd: false,
    hasOg: false,
    hasTwitter: false,
    image: '',
    imageAlt: '',
    jsonLdType: '',
    locale: '',
    metaCount: 0,
    price: '',
    publishedTime: '',
    section: '',
    siteName: '',
    title: '',
    twitterDescription: '',
    twitterImage: '',
    twitterImageAlt: '',
    twitterSite: '',
    twitterTitle: '',
    type: ''
  }

  if (!safeInput.trim() || typeof DOMParser === 'undefined') return empty

  const doc = new DOMParser().parseFromString(safeInput, 'text/html')
  const metas = Array.from(doc.querySelectorAll('meta'))
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).filter(
    (element): element is HTMLScriptElement => element instanceof HTMLScriptElement
  )
  const keyCounts = new Map<string, number>()

  metas.forEach(meta => {
    const key = getMetaKey(meta)
    if (!key) return
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  })

  const duplicates = Array.from(keyCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
  const title = doc.querySelector('title')?.textContent?.trim() || getMetaContent(metas, 'og:title')
  const description =
    getMetaContent(metas, 'description') || getMetaContent(metas, 'og:description')
  const canonical =
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ||
    getMetaContent(metas, 'og:url')

  return {
    ...empty,
    author: getMetaContent(metas, 'article:author'),
    canonical,
    description,
    duplicates,
    hasJsonLd: scripts.length > 0,
    hasOg: metas.some(meta => getMetaKey(meta).startsWith('og:')),
    hasTwitter: metas.some(meta => getMetaKey(meta).startsWith('twitter:')),
    image: getMetaContent(metas, 'og:image'),
    imageAlt: getMetaContent(metas, 'og:image:alt'),
    jsonLdType: parseJsonLdType(scripts),
    locale: getMetaContent(metas, 'og:locale'),
    metaCount: metas.length,
    price: getMetaContent(metas, 'product:price:amount'),
    publishedTime: getMetaContent(metas, 'article:published_time'),
    section: getMetaContent(metas, 'article:section'),
    siteName: getMetaContent(metas, 'og:site_name'),
    title,
    twitterDescription: getMetaContent(metas, 'twitter:description'),
    twitterImage: getMetaContent(metas, 'twitter:image'),
    twitterImageAlt: getMetaContent(metas, 'twitter:image:alt'),
    twitterSite: getMetaContent(metas, 'twitter:site'),
    twitterTitle: getMetaContent(metas, 'twitter:title'),
    type: getMetaContent(metas, 'og:type')
  }
}

const buildOgFindings = (
  data: OgFormData,
  parsed: ParsedOgMeta,
  workspace: string
): OgFinding[] => {
  const findings: OgFinding[] = []
  const title = data.title.trim()
  const description = data.description.trim()
  const pageUrl = getHttpUrl(data.url)
  const imageUrl = getHttpUrl(data.image)

  if (!title) findings.push({ key: 'title_missing', level: 'danger', subject: 'title' })
  if (title.length > 60)
    findings.push({ key: 'title_long', level: 'warn', subject: `${title.length}/60` })
  if (!description)
    findings.push({ key: 'description_missing', level: 'danger', subject: 'description' })
  if (description && description.length < 50)
    findings.push({ key: 'description_short', level: 'warn', subject: `${description.length}/50` })
  if (description.length > 160)
    findings.push({ key: 'description_long', level: 'warn', subject: `${description.length}/160` })
  if (!pageUrl) findings.push({ key: 'url_invalid', level: 'danger', subject: data.url || 'URL' })
  if (!imageUrl)
    findings.push({ key: 'image_invalid', level: 'danger', subject: data.image || 'image' })
  if (pageUrl && getUrlProtocol(data.url) === 'http:')
    findings.push({ key: 'url_non_https', level: 'warn', subject: pageUrl })
  if (imageUrl && getUrlProtocol(data.image) === 'http:')
    findings.push({ key: 'image_non_https', level: 'warn', subject: imageUrl })
  if (!data.imageAlt.trim())
    findings.push({ key: 'image_alt_missing', level: 'warn', subject: 'og:image:alt' })
  if (data.locale.trim() && !/^[a-z]{2}_[A-Z]{2}$/u.test(data.locale.trim()))
    findings.push({ key: 'locale_format', level: 'warn', subject: data.locale })
  if (data.type === 'product' && !data.price.trim())
    findings.push({ key: 'product_price_missing', level: 'warn', subject: 'product:price:amount' })

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: String(OG_WORKSPACE_LIMIT) })
  if (workspace.trim() && parsed.metaCount === 0 && !parsed.title && !parsed.hasJsonLd)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })
  if (parsed.duplicates.length > 0)
    findings.push({
      key: 'parsed_duplicates',
      level: 'warn',
      subject: parsed.duplicates.join(', ')
    })
  if (workspace.trim() && !parsed.hasOg)
    findings.push({ key: 'parsed_missing_og', level: 'warn', subject: 'og:*' })
  if (workspace.trim() && !parsed.hasTwitter)
    findings.push({ key: 'parsed_missing_twitter', level: 'warn', subject: 'twitter:*' })
  if (workspace.trim() && !parsed.hasJsonLd)
    findings.push({ key: 'parsed_missing_jsonld', level: 'warn', subject: 'application/ld+json' })
  if (parsed.title && parsed.twitterTitle && parsed.title !== parsed.twitterTitle)
    findings.push({
      key: 'parsed_title_mismatch',
      level: 'warn',
      subject: 'og:title / twitter:title'
    })
  if (
    parsed.description &&
    parsed.twitterDescription &&
    parsed.description !== parsed.twitterDescription
  )
    findings.push({
      key: 'parsed_description_mismatch',
      level: 'warn',
      subject: 'og:description / twitter:description'
    })
  if (parsed.image && parsed.twitterImage && parsed.image !== parsed.twitterImage)
    findings.push({
      key: 'parsed_image_mismatch',
      level: 'warn',
      subject: 'og:image / twitter:image'
    })

  if (findings.length === 0)
    findings.push({ key: 'ready', level: 'good', subject: pageUrl || data.title || 'Open Graph' })

  return findings
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: OgFinding[]) =>
  [
    ['level', 'key', 'subject'].map(csvCell).join(','),
    ...findings.map(finding => [finding.level, finding.key, finding.subject].map(csvCell).join(','))
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

const OgMetaClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<OgFormData>(DEFAULT_DATA)
  const [workspace, setWorkspace] = useState(getDefaultWorkspace)
  const deferredWorkspace = useDeferredValue(workspace)

  const tags = useMemo(() => buildMetaTags(formData), [formData])
  const jsonLd = useMemo(() => buildJsonLd(formData), [formData])
  const nextMetadata = useMemo(() => buildNextMetadata(formData), [formData])
  const combinedOutput = useMemo(() => `${tags}\n\n${jsonLd}`, [jsonLd, tags])
  const parsed = useMemo(() => parseOgWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(
    () => buildOgFindings(formData, parsed, workspace),
    [formData, parsed, workspace]
  )
  const findingsCsv = useMemo(() => buildFindingsCsv(findings), [findings])
  const previewImage = useMemo(() => getHttpUrl(formData.image), [formData.image])
  const pageUrl = useMemo(() => getHttpUrl(formData.url), [formData.url])
  const titleLength = formData.title.trim().length
  const descriptionLength = formData.description.trim().length
  const hasParsedMeta = Boolean(parsed.metaCount || parsed.title || parsed.hasJsonLd)
  const checks = [
    {
      key: 'title',
      ok: titleLength > 0 && titleLength <= 60
    },
    {
      key: 'description',
      ok: descriptionLength >= 50 && descriptionLength <= 160
    },
    {
      key: 'url',
      ok: Boolean(pageUrl)
    },
    {
      key: 'image',
      ok: Boolean(previewImage)
    },
    {
      key: 'alt',
      ok: Boolean(formData.imageAlt.trim())
    }
  ]

  const setField = (field: keyof OgFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleReset = () => {
    setFormData(DEFAULT_DATA)
    setWorkspace(getDefaultWorkspace())
  }

  const applyParsed = () => {
    setFormData(prev => ({
      ...prev,
      author: parsed.author || prev.author,
      description: parsed.description || parsed.twitterDescription || prev.description,
      image: parsed.image || parsed.twitterImage || prev.image,
      imageAlt: parsed.imageAlt || parsed.twitterImageAlt || prev.imageAlt,
      locale: parsed.locale || prev.locale,
      price: parsed.price || prev.price,
      publishedTime: parsed.publishedTime || prev.publishedTime,
      section: parsed.section || prev.section,
      siteName: parsed.siteName || prev.siteName,
      title: parsed.title || parsed.twitterTitle || prev.title,
      twitter: parsed.twitterSite || prev.twitter,
      type: isOgType(parsed.type) ? parsed.type : prev.type,
      url: parsed.canonical || prev.url
    }))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.og')}
              </CardTitle>
              <CardDescription>{t('app.generation.og.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(tags)}>
                {t('app.generation.og.copy_tags')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['tool', 'article', 'product'] as const).map(preset => (
              <Button
                key={preset}
                size="sm"
                variant="default"
                onClick={() => setFormData(PRESETS[preset])}
              >
                {t(`app.generation.og.preset.${preset}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <OgField
                id="og-title"
                label={t('app.generation.og.title')}
                value={formData.title}
                onChange={value => setField('title', value)}
                placeholder="Daily Tools"
              />
              <OgField
                id="og-site-name"
                label={t('app.generation.og.site_name')}
                value={formData.siteName}
                onChange={value => setField('siteName', value)}
                placeholder="Daily Tools"
              />
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="og-description">{t('app.generation.og.summary')}</Label>
                <Textarea
                  id="og-description"
                  value={formData.description}
                  onChange={event => setField('description', event.target.value)}
                  rows={3}
                  className="resize-none"
                  placeholder={t('app.generation.og.summary_placeholder')}
                />
              </div>
              <OgField
                id="og-url"
                label={t('app.generation.og.url')}
                value={formData.url}
                onChange={value => setField('url', value)}
                placeholder="example.com"
              />
              <OgField
                id="og-image"
                label={t('app.generation.og.image')}
                value={formData.image}
                onChange={value => setField('image', value)}
                placeholder="https://example.com/og.png"
              />
              <OgField
                id="og-image-alt"
                label={t('app.generation.og.image_alt')}
                value={formData.imageAlt}
                onChange={value => setField('imageAlt', value)}
                placeholder="Preview image"
              />
              <OgField
                id="og-twitter"
                label={t('app.generation.og.twitter')}
                value={formData.twitter}
                onChange={value => setField('twitter', value)}
                placeholder="@handle"
              />
              <OgField
                id="og-author"
                label={t('app.generation.og.author')}
                value={formData.author}
                onChange={value => setField('author', value)}
                placeholder="Author"
              />
              <OgField
                id="og-section"
                label={t('app.generation.og.section')}
                value={formData.section}
                onChange={value => setField('section', value)}
                placeholder="Tools"
              />
              <OgField
                id="og-published"
                label={t('app.generation.og.published')}
                value={formData.publishedTime}
                onChange={value => setField('publishedTime', value)}
                placeholder="2026-06-08T00:00:00.000Z"
              />
              <OgField
                id="og-price"
                label={t('app.generation.og.price')}
                value={formData.price}
                onChange={value => setField('price', value)}
                placeholder="Free"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="og-type">{t('app.generation.og.type')}</Label>
                <Select
                  id="og-type"
                  value={formData.type}
                  onChange={event => setField('type', event.target.value as OgType)}
                >
                  {(['website', 'article', 'profile', 'product'] as const).map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.og.type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <OgField
                id="og-locale"
                label={t('app.generation.og.locale')}
                value={formData.locale}
                onChange={value => setField('locale', value)}
                placeholder="en_US"
              />
              <div className="grid grid-cols-2 gap-3">
                <OgMetric
                  label={t('app.generation.og.title_length')}
                  value={`${titleLength}/60`}
                  warning={!checks[0].ok}
                />
                <OgMetric
                  label={t('app.generation.og.description_length')}
                  value={`${descriptionLength}/160`}
                  warning={!checks[1].ok}
                />
                <OgMetric
                  label={t('app.generation.og.tags')}
                  value={String(tags.split('\n').length)}
                />
                <OgMetric label={t('app.generation.og.valid_url')} value={pageUrl ? 'OK' : '--'} />
              </div>
              <div className="space-y-2">
                {checks.map(check => (
                  <div
                    key={check.key}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${check.ok ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}
                    />
                    {t(`app.generation.og.check.${check.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.og.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.og.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value)}
              placeholder={t('app.generation.og.workspace_placeholder')}
              className="min-h-[220px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-3">
              <OgMetric
                label={t('app.generation.og.metric.meta_count')}
                value={String(parsed.metaCount)}
              />
              <OgMetric
                label={t('app.generation.og.metric.duplicates')}
                value={String(parsed.duplicates.length)}
                warning={parsed.duplicates.length > 0}
              />
              <OgMetric
                label={t('app.generation.og.metric.jsonld')}
                value={parsed.hasJsonLd ? 'OK' : '--'}
                warning={!parsed.hasJsonLd}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={!hasParsedMeta}
                onClick={applyParsed}
              >
                {t('app.generation.og.use_parsed')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<Tags className="h-4 w-4" />}
                onClick={() => setWorkspace(combinedOutput)}
              >
                {t('app.generation.og.use_generated')}
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
            {hasParsedMeta ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['title', parsed.title || parsed.twitterTitle],
                  ['description', parsed.description || parsed.twitterDescription],
                  ['canonical', parsed.canonical],
                  ['image', parsed.image || parsed.twitterImage],
                  ['type', parsed.type || parsed.jsonLdType],
                  ['twitter', parsed.twitterSite]
                ].map(([key, value]) => (
                  <div
                    key={key}
                    className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] px-3 py-2.5"
                  >
                    <p className="font-mono text-xs text-[var(--text-tertiary)]">
                      {t(`app.generation.og.parsed.${key}`)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                      {value || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-base)] p-5 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.og.parsed_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.og.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.og.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => copy(findingsCsv)}>
                {t('app.generation.og.copy_audit_csv')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(findingsCsv, 'og-meta-audit.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.generation.og.download_audit_csv')}
              </Button>
            </div>
            <div className="space-y-2">
              {findings.map(finding => (
                <OgFindingRow
                  key={`${finding.key}-${finding.subject}`}
                  finding={finding}
                  label={t(`app.generation.og.audit.${finding.key}`)}
                  levelLabel={t(`app.generation.og.level.${finding.level}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="flex min-h-[460px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <SearchCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.og.generated')}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => copy(jsonLd)}
                >
                  {t('app.generation.og.copy_jsonld')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copy(nextMetadata)}>
                  {t('app.generation.og.copy_next')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => downloadText(tags, 'og-meta-tags.html', 'text/html;charset=utf-8')}
                >
                  {t('app.generation.og.download_tags')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => downloadText(jsonLd, 'og-json-ld.html', 'text/html;charset=utf-8')}
                >
                  {t('app.generation.og.download_jsonld')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() =>
                    downloadText(nextMetadata, 'next-metadata.ts', 'text/plain;charset=utf-8')
                  }
                >
                  {t('app.generation.og.download_next')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <CodeBlock id="og-tags" label={t('app.generation.og.meta_tags')} value={tags} />
            <CodeBlock id="og-jsonld" label={t('app.generation.og.jsonld')} value={jsonLd} />
            <CodeBlock
              id="og-next"
              label={t('app.generation.og.next_metadata')}
              value={nextMetadata}
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[460px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.og.preview')}
            </CardTitle>
            <CardDescription>{t('app.generation.og.preview_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            <div className="glass-clip overflow-hidden rounded-2xl border border-[var(--border-base)]">
              <div
                className="min-h-48 bg-[linear-gradient(135deg,var(--primary),var(--accent),var(--success))] bg-cover bg-center"
                style={previewImage ? { backgroundImage: `url("${previewImage}")` } : undefined}
              />
              <div className="space-y-3 p-4">
                <p className="truncate text-xs text-[var(--text-tertiary)]">
                  {pageUrl || 'https://example.com'}
                </p>
                <h3 className="line-clamp-2 text-lg font-semibold text-[var(--text-primary)]">
                  {formData.title || t('app.generation.og.untitled')}
                </h3>
                <p className="line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {formData.description || t('app.generation.og.no_description')}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[var(--primary-subtle)] px-3 py-1 text-[var(--primary)]">
                    {formData.type}
                  </span>
                  {formData.siteName && (
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-3 py-1 text-[var(--text-secondary)]">
                      {formData.siteName}
                    </span>
                  )}
                  {formData.section && (
                    <span className="rounded-full bg-[var(--glass-input-bg)] px-3 py-1 text-[var(--text-secondary)]">
                      {formData.section}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const OgField = ({
  id,
  label,
  onChange,
  placeholder,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
    />
  </div>
)

const OgMetric = ({
  label,
  value,
  warning = false
}: {
  label: string
  value: string
  warning?: boolean
}) => (
  <div
    className={`glass-input rounded-xl p-3 ${
      warning ? 'border-[var(--warning)] bg-[var(--warning-subtle)]' : ''
    }`}
  >
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

const getFindingColorClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const OgFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: OgFinding
  label: string
  levelLabel: string
}) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="flex items-start gap-2">
      {finding.level === 'good' ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${finding.level === 'danger' ? 'text-[var(--error)]' : 'text-[var(--warning)]'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getFindingColorClass(finding.level)}`}
          >
            {levelLabel}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
          {finding.subject}
        </p>
      </div>
    </div>
  </div>
)

const CodeBlock = ({ id, label, value }: { id: string; label: string; value: string }) => (
  <div className="flex min-h-0 flex-col gap-3">
    <Label htmlFor={id}>{label}</Label>
    <Textarea
      id={id}
      value={value}
      readOnly
      rows={16}
      className="min-h-[320px] flex-1 resize-none font-mono text-xs"
    />
  </div>
)

export default OgMetaClient
