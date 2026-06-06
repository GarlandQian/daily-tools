'use client'

import { Copy, ImageIcon, RotateCcw, SearchCheck, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type OgType = 'website' | 'article' | 'profile' | 'product'

interface OgFormData {
  description: string
  image: string
  imageAlt: string
  locale: string
  siteName: string
  title: string
  twitter: string
  type: OgType
  url: string
}

const DEFAULT_DATA: OgFormData = {
  description:
    'A fast, local-first daily tools collection for developers, creators, and operators.',
  image: 'https://daily-tools.vercel.app/og.png',
  imageAlt: 'Daily Tools interface preview',
  locale: 'en_US',
  siteName: 'Daily Tools',
  title: 'Daily Tools',
  twitter: '@dailytools',
  type: 'website',
  url: 'https://daily-tools.vercel.app'
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
    '@type': data.type === 'article' ? 'Article' : 'WebSite',
    description: data.description.trim(),
    image: image || undefined,
    name: data.title.trim(),
    url: url || undefined
  }

  return `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`
}

const OgMetaClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<OgFormData>(DEFAULT_DATA)

  const tags = useMemo(() => buildMetaTags(formData), [formData])
  const jsonLd = useMemo(() => buildJsonLd(formData), [formData])
  const previewImage = useMemo(() => getHttpUrl(formData.image), [formData.image])
  const pageUrl = useMemo(() => getHttpUrl(formData.url), [formData.url])
  const titleLength = formData.title.trim().length
  const descriptionLength = formData.description.trim().length
  const hasTitleWarning = titleLength > 60
  const hasDescriptionWarning = descriptionLength > 160

  const setField = (field: keyof OgFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleReset = () => {
    setFormData(DEFAULT_DATA)
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
                  warning={hasTitleWarning}
                />
                <OgMetric
                  label={t('app.generation.og.description_length')}
                  value={`${descriptionLength}/160`}
                  warning={hasDescriptionWarning}
                />
                <OgMetric
                  label={t('app.generation.og.tags')}
                  value={String(tags.split('\n').length)}
                />
                <OgMetric label={t('app.generation.og.valid_url')} value={pageUrl ? 'OK' : '--'} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <SearchCheck className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.og.generated')}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(jsonLd)}
              >
                {t('app.generation.og.copy_jsonld')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col gap-3">
              <Label htmlFor="og-tags">{t('app.generation.og.meta_tags')}</Label>
              <Textarea
                id="og-tags"
                value={tags}
                readOnly
                rows={16}
                className="min-h-[320px] flex-1 resize-none font-mono"
              />
            </div>
            <div className="flex min-h-0 flex-col gap-3">
              <Label htmlFor="og-jsonld">{t('app.generation.og.jsonld')}</Label>
              <Textarea
                id="og-jsonld"
                value={jsonLd}
                readOnly
                rows={16}
                className="min-h-[320px] flex-1 resize-none font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
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

export default OgMetaClient
