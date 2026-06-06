'use client'

import { Copy, FileSearch, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

interface SitemapEntry {
  changefreq: ChangeFreq
  id: string
  lastmod: string
  path: string
  priority: string
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

const DEFAULT_DISALLOW = ['/api/', '/admin/', '/private/']

const DEFAULT_SITEMAP: SitemapEntry[] = [
  { id: makeId(), path: '/', priority: '1.0', changefreq: 'weekly', lastmod: '' },
  { id: makeId(), path: '/format/json', priority: '0.8', changefreq: 'monthly', lastmod: '' },
  { id: makeId(), path: '/generation/qrcode', priority: '0.8', changefreq: 'monthly', lastmod: '' }
]

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const joinUrl = (origin: string, path: string) => {
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`
  return `${origin}${cleanPath}`
}

const buildRobots = ({
  allowAll,
  disallowPaths,
  host,
  includeHost,
  includeSitemap,
  sitemapUrl
}: {
  allowAll: boolean
  disallowPaths: string[]
  host: string
  includeHost: boolean
  includeSitemap: boolean
  sitemapUrl: string
}) => {
  const lines = ['User-agent: *']

  if (allowAll) {
    lines.push('Allow: /')
  } else {
    disallowPaths
      .map(path => path.trim())
      .filter(Boolean)
      .forEach(path => lines.push(`Disallow: ${path.startsWith('/') ? path : `/${path}`}`))
  }

  if (includeSitemap && sitemapUrl) {
    lines.push('', `Sitemap: ${sitemapUrl}`)
  }

  if (includeHost && host) {
    lines.push(`Host: ${host}`)
  }

  return lines.join('\n')
}

const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const buildSitemap = (siteUrl: string, entries: SitemapEntry[]) => {
  const origin = normalizeSiteUrl(siteUrl)
  if (!origin) return ''

  const urls = entries
    .filter(entry => entry.path.trim())
    .map(entry => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(joinUrl(origin, entry.path))}</loc>`,
        entry.lastmod.trim() ? `    <lastmod>${escapeXml(entry.lastmod.trim())}</lastmod>` : '',
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
        entry.priority.trim() ? `    <priority>${escapeXml(entry.priority.trim())}</priority>` : '',
        '  </url>'
      ].filter(Boolean)

      return lines.join('\n')
    })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
}

const RobotsClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [siteUrl, setSiteUrl] = useState('https://daily-tools.vercel.app')
  const [allowAll, setAllowAll] = useState(false)
  const [includeSitemap, setIncludeSitemap] = useState(true)
  const [includeHost, setIncludeHost] = useState(false)
  const [disallowPaths, setDisallowPaths] = useState(DEFAULT_DISALLOW)
  const [entries, setEntries] = useState(DEFAULT_SITEMAP)

  const normalizedSite = useMemo(() => normalizeSiteUrl(siteUrl), [siteUrl])
  const sitemapUrl = normalizedSite ? `${normalizedSite}/sitemap.xml` : ''
  const robots = useMemo(
    () =>
      buildRobots({
        allowAll,
        disallowPaths,
        host: normalizedSite.replace(/^https?:\/\//i, ''),
        includeHost,
        includeSitemap,
        sitemapUrl
      }),
    [allowAll, disallowPaths, includeHost, includeSitemap, normalizedSite, sitemapUrl]
  )
  const sitemap = useMemo(() => buildSitemap(siteUrl, entries), [entries, siteUrl])

  const updateDisallow = (index: number, value: string) => {
    setDisallowPaths(prev => prev.map((path, pathIndex) => (pathIndex === index ? value : path)))
  }

  const removeDisallow = (index: number) => {
    setDisallowPaths(prev => prev.filter((_, pathIndex) => pathIndex !== index))
  }

  const updateEntry = (id: string, field: keyof SitemapEntry, value: string) => {
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry)))
  }

  const reset = () => {
    setSiteUrl('https://daily-tools.vercel.app')
    setAllowAll(false)
    setIncludeSitemap(true)
    setIncludeHost(false)
    setDisallowPaths(DEFAULT_DISALLOW)
    setEntries(DEFAULT_SITEMAP.map(entry => ({ ...entry, id: makeId() })))
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.robots')}
              </CardTitle>
              <CardDescription>{t('app.generation.robots.description')}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={reset}
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Label htmlFor="robots-site">{t('app.generation.robots.site')}</Label>
              <Input
                id="robots-site"
                value={siteUrl}
                onChange={event => setSiteUrl(event.target.value)}
                placeholder="https://example.com"
                className="font-mono"
              />
            </div>
            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={allowAll}
                onChange={event => setAllowAll(event.target.checked)}
                label={t('app.generation.robots.allow_all')}
              />
              <Checkbox
                checked={includeSitemap}
                onChange={event => setIncludeSitemap(event.target.checked)}
                label={t('app.generation.robots.include_sitemap')}
              />
              <Checkbox
                checked={includeHost}
                onChange={event => setIncludeHost(event.target.checked)}
                label={t('app.generation.robots.include_host')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="bg-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{t('app.generation.robots.disallow')}</CardTitle>
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setDisallowPaths(prev => [...prev, '/'])}
                  >
                    {t('public.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {disallowPaths.map((path, index) => (
                  <div key={`${path}-${index}`} className="flex gap-2">
                    <Input
                      value={path}
                      onChange={event => updateDisallow(index, event.target.value)}
                      disabled={allowAll}
                      className="font-mono"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('public.clear')}
                      onClick={() => removeDisallow(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    {t('app.generation.robots.sitemap_entries')}
                  </CardTitle>
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() =>
                      setEntries(prev => [
                        ...prev,
                        {
                          id: makeId(),
                          path: '/',
                          priority: '0.5',
                          changefreq: 'monthly',
                          lastmod: ''
                        }
                      ])
                    }
                  >
                    {t('public.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-base)] p-3 md:grid-cols-[minmax(0,1fr)_120px_150px_120px_44px]"
                  >
                    <Input
                      value={entry.path}
                      onChange={event => updateEntry(entry.id, 'path', event.target.value)}
                      placeholder="/"
                      className="font-mono"
                    />
                    <Input
                      value={entry.priority}
                      onChange={event => updateEntry(entry.id, 'priority', event.target.value)}
                      placeholder="0.8"
                      className="font-mono"
                    />
                    <Select
                      value={entry.changefreq}
                      onChange={event => updateEntry(entry.id, 'changefreq', event.target.value)}
                    >
                      {(
                        [
                          'always',
                          'hourly',
                          'daily',
                          'weekly',
                          'monthly',
                          'yearly',
                          'never'
                        ] as const
                      ).map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={entry.lastmod}
                      onChange={event => updateEntry(entry.id, 'lastmod', event.target.value)}
                      placeholder="2026-06-06"
                      className="font-mono"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('public.clear')}
                      onClick={() => setEntries(prev => prev.filter(item => item.id !== entry.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <RobotsOutput
          title="robots.txt"
          value={robots}
          copyLabel={t('public.copy')}
          onCopy={() => copy(robots)}
        />
        <RobotsOutput
          title="sitemap.xml"
          value={sitemap}
          copyLabel={t('public.copy')}
          onCopy={() => copy(sitemap)}
        />
      </div>
    </div>
  )
}

const RobotsOutput = ({
  onCopy,
  copyLabel,
  title,
  value
}: {
  copyLabel: string
  onCopy: () => void
  title: string
  value: string
}) => (
  <Card className="flex min-h-[360px] flex-col">
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={onCopy}>
          {copyLabel}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <Textarea
        value={value}
        readOnly
        rows={16}
        className="min-h-[300px] flex-1 resize-none font-mono"
      />
    </CardContent>
  </Card>
)

export default RobotsClient
