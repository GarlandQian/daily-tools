'use client'

import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  FileSearch,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
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
type FindingLevel = 'danger' | 'good' | 'warn'
type RobotsPresetId = 'public' | 'app' | 'content' | 'private'

interface RobotsFinding {
  key: string
  level: FindingLevel
  subject: string
}

interface ParsedRobotsAgent {
  agent: string
  allows: string[]
  crawlDelays: string[]
  disallows: string[]
}

interface ParsedRobots {
  capped: boolean
  hosts: string[]
  invalidLines: number
  sitemaps: string[]
  unknownDirectives: string[]
  userAgents: ParsedRobotsAgent[]
}

interface SitemapEntry {
  changefreq: ChangeFreq
  id: string
  lastmod: string
  path: string
  priority: string
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

const DEFAULT_DISALLOW = ['/api/', '/admin/', '/private/']
const COMMON_DISALLOW = ['/api/', '/admin/', '/private/', '/account/', '/dashboard/', '/tmp/']
const ROBOTS_WORKSPACE_LIMIT = 40000
const ROBOTS_SITE_URL_LIMIT = 2048
const ROBOTS_LINE_LIMIT = 400
const SITEMAP_ENTRY_LIMIT = 300
const VISIBLE_SITEMAP_ENTRY_LIMIT = 80
const SITEMAP_OUTPUT_PREVIEW_LIMIT = 80
const BULK_PATH_INPUT_LIMIT = 100000
const BULK_PATH_IMPORT_LIMIT = 300
const VISIBLE_ROBOTS_FINDINGS_LIMIT = 80
const DISALLOW_PATH_LIMIT = 80
const VISIBLE_DISALLOW_PATH_LIMIT = 40
const DEFAULT_ROBOTS_WORKSPACE = `User-agent: *
Disallow: /api/
Disallow: /admin/
Disallow: /private/

Sitemap: https://daily-tools.vercel.app/sitemap.xml`

const DEFAULT_SITEMAP: SitemapEntry[] = [
  { id: makeId(), path: '/', priority: '1.0', changefreq: 'weekly', lastmod: '' },
  { id: makeId(), path: '/format/json', priority: '0.8', changefreq: 'monthly', lastmod: '' },
  { id: makeId(), path: '/generation/qrcode', priority: '0.8', changefreq: 'monthly', lastmod: '' }
]

const ROBOTS_PRESETS: Record<
  RobotsPresetId,
  {
    allowAll: boolean
    disallowPaths: string[]
    entries: Array<Omit<SitemapEntry, 'id'>>
  }
> = {
  public: {
    allowAll: true,
    disallowPaths: [],
    entries: [
      { path: '/', priority: '1.0', changefreq: 'daily', lastmod: '' },
      { path: '/about', priority: '0.7', changefreq: 'monthly', lastmod: '' }
    ]
  },
  app: {
    allowAll: false,
    disallowPaths: ['/api/', '/admin/', '/account/', '/dashboard/'],
    entries: [
      { path: '/', priority: '1.0', changefreq: 'weekly', lastmod: '' },
      { path: '/pricing', priority: '0.8', changefreq: 'weekly', lastmod: '' },
      { path: '/docs', priority: '0.7', changefreq: 'weekly', lastmod: '' }
    ]
  },
  content: {
    allowAll: false,
    disallowPaths: ['/search', '/tag/', '/preview/'],
    entries: [
      { path: '/', priority: '1.0', changefreq: 'daily', lastmod: '' },
      { path: '/blog', priority: '0.9', changefreq: 'daily', lastmod: '' },
      { path: '/archive', priority: '0.5', changefreq: 'weekly', lastmod: '' }
    ]
  },
  private: {
    allowAll: false,
    disallowPaths: ['/'],
    entries: []
  }
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const isValidHttpUrl = (value: string) => {
  const normalized = normalizeSiteUrl(value)
  if (!normalized) return false

  try {
    const url = new URL(normalized)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
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

const isValidPriority = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 1
}

const isValidDate = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return true
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(new Date(`${trimmed}T00:00:00Z`).getTime())
  )
}

const buildEntry = (entry: Omit<SitemapEntry, 'id'>): SitemapEntry => ({ ...entry, id: makeId() })

const normalizePathItem = (value: string) => {
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search}`
  } catch {
    return value.startsWith('/') ? value : `/${value}`
  }
}

const parsePathList = (value: string) => {
  const isInputTruncated = value.length > BULK_PATH_INPUT_LIMIT
  const source = isInputTruncated ? value.slice(0, BULK_PATH_INPUT_LIMIT) : value
  const paths: string[] = []
  let current = ''
  let hitPathLimit = false

  const pushCurrent = () => {
    const item = current.trim()
    current = ''
    if (!item) return false
    if (paths.length >= BULK_PATH_IMPORT_LIMIT) {
      hitPathLimit = true
      return true
    }
    paths.push(normalizePathItem(item))
    return false
  }

  for (const char of source) {
    if (char === ',' || char === '\n' || char === '\r') {
      if (pushCurrent()) break
    } else {
      current += char
    }
  }

  if (!hitPathLimit) pushCurrent()

  return {
    hitPathLimit,
    isInputTruncated,
    paths
  }
}

const parseRobotsWorkspace = (input: string): ParsedRobots => {
  const capped = input.length > ROBOTS_WORKSPACE_LIMIT
  const safeInput = input.slice(0, ROBOTS_WORKSPACE_LIMIT)
  const parsed: ParsedRobots = {
    capped,
    hosts: [],
    invalidLines: 0,
    sitemaps: [],
    unknownDirectives: [],
    userAgents: []
  }
  let currentAgent: ParsedRobotsAgent | null = null

  for (const rawLine of safeInput.split(/\r?\n/u).slice(0, ROBOTS_LINE_LIMIT)) {
    const withoutComment = rawLine.replace(/#.*/u, '').trim()
    if (!withoutComment) continue

    const separatorIndex = withoutComment.indexOf(':')
    if (separatorIndex === -1) {
      parsed.invalidLines += 1
      continue
    }

    const directive = withoutComment.slice(0, separatorIndex).trim().toLowerCase()
    const value = withoutComment.slice(separatorIndex + 1).trim()

    if (directive === 'user-agent') {
      currentAgent = { agent: value || '*', allows: [], crawlDelays: [], disallows: [] }
      parsed.userAgents.push(currentAgent)
      continue
    }

    if (directive === 'sitemap') {
      if (value) parsed.sitemaps.push(value)
      continue
    }

    if (directive === 'host') {
      if (value) parsed.hosts.push(value)
      continue
    }

    if (!currentAgent) {
      parsed.invalidLines += 1
      continue
    }

    if (directive === 'allow') {
      currentAgent.allows.push(value || '/')
      continue
    }

    if (directive === 'disallow') {
      currentAgent.disallows.push(value)
      continue
    }

    if (directive === 'crawl-delay') {
      if (value) currentAgent.crawlDelays.push(value)
      continue
    }

    parsed.unknownDirectives.push(directive)
  }

  return parsed
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const getSitemapOrigin = (sitemapUrl: string) => {
  try {
    const url = new URL(sitemapUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.origin
  } catch {
    return ''
  }
}

const getPrimaryParsedAgent = (parsed: ParsedRobots) =>
  parsed.userAgents.find(agent => agent.agent === '*') ?? parsed.userAgents[0]

const duplicateAgentNames = (agents: ParsedRobotsAgent[]) => {
  const counts = new Map<string, number>()
  agents.forEach(agent => {
    const key = agent.agent.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([agent]) => agent)
}

const buildRobotsFindings = (
  validation: string[],
  parsed: ParsedRobots,
  workspace: string
): RobotsFinding[] => {
  const findings: RobotsFinding[] = validation.map(warning => ({
    key: 'builder_warning',
    level: 'warn',
    subject: warning
  }))
  const primary = getPrimaryParsedAgent(parsed)
  const duplicateAgents = duplicateAgentNames(parsed.userAgents)

  if (parsed.capped)
    findings.push({
      key: 'workspace_capped',
      level: 'warn',
      subject: String(ROBOTS_WORKSPACE_LIMIT)
    })
  if (
    workspace.trim() &&
    parsed.userAgents.length === 0 &&
    parsed.sitemaps.length === 0 &&
    parsed.hosts.length === 0
  )
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'robots.txt' })
  if (parsed.invalidLines > 0)
    findings.push({ key: 'invalid_lines', level: 'warn', subject: String(parsed.invalidLines) })
  if (parsed.userAgents.length === 0 && workspace.trim())
    findings.push({ key: 'missing_user_agent', level: 'danger', subject: 'User-agent' })
  if (primary?.disallows.includes('/'))
    findings.push({ key: 'blocks_all', level: 'danger', subject: primary.agent })
  if (parsed.sitemaps.length === 0 && workspace.trim())
    findings.push({ key: 'missing_sitemap', level: 'warn', subject: 'Sitemap' })
  parsed.sitemaps.forEach(sitemap => {
    if (!isHttpUrl(sitemap))
      findings.push({ key: 'invalid_sitemap_url', level: 'danger', subject: sitemap })
  })
  if (parsed.hosts.length > 1)
    findings.push({ key: 'multiple_hosts', level: 'warn', subject: parsed.hosts.join(', ') })
  if (duplicateAgents.length > 0)
    findings.push({ key: 'duplicate_agents', level: 'warn', subject: duplicateAgents.join(', ') })
  if (parsed.unknownDirectives.length > 0)
    findings.push({
      key: 'unknown_directives',
      level: 'warn',
      subject: Array.from(new Set(parsed.unknownDirectives)).join(', ')
    })
  parsed.userAgents.forEach(agent => {
    const allowSet = new Set(agent.allows)
    const conflicts = agent.disallows.filter(path => allowSet.has(path))
    if (conflicts.length > 0)
      findings.push({
        key: 'allow_disallow_conflict',
        level: 'warn',
        subject: `${agent.agent}: ${conflicts.join(', ')}`
      })
    agent.crawlDelays.forEach(delay => {
      const numeric = Number(delay)
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 30)
        findings.push({
          key: 'crawl_delay_risky',
          level: 'warn',
          subject: `${agent.agent}: ${delay}`
        })
    })
  })

  if (findings.length === 0) findings.push({ key: 'ready', level: 'good', subject: 'robots.txt' })

  return findings
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: RobotsFinding[]) =>
  [
    ['level', 'key', 'subject'].map(csvCell).join(','),
    ...findings.map(finding => [finding.level, finding.key, finding.subject].map(csvCell).join(','))
  ].join('\n')

const buildSitemap = (siteUrl: string, entries: SitemapEntry[]) => {
  const origin = normalizeSiteUrl(siteUrl)
  if (!origin) return ''

  const urls = entries
    .filter(entry => entry.path.trim())
    .map(entry => {
      const priority = entry.priority.trim()
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(joinUrl(origin, entry.path))}</loc>`,
        entry.lastmod.trim() ? `    <lastmod>${escapeXml(entry.lastmod.trim())}</lastmod>` : '',
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
        priority && isValidPriority(priority)
          ? `    <priority>${escapeXml(priority)}</priority>`
          : '',
        '  </url>'
      ].filter(Boolean)

      return lines.join('\n')
    })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
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
  const [bulkPaths, setBulkPaths] = useState('')
  const [isBulkPathsCapped, setIsBulkPathsCapped] = useState(false)
  const [workspace, setWorkspace] = useState(DEFAULT_ROBOTS_WORKSPACE)
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const deferredBulkPaths = useDeferredValue(bulkPaths)
  const deferredWorkspace = useDeferredValue(workspace)

  const normalizedSite = useMemo(() => normalizeSiteUrl(siteUrl), [siteUrl])
  const parsedRobots = useMemo(() => {
    const next = parseRobotsWorkspace(deferredWorkspace)

    return isWorkspaceCapped ? { ...next, capped: true } : next
  }, [deferredWorkspace, isWorkspaceCapped])
  const bulkPathParse = useMemo(() => {
    const next = parsePathList(deferredBulkPaths)

    return isBulkPathsCapped ? { ...next, isInputTruncated: true } : next
  }, [deferredBulkPaths, isBulkPathsCapped])
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

  const updateWorkspace = (value: string) => {
    const capped = value.length > ROBOTS_WORKSPACE_LIMIT

    setIsWorkspaceCapped(capped)
    setWorkspace(capped ? value.slice(0, ROBOTS_WORKSPACE_LIMIT) : value)
  }

  const updateSiteUrl = (value: string) => {
    setSiteUrl(value.slice(0, ROBOTS_SITE_URL_LIMIT))
  }

  const updateBulkPaths = (value: string) => {
    const capped = value.length > BULK_PATH_INPUT_LIMIT

    setIsBulkPathsCapped(capped)
    setBulkPaths(capped ? value.slice(0, BULK_PATH_INPUT_LIMIT) : value)
  }
  const visibleEntries = useMemo(() => entries.slice(0, VISIBLE_SITEMAP_ENTRY_LIMIT), [entries])
  const sitemapPreviewEntries = useMemo(
    () => entries.slice(0, SITEMAP_OUTPUT_PREVIEW_LIMIT),
    [entries]
  )
  const sitemapPreview = useMemo(
    () => buildSitemap(siteUrl, sitemapPreviewEntries),
    [sitemapPreviewEntries, siteUrl]
  )
  const isEntryCapReached = entries.length >= SITEMAP_ENTRY_LIMIT
  const isEntryListLimited = entries.length > visibleEntries.length
  const isSitemapOutputLimited = entries.length > sitemapPreviewEntries.length
  const visibleDisallowPaths = useMemo(
    () =>
      disallowPaths.map((path, index) => ({ index, path })).slice(0, VISIBLE_DISALLOW_PATH_LIMIT),
    [disallowPaths]
  )
  const isDisallowCapReached = disallowPaths.length >= DISALLOW_PATH_LIMIT
  const isDisallowListLimited = disallowPaths.length > visibleDisallowPaths.length
  const validation = useMemo(() => {
    const warnings: string[] = []
    const seenPaths = new Set<string>()

    if (!isValidHttpUrl(siteUrl)) warnings.push(t('app.generation.robots.warning.invalid_site'))

    entries.forEach(entry => {
      const path = entry.path.trim()
      if (!path) return

      if (seenPaths.has(path)) {
        warnings.push(t('app.generation.robots.warning.duplicate_path', { path }))
      }
      seenPaths.add(path)

      if (!isValidPriority(entry.priority)) {
        warnings.push(t('app.generation.robots.warning.invalid_priority', { path }))
      }

      if (!isValidDate(entry.lastmod)) {
        warnings.push(t('app.generation.robots.warning.invalid_lastmod', { path }))
      }
    })

    if (includeSitemap && entries.filter(entry => entry.path.trim()).length === 0) {
      warnings.push(t('app.generation.robots.warning.empty_sitemap'))
    }

    return warnings
  }, [entries, includeSitemap, siteUrl, t])
  const findings = useMemo(
    () => buildRobotsFindings(validation, parsedRobots, workspace),
    [parsedRobots, validation, workspace]
  )
  const visibleFindings = useMemo(
    () => findings.slice(0, VISIBLE_ROBOTS_FINDINGS_LIMIT),
    [findings]
  )
  const isFindingsListLimited = findings.length > visibleFindings.length
  const stats = useMemo(
    () => [
      {
        label: t('app.generation.robots.stats_rules'),
        value: allowAll ? 1 : disallowPaths.filter(Boolean).length
      },
      {
        label: t('app.generation.robots.stats_urls'),
        value: entries.filter(entry => entry.path.trim()).length
      },
      {
        label: t('app.generation.robots.stats_lastmod'),
        value: entries.filter(entry => entry.lastmod.trim()).length
      },
      { label: t('app.generation.robots.stats_warnings'), value: validation.length }
    ],
    [allowAll, disallowPaths, entries, t, validation.length]
  )

  const updateDisallow = (index: number, value: string) => {
    setDisallowPaths(prev => prev.map((path, pathIndex) => (pathIndex === index ? value : path)))
  }

  const removeDisallow = (index: number) => {
    setDisallowPaths(prev => prev.filter((_, pathIndex) => pathIndex !== index))
  }

  const updateEntry = (id: string, field: keyof SitemapEntry, value: string) => {
    setEntries(prev => prev.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry)))
  }

  const applyPreset = (presetId: RobotsPresetId) => {
    const preset = ROBOTS_PRESETS[presetId]
    setAllowAll(preset.allowAll)
    setIncludeSitemap(preset.entries.length > 0)
    setDisallowPaths(preset.disallowPaths.slice(0, DISALLOW_PATH_LIMIT))
    setEntries(preset.entries.slice(0, SITEMAP_ENTRY_LIMIT).map(buildEntry))
  }

  const addCommonDisallow = (path: string) => {
    setAllowAll(false)
    setDisallowPaths(prev => {
      if (prev.includes(path)) return prev
      if (prev.length >= DISALLOW_PATH_LIMIT) return prev
      return [...prev, path]
    })
  }

  const importBulkPaths = () => {
    const paths = bulkPathParse.paths
    if (paths.length === 0) return

    setEntries(prev => {
      const availableSlots = Math.max(0, SITEMAP_ENTRY_LIMIT - prev.length)
      if (availableSlots === 0) return prev
      return [
        ...prev,
        ...paths.slice(0, availableSlots).map(path =>
          buildEntry({
            path,
            priority: path === '/' ? '1.0' : '0.6',
            changefreq: 'weekly',
            lastmod: ''
          })
        )
      ]
    })
    updateBulkPaths('')
  }

  const stampToday = () => {
    const today = todayISO()
    setEntries(prev => prev.map(entry => ({ ...entry, lastmod: today })))
  }

  const reset = () => {
    updateSiteUrl('https://daily-tools.vercel.app')
    setAllowAll(false)
    setIncludeSitemap(true)
    setIncludeHost(false)
    setDisallowPaths(DEFAULT_DISALLOW)
    setEntries(DEFAULT_SITEMAP.map(entry => ({ ...entry, id: makeId() })))
    updateBulkPaths('')
    updateWorkspace(DEFAULT_ROBOTS_WORKSPACE)
  }

  const applyParsedRobots = () => {
    const primary = getPrimaryParsedAgent(parsedRobots)
    if (!primary) return

    const nextSite = parsedRobots.sitemaps.map(getSitemapOrigin).find(Boolean)
    if (nextSite) updateSiteUrl(nextSite)
    if (!nextSite && parsedRobots.hosts[0]) updateSiteUrl(normalizeSiteUrl(parsedRobots.hosts[0]))
    setIncludeSitemap(parsedRobots.sitemaps.length > 0)
    setIncludeHost(parsedRobots.hosts.length > 0)
    setAllowAll(primary.disallows.length === 0 && primary.allows.includes('/'))
    setDisallowPaths(primary.disallows.filter(path => path.trim()))
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(item => (
              <div key={item.label} className="glass-input rounded-xl p-3">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            {(['public', 'app', 'content', 'private'] as const).map(presetId => (
              <button
                key={presetId}
                type="button"
                className="glass-input rounded-xl p-3 text-left transition-all hover:glass-panel-strong"
                onClick={() => applyPreset(presetId)}
              >
                <div className="text-sm font-semibold">
                  {t(`app.generation.robots.preset.${presetId}`)}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.generation.robots.preset.${presetId}.hint`)}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <Label htmlFor="robots-site">{t('app.generation.robots.site')}</Label>
              <Input
                id="robots-site"
                value={siteUrl}
                onChange={event => updateSiteUrl(event.target.value)}
                placeholder="https://example.com"
                maxLength={ROBOTS_SITE_URL_LIMIT}
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

          {validation.length > 0 && (
            <div className="glass-input rounded-xl p-3">
              <div className="mb-2 text-sm font-semibold text-[var(--warning)]">
                {t('app.generation.robots.validation')}
              </div>
              <div className="flex flex-wrap gap-2">
                {validation.slice(0, 6).map(warning => (
                  <span
                    key={warning}
                    className="rounded-full border border-[var(--border-base)] bg-[var(--warning-subtle)] px-3 py-1 text-xs text-[var(--warning)]"
                  >
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="bg-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">{t('app.generation.robots.disallow')}</CardTitle>
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    disabled={isDisallowCapReached}
                    onClick={() =>
                      setDisallowPaths(prev =>
                        prev.length >= DISALLOW_PATH_LIMIT ? prev : [...prev, '/']
                      )
                    }
                  >
                    {t('public.add')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {COMMON_DISALLOW.map(path => (
                    <Button
                      key={path}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addCommonDisallow(path)}
                    >
                      {path}
                    </Button>
                  ))}
                </div>
                {visibleDisallowPaths.map(({ index, path }) => (
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
                {isDisallowListLimited && (
                  <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t('app.generation.robots.warning.disallow_limited', {
                      total: disallowPaths.length.toLocaleString(),
                      visible: visibleDisallowPaths.length.toLocaleString()
                    })}
                  </p>
                )}
                {isDisallowCapReached && (
                  <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {t('app.generation.robots.warning.disallow_cap', {
                      limit: DISALLOW_PATH_LIMIT.toLocaleString()
                    })}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    {t('app.generation.robots.sitemap_entries')}
                  </CardTitle>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<CalendarDays className="h-4 w-4" />}
                      onClick={stampToday}
                    >
                      {t('app.generation.robots.today')}
                    </Button>
                    <Button
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() =>
                        setEntries(prev =>
                          [
                            ...prev,
                            {
                              id: makeId(),
                              path: '/',
                              priority: '0.5',
                              changefreq: 'monthly' as const,
                              lastmod: ''
                            }
                          ].slice(0, SITEMAP_ENTRY_LIMIT)
                        )
                      }
                      disabled={isEntryCapReached}
                    >
                      {t('public.add')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-base)] p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <Textarea
                    value={bulkPaths}
                    onChange={event => updateBulkPaths(event.target.value)}
                    rows={3}
                    placeholder={t('app.generation.robots.bulk_placeholder')}
                    className="resize-none font-mono"
                  />
                  <Button
                    className="self-start"
                    onClick={importBulkPaths}
                    disabled={!bulkPathParse.paths.length || isEntryCapReached}
                  >
                    {t('app.generation.robots.import_paths')}
                  </Button>
                </div>
                {(bulkPathParse.isInputTruncated ||
                  bulkPathParse.hitPathLimit ||
                  isEntryCapReached) && (
                  <div className="space-y-2">
                    {bulkPathParse.isInputTruncated && (
                      <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                        {t('app.generation.robots.warning.bulk_input_truncated', {
                          limit: BULK_PATH_INPUT_LIMIT.toLocaleString()
                        })}
                      </p>
                    )}
                    {bulkPathParse.hitPathLimit && (
                      <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                        {t('app.generation.robots.warning.bulk_paths_limited', {
                          limit: BULK_PATH_IMPORT_LIMIT.toLocaleString()
                        })}
                      </p>
                    )}
                    {isEntryCapReached && (
                      <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                        {t('app.generation.robots.warning.entry_cap', {
                          limit: SITEMAP_ENTRY_LIMIT.toLocaleString()
                        })}
                      </p>
                    )}
                  </div>
                )}
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_120px_44px] gap-3 px-3 text-xs font-medium text-[var(--text-secondary)] md:grid">
                  <span>{t('app.generation.robots.path')}</span>
                  <span>{t('app.generation.robots.priority')}</span>
                  <span>{t('app.generation.robots.frequency')}</span>
                  <span>{t('app.generation.robots.lastmod')}</span>
                  <span />
                </div>
                {visibleEntries.map(entry => (
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
                {isEntryListLimited && (
                  <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                    {t('app.generation.robots.warning.entries_limited', {
                      total: entries.length.toLocaleString(),
                      visible: visibleEntries.length.toLocaleString()
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.robots.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.robots.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.generation.robots.workspace_placeholder')}
              className="min-h-[240px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-3">
              <RobotsMetric
                label={t('app.generation.robots.metric.agents')}
                value={parsedRobots.userAgents.length}
              />
              <RobotsMetric
                label={t('app.generation.robots.metric.sitemaps')}
                value={parsedRobots.sitemaps.length}
              />
              <RobotsMetric
                label={t('app.generation.robots.metric.invalid_lines')}
                value={parsedRobots.invalidLines}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={!getPrimaryParsedAgent(parsedRobots)}
                onClick={applyParsedRobots}
              >
                {t('app.generation.robots.use_parsed')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<FileSearch className="h-4 w-4" />}
                onClick={() => updateWorkspace(robots)}
              >
                {t('app.generation.robots.use_generated')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => updateWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.robots.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.robots.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(buildFindingsCsv(findings))}
              >
                {t('app.generation.robots.copy_audit_csv')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    buildFindingsCsv(findings),
                    'robots-audit.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                {t('app.generation.robots.download_audit_csv')}
              </Button>
            </div>
            <div className="space-y-2">
              {visibleFindings.map(finding => (
                <RobotsFindingRow
                  key={`${finding.key}-${finding.subject}`}
                  finding={finding}
                  label={t(`app.generation.robots.audit.${finding.key}`)}
                  levelLabel={t(`app.generation.robots.level.${finding.level}`)}
                />
              ))}
              {isFindingsListLimited && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.generation.robots.warning.findings_limited', {
                    total: findings.length.toLocaleString(),
                    visible: visibleFindings.length.toLocaleString()
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <RobotsOutput
          title="robots.txt"
          value={robots}
          copyLabel={t('public.copy')}
          onCopy={() => copy(robots)}
          downloadLabel={t('app.generation.robots.download')}
          onDownload={() => downloadText(robots, 'robots.txt', 'text/plain;charset=utf-8')}
        />
        <RobotsOutput
          title="sitemap.xml"
          value={sitemapPreview}
          hint={
            isSitemapOutputLimited
              ? t('app.generation.robots.warning.sitemap_preview_limited', {
                  total: entries.length.toLocaleString(),
                  visible: sitemapPreviewEntries.length.toLocaleString()
                })
              : undefined
          }
          copyLabel={t('public.copy')}
          onCopy={() => copy(buildSitemap(siteUrl, entries))}
          downloadLabel={t('app.generation.robots.download')}
          onDownload={() =>
            downloadText(
              buildSitemap(siteUrl, entries),
              'sitemap.xml',
              'application/xml;charset=utf-8'
            )
          }
        />
      </div>
    </div>
  )
}

const RobotsOutput = ({
  onCopy,
  copyLabel,
  downloadLabel,
  hint,
  onDownload,
  title,
  value
}: {
  copyLabel: string
  downloadLabel: string
  hint?: string
  onCopy: () => void
  onDownload: () => void
  title: string
  value: string
}) => (
  <Card className="flex min-h-[360px] flex-col">
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Download className="h-4 w-4" />}
            onClick={onDownload}
          >
            {downloadLabel}
          </Button>
          <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={onCopy}>
            {copyLabel}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <Textarea
        value={value}
        readOnly
        rows={16}
        className="min-h-[300px] flex-1 resize-none font-mono"
      />
      {hint && (
        <p className="mt-3 rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
          {hint}
        </p>
      )}
    </CardContent>
  </Card>
)

const RobotsMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <p className="truncate text-xs font-medium text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

const getFindingColorClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const RobotsFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: RobotsFinding
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

export default RobotsClient
