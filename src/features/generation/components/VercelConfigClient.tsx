'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow
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

const FRAMEWORKS = ['nextjs', 'vite', 'astro', 'sveltekit', 'other'] as const
const OUTPUT_TYPES = ['vercel', 'package', 'env', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 80000
const RENDER_LIMIT = 80
const UNSAFE_FIELD_PATTERN = /[\r\n]/u
const SENSITIVE_PATTERN = /(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|DATABASE_URL|API_KEY)/iu

type Framework = (typeof FRAMEWORKS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface VercelDraft {
  assetCacheSource: string
  buildCommand: string
  cacheTag: string
  cleanUrls: boolean
  cronPath: string
  cronSchedule: string
  devCommand: string
  fluid: boolean
  framework: Framework
  functionMaxDuration: string
  functionMemory: string
  functionPattern: string
  imageHostname: string
  imageMinimumCacheTtl: string
  imageQualities: string
  includeAssetCache: boolean
  includeCron: boolean
  includeFunctions: boolean
  includeHeaders: boolean
  includeImages: boolean
  includeRedirect: boolean
  includeRewrite: boolean
  includeRewriteCaching: boolean
  includeSecurityHeaders: boolean
  installCommand: string
  outputDirectory: string
  projectName: string
  publicSource: boolean
  redirectDestination: string
  redirectPermanent: boolean
  redirectSource: string
  regions: string
  rewriteCacheTtl: string
  rewriteDestination: string
  rewriteSource: string
  trailingSlash: boolean
  useBun: boolean
  useCorepack: boolean
}

interface Preset {
  draft: VercelDraft
  key: string
  workspace: string
}

interface ParsedConfig {
  capped: boolean
  crons: Array<{ path: string; schedule: string }>
  error: string
  framework: string
  functions: Array<{ memory: string; maxDuration: string; pattern: string }>
  hasBuilds: boolean
  hasFluid: boolean
  hasImages: boolean
  hasPublicSource: boolean
  hasRoutes: boolean
  hasSchema: boolean
  hasSecurityHeaders: boolean
  hasRewriteCaching: boolean
  imageDangerousSvg: boolean
  keys: string[]
  redirectCount: number
  redirects: Array<{ destination: string; permanent: boolean; source: string }>
  rewriteCount: number
  rewrites: Array<{ destination: string; source: string }>
  headerCount: number
  headers: Array<{ count: number; source: string }>
  sensitiveValues: string[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: VercelDraft = {
  assetCacheSource: '/assets/(.*)',
  buildCommand: 'pnpm build',
  cacheTag: 'daily-tools',
  cleanUrls: true,
  cronPath: '/api/revalidate',
  cronSchedule: '0 3 * * *',
  devCommand: 'pnpm dev',
  fluid: true,
  framework: 'nextjs',
  functionMaxDuration: '60',
  functionMemory: '1024',
  functionPattern: 'src/app/api/**/*.ts',
  imageHostname: 'images.example.com',
  imageMinimumCacheTtl: '86400',
  imageQualities: '60,75,90',
  includeAssetCache: true,
  includeCron: false,
  includeFunctions: true,
  includeHeaders: true,
  includeImages: true,
  includeRedirect: false,
  includeRewrite: false,
  includeRewriteCaching: false,
  includeSecurityHeaders: true,
  installCommand: 'corepack enable && pnpm install --frozen-lockfile',
  outputDirectory: '',
  projectName: 'daily-tools',
  publicSource: false,
  redirectDestination: '/docs',
  redirectPermanent: false,
  redirectSource: '/guide',
  regions: 'iad1,sfo1',
  rewriteCacheTtl: '3600',
  rewriteDestination: 'https://api.example.com/:path*',
  rewriteSource: '/api/:path*',
  trailingSlash: false,
  useBun: false,
  useCorepack: true
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "cleanUrls": true,
  "fluid": true,
  "regions": ["iad1", "sfo1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "images": {
    "remotePatterns": [
      { "protocol": "https", "hostname": "images.example.com", "pathname": "/**" }
    ],
    "minimumCacheTTL": 86400,
    "qualities": [60, 75, 90],
    "formats": ["image/avif", "image/webp"]
  }
}`
  },
  {
    key: 'spa',
    draft: {
      ...DEFAULT_DRAFT,
      buildCommand: 'pnpm build',
      framework: 'vite',
      functionPattern: 'api/**/*.ts',
      includeCron: false,
      includeFunctions: false,
      includeImages: false,
      includeRewrite: true,
      outputDirectory: 'dist',
      projectName: 'marketing-spa',
      regions: '',
      rewriteDestination: '/index.html',
      rewriteSource: '/(.*)'
    },
    workspace: `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}`
  },
  {
    key: 'api',
    draft: {
      ...DEFAULT_DRAFT,
      buildCommand: '',
      framework: 'other',
      functionMaxDuration: '120',
      includeAssetCache: false,
      includeImages: false,
      includeRewrite: true,
      includeRewriteCaching: true,
      outputDirectory: '',
      projectName: 'edge-api',
      rewriteDestination: 'https://upstream.example.com/:path*',
      rewriteSource: '/api/:path*'
    },
    workspace: `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "fluid": true,
  "regions": ["iad1"],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 120
    }
  },
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://upstream.example.com/:path*" }
  ],
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        { "key": "x-vercel-enable-rewrite-caching", "value": "1" },
        { "key": "CDN-Cache-Control", "value": "max-age=3600" },
        { "key": "Vercel-Cache-Tag", "value": "edge-api" }
      ]
    }
  ]
}`
  },
  {
    key: 'cron',
    draft: {
      ...DEFAULT_DRAFT,
      cronPath: '/api/jobs/digest',
      cronSchedule: '30 8 * * 1',
      includeCron: true,
      includeFunctions: true,
      includeImages: false,
      projectName: 'weekly-digest',
      regions: 'iad1'
    },
    workspace: `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "fluid": true,
  "functions": {
    "src/app/api/jobs/**/*.ts": {
      "maxDuration": 300
    }
  },
  "crons": [
    { "path": "/api/jobs/digest", "schedule": "30 8 * * 1" }
  ]
}`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      buildCommand: '',
      cacheTag: '',
      cleanUrls: false,
      fluid: false,
      functionMaxDuration: '900',
      functionMemory: '3008',
      includeAssetCache: false,
      includeCron: true,
      includeFunctions: true,
      includeHeaders: false,
      includeImages: true,
      includeRedirect: true,
      includeRewrite: true,
      includeRewriteCaching: true,
      includeSecurityHeaders: false,
      installCommand: 'pnpm install',
      outputDirectory: '',
      projectName: 'risky-vercel',
      publicSource: true,
      redirectDestination: 'https://example.org/old',
      redirectPermanent: true,
      redirectSource: '/old',
      rewriteDestination: 'http://internal.example.com/:path*?token=SECRET',
      rewriteSource: '/:path*',
      useCorepack: false
    },
    workspace: `{
  "public": true,
  "routes": [{ "src": "/(.*)", "dest": "http://internal.example.com/$1?token=SECRET" }],
  "rewrites": [
    { "source": "/:path*", "destination": "http://internal.example.com/:path*?token=SECRET" }
  ],
  "redirects": [
    { "source": "/old", "destination": "https://example.org/old", "permanent": true }
  ],
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 900,
      "memory": 3008
    }
  },
  "crons": [
    { "path": "api/job", "schedule": "* * *" }
  ],
  "images": {
    "dangerouslyAllowSVG": true
  }
}`
  }
]

function parseList(value: string, limit = 24) {
  return value
    .split(/[\s,]+/u)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function collectUnsafeDraftSubjects(draft: VercelDraft) {
  return Object.entries(draft)
    .filter(([, value]) => typeof value === 'string' && UNSAFE_FIELD_PATTERN.test(value))
    .map(([key]) => key)
}

function isHttpDestination(value: string) {
  return /^http:\/\//iu.test(value)
}

function isExternalDestination(value: string) {
  return /^https?:\/\//iu.test(value)
}

function isPrivateLookingDestination(value: string) {
  return /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|internal|\.local|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/iu.test(
    value
  )
}

function isCatchAllSource(source: string) {
  return source === '/:path*' || source === '/(.*)' || /\/\(\.\*\)|:path\*/u.test(source)
}

function isValidCron(schedule: string) {
  return schedule.trim().split(/\s+/u).length === 5
}

function buildHeaders(draft: VercelDraft) {
  const headers: Array<{ headers: Array<{ key: string; value: string }>; source: string }> = []

  if (draft.includeSecurityHeaders) {
    headers.push({
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ]
    })
  }

  if (draft.includeAssetCache) {
    headers.push({
      source: draft.assetCacheSource.trim() || '/assets/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
    })
  }

  if (draft.includeRewrite && draft.includeRewriteCaching) {
    headers.push({
      source: draft.rewriteSource.trim() || '/api/:path*',
      headers: [
        { key: 'x-vercel-enable-rewrite-caching', value: '1' },
        {
          key: 'CDN-Cache-Control',
          value: `max-age=${parsePositiveInt(draft.rewriteCacheTtl, 3600)}`
        },
        { key: 'Vercel-Cache-Tag', value: draft.cacheTag.trim() || 'app' }
      ]
    })
  }

  return headers
}

function buildVercelConfig(draft: VercelDraft) {
  const config: Record<string, unknown> = {
    $schema: 'https://openapi.vercel.sh/vercel.json'
  }
  const regions = parseList(draft.regions, 8)
  const headers = draft.includeHeaders ? buildHeaders(draft) : []

  config.framework = draft.framework === 'other' ? null : draft.framework
  if (draft.installCommand.trim()) config.installCommand = draft.installCommand.trim()
  if (draft.buildCommand.trim()) config.buildCommand = draft.buildCommand.trim()
  if (draft.devCommand.trim()) config.devCommand = draft.devCommand.trim()
  if (draft.outputDirectory.trim()) config.outputDirectory = draft.outputDirectory.trim()
  if (draft.cleanUrls) config.cleanUrls = true
  if (draft.trailingSlash) config.trailingSlash = true
  if (draft.fluid) config.fluid = true
  if (draft.useBun) config.bunVersion = '1.x'
  if (draft.publicSource) config.public = true
  if (regions.length > 0) config.regions = regions

  if (draft.includeFunctions) {
    const functionConfig: Record<string, number> = {
      maxDuration: parsePositiveInt(draft.functionMaxDuration, 60)
    }
    if (!draft.fluid) functionConfig.memory = parsePositiveInt(draft.functionMemory, 1024)
    config.functions = {
      [draft.functionPattern.trim() || 'api/**/*.ts']: functionConfig
    }
  }

  if (headers.length > 0) config.headers = headers
  if (draft.includeRewrite) {
    config.rewrites = [
      {
        source: draft.rewriteSource.trim() || '/api/:path*',
        destination: draft.rewriteDestination.trim() || 'https://api.example.com/:path*'
      }
    ]
  }
  if (draft.includeRedirect) {
    config.redirects = [
      {
        source: draft.redirectSource.trim() || '/old',
        destination: draft.redirectDestination.trim() || '/new',
        permanent: draft.redirectPermanent
      }
    ]
  }
  if (draft.includeCron) {
    config.crons = [
      {
        path: draft.cronPath.trim() || '/api/jobs/digest',
        schedule: draft.cronSchedule.trim() || '0 3 * * *'
      }
    ]
  }
  if (draft.includeImages) {
    const qualities = parseList(draft.imageQualities, 12)
      .map(value => Number.parseInt(value, 10))
      .filter(value => Number.isFinite(value) && value > 0 && value <= 100)

    config.images = {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: draft.imageHostname.trim() || 'images.example.com',
          pathname: '/**'
        }
      ],
      minimumCacheTTL: parsePositiveInt(draft.imageMinimumCacheTtl, 86400),
      qualities: qualities.length > 0 ? qualities : [60, 75, 90],
      formats: ['image/avif', 'image/webp']
    }
  }

  return JSON.stringify(config, null, 2)
}

function buildPackageSnippet(draft: VercelDraft) {
  return JSON.stringify(
    {
      scripts: {
        dev: draft.devCommand.trim() || 'pnpm dev',
        build: draft.buildCommand.trim() || 'pnpm build',
        deploy: 'vercel deploy --prod'
      },
      packageManager: draft.useCorepack ? 'pnpm@latest' : undefined
    },
    null,
    2
  )
}

function buildEnvChecklist(draft: VercelDraft) {
  return [
    '# Vercel environment checklist',
    '',
    `Project: ${draft.projectName || 'project'}`,
    'Production:',
    '- NEXT_PUBLIC_SITE_URL=https://example.com',
    '- NODE_ENV=production',
    draft.includeRewrite ? '- UPSTREAM_BASE_URL=https://api.example.com' : '',
    draft.includeCron ? '- CRON_SECRET=<set in Vercel dashboard>' : '',
    '',
    'CLI:',
    '- vercel link',
    '- vercel env pull .env.local',
    '- vercel deploy --prebuilt --prod'
  ]
    .filter(Boolean)
    .join('\n')
}

function buildMarkdown(draft: VercelDraft, findings: Finding[], parsed: ParsedConfig) {
  return [
    `# ${draft.projectName || 'project'} Vercel plan`,
    '',
    `- Framework: ${draft.framework}`,
    `- Build command: ${draft.buildCommand || 'not configured'}`,
    `- Output directory: ${draft.outputDirectory || 'framework default'}`,
    `- Functions: ${draft.includeFunctions ? draft.functionPattern : 'disabled'}`,
    `- Rewrites: ${draft.includeRewrite ? `${draft.rewriteSource} -> ${draft.rewriteDestination}` : 'disabled'}`,
    `- Crons: ${draft.includeCron ? `${draft.cronPath} ${draft.cronSchedule}` : 'disabled'}`,
    `- Parsed keys: ${parsed.keys.join(', ') || '-'}`,
    `- Audit findings: ${findings.length}`,
    '',
    '## Next checks',
    '',
    '- Validate `vercel.json` against the current Vercel schema.',
    '- Keep broad rewrites away from sensitive routes unless caching and auth are intentional.',
    '- Review permanent redirects before production rollout.',
    '- Create environment variables in Vercel before enabling deploy or cron workflows.'
  ].join('\n')
}

function getOutputFilename(outputType: OutputType) {
  if (outputType === 'vercel') return 'vercel.json'
  if (outputType === 'package') return 'package-scripts.json'
  if (outputType === 'env') return 'vercel-env-checklist.md'
  if (outputType === 'json') return 'vercel-summary.json'
  if (outputType === 'csv') return 'vercel-audit.csv'

  return 'vercel-plan.md'
}

function downloadText(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function parseString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function parseBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false
}

function parseVercelConfig(input: string): ParsedConfig {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const capped = input.length > WORKSPACE_LIMIT
  const empty: ParsedConfig = {
    capped,
    crons: [],
    error: '',
    framework: '',
    functions: [],
    hasBuilds: false,
    hasFluid: false,
    hasImages: false,
    hasPublicSource: false,
    hasRoutes: false,
    hasSchema: false,
    hasSecurityHeaders: false,
    hasRewriteCaching: false,
    headerCount: 0,
    headers: [],
    imageDangerousSvg: false,
    keys: [],
    redirectCount: 0,
    redirects: [],
    rewriteCount: 0,
    rewrites: [],
    sensitiveValues: []
  }

  if (!source.trim()) return empty

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : 'invalid_json' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return { ...empty, error: 'not_object' }

  const config = parsed as Record<string, unknown>
  const headers = Array.isArray(config.headers) ? config.headers.slice(0, RENDER_LIMIT) : []
  const rewrites = Array.isArray(config.rewrites) ? config.rewrites.slice(0, RENDER_LIMIT) : []
  const redirects = Array.isArray(config.redirects) ? config.redirects.slice(0, RENDER_LIMIT) : []
  const crons = Array.isArray(config.crons) ? config.crons.slice(0, RENDER_LIMIT) : []
  const functions =
    config.functions && typeof config.functions === 'object' && !Array.isArray(config.functions)
      ? Object.entries(config.functions as Record<string, unknown>).slice(0, RENDER_LIMIT)
      : []
  const imageConfig =
    config.images && typeof config.images === 'object' && !Array.isArray(config.images)
      ? (config.images as Record<string, unknown>)
      : {}
  const sensitiveValues = Array.from(
    JSON.stringify(config).matchAll(
      /"([^"]*(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|DATABASE_URL|API_KEY)[^"]*)"\s*:\s*"([^"]+)"/giu
    )
  )
    .map(match => match[1] || '')
    .slice(0, RENDER_LIMIT)

  return {
    capped,
    crons: crons.map(item => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return { path: parseString(record.path), schedule: parseString(record.schedule) }
    }),
    error: '',
    framework:
      typeof config.framework === 'string'
        ? config.framework
        : config.framework === null
          ? 'other'
          : '',
    functions: functions.map(([pattern, value]) => {
      const record =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {}
      return {
        maxDuration: String(record.maxDuration ?? ''),
        memory: String(record.memory ?? ''),
        pattern
      }
    }),
    hasBuilds: Array.isArray(config.builds),
    hasFluid: parseBoolean(config.fluid),
    hasImages: Boolean(config.images),
    hasPublicSource: parseBoolean(config.public),
    hasRoutes: Array.isArray(config.routes),
    hasSchema: typeof config.$schema === 'string',
    hasSecurityHeaders: headers.some(item =>
      JSON.stringify(item).match(
        /X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy/iu
      )
    ),
    hasRewriteCaching: headers.some(item =>
      JSON.stringify(item).match(
        /x-vercel-enable-rewrite-caching|Vercel-Cache-Tag|CDN-Cache-Control/iu
      )
    ),
    headerCount: headers.length,
    headers: headers.map(item => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const nested = Array.isArray(record.headers) ? record.headers : []
      return { count: nested.length, source: parseString(record.source) }
    }),
    imageDangerousSvg: parseBoolean(imageConfig.dangerouslyAllowSVG),
    keys: Object.keys(config).slice(0, RENDER_LIMIT),
    redirectCount: Array.isArray(config.redirects) ? config.redirects.length : 0,
    redirects: redirects.map(item => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        destination: parseString(record.destination),
        permanent:
          parseBoolean(record.permanent) ||
          Number(record.statusCode) === 308 ||
          Number(record.statusCode) === 301,
        source: parseString(record.source)
      }
    }),
    rewriteCount: Array.isArray(config.rewrites) ? config.rewrites.length : 0,
    rewrites: rewrites.map(item => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return { destination: parseString(record.destination), source: parseString(record.source) }
    }),
    sensitiveValues
  }
}

function auditDraft(draft: VercelDraft, parsed: ParsedConfig): Finding[] {
  const findings: Finding[] = []
  const maxDuration = parsePositiveInt(draft.functionMaxDuration, 0)
  const memory = parsePositiveInt(draft.functionMemory, 0)

  for (const subject of collectUnsafeDraftSubjects(draft)) {
    findings.push({ key: 'unsafe_field_value', level: 'danger', subject })
  }
  if (!draft.projectName.trim())
    findings.push({ key: 'project_missing', level: 'warn', subject: 'projectName' })
  if (!draft.installCommand.trim())
    findings.push({ key: 'install_missing', level: 'warn', subject: 'installCommand' })
  if (!draft.buildCommand.trim() && draft.framework !== 'other')
    findings.push({ key: 'build_missing', level: 'warn', subject: 'buildCommand' })
  if (!draft.useCorepack && /pnpm|yarn|bun/iu.test(draft.installCommand)) {
    findings.push({ key: 'corepack_missing', level: 'warn', subject: draft.installCommand })
  }
  if (!draft.includeHeaders || !draft.includeSecurityHeaders)
    findings.push({ key: 'security_headers_missing', level: 'warn', subject: 'headers' })
  if (!draft.includeAssetCache && draft.framework !== 'other')
    findings.push({ key: 'asset_cache_missing', level: 'warn', subject: 'assets' })
  if (draft.publicSource)
    findings.push({ key: 'public_source_enabled', level: 'danger', subject: 'public' })
  if (draft.includeFunctions && maxDuration > 300)
    findings.push({
      key: 'function_duration_high',
      level: maxDuration > 600 ? 'danger' : 'warn',
      subject: `${maxDuration}s`
    })
  if (draft.includeFunctions && !draft.fluid && memory > 2048)
    findings.push({ key: 'function_memory_high', level: 'warn', subject: `${memory} MB` })
  if (draft.includeFunctions && draft.fluid && memory > 0)
    findings.push({ key: 'fluid_memory_ignored', level: 'warn', subject: 'memory' })
  if (draft.includeCron && !draft.cronPath.startsWith('/'))
    findings.push({ key: 'cron_path_invalid', level: 'danger', subject: draft.cronPath })
  if (draft.includeCron && !isValidCron(draft.cronSchedule))
    findings.push({ key: 'cron_schedule_invalid', level: 'danger', subject: draft.cronSchedule })
  if (draft.includeRewrite && isHttpDestination(draft.rewriteDestination))
    findings.push({
      key: 'rewrite_http_destination',
      level: 'danger',
      subject: draft.rewriteDestination
    })
  if (draft.includeRewrite && isPrivateLookingDestination(draft.rewriteDestination))
    findings.push({
      key: 'rewrite_private_destination',
      level: 'warn',
      subject: draft.rewriteDestination
    })
  if (
    draft.includeRewrite &&
    isCatchAllSource(draft.rewriteSource) &&
    isExternalDestination(draft.rewriteDestination)
  ) {
    findings.push({
      key: 'rewrite_catch_all_external',
      level: 'danger',
      subject: draft.rewriteSource
    })
  }
  if (draft.includeRewrite && draft.includeRewriteCaching && !draft.cacheTag.trim())
    findings.push({ key: 'rewrite_cache_tag_missing', level: 'warn', subject: 'Vercel-Cache-Tag' })
  if (draft.includeRedirect && draft.redirectSource.trim() === draft.redirectDestination.trim())
    findings.push({ key: 'redirect_loop', level: 'danger', subject: draft.redirectSource })
  if (
    draft.includeRedirect &&
    draft.redirectPermanent &&
    isExternalDestination(draft.redirectDestination)
  ) {
    findings.push({
      key: 'redirect_external_permanent',
      level: 'warn',
      subject: draft.redirectDestination
    })
  }
  if (
    draft.cleanUrls &&
    /\.(?:html|htm)(?:$|[?#])/iu.test(`${draft.rewriteDestination} ${draft.redirectDestination}`)
  ) {
    findings.push({ key: 'clean_urls_extension_conflict', level: 'warn', subject: 'cleanUrls' })
  }
  if (
    SENSITIVE_PATTERN.test(
      `${draft.rewriteDestination} ${draft.redirectDestination} ${draft.installCommand} ${draft.buildCommand}`
    )
  ) {
    findings.push({ key: 'sensitive_value_plain', level: 'danger', subject: 'draft' })
  }

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: String(WORKSPACE_LIMIT) })
  if (parsed.error) findings.push({ key: 'invalid_json', level: 'danger', subject: parsed.error })
  if (!parsed.error && parsed.keys.length === 0)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })
  if (!parsed.error && !parsed.hasSchema)
    findings.push({ key: 'parsed_schema_missing', level: 'warn', subject: '$schema' })
  if (parsed.hasPublicSource)
    findings.push({ key: 'parsed_public_source', level: 'danger', subject: 'public' })
  if (parsed.hasRoutes || parsed.hasBuilds)
    findings.push({
      key: 'parsed_legacy_routes',
      level: 'warn',
      subject: parsed.hasRoutes ? 'routes' : 'builds'
    })
  if (!parsed.error && parsed.keys.length > 0 && parsed.headerCount === 0)
    findings.push({ key: 'parsed_no_headers', level: 'warn', subject: 'headers' })
  if (parsed.headerCount > 0 && !parsed.hasSecurityHeaders)
    findings.push({ key: 'parsed_no_security_headers', level: 'warn', subject: 'headers' })
  if (parsed.hasImages && parsed.imageDangerousSvg)
    findings.push({ key: 'parsed_dangerous_svg', level: 'danger', subject: 'images' })
  if (parsed.hasFluid) {
    for (const item of parsed.functions) {
      if (item.memory)
        findings.push({ key: 'parsed_fluid_memory', level: 'warn', subject: item.pattern })
    }
  }
  for (const item of parsed.functions) {
    if (parsePositiveInt(item.maxDuration, 0) > 300)
      findings.push({ key: 'parsed_function_long', level: 'warn', subject: item.pattern })
  }
  for (const item of parsed.rewrites) {
    if (isHttpDestination(item.destination))
      findings.push({ key: 'parsed_rewrite_http', level: 'danger', subject: item.destination })
    if (isCatchAllSource(item.source) && isExternalDestination(item.destination))
      findings.push({ key: 'parsed_catch_all_rewrite', level: 'danger', subject: item.source })
  }
  for (const item of parsed.redirects) {
    if (item.permanent && isExternalDestination(item.destination))
      findings.push({
        key: 'parsed_external_permanent_redirect',
        level: 'warn',
        subject: item.destination
      })
  }
  for (const item of parsed.crons) {
    if (!item.path.startsWith('/') || !isValidCron(item.schedule))
      findings.push({
        key: 'parsed_invalid_cron',
        level: 'danger',
        subject: `${item.path} ${item.schedule}`
      })
  }
  for (const subject of parsed.sensitiveValues) {
    findings.push({ key: 'parsed_sensitive_value', level: 'danger', subject })
  }

  if (findings.length === 0)
    findings.push({
      key: 'baseline_ok',
      level: 'good',
      subject: draft.projectName || 'vercel.json'
    })

  return findings
}

function buildCsv(findings: Finding[]) {
  return [
    'level,subject,key',
    ...findings.map(item =>
      [item.level, item.subject, item.key]
        .map(value => `"${String(value).replace(/"/gu, '""')}"`)
        .join(',')
    )
  ].join('\n')
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel min-w-0 rounded-2xl p-4">
      <p className="text-xs font-medium uppercase text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

export default function VercelConfigClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<VercelDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputType, setOutputType] = useState<OutputType>('vercel')
  const deferredWorkspace = useDeferredValue(workspace)

  const vercelOutput = useMemo(() => buildVercelConfig(draft), [draft])
  const parsed = useMemo(() => parseVercelConfig(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditDraft(draft, parsed), [draft, parsed])
  const csvOutput = useMemo(() => buildCsv(findings), [findings])
  const outputValue = useMemo(() => {
    if (outputType === 'vercel') return vercelOutput
    if (outputType === 'package') return buildPackageSnippet(draft)
    if (outputType === 'env') return buildEnvChecklist(draft)
    if (outputType === 'json') return JSON.stringify({ draft, findings, parsed }, null, 2)
    if (outputType === 'csv') return csvOutput

    return buildMarkdown(draft, findings, parsed)
  }, [csvOutput, draft, findings, outputType, parsed, vercelOutput])

  const filteredFindings = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return findings

    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.vercel.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, findings, t])

  const metrics = useMemo(() => {
    const critical = findings.filter(item => item.level === 'danger').length
    const warnings = findings.filter(item => item.level === 'warn').length

    return {
      critical,
      functions: parsed.functions.length,
      redirects: parsed.redirectCount,
      rewrites: parsed.rewriteCount,
      status:
        critical > 0
          ? t('app.generation.vercel.status.risk')
          : warnings > 0
            ? t('app.generation.vercel.status.review')
            : t('app.generation.vercel.status.ready'),
      warnings
    }
  }, [findings, parsed.functions.length, parsed.redirectCount, parsed.rewriteCount, t])

  const updateDraft = useCallback(<K extends keyof VercelDraft>(key: K, value: VercelDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }, [])

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0].workspace)
    setAuditQuery('')
    setOutputType('vercel')
  }, [])

  const copySummary = useCallback(() => {
    copy(
      [
        t('app.generation.vercel.summary_title'),
        `${t('app.generation.vercel.metric.status')}: ${metrics.status}`,
        `${t('app.generation.vercel.metric.rewrites')}: ${metrics.rewrites}`,
        `${t('app.generation.vercel.metric.redirects')}: ${metrics.redirects}`,
        `${t('app.generation.vercel.metric.functions')}: ${metrics.functions}`,
        `${t('app.generation.vercel.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.vercel.metric.critical')}: ${metrics.critical}`
      ].join('\n')
    )
  }, [copy, metrics, t])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  <Workflow className="h-3.5 w-3.5" />
                  {t('app.generation.vercel')}
                </div>
                <CardTitle className="mt-2 text-2xl">{t('app.generation.vercel')}</CardTitle>
                <CardDescription>{t('app.generation.vercel.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copySummary}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('app.generation.vercel.copy_summary')}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('public.reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label={t('app.generation.vercel.metric.status')} value={metrics.status} />
            <Metric label={t('app.generation.vercel.metric.rewrites')} value={metrics.rewrites} />
            <Metric label={t('app.generation.vercel.metric.redirects')} value={metrics.redirects} />
            <Metric label={t('app.generation.vercel.metric.functions')} value={metrics.functions} />
            <Metric label={t('app.generation.vercel.metric.warnings')} value={metrics.warnings} />
            <Metric label={t('app.generation.vercel.metric.critical')} value={metrics.critical} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.vercel.presets')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="glass-input min-w-0 rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]"
              >
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.vercel.preset.${preset.key}`)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.vercel.preset.${preset.key}_hint`)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.vercel.builder')}</CardTitle>
              <CardDescription>{t('app.generation.vercel.builder_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="vercel-project">{t('app.generation.vercel.project_name')}</Label>
                  <Input
                    id="vercel-project"
                    value={draft.projectName}
                    onChange={event => updateDraft('projectName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-framework">{t('app.generation.vercel.framework')}</Label>
                  <Select
                    id="vercel-framework"
                    value={draft.framework}
                    onChange={event => updateDraft('framework', event.target.value as Framework)}
                  >
                    {FRAMEWORKS.map(framework => (
                      <option key={framework} value={framework}>
                        {t(`app.generation.vercel.framework.${framework}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-regions">{t('app.generation.vercel.regions')}</Label>
                  <Input
                    id="vercel-regions"
                    value={draft.regions}
                    onChange={event => updateDraft('regions', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-install">
                    {t('app.generation.vercel.install_command')}
                  </Label>
                  <Input
                    id="vercel-install"
                    value={draft.installCommand}
                    onChange={event => updateDraft('installCommand', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-build">{t('app.generation.vercel.build_command')}</Label>
                  <Input
                    id="vercel-build"
                    value={draft.buildCommand}
                    onChange={event => updateDraft('buildCommand', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-dev">{t('app.generation.vercel.dev_command')}</Label>
                  <Input
                    id="vercel-dev"
                    value={draft.devCommand}
                    onChange={event => updateDraft('devCommand', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-output">
                    {t('app.generation.vercel.output_directory')}
                  </Label>
                  <Input
                    id="vercel-output"
                    value={draft.outputDirectory}
                    onChange={event => updateDraft('outputDirectory', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-function">
                    {t('app.generation.vercel.function_pattern')}
                  </Label>
                  <Input
                    id="vercel-function"
                    value={draft.functionPattern}
                    onChange={event => updateDraft('functionPattern', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-duration">{t('app.generation.vercel.max_duration')}</Label>
                  <Input
                    id="vercel-duration"
                    value={draft.functionMaxDuration}
                    onChange={event => updateDraft('functionMaxDuration', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-memory">{t('app.generation.vercel.memory')}</Label>
                  <Input
                    id="vercel-memory"
                    value={draft.functionMemory}
                    onChange={event => updateDraft('functionMemory', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-cron-path">{t('app.generation.vercel.cron_path')}</Label>
                  <Input
                    id="vercel-cron-path"
                    value={draft.cronPath}
                    onChange={event => updateDraft('cronPath', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-cron-schedule">
                    {t('app.generation.vercel.cron_schedule')}
                  </Label>
                  <Input
                    id="vercel-cron-schedule"
                    value={draft.cronSchedule}
                    onChange={event => updateDraft('cronSchedule', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-rewrite-source">
                    {t('app.generation.vercel.rewrite_source')}
                  </Label>
                  <Input
                    id="vercel-rewrite-source"
                    value={draft.rewriteSource}
                    onChange={event => updateDraft('rewriteSource', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-rewrite-destination">
                    {t('app.generation.vercel.rewrite_destination')}
                  </Label>
                  <Input
                    id="vercel-rewrite-destination"
                    value={draft.rewriteDestination}
                    onChange={event => updateDraft('rewriteDestination', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-redirect-source">
                    {t('app.generation.vercel.redirect_source')}
                  </Label>
                  <Input
                    id="vercel-redirect-source"
                    value={draft.redirectSource}
                    onChange={event => updateDraft('redirectSource', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-redirect-destination">
                    {t('app.generation.vercel.redirect_destination')}
                  </Label>
                  <Input
                    id="vercel-redirect-destination"
                    value={draft.redirectDestination}
                    onChange={event => updateDraft('redirectDestination', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-cache-source">
                    {t('app.generation.vercel.asset_cache_source')}
                  </Label>
                  <Input
                    id="vercel-cache-source"
                    value={draft.assetCacheSource}
                    onChange={event => updateDraft('assetCacheSource', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-cache-tag">{t('app.generation.vercel.cache_tag')}</Label>
                  <Input
                    id="vercel-cache-tag"
                    value={draft.cacheTag}
                    onChange={event => updateDraft('cacheTag', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-cache-ttl">
                    {t('app.generation.vercel.rewrite_cache_ttl')}
                  </Label>
                  <Input
                    id="vercel-cache-ttl"
                    value={draft.rewriteCacheTtl}
                    onChange={event => updateDraft('rewriteCacheTtl', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-image-host">
                    {t('app.generation.vercel.image_hostname')}
                  </Label>
                  <Input
                    id="vercel-image-host"
                    value={draft.imageHostname}
                    onChange={event => updateDraft('imageHostname', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-image-ttl">{t('app.generation.vercel.image_ttl')}</Label>
                  <Input
                    id="vercel-image-ttl"
                    value={draft.imageMinimumCacheTtl}
                    onChange={event => updateDraft('imageMinimumCacheTtl', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vercel-image-quality">
                    {t('app.generation.vercel.image_qualities')}
                  </Label>
                  <Input
                    id="vercel-image-quality"
                    value={draft.imageQualities}
                    onChange={event => updateDraft('imageQualities', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  checked={draft.useCorepack}
                  onChange={event => updateDraft('useCorepack', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.use_corepack')}
                />
                <Checkbox
                  checked={draft.useBun}
                  onChange={event => updateDraft('useBun', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.use_bun')}
                />
                <Checkbox
                  checked={draft.cleanUrls}
                  onChange={event => updateDraft('cleanUrls', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.clean_urls')}
                />
                <Checkbox
                  checked={draft.trailingSlash}
                  onChange={event => updateDraft('trailingSlash', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.trailing_slash')}
                />
                <Checkbox
                  checked={draft.fluid}
                  onChange={event => updateDraft('fluid', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.fluid')}
                />
                <Checkbox
                  checked={draft.publicSource}
                  onChange={event => updateDraft('publicSource', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.public_source')}
                />
                <Checkbox
                  checked={draft.includeFunctions}
                  onChange={event => updateDraft('includeFunctions', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_functions')}
                />
                <Checkbox
                  checked={draft.includeCron}
                  onChange={event => updateDraft('includeCron', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_cron')}
                />
                <Checkbox
                  checked={draft.includeRewrite}
                  onChange={event => updateDraft('includeRewrite', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_rewrite')}
                />
                <Checkbox
                  checked={draft.includeRewriteCaching}
                  onChange={event => updateDraft('includeRewriteCaching', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.rewrite_caching')}
                />
                <Checkbox
                  checked={draft.includeRedirect}
                  onChange={event => updateDraft('includeRedirect', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_redirect')}
                />
                <Checkbox
                  checked={draft.redirectPermanent}
                  onChange={event => updateDraft('redirectPermanent', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.redirect_permanent')}
                />
                <Checkbox
                  checked={draft.includeHeaders}
                  onChange={event => updateDraft('includeHeaders', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_headers')}
                />
                <Checkbox
                  checked={draft.includeSecurityHeaders}
                  onChange={event => updateDraft('includeSecurityHeaders', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.security_headers')}
                />
                <Checkbox
                  checked={draft.includeAssetCache}
                  onChange={event => updateDraft('includeAssetCache', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.asset_cache')}
                />
                <Checkbox
                  checked={draft.includeImages}
                  onChange={event => updateDraft('includeImages', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.vercel.include_images')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.vercel.audit')}</CardTitle>
              <CardDescription>{t('app.generation.vercel.audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  className="pl-9"
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value)}
                  placeholder={t('app.generation.vercel.audit_search')}
                />
              </div>
              <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
                {filteredFindings.map((finding, index) => (
                  <div
                    key={`${finding.key}-${finding.subject}-${index}`}
                    className="glass-panel flex min-w-0 items-start gap-3 rounded-2xl p-3"
                  >
                    {finding.level === 'good' ? (
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : finding.level === 'danger' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    ) : (
                      <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {t(`app.generation.vercel.audit.${finding.key}`)}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                        {finding.subject}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.vercel.workspace')}</CardTitle>
              <CardDescription>{t('app.generation.vercel.workspace_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea
                value={workspace}
                onChange={event => setWorkspace(event.target.value)}
                placeholder={t('app.generation.vercel.workspace_placeholder')}
                className="min-h-[260px] font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setWorkspace(vercelOutput)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('app.generation.vercel.use_output')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('public.clear')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.vercel.output')}</CardTitle>
              <CardDescription>{t('app.generation.vercel.output_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="vercel-output-type">{t('app.generation.vercel.output_type')}</Label>
                <Select
                  id="vercel-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.vercel.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                value={outputValue}
                readOnly
                className="min-h-[300px] font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => copy(outputValue)}
                  className="w-full sm:w-auto"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('app.generation.vercel.copy_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      outputValue,
                      getOutputFilename(outputType),
                      outputType === 'json' || outputType === 'vercel' || outputType === 'package'
                        ? 'application/json;charset=utf-8'
                        : 'text/plain;charset=utf-8'
                    )
                  }
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('app.generation.vercel.download_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(csvOutput, 'vercel-audit.csv', 'text/csv;charset=utf-8')
                  }
                  className="w-full sm:w-auto"
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {t('app.generation.vercel.download_csv')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.vercel.parsed')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {parsed.error ? (
              <div className="glass-panel rounded-2xl p-4 text-sm text-red-500">{parsed.error}</div>
            ) : parsed.keys.length === 0 ? (
              <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--text-muted)]">
                {t('app.generation.vercel.empty')}
              </div>
            ) : (
              <>
                <div className="glass-panel min-w-0 rounded-2xl p-4">
                  <div className="grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2 lg:grid-cols-4">
                    <span>
                      {t('app.generation.vercel.parsed.framework')}: {parsed.framework || '-'}
                    </span>
                    <span>
                      {t('app.generation.vercel.parsed.headers')}: {parsed.headerCount}
                    </span>
                    <span>
                      {t('app.generation.vercel.parsed.rewrites')}: {parsed.rewriteCount}
                    </span>
                    <span>
                      {t('app.generation.vercel.parsed.redirects')}: {parsed.redirectCount}
                    </span>
                  </div>
                </div>
                {[
                  ...parsed.functions.map(item => ({
                    detail: `${item.maxDuration || '-'}s / ${item.memory || '-'}`,
                    label: item.pattern,
                    type: t('app.generation.vercel.parsed.function')
                  })),
                  ...parsed.rewrites.map(item => ({
                    detail: item.destination,
                    label: item.source,
                    type: t('app.generation.vercel.parsed.rewrite')
                  })),
                  ...parsed.redirects.map(item => ({
                    detail: item.destination,
                    label: item.source,
                    type: t('app.generation.vercel.parsed.redirect')
                  })),
                  ...parsed.crons.map(item => ({
                    detail: item.schedule,
                    label: item.path,
                    type: t('app.generation.vercel.parsed.cron')
                  }))
                ]
                  .slice(0, RENDER_LIMIT)
                  .map((item, index) => (
                    <div
                      key={`${item.type}-${item.label}-${index}`}
                      className="glass-panel min-w-0 rounded-2xl p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                          {item.label || '-'}
                        </p>
                        <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                          {item.type}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-[var(--text-muted)]">
                        {item.detail || '-'}
                      </p>
                    </div>
                  ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.vercel.reference')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {['builds', 'functions', 'rewrites', 'headers', 'crons'].map(item => (
              <div key={item} className="glass-panel rounded-2xl p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.vercel.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.vercel.reference.${item}_hint`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
