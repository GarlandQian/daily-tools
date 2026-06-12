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
  Server,
  ShieldCheck,
  Sparkles,
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

const APP_TYPES = ['reverse_proxy', 'static', 'spa', 'api'] as const
const OUTPUT_TYPES = ['caddyfile', 'json', 'docker', 'commands', 'headers', 'markdown'] as const
const SITE_RENDER_LIMIT = 80
const FINDING_RENDER_LIMIT = 80
const WORKSPACE_LIMIT = 80000
const DRAFT_FIELD_LIMIT = 1200
const UNSAFE_DIRECTIVE_PATTERN = /[\r\n;{}]/u

type AppType = (typeof APP_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface CaddyDraft {
  adminEmail: string
  appType: AppType
  cacheDuration: string
  compression: boolean
  handleErrors: boolean
  hostnames: string
  hstsMaxAge: string
  includeAccessLog: boolean
  includeAutoHttps: boolean
  includeBodyLimit: boolean
  includeSecurityHeaders: boolean
  includeStaticCache: boolean
  includeTrustedProxies: boolean
  listenPort: string
  logPath: string
  maxBodySize: string
  redirectHttp: boolean
  rootPath: string
  siteName: string
  spaFallback: boolean
  upstreamUrl: string
  useTlsInternal: boolean
}

interface Preset {
  draft: CaddyDraft
  key: string
  workspace: string
}

interface ParsedSite {
  hasAccessLog: boolean
  hasBodyLimit: boolean
  hasCompression: boolean
  hasFileServer: boolean
  hasHsts: boolean
  hasReverseProxy: boolean
  hasSecurityHeaders: boolean
  hasStaticCache: boolean
  hasTlsInternal: boolean
  header: string
  hosts: string[]
  publicHttp: boolean
  rootPath: string
  upstreams: string[]
}

interface ParsedCaddy {
  capped: boolean
  siteLimited: boolean
  sites: ParsedSite[]
  syntaxHints: string[]
  totalSites: number
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: CaddyDraft = {
  adminEmail: 'ops@example.com',
  appType: 'reverse_proxy',
  cacheDuration: '604800',
  compression: true,
  handleErrors: true,
  hostnames: 'tools.example.com',
  hstsMaxAge: '31536000',
  includeAccessLog: true,
  includeAutoHttps: true,
  includeBodyLimit: true,
  includeSecurityHeaders: true,
  includeStaticCache: true,
  includeTrustedProxies: false,
  listenPort: '443',
  logPath: '/var/log/caddy/daily-tools.access.log',
  maxBodySize: '20MB',
  redirectHttp: true,
  rootPath: '/srv/daily-tools',
  siteName: 'daily-tools',
  spaFallback: true,
  upstreamUrl: 'http://127.0.0.1:3000',
  useTlsInternal: false
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `{
  email ops@example.com
}

tools.example.com {
  encode zstd gzip
  log {
    output file /var/log/caddy/daily-tools.access.log
    format json
  }
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
  request_body {
    max_size 20MB
  }
  reverse_proxy http://127.0.0.1:3000
  handle_errors {
    respond "{err.status_code} {err.status_text}" {err.status_code}
  }
}`
  },
  {
    key: 'static',
    draft: {
      ...DEFAULT_DRAFT,
      appType: 'static',
      hostnames: 'docs.example.com',
      logPath: '/var/log/caddy/docs.access.log',
      rootPath: '/srv/docs',
      siteName: 'docs',
      upstreamUrl: ''
    },
    workspace: `docs.example.com {
  root * /srv/docs
  encode zstd gzip
  file_server
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
  }
  @assets path *.css *.js *.woff2 *.png *.jpg *.svg
  header @assets Cache-Control "public, max-age=604800, immutable"
}`
  },
  {
    key: 'spa',
    draft: {
      ...DEFAULT_DRAFT,
      appType: 'spa',
      hostnames: 'app.example.com',
      logPath: '/var/log/caddy/app.access.log',
      rootPath: '/srv/app',
      siteName: 'app',
      upstreamUrl: ''
    },
    workspace: `app.example.com {
  root * /srv/app
  encode zstd gzip
  try_files {path} /index.html
  file_server
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
  }
}`
  },
  {
    key: 'api',
    draft: {
      ...DEFAULT_DRAFT,
      appType: 'api',
      hostnames: 'api.example.com',
      logPath: '/var/log/caddy/api.access.log',
      maxBodySize: '10MB',
      siteName: 'api',
      upstreamUrl: 'http://127.0.0.1:8080'
    },
    workspace: `api.example.com {
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
  }
  request_body {
    max_size 10MB
  }
  reverse_proxy http://127.0.0.1:8080
}`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      adminEmail: '',
      appType: 'reverse_proxy',
      compression: false,
      handleErrors: false,
      hostnames: ':80',
      hstsMaxAge: '0',
      includeAccessLog: false,
      includeAutoHttps: false,
      includeBodyLimit: false,
      includeSecurityHeaders: false,
      includeStaticCache: false,
      listenPort: '80',
      maxBodySize: '',
      redirectHttp: false,
      rootPath: '/',
      siteName: 'risky-site',
      upstreamUrl: 'http://app.internal:3000'
    },
    workspace: `http://:80 {
  root * /
  reverse_proxy http://app.internal:3000
  file_server
}`
  }
]

function compactLines(lines: string[]) {
  return lines.filter(line => line.trim().length > 0).join('\n')
}

function sanitizeDirective(value: string, fallback = '') {
  const sanitized = value.replace(UNSAFE_DIRECTIVE_PATTERN, ' ').replace(/\s+/gu, ' ').trim()

  return sanitized || fallback
}

function toSlug(value: string, fallback: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 48) || fallback
  )
}

function splitList(value: string, limit = 16) {
  return value
    .split(/[\s,]+/u)
    .map(item => sanitizeDirective(item))
    .filter(Boolean)
    .slice(0, limit)
}

function collectUnsafeDraftSubjects(draft: CaddyDraft) {
  return Object.entries(draft)
    .filter(([, value]) => typeof value === 'string' && UNSAFE_DIRECTIVE_PATTERN.test(value))
    .map(([key]) => key)
}

function buildSiteAddress(draft: CaddyDraft) {
  const hosts = splitList(draft.hostnames)
  const fallback = draft.includeAutoHttps ? 'example.com' : ':80'
  const port = sanitizeDirective(draft.listenPort, draft.includeAutoHttps ? '443' : '80')

  if (hosts.length === 0) return fallback
  if (draft.includeAutoHttps) return hosts.join(', ')

  return hosts
    .map(host => {
      if (host.startsWith('http://') || host.startsWith(':')) return host
      if (!port || port === '80') return `http://${host}`

      return `http://${host}:${port}`
    })
    .join(', ')
}

function buildHeaderLines(draft: CaddyDraft) {
  const hstsMaxAge = sanitizeDirective(draft.hstsMaxAge, '31536000')

  return compactLines([
    draft.includeAutoHttps && draft.redirectHttp
      ? `    Strict-Transport-Security "max-age=${hstsMaxAge}; includeSubDomains; preload"`
      : '',
    '    X-Content-Type-Options "nosniff"',
    '    X-Frame-Options "SAMEORIGIN"',
    '    Referrer-Policy "strict-origin-when-cross-origin"',
    '    Permissions-Policy "camera=(), microphone=(), geolocation=()"'
  ])
}

function buildCaddyfile(draft: CaddyDraft) {
  const lines: string[] = []
  const email = sanitizeDirective(draft.adminEmail)

  if (email || !draft.includeAutoHttps || draft.includeTrustedProxies) {
    lines.push('{')
    if (email) lines.push(`  email ${email}`)
    if (!draft.includeAutoHttps) lines.push('  auto_https off')
    if (draft.includeTrustedProxies) {
      lines.push('  servers {')
      lines.push('    trusted_proxies static private_ranges')
      lines.push('  }')
    }
    lines.push('}')
    lines.push('')
  }

  lines.push(`${buildSiteAddress(draft)} {`)
  if (draft.useTlsInternal) lines.push('  tls internal')
  if (draft.compression) lines.push('  encode zstd gzip')
  if (draft.includeAccessLog) {
    lines.push('  log {')
    lines.push(
      `    output file ${sanitizeDirective(draft.logPath, '/var/log/caddy/site.access.log')}`
    )
    lines.push('    format json')
    lines.push('  }')
  }
  if (draft.includeSecurityHeaders) {
    lines.push('  header {')
    lines.push(buildHeaderLines(draft))
    lines.push('  }')
  }
  if (draft.includeBodyLimit) {
    lines.push('  request_body {')
    lines.push(`    max_size ${sanitizeDirective(draft.maxBodySize, '20MB')}`)
    lines.push('  }')
  }

  if (draft.appType === 'reverse_proxy' || draft.appType === 'api') {
    lines.push(`  reverse_proxy ${sanitizeDirective(draft.upstreamUrl, 'http://127.0.0.1:3000')}`)
  } else {
    lines.push(`  root * ${sanitizeDirective(draft.rootPath, '/srv/site')}`)
    if (draft.spaFallback && draft.appType === 'spa') lines.push('  try_files {path} /index.html')
    lines.push('  file_server')
    if (draft.includeStaticCache) {
      lines.push(
        '  @assets path *.css *.js *.mjs *.woff2 *.png *.jpg *.jpeg *.gif *.svg *.webp *.avif'
      )
      lines.push(
        `  header @assets Cache-Control "public, max-age=${sanitizeDirective(draft.cacheDuration, '604800')}, immutable"`
      )
    }
  }

  if (draft.handleErrors) {
    lines.push('  handle_errors {')
    lines.push('    respond "{err.status_code} {err.status_text}" {err.status_code}')
    lines.push('  }')
  }
  lines.push('}')

  return lines.join('\n')
}

function buildCaddyJson(draft: CaddyDraft) {
  const hosts = splitList(draft.hostnames)
  const site = toSlug(draft.siteName, 'site')
  const handlers: Array<Record<string, unknown>> = []

  if (draft.includeSecurityHeaders) {
    handlers.push({
      handler: 'headers',
      response: {
        set: {
          'Referrer-Policy': ['strict-origin-when-cross-origin'],
          'X-Content-Type-Options': ['nosniff'],
          'X-Frame-Options': ['SAMEORIGIN']
        }
      }
    })
  }

  if (draft.compression) {
    handlers.push({ encodings: { gzip: {}, zstd: {} }, handler: 'encode' })
  }

  if (draft.appType === 'reverse_proxy' || draft.appType === 'api') {
    handlers.push({
      handler: 'reverse_proxy',
      upstreams: [
        {
          dial: sanitizeDirective(draft.upstreamUrl, '127.0.0.1:3000').replace(/^https?:\/\//iu, '')
        }
      ]
    })
  } else {
    handlers.push({ handler: 'vars', root: sanitizeDirective(draft.rootPath, '/srv/site') })
    if (draft.spaFallback && draft.appType === 'spa') {
      handlers.push({
        handler: 'rewrite',
        uri: '{http.matchers.file.relative}'
      })
    }
    handlers.push({ handler: 'file_server' })
  }

  return JSON.stringify(
    {
      apps: {
        http: {
          servers: {
            [site]: {
              listen: [
                draft.includeAutoHttps ? ':443' : `:${sanitizeDirective(draft.listenPort, '80')}`
              ],
              routes: [
                {
                  handle: handlers,
                  match: hosts.length > 0 ? [{ host: hosts }] : undefined
                }
              ]
            }
          }
        }
      }
    },
    null,
    2
  )
}

function buildDockerOutput(draft: CaddyDraft) {
  const site = toSlug(draft.siteName, 'site')
  const isStatic = draft.appType === 'static' || draft.appType === 'spa'
  const rootPath = sanitizeDirective(draft.rootPath, '/srv/site')

  return [
    'services:',
    '  caddy:',
    '    image: caddy:2.8-alpine',
    '    restart: unless-stopped',
    '    ports:',
    '      - "80:80"',
    draft.includeAutoHttps
      ? '      - "443:443"'
      : `      - "${sanitizeDirective(draft.listenPort, '80')}:${sanitizeDirective(draft.listenPort, '80')}"`,
    '    volumes:',
    `      - ./Caddyfile:/etc/caddy/Caddyfile:ro`,
    '      - caddy-data:/data',
    '      - caddy-config:/config',
    isStatic ? `      - ${rootPath}:${rootPath}:ro` : '',
    '    healthcheck:',
    '      test: ["CMD", "caddy", "version"]',
    '      interval: 30s',
    '      timeout: 5s',
    '      retries: 3',
    'volumes:',
    '  caddy-data:',
    '  caddy-config:',
    `# site: ${site}`
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCommands(draft: CaddyDraft) {
  return [
    'sudo mkdir -p /etc/caddy',
    "sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDY'",
    buildCaddyfile(draft),
    'CADDY',
    'sudo caddy validate --config /etc/caddy/Caddyfile',
    'sudo systemctl reload caddy'
  ].join('\n')
}

function buildHeadersOutput(draft: CaddyDraft) {
  if (!draft.includeSecurityHeaders) return '# Security headers are disabled in the current draft.'

  return ['header {', buildHeaderLines(draft), '}'].join('\n')
}

function buildMarkdown(draft: CaddyDraft, findings: Finding[], parsed: ParsedCaddy) {
  return [
    `# ${draft.siteName || 'site'} Caddy plan`,
    '',
    `- Hosts: ${splitList(draft.hostnames).join(', ') || 'example.com'}`,
    `- App type: ${draft.appType}`,
    `- Automatic HTTPS: ${draft.includeAutoHttps ? 'enabled' : 'disabled'}`,
    `- Compression: ${draft.compression ? 'zstd, gzip' : 'disabled'}`,
    `- Parsed site blocks: ${parsed.sites.length}`,
    `- Audit findings: ${findings.length}`,
    '',
    '## Next checks',
    '',
    '- Run `caddy validate --config /etc/caddy/Caddyfile` before reload.',
    '- Confirm DNS and certificate automation before enabling production traffic.',
    '- Review reverse proxy targets, body limits, headers, and cache rules.',
    '- Keep catch-all HTTP blocks separate from production hostnames.'
  ].join('\n')
}

function getOutputFilename(outputType: OutputType) {
  if (outputType === 'caddyfile') return 'Caddyfile'
  if (outputType === 'json') return 'caddy.json'
  if (outputType === 'docker') return 'docker-compose.caddy.yml'
  if (outputType === 'commands') return 'install-caddy.sh'
  if (outputType === 'headers') return 'caddy-headers.conf'

  return 'caddy-plan.md'
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

function parseTopLevelBlocks(input: string) {
  const blocks: Array<{ body: string; header: string }> = []
  const lines = input.split(/\r?\n/u)
  let depth = 0
  let collecting = false
  let current: string[] = []
  let header = ''
  let totalBlocks = 0

  for (const line of lines) {
    const openCount = (line.match(/\{/gu) || []).length
    const closeCount = (line.match(/\}/gu) || []).length

    if (!collecting && depth === 0 && openCount > 0) {
      const candidate = line.slice(0, line.indexOf('{')).trim()
      if (candidate) {
        collecting = true
        current = [line]
        header = candidate
      }
    } else if (collecting) {
      current.push(line)
    }

    depth += openCount - closeCount

    if (collecting && depth === 0) {
      totalBlocks += 1
      if (blocks.length < SITE_RENDER_LIMIT) blocks.push({ body: current.join('\n'), header })
      collecting = false
      current = []
      header = ''
    }
  }

  return { blocks, totalBlocks }
}

function parseCaddyWorkspace(input: string): ParsedCaddy {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const capped = input.length > WORKSPACE_LIMIT
  const syntaxHints: string[] = []
  const openBraces = (source.match(/\{/gu) || []).length
  const closeBraces = (source.match(/\}/gu) || []).length

  if (openBraces !== closeBraces) syntaxHints.push('brace_mismatch')

  const { blocks, totalBlocks } = parseTopLevelBlocks(source)
  const sites = blocks.map(({ body, header }) => {
    const upstreams = Array.from(
      body.matchAll(/reverse_proxy\s+([^\s{]+)/giu),
      match => match[1] || ''
    ).filter(Boolean)
    const rootMatch = body.match(/root\s+\*\s+([^\s]+)/iu)

    return {
      hasAccessLog: /\blog\s*\{/iu.test(body),
      hasBodyLimit: /request_body\s*\{[\s\S]*max_size/iu.test(body),
      hasCompression: /\bencode\s+[^\n]*(?:gzip|zstd)/iu.test(body),
      hasFileServer: /\bfile_server\b/iu.test(body),
      hasHsts: /Strict-Transport-Security/iu.test(body),
      hasReverseProxy: upstreams.length > 0,
      hasSecurityHeaders:
        /X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy/iu.test(body),
      hasStaticCache: /Cache-Control[^\n]*(?:max-age|immutable)|header\s+@assets/iu.test(body),
      hasTlsInternal: /\btls\s+internal\b/iu.test(body),
      header,
      hosts: header
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      publicHttp: /^http:\/\//iu.test(header) || /(?:^|,\s*):80(?:\s|,|$)/iu.test(header),
      rootPath: rootMatch?.[1] || '',
      upstreams
    }
  })

  return {
    capped,
    siteLimited: totalBlocks > sites.length,
    sites,
    syntaxHints,
    totalSites: totalBlocks
  }
}

function auditDraft(draft: CaddyDraft, parsed: ParsedCaddy): Finding[] {
  const findings: Finding[] = []
  const hosts = splitList(draft.hostnames)
  const upstream = draft.upstreamUrl.trim()

  for (const subject of collectUnsafeDraftSubjects(draft)) {
    findings.push({ key: 'unsafe_directive_value', level: 'danger', subject })
  }
  if (hosts.length === 0) findings.push({ key: 'host_missing', level: 'danger', subject: 'host' })
  if (hosts.some(host => host === '*' || host === ':80' || host === ':443' || host.includes('*'))) {
    findings.push({ key: 'wildcard_host', level: 'warn', subject: hosts.join(', ') || 'host' })
  }
  if (!draft.includeAutoHttps)
    findings.push({
      key: 'auto_https_disabled',
      level: 'danger',
      subject: hosts.join(', ') || 'site'
    })
  if (draft.includeAutoHttps && !draft.redirectHttp)
    findings.push({ key: 'redirect_disabled', level: 'warn', subject: 'HTTP' })
  if (draft.includeAutoHttps && Number.parseInt(draft.hstsMaxAge, 10) < 15552000) {
    findings.push({ key: 'hsts_short', level: 'warn', subject: draft.hstsMaxAge || '0' })
  }
  if (!draft.includeSecurityHeaders)
    findings.push({
      key: 'security_headers_missing',
      level: 'warn',
      subject: hosts.join(', ') || 'site'
    })
  if (!draft.compression)
    findings.push({ key: 'compression_missing', level: 'warn', subject: 'encode' })
  if (!draft.includeAccessLog)
    findings.push({ key: 'access_log_missing', level: 'warn', subject: 'log' })
  if ((draft.appType === 'reverse_proxy' || draft.appType === 'api') && !upstream) {
    findings.push({ key: 'upstream_missing', level: 'danger', subject: 'reverse_proxy' })
  }
  if (
    (draft.appType === 'reverse_proxy' || draft.appType === 'api') &&
    /^http:\/\//iu.test(upstream) &&
    !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/iu.test(upstream)
  ) {
    findings.push({ key: 'upstream_plain_http', level: 'warn', subject: upstream })
  }
  if (draft.appType === 'api' && !draft.includeBodyLimit)
    findings.push({ key: 'body_limit_missing', level: 'warn', subject: 'request_body' })
  if ((draft.appType === 'static' || draft.appType === 'spa') && draft.rootPath.trim() === '/') {
    findings.push({ key: 'root_path_risky', level: 'danger', subject: '/' })
  }
  if ((draft.appType === 'static' || draft.appType === 'spa') && !draft.includeStaticCache) {
    findings.push({ key: 'static_cache_missing', level: 'warn', subject: 'assets' })
  }

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: String(WORKSPACE_LIMIT) })
  if (parsed.syntaxHints.includes('brace_mismatch'))
    findings.push({ key: 'brace_mismatch', level: 'danger', subject: 'workspace' })
  if (parsed.sites.length === 0)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })

  for (const site of parsed.sites) {
    const subject = site.hosts.join(', ') || site.header || 'site'
    if (site.publicHttp) findings.push({ key: 'parsed_http_site', level: 'danger', subject })
    if (site.hosts.some(host => host === ':80' || host === ':443' || host.includes('*'))) {
      findings.push({ key: 'parsed_wildcard_site', level: 'warn', subject })
    }
    if (!site.hasSecurityHeaders)
      findings.push({ key: 'parsed_no_headers', level: 'warn', subject })
    if (!site.hasHsts && !site.hasTlsInternal && !site.publicHttp)
      findings.push({ key: 'parsed_no_hsts', level: 'warn', subject })
    if (!site.hasCompression)
      findings.push({ key: 'parsed_no_compression', level: 'warn', subject })
    if (site.hasReverseProxy && !site.hasBodyLimit)
      findings.push({ key: 'parsed_no_body_limit', level: 'warn', subject })
    if (site.hasFileServer && !site.hasStaticCache)
      findings.push({ key: 'parsed_no_static_cache', level: 'warn', subject })
    if (site.rootPath === '/') findings.push({ key: 'parsed_root_path', level: 'danger', subject })
    for (const proxyPass of site.upstreams) {
      if (
        /^http:\/\//iu.test(proxyPass) &&
        !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/iu.test(proxyPass)
      ) {
        findings.push({ key: 'parsed_plain_upstream', level: 'warn', subject: proxyPass })
      }
    }
  }

  if (findings.length === 0)
    findings.push({ key: 'baseline_ok', level: 'good', subject: hosts.join(', ') || 'site' })

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

export default function CaddyClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<CaddyDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputType, setOutputType] = useState<OutputType>('caddyfile')
  const deferredWorkspace = useDeferredValue(workspace)

  const caddyfileOutput = useMemo(() => buildCaddyfile(draft), [draft])
  const parsed = useMemo(() => {
    const next = parseCaddyWorkspace(deferredWorkspace)

    return isWorkspaceCapped ? { ...next, capped: true } : next
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditDraft(draft, parsed), [draft, parsed])
  const csvOutput = useMemo(() => buildCsv(findings), [findings])
  const buildCurrentOutput = useCallback(() => {
    if (outputType === 'caddyfile') return caddyfileOutput
    if (outputType === 'json') return buildCaddyJson(draft)
    if (outputType === 'docker') return buildDockerOutput(draft)
    if (outputType === 'commands') return buildCommands(draft)
    if (outputType === 'headers') return buildHeadersOutput(draft)

    return buildMarkdown(draft, findings, parsed)
  }, [caddyfileOutput, draft, findings, outputType, parsed])
  const outputPreviewSource = useMemo(() => buildCurrentOutput(), [buildCurrentOutput])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)

  const filteredFindings = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return findings

    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.caddy.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, findings, t])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, FINDING_RENDER_LIMIT),
    [filteredFindings]
  )
  const findingsLimited = filteredFindings.length > visibleFindings.length

  const metrics = useMemo(() => {
    const critical = findings.filter(item => item.level === 'danger').length
    const warnings = findings.filter(item => item.level === 'warn').length
    const proxies = parsed.sites.reduce((sum, site) => sum + site.upstreams.length, 0)

    return {
      critical,
      proxies,
      sites: parsed.sites.length,
      status:
        critical > 0
          ? t('app.generation.caddy.status.risk')
          : warnings > 0
            ? t('app.generation.caddy.status.review')
            : t('app.generation.caddy.status.ready'),
      warnings
    }
  }, [findings, parsed.sites, t])

  const updateDraft = useCallback(<K extends keyof CaddyDraft>(key: K, value: CaddyDraft[K]) => {
    const nextValue =
      typeof value === 'string' ? (value.slice(0, DRAFT_FIELD_LIMIT) as CaddyDraft[K]) : value
    setDraft(current => ({ ...current, [key]: nextValue }))
  }, [])

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
    updateWorkspace(PRESETS[0].workspace)
    setAuditQuery('')
    setOutputType('caddyfile')
  }, [updateWorkspace])

  const copySummary = useCallback(() => {
    copy(
      [
        t('app.generation.caddy.summary_title'),
        `${t('app.generation.caddy.metric.status')}: ${metrics.status}`,
        `${t('app.generation.caddy.metric.sites')}: ${metrics.sites}`,
        `${t('app.generation.caddy.metric.proxies')}: ${metrics.proxies}`,
        `${t('app.generation.caddy.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.caddy.metric.critical')}: ${metrics.critical}`
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
                  <Server className="h-3.5 w-3.5" />
                  {t('app.generation.caddy')}
                </div>
                <CardTitle className="mt-2 text-2xl">{t('app.generation.caddy')}</CardTitle>
                <CardDescription>{t('app.generation.caddy.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copySummary}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('app.generation.caddy.copy_summary')}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('public.reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={t('app.generation.caddy.metric.status')} value={metrics.status} />
            <Metric label={t('app.generation.caddy.metric.sites')} value={metrics.sites} />
            <Metric label={t('app.generation.caddy.metric.proxies')} value={metrics.proxies} />
            <Metric label={t('app.generation.caddy.metric.warnings')} value={metrics.warnings} />
            <Metric label={t('app.generation.caddy.metric.critical')} value={metrics.critical} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.caddy.presets')}</CardTitle>
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
                  {t(`app.generation.caddy.preset.${preset.key}`)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.caddy.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.generation.caddy.builder')}</CardTitle>
              <CardDescription>{t('app.generation.caddy.builder_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="caddy-site">{t('app.generation.caddy.site_name')}</Label>
                  <Input
                    id="caddy-site"
                    value={draft.siteName}
                    onChange={event => updateDraft('siteName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-hosts">{t('app.generation.caddy.hostnames')}</Label>
                  <Input
                    id="caddy-hosts"
                    value={draft.hostnames}
                    onChange={event => updateDraft('hostnames', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-app">{t('app.generation.caddy.app_type')}</Label>
                  <Select
                    id="caddy-app"
                    value={draft.appType}
                    onChange={event => updateDraft('appType', event.target.value as AppType)}
                  >
                    {APP_TYPES.map(type => (
                      <option key={type} value={type}>
                        {t(`app.generation.caddy.app_type.${type}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-upstream">{t('app.generation.caddy.upstream_url')}</Label>
                  <Input
                    id="caddy-upstream"
                    value={draft.upstreamUrl}
                    onChange={event => updateDraft('upstreamUrl', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-root">{t('app.generation.caddy.root_path')}</Label>
                  <Input
                    id="caddy-root"
                    value={draft.rootPath}
                    onChange={event => updateDraft('rootPath', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-email">{t('app.generation.caddy.admin_email')}</Label>
                  <Input
                    id="caddy-email"
                    value={draft.adminEmail}
                    onChange={event => updateDraft('adminEmail', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-port">{t('app.generation.caddy.listen_port')}</Label>
                  <Input
                    id="caddy-port"
                    value={draft.listenPort}
                    onChange={event => updateDraft('listenPort', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-body">{t('app.generation.caddy.max_body_size')}</Label>
                  <Input
                    id="caddy-body"
                    value={draft.maxBodySize}
                    onChange={event => updateDraft('maxBodySize', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-hsts">{t('app.generation.caddy.hsts_max_age')}</Label>
                  <Input
                    id="caddy-hsts"
                    value={draft.hstsMaxAge}
                    onChange={event => updateDraft('hstsMaxAge', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caddy-cache">{t('app.generation.caddy.cache_duration')}</Label>
                  <Input
                    id="caddy-cache"
                    value={draft.cacheDuration}
                    onChange={event => updateDraft('cacheDuration', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="caddy-log">{t('app.generation.caddy.log_path')}</Label>
                  <Input
                    id="caddy-log"
                    value={draft.logPath}
                    onChange={event => updateDraft('logPath', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  checked={draft.includeAutoHttps}
                  onChange={event => updateDraft('includeAutoHttps', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.auto_https')}
                />
                <Checkbox
                  checked={draft.redirectHttp}
                  onChange={event => updateDraft('redirectHttp', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.redirect_http')}
                />
                <Checkbox
                  checked={draft.useTlsInternal}
                  onChange={event => updateDraft('useTlsInternal', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.tls_internal')}
                />
                <Checkbox
                  checked={draft.includeSecurityHeaders}
                  onChange={event => updateDraft('includeSecurityHeaders', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.security_headers')}
                />
                <Checkbox
                  checked={draft.compression}
                  onChange={event => updateDraft('compression', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.compression')}
                />
                <Checkbox
                  checked={draft.includeBodyLimit}
                  onChange={event => updateDraft('includeBodyLimit', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.body_limit')}
                />
                <Checkbox
                  checked={draft.includeStaticCache}
                  onChange={event => updateDraft('includeStaticCache', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.static_cache')}
                />
                <Checkbox
                  checked={draft.includeAccessLog}
                  onChange={event => updateDraft('includeAccessLog', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.access_log')}
                />
                <Checkbox
                  checked={draft.includeTrustedProxies}
                  onChange={event => updateDraft('includeTrustedProxies', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.trusted_proxies')}
                />
                <Checkbox
                  checked={draft.spaFallback}
                  onChange={event => updateDraft('spaFallback', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.spa_fallback')}
                />
                <Checkbox
                  checked={draft.handleErrors}
                  onChange={event => updateDraft('handleErrors', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.caddy.handle_errors')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.caddy.audit')}</CardTitle>
              <CardDescription>{t('app.generation.caddy.audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  className="pl-9"
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                  placeholder={t('app.generation.caddy.audit_search')}
                />
              </div>
              <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
                {visibleFindings.map((finding, index) => (
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
                        {t(`app.generation.caddy.audit.${finding.key}`)}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs leading-5 text-[var(--text-muted)]">
                        {finding.subject}
                      </p>
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

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.caddy.workspace')}</CardTitle>
              <CardDescription>{t('app.generation.caddy.workspace_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea
                value={workspace}
                onChange={event => updateWorkspace(event.target.value)}
                placeholder={t('app.generation.caddy.workspace_placeholder')}
                className="min-h-[260px] font-mono text-sm"
                spellCheck={false}
              />
              <InputCapNotice visible={isWorkspaceCapped} limit={WORKSPACE_LIMIT} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateWorkspace(caddyfileOutput)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('app.generation.caddy.use_output')}
                </Button>
                <Button type="button" variant="outline" onClick={() => updateWorkspace('')}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('public.clear')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.caddy.output')}</CardTitle>
              <CardDescription>{t('app.generation.caddy.output_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="caddy-output">{t('app.generation.caddy.output_type')}</Label>
                <Select
                  id="caddy-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.caddy.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                value={outputPreview}
                readOnly
                className="min-h-[300px] font-mono text-sm"
                spellCheck={false}
              />
              {outputPreviewLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_limited', {
                    total: outputPreviewSource.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => copy(buildCurrentOutput())}
                  className="w-full sm:w-auto"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('app.generation.caddy.copy_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadText(buildCurrentOutput(), getOutputFilename(outputType))}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('app.generation.caddy.download_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(csvOutput, 'caddy-audit.csv', 'text/csv;charset=utf-8')
                  }
                  className="w-full sm:w-auto"
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {t('app.generation.caddy.download_csv')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.caddy.parsed')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {parsed.sites.length === 0 ? (
              <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--text-muted)]">
                {t('app.generation.caddy.empty')}
              </div>
            ) : (
              <>
                {parsed.sites.map((site, index) => (
                  <div
                    key={`${site.header}-${index}`}
                    className="glass-panel min-w-0 rounded-2xl p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 break-all font-mono text-sm font-semibold leading-5 text-[var(--text-primary)]">
                        {site.header}
                      </p>
                      <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                        {site.hasReverseProxy
                          ? t('app.generation.caddy.parsed.proxy')
                          : site.hasFileServer
                            ? t('app.generation.caddy.parsed.files')
                            : t('app.generation.caddy.parsed.site')}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
                      <span>
                        {t('app.generation.caddy.parsed.upstreams')}: {site.upstreams.length || '-'}
                      </span>
                      <span>
                        {t('app.generation.caddy.parsed.root')}: {site.rootPath || '-'}
                      </span>
                      <span>
                        {t('app.generation.caddy.parsed.headers')}:{' '}
                        {site.hasSecurityHeaders
                          ? t('app.generation.caddy.level.good')
                          : t('app.generation.caddy.level.warn')}
                      </span>
                      <span>
                        {t('app.generation.caddy.parsed.compression')}:{' '}
                        {site.hasCompression
                          ? t('app.generation.caddy.level.good')
                          : t('app.generation.caddy.level.warn')}
                      </span>
                    </div>
                  </div>
                ))}
                {parsed.siteLimited && (
                  <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                    {t('public.rows_render_limited', {
                      total: parsed.totalSites,
                      visible: parsed.sites.length
                    })}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.caddy.reference')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {['auto_https', 'proxy', 'headers', 'static_cache', 'body_limit'].map(item => (
              <div key={item} className="glass-panel rounded-2xl p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.caddy.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.caddy.reference.${item}_hint`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
