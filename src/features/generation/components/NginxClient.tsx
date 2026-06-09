'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  Network,
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
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const OUTPUT_TYPES = ['config', 'docker', 'commands', 'headers', 'markdown', 'json'] as const
const APP_TYPES = ['reverse_proxy', 'static', 'spa', 'api'] as const
const WORKSPACE_LIMIT = 80000
const SERVER_RENDER_LIMIT = 80
const UNSAFE_DIRECTIVE_PATTERN = /[\r\n;{}]/u

type AppType = (typeof APP_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface NginxDraft {
  accessLog: string
  appType: AppType
  brotli: boolean
  cacheDuration: string
  cacheProxy: boolean
  clientMaxBodySize: string
  errorLog: string
  gzip: boolean
  hstsMaxAge: string
  http2: boolean
  includeSecurityHeaders: boolean
  includeTls: boolean
  listenPort: string
  proxyReadTimeout: string
  rateLimit: boolean
  rateLimitRate: string
  realIpHeader: boolean
  redirectHttp: boolean
  rootPath: string
  serverName: string
  serverTokensOff: boolean
  siteName: string
  spaFallback: boolean
  sslCertPath: string
  sslKeyPath: string
  staticCache: boolean
  upstreamUrl: string
  websocket: boolean
}

interface Preset {
  draft: NginxDraft
  key: string
  workspace: string
}

interface ParsedServer {
  addHeaders: string[]
  hasBrotli: boolean
  hasGzip: boolean
  hasHsts: boolean
  hasProxyHeaders: boolean
  hasSsl: boolean
  hasWebsocketHeaders: boolean
  listen: string[]
  locations: number
  proxyPasses: string[]
  redirectsToHttps: boolean
  rootPath: string
  serverName: string
  serverTokensOff: boolean
}

interface ParsedNginx {
  capped: boolean
  serverBlocks: ParsedServer[]
  syntaxHints: string[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: NginxDraft = {
  accessLog: '/var/log/nginx/daily-tools.access.log',
  appType: 'reverse_proxy',
  brotli: true,
  cacheDuration: '7d',
  cacheProxy: true,
  clientMaxBodySize: '20m',
  errorLog: '/var/log/nginx/daily-tools.error.log',
  gzip: true,
  hstsMaxAge: '31536000',
  http2: true,
  includeSecurityHeaders: true,
  includeTls: true,
  listenPort: '443',
  proxyReadTimeout: '60s',
  rateLimit: true,
  rateLimitRate: '10r/s',
  realIpHeader: false,
  redirectHttp: true,
  rootPath: '/var/www/daily-tools',
  serverName: 'tools.example.com',
  serverTokensOff: true,
  siteName: 'daily-tools',
  spaFallback: true,
  sslCertPath: '/etc/letsencrypt/live/tools.example.com/fullchain.pem',
  sslKeyPath: '/etc/letsencrypt/live/tools.example.com/privkey.pem',
  staticCache: true,
  upstreamUrl: 'http://127.0.0.1:3000',
  websocket: true
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `limit_req_zone $binary_remote_addr zone=daily-tools_rate:10m rate=10r/s;
proxy_cache_path /var/cache/nginx/daily-tools levels=1:2 keys_zone=daily-tools_cache:20m inactive=60m max_size=1g;

server {
  listen 80;
  server_name tools.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name tools.example.com;
  server_tokens off;
  ssl_certificate /etc/letsencrypt/live/tools.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tools.example.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  gzip on;
  brotli on;
  client_max_body_size 20m;

  location / {
    limit_req zone=daily-tools_rate burst=30 nodelay;
    proxy_cache daily-tools_cache;
    proxy_cache_valid 200 302 7d;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
  }
}`
  },
  {
    key: 'static',
    draft: {
      ...DEFAULT_DRAFT,
      accessLog: '/var/log/nginx/docs.access.log',
      appType: 'static',
      cacheProxy: false,
      errorLog: '/var/log/nginx/docs.error.log',
      rateLimit: false,
      rootPath: '/var/www/docs',
      serverName: 'docs.example.com',
      siteName: 'docs',
      spaFallback: false,
      sslCertPath: '/etc/letsencrypt/live/docs.example.com/fullchain.pem',
      sslKeyPath: '/etc/letsencrypt/live/docs.example.com/privkey.pem'
    },
    workspace: `server {
  listen 443 ssl http2;
  server_name docs.example.com;
  server_tokens off;
  root /var/www/docs;
  index index.html;
  ssl_certificate /etc/letsencrypt/live/docs.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/docs.example.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  gzip on;
  brotli on;

  location / {
    try_files $uri $uri/ =404;
  }

  location ~* \\.(?:css|js|woff2|png|jpg|jpeg|gif|svg)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
  }
}`
  },
  {
    key: 'spa',
    draft: {
      ...DEFAULT_DRAFT,
      accessLog: '/var/log/nginx/app.access.log',
      appType: 'spa',
      cacheProxy: false,
      errorLog: '/var/log/nginx/app.error.log',
      rateLimit: false,
      rootPath: '/var/www/app',
      serverName: 'app.example.com',
      siteName: 'app',
      sslCertPath: '/etc/letsencrypt/live/app.example.com/fullchain.pem',
      sslKeyPath: '/etc/letsencrypt/live/app.example.com/privkey.pem'
    },
    workspace: `server {
  listen 443 ssl http2;
  server_name app.example.com;
  server_tokens off;
  root /var/www/app;
  index index.html;
  ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;

  location / {
    try_files $uri $uri/ /index.html;
  }
}`
  },
  {
    key: 'api',
    draft: {
      ...DEFAULT_DRAFT,
      accessLog: '/var/log/nginx/api.access.log',
      appType: 'api',
      cacheProxy: false,
      clientMaxBodySize: '10m',
      errorLog: '/var/log/nginx/api.error.log',
      rateLimitRate: '30r/s',
      serverName: 'api.example.com',
      siteName: 'api',
      sslCertPath: '/etc/letsencrypt/live/api.example.com/fullchain.pem',
      sslKeyPath: '/etc/letsencrypt/live/api.example.com/privkey.pem',
      upstreamUrl: 'http://127.0.0.1:8080'
    },
    workspace: `limit_req_zone $binary_remote_addr zone=api_rate:10m rate=30r/s;

server {
  listen 443 ssl http2;
  server_name api.example.com;
  server_tokens off;
  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  client_max_body_size 10m;

  location / {
    limit_req zone=api_rate burst=90 nodelay;
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      brotli: false,
      cacheProxy: false,
      gzip: false,
      includeSecurityHeaders: false,
      includeTls: false,
      listenPort: '80',
      rateLimit: false,
      redirectHttp: false,
      serverName: '_',
      serverTokensOff: false,
      staticCache: false,
      upstreamUrl: 'http://app.internal:3000',
      websocket: false
    },
    workspace: `server {
  listen 80 default_server;
  server_name _;
  server_tokens on;
  root /;

  location / {
    proxy_pass http://app.internal:3000;
  }

  location /uploads/ {
    alias /;
  }
}`
  }
]

function escapeNginx(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function hasUnsafeDirectiveCharacters(value: string) {
  return UNSAFE_DIRECTIVE_PATTERN.test(value)
}

function collectUnsafeDraftSubjects(draft: NginxDraft) {
  const fields: Array<[string, string]> = [
    [draft.accessLog, 'access_log'],
    [draft.cacheDuration, 'cache_duration'],
    [draft.clientMaxBodySize, 'client_max_body_size'],
    [draft.errorLog, 'error_log'],
    [draft.hstsMaxAge, 'hsts_max_age'],
    [draft.listenPort, 'listen'],
    [draft.proxyReadTimeout, 'proxy_read_timeout'],
    [draft.rateLimitRate, 'rate_limit'],
    [draft.rootPath, 'root'],
    [draft.serverName, 'server_name'],
    [draft.sslCertPath, 'ssl_certificate'],
    [draft.sslKeyPath, 'ssl_certificate_key'],
    [draft.upstreamUrl, 'proxy_pass']
  ]

  return fields
    .filter(([value]) => hasUnsafeDirectiveCharacters(value))
    .map(([, subject]) => subject)
}

function sanitizeDirective(value: string, fallback: string) {
  const trimmed = value.trim()
  if (!trimmed) return fallback

  const safe = trimmed.split(UNSAFE_DIRECTIVE_PATTERN)[0]?.trim()
  return safe || fallback
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function compactLines(lines: string[]) {
  return lines.filter(line => line.trim()).join('\n')
}

function downloadText(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildSecurityHeaders(draft: NginxDraft) {
  if (!draft.includeSecurityHeaders) return []

  const hstsMaxAge = sanitizeDirective(draft.hstsMaxAge, '31536000')
  const hsts = draft.includeTls
    ? [
        `  add_header Strict-Transport-Security "max-age=${escapeNginx(hstsMaxAge)}; includeSubDomains" always;`
      ]
    : []

  return [
    ...hsts,
    '  add_header X-Content-Type-Options "nosniff" always;',
    '  add_header X-Frame-Options "SAMEORIGIN" always;',
    '  add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    '  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;'
  ]
}

function buildCompression(draft: NginxDraft) {
  const lines: string[] = []
  if (draft.gzip) {
    lines.push('  gzip on;')
    lines.push(
      '  gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;'
    )
  }
  if (draft.brotli) {
    lines.push('  brotli on;')
    lines.push(
      '  brotli_types text/plain text/css application/json application/javascript application/xml image/svg+xml;'
    )
  }
  return lines
}

function buildProxyLocation(draft: NginxDraft) {
  const cacheDuration = sanitizeDirective(draft.cacheDuration, '7d')
  const proxyReadTimeout = sanitizeDirective(draft.proxyReadTimeout, '60s')
  const upstreamUrl = sanitizeDirective(draft.upstreamUrl, 'http://127.0.0.1:3000')
  const lines = [
    '  location / {',
    draft.rateLimit
      ? `    limit_req zone=${toSlug(draft.siteName, 'site')}_rate burst=30 nodelay;`
      : '',
    draft.cacheProxy ? `    proxy_cache ${toSlug(draft.siteName, 'site')}_cache;` : '',
    draft.cacheProxy ? `    proxy_cache_valid 200 302 ${cacheDuration};` : '',
    `    proxy_pass ${upstreamUrl};`,
    '    proxy_http_version 1.1;',
    '    proxy_set_header Host $host;',
    '    proxy_set_header X-Real-IP $remote_addr;',
    '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '    proxy_set_header X-Forwarded-Proto $scheme;',
    draft.realIpHeader ? '    real_ip_header X-Forwarded-For;' : '',
    draft.websocket ? '    proxy_set_header Upgrade $http_upgrade;' : '',
    draft.websocket ? '    proxy_set_header Connection "upgrade";' : '',
    `    proxy_read_timeout ${proxyReadTimeout};`,
    '  }'
  ]

  return compactLines(lines)
}

function buildStaticLocation(draft: NginxDraft) {
  const fallback = draft.appType === 'spa' || draft.spaFallback ? '/index.html' : '=404'
  const cacheDuration = sanitizeDirective(draft.cacheDuration, '7d')
  const lines = [
    '  location / {',
    `    try_files $uri $uri/ ${fallback};`,
    '  }',
    draft.staticCache
      ? [
          '',
          '  location ~* \\.(?:css|js|mjs|woff2|png|jpg|jpeg|gif|svg|webp|avif)$ {',
          `    expires ${cacheDuration};`,
          '    add_header Cache-Control "public, immutable";',
          '  }'
        ].join('\n')
      : ''
  ]

  return compactLines(lines)
}

function buildNginxConfig(draft: NginxDraft) {
  const site = toSlug(draft.siteName, 'site')
  const serverName = sanitizeDirective(draft.serverName, 'example.com')
  const listenPort = sanitizeDirective(draft.listenPort, '80')
  const clientMaxBodySize = sanitizeDirective(draft.clientMaxBodySize, '20m')
  const accessLog = sanitizeDirective(draft.accessLog, '')
  const errorLog = sanitizeDirective(draft.errorLog, '')
  const rootPath = sanitizeDirective(draft.rootPath, '/var/www/app')
  const sslCertPath = sanitizeDirective(
    draft.sslCertPath,
    `/etc/letsencrypt/live/${serverName}/fullchain.pem`
  )
  const sslKeyPath = sanitizeDirective(
    draft.sslKeyPath,
    `/etc/letsencrypt/live/${serverName}/privkey.pem`
  )
  const rateLimitRate = sanitizeDirective(draft.rateLimitRate, '10r/s')
  const listen = draft.includeTls ? `443 ssl${draft.http2 ? ' http2' : ''}` : listenPort
  const prelude = [
    draft.rateLimit
      ? `limit_req_zone $binary_remote_addr zone=${site}_rate:10m rate=${rateLimitRate};`
      : '',
    draft.cacheProxy
      ? `proxy_cache_path /var/cache/nginx/${site} levels=1:2 keys_zone=${site}_cache:20m inactive=60m max_size=1g;`
      : ''
  ]
  const redirect =
    draft.redirectHttp && draft.includeTls
      ? [
          '',
          'server {',
          '  listen 80;',
          `  server_name ${serverName};`,
          '  return 301 https://$host$request_uri;',
          '}'
        ].join('\n')
      : ''

  const body = [
    'server {',
    `  listen ${listen};`,
    `  server_name ${serverName};`,
    draft.serverTokensOff ? '  server_tokens off;' : '',
    draft.appType === 'static' || draft.appType === 'spa' ? `  root ${rootPath};` : '',
    draft.appType === 'static' || draft.appType === 'spa' ? '  index index.html;' : '',
    draft.includeTls ? `  ssl_certificate ${sslCertPath};` : '',
    draft.includeTls ? `  ssl_certificate_key ${sslKeyPath};` : '',
    accessLog ? `  access_log ${accessLog};` : '',
    errorLog ? `  error_log ${errorLog};` : '',
    `  client_max_body_size ${clientMaxBodySize};`,
    ...buildSecurityHeaders(draft),
    ...buildCompression(draft),
    '',
    draft.appType === 'reverse_proxy' || draft.appType === 'api'
      ? buildProxyLocation(draft)
      : buildStaticLocation(draft),
    '}'
  ]

  return compactLines([...prelude, redirect, body.join('\n')])
}

function buildDockerOutput(draft: NginxDraft) {
  const site = toSlug(draft.siteName, 'site')
  const listenPort = sanitizeDirective(draft.listenPort, '80')
  const rootPath = sanitizeDirective(draft.rootPath, '/var/www/app')

  return [
    'services:',
    '  nginx:',
    '    image: nginx:1.27-alpine',
    '    restart: unless-stopped',
    '    ports:',
    draft.includeTls ? '      - "80:80"\n      - "443:443"' : `      - "${listenPort}:80"`,
    '    volumes:',
    `      - ./nginx/${site}.conf:/etc/nginx/conf.d/${site}.conf:ro`,
    draft.includeTls ? '      - /etc/letsencrypt:/etc/letsencrypt:ro' : '',
    draft.appType === 'static' || draft.appType === 'spa'
      ? `      - ${rootPath}:${rootPath}:ro`
      : '',
    draft.cacheProxy ? `      - nginx-${site}-cache:/var/cache/nginx/${site}` : '',
    '    healthcheck:',
    '      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ || exit 1"]',
    '      interval: 30s',
    '      timeout: 5s',
    '      retries: 3',
    draft.cacheProxy ? `volumes:\n  nginx-${site}-cache:` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCommands(draft: NginxDraft) {
  const site = toSlug(draft.siteName, 'site')

  return [
    `sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled`,
    `sudo tee /etc/nginx/sites-available/${site}.conf > /dev/null <<'NGINX'`,
    buildNginxConfig(draft),
    'NGINX',
    `sudo ln -sfn /etc/nginx/sites-available/${site}.conf /etc/nginx/sites-enabled/${site}.conf`,
    'sudo nginx -t',
    'sudo systemctl reload nginx'
  ].join('\n')
}

function buildHeadersOutput(draft: NginxDraft) {
  const hstsMaxAge = sanitizeDirective(draft.hstsMaxAge, '31536000')

  return compactLines([
    draft.includeTls
      ? `add_header Strict-Transport-Security "max-age=${hstsMaxAge}; includeSubDomains" always;`
      : '',
    draft.includeSecurityHeaders ? 'add_header X-Content-Type-Options "nosniff" always;' : '',
    draft.includeSecurityHeaders ? 'add_header X-Frame-Options "SAMEORIGIN" always;' : '',
    draft.includeSecurityHeaders
      ? 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;'
      : '',
    draft.includeSecurityHeaders
      ? 'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;'
      : ''
  ])
}

function buildMarkdown(draft: NginxDraft, findings: Finding[], parsed: ParsedNginx) {
  return [
    `# ${draft.siteName || 'site'} Nginx plan`,
    '',
    `- Server name: ${draft.serverName || 'example.com'}`,
    `- App type: ${draft.appType}`,
    `- TLS: ${draft.includeTls ? 'enabled' : 'review'}`,
    `- Compression: ${[draft.gzip ? 'gzip' : '', draft.brotli ? 'brotli' : ''].filter(Boolean).join(', ') || 'disabled'}`,
    `- Parsed server blocks: ${parsed.serverBlocks.length}`,
    `- Audit findings: ${findings.length}`,
    '',
    '## Next checks',
    '',
    '- Run `nginx -t` before reload.',
    '- Confirm certificate renewal paths and HSTS rollout timing.',
    '- Review proxy headers, cache rules, and upload limits for the app.',
    '- Keep risky catch-all server blocks away from production defaults.'
  ].join('\n')
}

function getOutputFilename(outputType: OutputType) {
  if (outputType === 'config') return 'nginx-site.conf'
  if (outputType === 'docker') return 'docker-compose.nginx.yml'
  if (outputType === 'commands') return 'install-nginx.sh'
  if (outputType === 'headers') return 'nginx-headers.conf'
  if (outputType === 'json') return 'nginx-summary.json'
  return 'nginx-plan.md'
}

function extractDirectives(block: string, name: string) {
  const pattern = new RegExp(`${name}\\s+([^;]+);`, 'giu')
  return Array.from(block.matchAll(pattern), match => match[1]?.trim() || '').filter(Boolean)
}

function parseServerBlocks(input: string) {
  const blocks: string[] = []
  const pattern = /server\s*\{/giu
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input)) && blocks.length < SERVER_RENDER_LIMIT) {
    let depth = 0
    let end = match.index
    let opened = false

    for (let index = match.index; index < input.length; index += 1) {
      const char = input[index]
      if (char === '{') {
        depth += 1
        opened = true
      }
      if (char === '}') depth -= 1
      if (opened && depth === 0) {
        end = index + 1
        break
      }
    }

    blocks.push(input.slice(match.index, end))
  }

  return blocks
}

function parseNginxWorkspace(input: string): ParsedNginx {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const capped = input.length > WORKSPACE_LIMIT
  const syntaxHints: string[] = []
  const openBraces = (source.match(/\{/gu) || []).length
  const closeBraces = (source.match(/\}/gu) || []).length
  if (openBraces !== closeBraces) syntaxHints.push('brace_mismatch')

  const serverBlocks = parseServerBlocks(source).map(block => {
    const listen = extractDirectives(block, 'listen')
    const proxyPasses = extractDirectives(block, 'proxy_pass')
    const addHeaders = extractDirectives(block, 'add_header')
    const serverNames = extractDirectives(block, 'server_name')
    const roots = extractDirectives(block, 'root')
    const locations = block.match(/location\s+/giu)?.length || 0
    const lower = block.toLowerCase()

    return {
      addHeaders,
      hasBrotli: /\bbrotli\s+on\s*;/iu.test(block),
      hasGzip: /\bgzip\s+on\s*;/iu.test(block),
      hasHsts: /strict-transport-security/iu.test(block),
      hasProxyHeaders:
        /proxy_set_header\s+Host/iu.test(block) &&
        /proxy_set_header\s+X-Forwarded-For/iu.test(block) &&
        /proxy_set_header\s+X-Forwarded-Proto/iu.test(block),
      hasSsl: /listen\s+[^;]*ssl/iu.test(block) && /ssl_certificate\s+/iu.test(block),
      hasWebsocketHeaders:
        /proxy_set_header\s+Upgrade/iu.test(block) && /proxy_set_header\s+Connection/iu.test(block),
      listen,
      locations,
      proxyPasses,
      redirectsToHttps: /return\s+30[128]\s+https:\/\//iu.test(block),
      rootPath: roots[0] || '',
      serverName: serverNames[0] || '',
      serverTokensOff:
        /server_tokens\s+off\s*;/iu.test(block) &&
        !/server_tokens\s+on\s*;/iu.test(block) &&
        !lower.includes('server_tokens on')
    }
  })

  return { capped, serverBlocks, syntaxHints }
}

function auditDraft(draft: NginxDraft, parsed: ParsedNginx): Finding[] {
  const findings: Finding[] = []
  const serverName = draft.serverName.trim()
  const upstream = draft.upstreamUrl.trim()

  for (const subject of collectUnsafeDraftSubjects(draft)) {
    findings.push({ key: 'unsafe_directive_value', level: 'danger', subject })
  }
  if (!serverName)
    findings.push({ key: 'server_name_missing', level: 'danger', subject: 'server_name' })
  if (serverName === '_' || serverName.includes('*'))
    findings.push({ key: 'wildcard_server', level: 'warn', subject: serverName || '_' })
  if (!draft.includeTls)
    findings.push({ key: 'tls_missing', level: 'danger', subject: serverName || 'server' })
  if (draft.includeTls && !draft.redirectHttp)
    findings.push({ key: 'redirect_missing', level: 'warn', subject: 'HTTP' })
  if (
    draft.includeTls &&
    draft.includeSecurityHeaders &&
    Number.parseInt(draft.hstsMaxAge, 10) < 15552000
  ) {
    findings.push({ key: 'hsts_short', level: 'warn', subject: draft.hstsMaxAge || '0' })
  }
  if (!draft.serverTokensOff)
    findings.push({ key: 'server_tokens_on', level: 'warn', subject: 'server_tokens' })
  if (!draft.includeSecurityHeaders)
    findings.push({
      key: 'security_headers_missing',
      level: 'warn',
      subject: serverName || 'server'
    })
  if (!draft.gzip && !draft.brotli)
    findings.push({ key: 'compression_missing', level: 'warn', subject: serverName || 'server' })
  if ((draft.appType === 'reverse_proxy' || draft.appType === 'api') && !upstream) {
    findings.push({ key: 'upstream_missing', level: 'danger', subject: 'proxy_pass' })
  }
  if (
    (draft.appType === 'reverse_proxy' || draft.appType === 'api') &&
    /^http:\/\//iu.test(upstream) &&
    !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/iu.test(upstream)
  ) {
    findings.push({ key: 'upstream_plain_http', level: 'warn', subject: upstream })
  }
  if ((draft.appType === 'reverse_proxy' || draft.appType === 'api') && !draft.websocket) {
    findings.push({ key: 'websocket_headers_missing', level: 'warn', subject: 'Upgrade' })
  }
  if (!draft.clientMaxBodySize.trim())
    findings.push({ key: 'body_size_missing', level: 'warn', subject: 'client_max_body_size' })
  if ((draft.appType === 'static' || draft.appType === 'spa') && draft.rootPath.trim() === '/') {
    findings.push({ key: 'root_path_risky', level: 'danger', subject: '/' })
  }
  if (!draft.staticCache && (draft.appType === 'static' || draft.appType === 'spa')) {
    findings.push({ key: 'static_cache_missing', level: 'warn', subject: 'assets' })
  }
  if (!draft.rateLimit && draft.appType === 'api')
    findings.push({ key: 'rate_limit_missing', level: 'warn', subject: 'API' })

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: String(WORKSPACE_LIMIT) })
  if (parsed.syntaxHints.includes('brace_mismatch'))
    findings.push({ key: 'brace_mismatch', level: 'danger', subject: 'workspace' })
  if (parsed.serverBlocks.length === 0)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })

  for (const server of parsed.serverBlocks) {
    const subject = server.serverName || server.listen.join(', ') || 'server'
    const redirectOnly =
      server.redirectsToHttps && server.proxyPasses.length === 0 && server.locations === 0
    const listensPublicHttp = server.listen.some(
      item => /\b80\b/iu.test(item) && !/ssl/iu.test(item)
    )
    if (redirectOnly) continue
    if (!server.hasSsl && listensPublicHttp)
      findings.push({ key: 'parsed_tls_missing', level: 'danger', subject })
    if (server.hasSsl && !server.hasHsts)
      findings.push({ key: 'parsed_hsts_missing', level: 'warn', subject })
    if (!server.serverTokensOff)
      findings.push({ key: 'parsed_server_tokens', level: 'warn', subject })
    if (server.proxyPasses.length > 0 && !server.hasProxyHeaders)
      findings.push({ key: 'parsed_proxy_headers', level: 'warn', subject })
    if (server.proxyPasses.length > 0 && !server.hasWebsocketHeaders)
      findings.push({ key: 'parsed_websocket_headers', level: 'warn', subject })
    if (!server.hasGzip && !server.hasBrotli)
      findings.push({ key: 'parsed_compression_missing', level: 'warn', subject })
    if (
      server.serverName === '_' ||
      server.serverName.includes('*') ||
      server.listen.some(item => /default_server/iu.test(item))
    ) {
      findings.push({ key: 'parsed_default_server', level: 'warn', subject })
    }
    if (server.rootPath === '/')
      findings.push({ key: 'parsed_root_path', level: 'danger', subject })
    for (const proxyPass of server.proxyPasses) {
      if (
        /^http:\/\//iu.test(proxyPass) &&
        !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])/iu.test(proxyPass)
      ) {
        findings.push({ key: 'parsed_plain_upstream', level: 'warn', subject: proxyPass })
      }
    }
  }

  if (findings.length === 0)
    findings.push({ key: 'baseline_ok', level: 'good', subject: serverName || 'server' })

  return findings
}

function buildCsv(findings: Finding[]) {
  return [
    'level,subject,key',
    ...findings.map(item =>
      [item.level, item.subject, item.key]
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
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

export default function NginxClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<NginxDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputType, setOutputType] = useState<OutputType>('config')
  const deferredWorkspace = useDeferredValue(workspace)

  const configOutput = useMemo(() => buildNginxConfig(draft), [draft])
  const parsed = useMemo(() => parseNginxWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditDraft(draft, parsed), [draft, parsed])
  const csvOutput = useMemo(() => buildCsv(findings), [findings])
  const outputValue = useMemo(() => {
    if (outputType === 'config') return configOutput
    if (outputType === 'docker') return buildDockerOutput(draft)
    if (outputType === 'commands') return buildCommands(draft)
    if (outputType === 'headers') return buildHeadersOutput(draft)
    if (outputType === 'json') return JSON.stringify({ draft, findings, parsed }, null, 2)
    return buildMarkdown(draft, findings, parsed)
  }, [configOutput, draft, findings, outputType, parsed])

  const filteredFindings = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return findings

    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.nginx.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, findings, t])

  const metrics = useMemo(() => {
    const danger = findings.filter(item => item.level === 'danger').length
    const warn = findings.filter(item => item.level === 'warn').length

    return {
      critical: danger,
      proxy: parsed.serverBlocks.reduce((sum, block) => sum + block.proxyPasses.length, 0),
      servers: parsed.serverBlocks.length,
      status:
        danger > 0
          ? t('app.generation.nginx.status.risk')
          : warn > 0
            ? t('app.generation.nginx.status.review')
            : t('app.generation.nginx.status.ready'),
      warnings: warn
    }
  }, [findings, parsed.serverBlocks, t])

  const updateDraft = useCallback(<K extends keyof NginxDraft>(key: K, value: NginxDraft[K]) => {
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
    setOutputType('config')
  }, [])

  const copySummary = useCallback(() => {
    copy(
      [
        t('app.generation.nginx.summary_title'),
        `${t('app.generation.nginx.metric.status')}: ${metrics.status}`,
        `${t('app.generation.nginx.metric.servers')}: ${metrics.servers}`,
        `${t('app.generation.nginx.metric.proxy')}: ${metrics.proxy}`,
        `${t('app.generation.nginx.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.nginx.metric.critical')}: ${metrics.critical}`
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
                  {t('app.generation.nginx')}
                </div>
                <CardTitle className="mt-2 text-2xl">{t('app.generation.nginx')}</CardTitle>
                <CardDescription>{t('app.generation.nginx.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copySummary}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('app.generation.nginx.copy_summary')}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('public.reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={t('app.generation.nginx.metric.status')} value={metrics.status} />
            <Metric label={t('app.generation.nginx.metric.servers')} value={metrics.servers} />
            <Metric label={t('app.generation.nginx.metric.proxy')} value={metrics.proxy} />
            <Metric label={t('app.generation.nginx.metric.warnings')} value={metrics.warnings} />
            <Metric label={t('app.generation.nginx.metric.critical')} value={metrics.critical} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.nginx.presets')}</CardTitle>
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
                  {t(`app.generation.nginx.preset.${preset.key}`)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.nginx.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.generation.nginx.builder')}</CardTitle>
              <CardDescription>{t('app.generation.nginx.builder_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="nginx-site">{t('app.generation.nginx.site_name')}</Label>
                  <Input
                    id="nginx-site"
                    value={draft.siteName}
                    onChange={event => updateDraft('siteName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-server">{t('app.generation.nginx.server_name')}</Label>
                  <Input
                    id="nginx-server"
                    value={draft.serverName}
                    onChange={event => updateDraft('serverName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-app">{t('app.generation.nginx.app_type')}</Label>
                  <Select
                    id="nginx-app"
                    value={draft.appType}
                    onChange={event => updateDraft('appType', event.target.value as AppType)}
                  >
                    {APP_TYPES.map(type => (
                      <option key={type} value={type}>
                        {t(`app.generation.nginx.app_type.${type}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-listen">{t('app.generation.nginx.listen_port')}</Label>
                  <Input
                    id="nginx-listen"
                    value={draft.listenPort}
                    onChange={event => updateDraft('listenPort', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-upstream">{t('app.generation.nginx.upstream_url')}</Label>
                  <Input
                    id="nginx-upstream"
                    value={draft.upstreamUrl}
                    onChange={event => updateDraft('upstreamUrl', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-root">{t('app.generation.nginx.root_path')}</Label>
                  <Input
                    id="nginx-root"
                    value={draft.rootPath}
                    onChange={event => updateDraft('rootPath', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-body">
                    {t('app.generation.nginx.client_max_body_size')}
                  </Label>
                  <Input
                    id="nginx-body"
                    value={draft.clientMaxBodySize}
                    onChange={event => updateDraft('clientMaxBodySize', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-timeout">
                    {t('app.generation.nginx.proxy_read_timeout')}
                  </Label>
                  <Input
                    id="nginx-timeout"
                    value={draft.proxyReadTimeout}
                    onChange={event => updateDraft('proxyReadTimeout', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-cache-duration">
                    {t('app.generation.nginx.cache_duration')}
                  </Label>
                  <Input
                    id="nginx-cache-duration"
                    value={draft.cacheDuration}
                    onChange={event => updateDraft('cacheDuration', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-rate">{t('app.generation.nginx.rate_limit_rate')}</Label>
                  <Input
                    id="nginx-rate"
                    value={draft.rateLimitRate}
                    onChange={event => updateDraft('rateLimitRate', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-hsts">{t('app.generation.nginx.hsts_max_age')}</Label>
                  <Input
                    id="nginx-hsts"
                    value={draft.hstsMaxAge}
                    onChange={event => updateDraft('hstsMaxAge', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-access">{t('app.generation.nginx.access_log')}</Label>
                  <Input
                    id="nginx-access"
                    value={draft.accessLog}
                    onChange={event => updateDraft('accessLog', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nginx-error">{t('app.generation.nginx.error_log')}</Label>
                  <Input
                    id="nginx-error"
                    value={draft.errorLog}
                    onChange={event => updateDraft('errorLog', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="nginx-cert">{t('app.generation.nginx.ssl_cert_path')}</Label>
                  <Input
                    id="nginx-cert"
                    value={draft.sslCertPath}
                    onChange={event => updateDraft('sslCertPath', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="nginx-key">{t('app.generation.nginx.ssl_key_path')}</Label>
                  <Input
                    id="nginx-key"
                    value={draft.sslKeyPath}
                    onChange={event => updateDraft('sslKeyPath', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  checked={draft.includeTls}
                  onChange={event => updateDraft('includeTls', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.include_tls')}
                />
                <Checkbox
                  checked={draft.redirectHttp}
                  onChange={event => updateDraft('redirectHttp', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.redirect_http')}
                />
                <Checkbox
                  checked={draft.http2}
                  onChange={event => updateDraft('http2', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.http2')}
                />
                <Checkbox
                  checked={draft.includeSecurityHeaders}
                  onChange={event => updateDraft('includeSecurityHeaders', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.security_headers')}
                />
                <Checkbox
                  checked={draft.serverTokensOff}
                  onChange={event => updateDraft('serverTokensOff', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.server_tokens_off')}
                />
                <Checkbox
                  checked={draft.gzip}
                  onChange={event => updateDraft('gzip', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.gzip')}
                />
                <Checkbox
                  checked={draft.brotli}
                  onChange={event => updateDraft('brotli', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.brotli')}
                />
                <Checkbox
                  checked={draft.staticCache}
                  onChange={event => updateDraft('staticCache', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.static_cache')}
                />
                <Checkbox
                  checked={draft.cacheProxy}
                  onChange={event => updateDraft('cacheProxy', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.proxy_cache')}
                />
                <Checkbox
                  checked={draft.rateLimit}
                  onChange={event => updateDraft('rateLimit', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.rate_limit')}
                />
                <Checkbox
                  checked={draft.websocket}
                  onChange={event => updateDraft('websocket', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.websocket')}
                />
                <Checkbox
                  checked={draft.realIpHeader}
                  onChange={event => updateDraft('realIpHeader', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.real_ip_header')}
                />
                <Checkbox
                  checked={draft.spaFallback}
                  onChange={event => updateDraft('spaFallback', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.nginx.spa_fallback')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.nginx.workspace')}</CardTitle>
              <CardDescription>{t('app.generation.nginx.workspace_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea
                value={workspace}
                onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
                placeholder={t('app.generation.nginx.workspace_placeholder')}
                className="min-h-[520px] font-mono"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => copy(workspace)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('public.copy')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setWorkspace(configOutput)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('app.generation.nginx.use_output')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('public.clear')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.nginx.audit')}</CardTitle>
              <CardDescription>{t('app.generation.nginx.audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value)}
                  placeholder={t('app.generation.nginx.audit_search')}
                  className="pl-10"
                />
              </div>
              <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
                {filteredFindings.map((finding, index) => (
                  <div
                    key={`${finding.key}-${finding.subject}-${index}`}
                    className="glass-panel rounded-2xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {finding.subject}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          {t(`app.generation.nginx.audit.${finding.key}`)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium">
                        {t(`app.generation.nginx.level.${finding.level}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">{t('app.generation.nginx.output')}</CardTitle>
                  <CardDescription>{t('app.generation.nginx.output_hint')}</CardDescription>
                </div>
                <ShieldCheck className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="nginx-output">{t('app.generation.nginx.output_type')}</Label>
                <Select
                  id="nginx-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.nginx.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                value={outputValue}
                readOnly
                className="min-h-[360px] font-mono"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(outputValue)}
                  className="w-full sm:w-auto"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('app.generation.nginx.copy_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadText(outputValue, getOutputFilename(outputType))}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('app.generation.nginx.download_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(csvOutput, 'nginx-audit.csv', 'text/csv;charset=utf-8')
                  }
                  className="w-full sm:w-auto"
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {t('app.generation.nginx.download_csv')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.nginx.parsed')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {parsed.serverBlocks.map((server, index) => (
                <div key={`${server.serverName}-${index}`} className="glass-panel rounded-2xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {server.serverName || t('app.generation.nginx.parsed.unnamed')}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {server.listen.join(', ') || '-'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs">
                      {server.locations} {t('app.generation.nginx.parsed.locations')}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--text-muted)]">
                    <p>
                      {t('app.generation.nginx.parsed.proxy')}:{' '}
                      {server.proxyPasses.join(', ') || '-'}
                    </p>
                    <p>
                      {t('app.generation.nginx.parsed.tls')}:{' '}
                      {server.hasSsl ? t('public.yes') : t('public.no')}
                    </p>
                    <p>
                      {t('app.generation.nginx.parsed.hsts')}:{' '}
                      {server.hasHsts ? t('public.yes') : t('public.no')}
                    </p>
                    <p>
                      {t('app.generation.nginx.parsed.compression')}:{' '}
                      {[server.hasGzip ? 'gzip' : '', server.hasBrotli ? 'brotli' : '']
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>
              ))}
              {parsed.serverBlocks.length === 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
                  <AlertTriangle className="h-4 w-4" />
                  {t('app.generation.nginx.empty')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.nginx.reference')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {['tls', 'proxy', 'compression', 'cache', 'limits'].map(item => (
                <div key={item} className="flex gap-3">
                  {item === 'compression' ? (
                    <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  ) : (
                    <Network className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {t(`app.generation.nginx.reference.${item}`)}
                    </p>
                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                      {t(`app.generation.nginx.reference.${item}_hint`)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
