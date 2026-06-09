'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  FileCode2,
  HardDrive,
  Package,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import YAML from 'yaml'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const
const APP_TYPES = ['next', 'vite', 'node', 'worker'] as const
const OUTPUT_TYPES = [
  'compose',
  'override',
  'env',
  'dockerfile',
  'dockerignore',
  'markdown',
  'json'
] as const
const WORKSPACE_LIMIT = 80000
const SERVICE_RENDER_LIMIT = 80

type PackageManager = (typeof PACKAGE_MANAGERS)[number]
type AppType = (typeof APP_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface ComposeDraft {
  appPort: string
  appServiceName: string
  appType: AppType
  buildCommand: string
  buildContext: string
  command: string
  containerPort: string
  dockerfileName: string
  envKeys: string
  healthcheckPath: string
  imageName: string
  includeHealthcheck: boolean
  includeMinio: boolean
  includePostgres: boolean
  includeRedis: boolean
  includeRestart: boolean
  includeWorker: boolean
  minioVersion: string
  networkName: string
  nodeVersion: string
  packageManager: PackageManager
  postgresVersion: string
  projectName: string
  publicBind: boolean
  redisVersion: string
  secretKeys: string
  useEnvFile: boolean
  useNamedNetwork: boolean
  useNamedVolumes: boolean
  volumePrefix: string
}

interface Preset {
  draft: ComposeDraft
  key: string
  workspace: string
}

interface ParsedService {
  envFile: boolean
  healthcheck: boolean
  image: string
  name: string
  ports: string[]
  privileged: boolean
  restart: string
  sensitivePlainKeys: string[]
  user: string
  volumes: string[]
}

interface ParsedCompose {
  capped: boolean
  errors: string[]
  networks: number
  services: ParsedService[]
  volumes: number
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: ComposeDraft = {
  appPort: '3000',
  appServiceName: 'web',
  appType: 'next',
  buildCommand: 'pnpm build',
  buildContext: '.',
  command: 'pnpm start',
  containerPort: '3000',
  dockerfileName: 'Dockerfile',
  envKeys: 'NODE_ENV\nNEXT_PUBLIC_SITE_URL',
  healthcheckPath: '/api/health',
  imageName: 'daily-tools-web',
  includeHealthcheck: true,
  includeMinio: false,
  includePostgres: true,
  includeRedis: true,
  includeRestart: true,
  includeWorker: false,
  minioVersion: 'RELEASE.2026-05-01T00-00-00Z',
  networkName: 'daily-tools-net',
  nodeVersion: '22',
  packageManager: 'pnpm',
  postgresVersion: '16-alpine',
  projectName: 'daily-tools',
  publicBind: false,
  redisVersion: '7-alpine',
  secretKeys: 'DATABASE_URL\nJWT_SECRET',
  useEnvFile: true,
  useNamedNetwork: true,
  useNamedVolumes: true,
  volumePrefix: 'daily-tools'
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `name: daily-tools
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: daily-tools-web:local
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_SITE_URL: \${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}
      DATABASE_URL: \${DATABASE_URL:?missing}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    networks:
      - daily-tools-net
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: daily_tools
      POSTGRES_USER: app
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?missing}
    volumes:
      - daily-tools-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d daily_tools"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - daily-tools-net
  redis:
    image: redis:7-alpine
    volumes:
      - daily-tools-redis:/data
    restart: unless-stopped
    networks:
      - daily-tools-net
networks:
  daily-tools-net:
volumes:
  daily-tools-postgres:
  daily-tools-redis:`
  },
  {
    key: 'node_api',
    draft: {
      ...DEFAULT_DRAFT,
      appServiceName: 'api',
      appType: 'node',
      command: 'pnpm start',
      envKeys: 'NODE_ENV\nLOG_LEVEL',
      imageName: 'daily-tools-api',
      includeRedis: true,
      secretKeys: 'DATABASE_URL\nREDIS_URL\nJWT_SECRET',
      projectName: 'daily-tools-api'
    },
    workspace: `name: api-stack
services:
  api:
    build: .
    image: daily-tools-api:local
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_URL:?missing}
      REDIS_URL: \${REDIS_URL:?missing}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
    restart: unless-stopped
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
volumes:
  postgres-data:`
  },
  {
    key: 'worker',
    draft: {
      ...DEFAULT_DRAFT,
      appServiceName: 'worker',
      appType: 'worker',
      appPort: '0',
      command: 'pnpm run worker',
      containerPort: '0',
      envKeys: 'NODE_ENV\nQUEUE_NAME',
      imageName: 'daily-tools-worker',
      includeHealthcheck: false,
      includePostgres: false,
      includeRedis: true,
      includeWorker: false,
      secretKeys: 'REDIS_URL\nWORKER_TOKEN',
      projectName: 'worker-stack'
    },
    workspace: `name: worker-stack
services:
  worker:
    build: .
    image: daily-tools-worker:local
    command: pnpm run worker
    env_file:
      - .env
    environment:
      NODE_ENV: production
      REDIS_URL: \${REDIS_URL:?missing}
    depends_on:
      - redis
    restart: unless-stopped
  redis:
    image: redis:7-alpine
    restart: unless-stopped`
  },
  {
    key: 'full_stack',
    draft: {
      ...DEFAULT_DRAFT,
      includeMinio: true,
      includeWorker: true,
      secretKeys: 'DATABASE_URL\nREDIS_URL\nJWT_SECRET\nMINIO_ROOT_PASSWORD\nS3_SECRET_ACCESS_KEY',
      volumePrefix: 'full-stack'
    },
    workspace: `name: full-stack
services:
  web:
    build: .
    image: full-stack-web:local
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
      - minio
  worker:
    image: full-stack-web:local
    command: pnpm run worker
    env_file:
      - .env
    depends_on:
      - redis
  postgres:
    image: postgres:16-alpine
    volumes:
      - full-stack-postgres:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio:RELEASE.2026-05-01T00-00-00Z
    command: server /data --console-address ":9001"
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER:-minio}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD:?missing}
    volumes:
      - full-stack-minio:/data
volumes:
  full-stack-postgres:
  full-stack-minio:`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      appPort: '3000',
      imageName: 'daily-tools:latest',
      includeHealthcheck: false,
      includeRestart: false,
      publicBind: true,
      secretKeys: '',
      useEnvFile: false,
      useNamedNetwork: false,
      useNamedVolumes: false
    },
    workspace: `version: "3.9"
services:
  web:
    image: daily-tools:latest
    privileged: true
    user: root
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://user:pass@example.com:5432/app
      JWT_SECRET: plain-secret
    volumes:
      - .:/app
  postgres:
    image: postgres:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: password`
  }
]

const REFERENCE_ITEMS = ['env', 'healthcheck', 'ports', 'volumes', 'profiles'] as const
const CHECKLIST_ITEMS = ['secrets', 'images', 'health', 'network'] as const

const splitList = (value: string) =>
  value
    .split(/[\n,]+/u)
    .map(item => item.trim())
    .filter(Boolean)

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const numberFromInput = (value: string, fallback = 0) => {
  const next = Number(value.replace(/[,_\s]+/gu, ''))
  return Number.isFinite(next) && next >= 0 ? next : fallback
}

const serviceSlug = (value: string, fallback = 'web') =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-|-$/gu, '') || fallback

const isSensitiveKey = (key: string) =>
  /(secret|token|key|password|passwd|private|credential|database|dsn)/iu.test(key)
const isVariableRef = (value: string) => /\$\{[A-Z0-9_]+(?::[-?][^}]*)?\}/u.test(value)
const imageUsesLatest = (image: string) => {
  const trimmed = image.trim()
  if (!trimmed) return false
  const lastPart = trimmed.split('/').at(-1) ?? trimmed
  return !lastPart.includes(':') || /:latest$/iu.test(trimmed)
}

const stringifyCompose = (value: unknown) =>
  YAML.stringify(value, {
    aliasDuplicateObjects: false,
    indent: 2,
    lineWidth: 110
  }).trim()

const envMapFromDraft = (draft: ComposeDraft) => {
  const env: Record<string, string> = {}
  splitList(draft.envKeys).forEach(key => {
    env[key] = key === 'NODE_ENV' ? 'production' : `\${${key}:-}`
  })
  splitList(draft.secretKeys).forEach(key => {
    env[key] = `\${${key}:?missing}`
  })

  if (draft.includePostgres && !env.DATABASE_URL) env.DATABASE_URL = '${DATABASE_URL:?missing}'
  if (draft.includeRedis && !env.REDIS_URL) env.REDIS_URL = '${REDIS_URL:?missing}'
  if (draft.includeMinio) {
    env.S3_ENDPOINT = '${S3_ENDPOINT:-http://minio:9000}'
    env.S3_ACCESS_KEY_ID = '${S3_ACCESS_KEY_ID:-minio}'
    env.S3_SECRET_ACCESS_KEY = '${S3_SECRET_ACCESS_KEY:?missing}'
  }

  return env
}

const buildHealthcheck = (port: number, path: string) => ({
  interval: '30s',
  retries: 3,
  test: ['CMD-SHELL', `wget -qO- http://localhost:${port}${path || '/health'} || exit 1`],
  timeout: '5s'
})

const addNetwork = (service: Record<string, unknown>, draft: ComposeDraft) => {
  if (draft.useNamedNetwork) service.networks = [serviceSlug(draft.networkName, 'app-net')]
}

const addRestart = (service: Record<string, unknown>, draft: ComposeDraft) => {
  if (draft.includeRestart) service.restart = 'unless-stopped'
}

const buildComposeObject = (draft: ComposeDraft) => {
  const appName = serviceSlug(draft.appServiceName, 'web')
  const containerPort = numberFromInput(draft.containerPort, 3000)
  const hostPort = numberFromInput(draft.appPort, containerPort)
  const bindHost = draft.publicBind ? '0.0.0.0' : '127.0.0.1'
  const services: Record<string, Record<string, unknown>> = {}
  const volumes: Record<string, null> = {}
  const appService: Record<string, unknown> = {
    build: {
      context: draft.buildContext || '.',
      dockerfile: draft.dockerfileName || 'Dockerfile'
    },
    command: draft.command || defaultStartCommand(draft),
    environment: envMapFromDraft(draft),
    image: `${draft.imageName || `${appName}-app`}:local`
  }

  if (hostPort > 0 && containerPort > 0) {
    appService.ports = [`${bindHost}:${hostPort}:${containerPort}`]
  }
  if (draft.useEnvFile) appService.env_file = ['.env']
  if (draft.includeHealthcheck && containerPort > 0)
    appService.healthcheck = buildHealthcheck(containerPort, draft.healthcheckPath)
  addRestart(appService, draft)
  addNetwork(appService, draft)

  const dependsOn: Record<string, { condition: string }> = {}
  if (draft.includePostgres) dependsOn.postgres = { condition: 'service_healthy' }
  if (draft.includeRedis) dependsOn.redis = { condition: 'service_started' }
  if (draft.includeMinio) dependsOn.minio = { condition: 'service_started' }
  if (Object.keys(dependsOn).length) appService.depends_on = dependsOn
  services[appName] = appService

  if (draft.includeWorker && draft.appType !== 'worker') {
    const workerService: Record<string, unknown> = {
      command: `${draft.packageManager} run worker`,
      environment: envMapFromDraft(draft),
      image: `${draft.imageName || `${appName}-app`}:local`
    }
    if (draft.useEnvFile) workerService.env_file = ['.env']
    addRestart(workerService, draft)
    addNetwork(workerService, draft)
    if (Object.keys(dependsOn).length) workerService.depends_on = Object.keys(dependsOn)
    services.worker = workerService
  }

  if (draft.includePostgres) {
    const volumeName = `${serviceSlug(draft.volumePrefix, 'app')}-postgres`
    const postgres: Record<string, unknown> = {
      environment: {
        POSTGRES_DB: serviceSlug(draft.projectName, 'app').replaceAll('-', '_'),
        POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:?missing}',
        POSTGRES_USER: 'app'
      },
      healthcheck: {
        interval: '10s',
        retries: 5,
        test: ['CMD-SHELL', 'pg_isready -U app'],
        timeout: '5s'
      },
      image: `postgres:${draft.postgresVersion || '16-alpine'}`
    }
    if (draft.useNamedVolumes) {
      postgres.volumes = [`${volumeName}:/var/lib/postgresql/data`]
      volumes[volumeName] = null
    }
    addRestart(postgres, draft)
    addNetwork(postgres, draft)
    services.postgres = postgres
  }

  if (draft.includeRedis) {
    const volumeName = `${serviceSlug(draft.volumePrefix, 'app')}-redis`
    const redis: Record<string, unknown> = {
      image: `redis:${draft.redisVersion || '7-alpine'}`
    }
    if (draft.useNamedVolumes) {
      redis.volumes = [`${volumeName}:/data`]
      volumes[volumeName] = null
    }
    addRestart(redis, draft)
    addNetwork(redis, draft)
    services.redis = redis
  }

  if (draft.includeMinio) {
    const volumeName = `${serviceSlug(draft.volumePrefix, 'app')}-minio`
    const minio: Record<string, unknown> = {
      command: 'server /data --console-address ":9001"',
      environment: {
        MINIO_ROOT_PASSWORD: '${MINIO_ROOT_PASSWORD:?missing}',
        MINIO_ROOT_USER: '${MINIO_ROOT_USER:-minio}'
      },
      image: `minio/minio:${draft.minioVersion || 'RELEASE.2026-05-01T00-00-00Z'}`,
      ports: [`${bindHost}:9000:9000`, `${bindHost}:9001:9001`]
    }
    if (draft.useNamedVolumes) {
      minio.volumes = [`${volumeName}:/data`]
      volumes[volumeName] = null
    }
    addRestart(minio, draft)
    addNetwork(minio, draft)
    services.minio = minio
  }

  const compose: Record<string, unknown> = {
    name: serviceSlug(draft.projectName, 'app'),
    services
  }
  if (draft.useNamedNetwork)
    compose.networks = { [serviceSlug(draft.networkName, 'app-net')]: null }
  if (Object.keys(volumes).length) compose.volumes = volumes
  return compose
}

const defaultStartCommand = (draft: ComposeDraft) => {
  if (draft.appType === 'vite') return `${draft.packageManager} run preview -- --host 0.0.0.0`
  if (draft.appType === 'worker') return `${draft.packageManager} run worker`
  return `${draft.packageManager} start`
}

const buildComposeYaml = (draft: ComposeDraft) => stringifyCompose(buildComposeObject(draft))

const buildOverride = (draft: ComposeDraft) => {
  const serviceName = serviceSlug(draft.appServiceName, 'web')
  const manager = draft.packageManager
  return stringifyCompose({
    services: {
      [serviceName]: {
        command: draft.appType === 'vite' ? `${manager} dev --host 0.0.0.0` : `${manager} dev`,
        environment: {
          NODE_ENV: 'development'
        },
        ports:
          numberFromInput(draft.containerPort, 3000) > 0
            ? [`127.0.0.1:${draft.appPort || '3000'}:${draft.containerPort || '3000'}`]
            : undefined,
        volumes: ['.:/app', '/app/node_modules']
      }
    }
  })
}

const buildEnvExample = (draft: ComposeDraft) => {
  const keys = unique([
    ...splitList(draft.envKeys),
    ...splitList(draft.secretKeys),
    ...(draft.includePostgres ? ['DATABASE_URL', 'POSTGRES_PASSWORD'] : []),
    ...(draft.includeRedis ? ['REDIS_URL'] : []),
    ...(draft.includeMinio
      ? [
          'MINIO_ROOT_USER',
          'MINIO_ROOT_PASSWORD',
          'S3_ENDPOINT',
          'S3_ACCESS_KEY_ID',
          'S3_SECRET_ACCESS_KEY'
        ]
      : [])
  ])

  return keys
    .map(key => {
      if (key === 'NODE_ENV') return 'NODE_ENV=production'
      if (key === 'NEXT_PUBLIC_SITE_URL') return 'NEXT_PUBLIC_SITE_URL=http://localhost:3000'
      if (key === 'DATABASE_URL') return 'DATABASE_URL=postgres://app:change-me@postgres:5432/app'
      if (key === 'REDIS_URL') return 'REDIS_URL=redis://redis:6379'
      if (key === 'S3_ENDPOINT') return 'S3_ENDPOINT=http://minio:9000'
      if (key === 'MINIO_ROOT_USER') return 'MINIO_ROOT_USER=minio'
      return `${key}=`
    })
    .join('\n')
}

const packageInstallCommand = (manager: PackageManager) => {
  if (manager === 'npm') return 'npm ci'
  if (manager === 'yarn') return 'yarn install --frozen-lockfile'
  if (manager === 'bun') return 'bun install --frozen-lockfile'
  return 'pnpm install --frozen-lockfile'
}

const buildDockerfile = (draft: ComposeDraft) => {
  const manager = draft.packageManager
  const install = packageInstallCommand(manager)
  const build = draft.buildCommand || `${manager} build`
  const command = draft.command || defaultStartCommand(draft)
  return [
    `FROM node:${draft.nodeVersion || '22'}-alpine AS deps`,
    'WORKDIR /app',
    manager === 'pnpm' || manager === 'yarn' ? 'RUN corepack enable' : '',
    'COPY package.json pnpm-lock.yaml package-lock.json yarn.lock bun.lockb* ./',
    `RUN ${install}`,
    '',
    `FROM node:${draft.nodeVersion || '22'}-alpine AS builder`,
    'WORKDIR /app',
    'COPY --from=deps /app/node_modules ./node_modules',
    'COPY . .',
    build ? `RUN ${build}` : '',
    '',
    `FROM node:${draft.nodeVersion || '22'}-alpine AS runner`,
    'WORKDIR /app',
    'ENV NODE_ENV=production',
    'COPY --from=builder /app .',
    numberFromInput(draft.containerPort, 3000) > 0 ? `EXPOSE ${draft.containerPort || '3000'}` : '',
    `CMD ${JSON.stringify(command.split(/\s+/u))}`
  ]
    .filter(Boolean)
    .join('\n')
}

const buildDockerignore = () =>
  [
    '.git',
    '.next',
    'node_modules',
    'coverage',
    'dist',
    '.env',
    '.env.*',
    '!.env.example',
    'Dockerfile*',
    'docker-compose*.yml',
    'npm-debug.log*',
    'pnpm-debug.log*',
    'yarn-error.log*'
  ].join('\n')

const parseEnvironmentKeys = (environment: unknown) => {
  if (Array.isArray(environment)) {
    return environment
      .map(item => String(item))
      .map(item => {
        const [key, ...rest] = item.split('=')
        return { key: key.trim(), value: rest.join('=').trim() }
      })
      .filter(item => item.key)
  }
  if (environment && typeof environment === 'object') {
    return Object.entries(environment as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value ?? '')
    }))
  }
  return []
}

const parsePorts = (ports: unknown) =>
  Array.isArray(ports)
    ? ports.map(port => (typeof port === 'string' ? port : JSON.stringify(port))).filter(Boolean)
    : []

const parseVolumes = (volumes: unknown) =>
  Array.isArray(volumes)
    ? volumes
        .map(volume => (typeof volume === 'string' ? volume : JSON.stringify(volume)))
        .filter(Boolean)
    : []

const serviceFromEntry = ([name, value]: [string, unknown]): ParsedService => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const envEntries = parseEnvironmentKeys(record.environment)
  return {
    envFile: Boolean(record.env_file),
    healthcheck: Boolean(record.healthcheck),
    image: typeof record.image === 'string' ? record.image : record.build ? 'build' : '',
    name,
    ports: parsePorts(record.ports),
    privileged: record.privileged === true,
    restart: typeof record.restart === 'string' ? record.restart : '',
    sensitivePlainKeys: envEntries
      .filter(item => isSensitiveKey(item.key) && item.value && !isVariableRef(item.value))
      .map(item => item.key),
    user:
      typeof record.user === 'string' || typeof record.user === 'number' ? String(record.user) : '',
    volumes: parseVolumes(record.volumes)
  }
}

const parseCompose = (input: string): ParsedCompose => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const errors: string[] = []
  try {
    const value = YAML.parse(source) as unknown
    if (!value || typeof value !== 'object') {
      return {
        capped: input.length > WORKSPACE_LIMIT,
        errors: ['empty'],
        networks: 0,
        services: [],
        volumes: 0
      }
    }
    const root = value as Record<string, unknown>
    const services =
      root.services && typeof root.services === 'object'
        ? Object.entries(root.services as Record<string, unknown>)
            .slice(0, SERVICE_RENDER_LIMIT)
            .map(serviceFromEntry)
        : []
    const networks =
      root.networks && typeof root.networks === 'object' ? Object.keys(root.networks).length : 0
    const volumes =
      root.volumes && typeof root.volumes === 'object' ? Object.keys(root.volumes).length : 0
    return {
      capped: input.length > WORKSPACE_LIMIT,
      errors,
      networks,
      services,
      volumes
    }
  } catch {
    return {
      capped: input.length > WORKSPACE_LIMIT,
      errors: ['invalid_yaml'],
      networks: 0,
      services: [],
      volumes: 0
    }
  }
}

const broadPort = (port: string) => /^"?\d+:\d+|^"?0\.0\.0\.0:/u.test(port)
const rootUser = (user: string) => user === 'root' || user === '0' || /^0:/u.test(user)

const auditCompose = (draft: ComposeDraft, parsed: ParsedCompose): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const appPort = numberFromInput(draft.appPort, 0)
  const containerPort = numberFromInput(draft.containerPort, 0)
  const secretKeys = splitList(draft.secretKeys)
  const envKeys = splitList(draft.envKeys)
  const sensitiveEnvKeys = envKeys.filter(isSensitiveKey)

  if (!draft.projectName.trim()) add('danger', 'project_missing', 'name')
  if (!draft.appServiceName.trim()) add('danger', 'service_missing', 'service')
  if (!draft.imageName.trim()) add('warn', 'image_missing', 'image')
  if (appPort > 0 && containerPort <= 0) add('warn', 'container_port_missing', `${appPort}`)
  if (draft.publicBind && appPort > 0) add('warn', 'public_bind', `${appPort}`)
  if (!draft.useEnvFile && (secretKeys.length || sensitiveEnvKeys.length))
    add('warn', 'env_file_missing', '.env')
  if (sensitiveEnvKeys.length) add('danger', 'sensitive_env_plain', sensitiveEnvKeys.join(', '))
  if (draft.includePostgres && !secretKeys.includes('DATABASE_URL'))
    add('warn', 'database_secret_missing', 'DATABASE_URL')
  if (draft.includeRedis && !secretKeys.includes('REDIS_URL'))
    add('warn', 'redis_secret_missing', 'REDIS_URL')
  if (draft.includeMinio && !secretKeys.some(key => /S3_SECRET|MINIO_ROOT_PASSWORD/iu.test(key)))
    add('warn', 'storage_secret_missing', 'MinIO')
  if (!draft.includeHealthcheck && draft.appType !== 'worker')
    add('warn', 'healthcheck_missing', draft.appServiceName)
  if (!draft.includeRestart) add('warn', 'restart_missing', 'restart')
  if (!draft.useNamedNetwork) add('warn', 'network_missing', 'network')
  if (!draft.useNamedVolumes && (draft.includePostgres || draft.includeRedis || draft.includeMinio))
    add('warn', 'named_volume_missing', 'volumes')
  if (imageUsesLatest(draft.imageName)) add('warn', 'image_latest', draft.imageName)

  if (parsed.capped) add('warn', 'workspace_capped', `${WORKSPACE_LIMIT}`)
  parsed.errors.forEach(error =>
    add(error === 'invalid_yaml' ? 'danger' : 'warn', error, 'workspace')
  )
  if (!parsed.services.length && !parsed.errors.length) add('warn', 'parser_empty', 'workspace')
  parsed.services.forEach(service => {
    if (imageUsesLatest(service.image)) add('warn', 'parsed_latest', service.image || service.name)
    if (service.ports.some(broadPort))
      add('warn', 'parsed_public_port', `${service.name}: ${service.ports.join(', ')}`)
    if (service.privileged) add('danger', 'parsed_privileged', service.name)
    if (rootUser(service.user)) add('danger', 'parsed_root_user', service.name)
    if (service.sensitivePlainKeys.length)
      add(
        'danger',
        'parsed_plain_secret',
        `${service.name}: ${service.sensitivePlainKeys.join(', ')}`
      )
    if (!service.healthcheck && !/redis|worker/iu.test(service.name))
      add('warn', 'parsed_no_healthcheck', service.name)
    if (!service.restart) add('warn', 'parsed_no_restart', service.name)
    if (service.volumes.some(volume => /^\.:|^\.\/:/u.test(volume)))
      add('warn', 'parsed_bind_mount', `${service.name}: ${service.volumes.join(', ')}`)
    if (!service.envFile && service.sensitivePlainKeys.length)
      add('warn', 'parsed_no_env_file', service.name)
  })

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.projectName)
    add('good', 'healthcheck_ok', draft.appServiceName)
    add('good', 'secrets_ok', secretKeys.length ? `${secretKeys.length}` : '0')
  }

  return findings
}

const buildMarkdown = (draft: ComposeDraft, parsed: ParsedCompose, findings: Finding[]) =>
  [
    `# Docker Compose stack: ${draft.projectName || 'app'}`,
    '',
    `- App service: ${draft.appServiceName}`,
    `- Package manager: ${draft.packageManager}`,
    `- Services: ${parsed.services.length || Object.keys((buildComposeObject(draft).services as Record<string, unknown>) ?? {}).length}`,
    `- Env file: ${draft.useEnvFile ? '.env' : 'inline only'}`,
    `- Secrets: ${splitList(draft.secretKeys).join(', ') || 'none'}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 30)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`)
  ].join('\n')

const buildOutput = (
  draft: ComposeDraft,
  parsed: ParsedCompose,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'compose') return buildComposeYaml(draft)
  if (outputType === 'override') return buildOverride(draft)
  if (outputType === 'env') return buildEnvExample(draft)
  if (outputType === 'dockerfile') return buildDockerfile(draft)
  if (outputType === 'dockerignore') return buildDockerignore()
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  return JSON.stringify({ draft, parsed, findings, compose: buildComposeObject(draft) }, null, 2)
}

const getOutputFilename = (draft: ComposeDraft, outputType: OutputType) => {
  if (outputType === 'compose') return 'docker-compose.yml'
  if (outputType === 'override') return 'docker-compose.override.yml'
  if (outputType === 'env') return '.env.example'
  if (outputType === 'dockerfile') return draft.dockerfileName || 'Dockerfile'
  if (outputType === 'dockerignore') return '.dockerignore'
  if (outputType === 'json') return 'docker-compose-summary.json'
  return 'docker-compose-plan.md'
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-400/35 bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'warn')
    return 'border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
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

export default function DockerComposeClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<ComposeDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('compose')
  const [auditQuery, setAuditQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)

  const parsed = useMemo(() => parseCompose(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditCompose(draft, parsed), [draft, parsed])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(
    () =>
      [
        ['project', 'services', 'volumes', 'networks', 'warnings', 'critical']
          .map(escapeCsv)
          .join(','),
        [
          draft.projectName,
          parsed.services.length,
          parsed.volumes,
          parsed.networks,
          findings.filter(item => item.level === 'warn').length,
          findings.filter(item => item.level === 'danger').length
        ]
          .map(escapeCsv)
          .join(',')
      ].join('\n'),
    [draft.projectName, findings, parsed.networks, parsed.services.length, parsed.volumes]
  )
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.docker_compose.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      networks: parsed.networks,
      services:
        parsed.services.length ||
        Object.keys((buildComposeObject(draft).services as Record<string, unknown>) ?? {}).length,
      status: findings.some(item => item.level === 'danger')
        ? t('app.generation.docker_compose.status.risk')
        : findings.some(item => item.level === 'warn')
          ? t('app.generation.docker_compose.status.review')
          : t('app.generation.docker_compose.status.ready'),
      volumes: parsed.volumes,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft, findings, parsed.networks, parsed.services.length, parsed.volumes, t]
  )

  const updateDraft = <Key extends keyof ComposeDraft>(key: Key, value: ComposeDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('compose')
    setAuditQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.generation.docker_compose.summary_title'),
        `${t('app.generation.docker_compose.metric.status')}: ${metrics.status}`,
        `${t('app.generation.docker_compose.metric.services')}: ${metrics.services}`,
        `${t('app.generation.docker_compose.metric.volumes')}: ${metrics.volumes}`,
        `${t('app.generation.docker_compose.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.docker_compose.metric.critical')}: ${metrics.critical}`
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
                <Package className="h-4 w-4" />
                {t('app.generation.docker-compose')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.generation.docker-compose')}</CardTitle>
              <CardDescription>{t('app.generation.docker_compose.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.generation.docker_compose.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.generation.docker_compose.metric.status')}
              value={metrics.status}
            />
            <Metric
              label={t('app.generation.docker_compose.metric.services')}
              value={metrics.services}
            />
            <Metric
              label={t('app.generation.docker_compose.metric.volumes')}
              value={metrics.volumes}
            />
            <Metric
              label={t('app.generation.docker_compose.metric.networks')}
              value={metrics.networks}
            />
            <Metric
              label={t('app.generation.docker_compose.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.generation.docker_compose.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">
              {t('app.generation.docker_compose.presets')}
            </CardTitle>
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
                {t(`app.generation.docker_compose.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.generation.docker_compose.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.96fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.docker_compose.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.docker_compose.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="compose-project">
                  {t('app.generation.docker_compose.project_name')}
                </Label>
                <Input
                  id="compose-project"
                  value={draft.projectName}
                  onChange={event => updateDraft('projectName', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-service">
                  {t('app.generation.docker_compose.app_service')}
                </Label>
                <Input
                  id="compose-service"
                  value={draft.appServiceName}
                  onChange={event => updateDraft('appServiceName', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-app-type">
                  {t('app.generation.docker_compose.app_type')}
                </Label>
                <Select
                  id="compose-app-type"
                  value={draft.appType}
                  onChange={event => updateDraft('appType', event.target.value as AppType)}
                >
                  {APP_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.docker_compose.app_type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-package">
                  {t('app.generation.docker_compose.package_manager')}
                </Label>
                <Select
                  id="compose-package"
                  value={draft.packageManager}
                  onChange={event =>
                    updateDraft('packageManager', event.target.value as PackageManager)
                  }
                >
                  {PACKAGE_MANAGERS.map(manager => (
                    <option key={manager} value={manager}>
                      {t(`app.generation.docker_compose.package.${manager}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-image">
                  {t('app.generation.docker_compose.image_name')}
                </Label>
                <Input
                  id="compose-image"
                  value={draft.imageName}
                  onChange={event => updateDraft('imageName', event.target.value.slice(0, 140))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-node">
                  {t('app.generation.docker_compose.node_version')}
                </Label>
                <Input
                  id="compose-node"
                  value={draft.nodeVersion}
                  onChange={event => updateDraft('nodeVersion', event.target.value.slice(0, 16))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-context">
                  {t('app.generation.docker_compose.build_context')}
                </Label>
                <Input
                  id="compose-context"
                  value={draft.buildContext}
                  onChange={event => updateDraft('buildContext', event.target.value.slice(0, 160))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-dockerfile">
                  {t('app.generation.docker_compose.dockerfile')}
                </Label>
                <Input
                  id="compose-dockerfile"
                  value={draft.dockerfileName}
                  onChange={event => updateDraft('dockerfileName', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-host-port">
                  {t('app.generation.docker_compose.host_port')}
                </Label>
                <Input
                  id="compose-host-port"
                  value={draft.appPort}
                  onChange={event => updateDraft('appPort', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-container-port">
                  {t('app.generation.docker_compose.container_port')}
                </Label>
                <Input
                  id="compose-container-port"
                  value={draft.containerPort}
                  onChange={event => updateDraft('containerPort', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-command">
                  {t('app.generation.docker_compose.command')}
                </Label>
                <Input
                  id="compose-command"
                  value={draft.command}
                  onChange={event => updateDraft('command', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-build-command">
                  {t('app.generation.docker_compose.build_command')}
                </Label>
                <Input
                  id="compose-build-command"
                  value={draft.buildCommand}
                  onChange={event => updateDraft('buildCommand', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-network">
                  {t('app.generation.docker_compose.network_name')}
                </Label>
                <Input
                  id="compose-network"
                  value={draft.networkName}
                  onChange={event => updateDraft('networkName', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-volume">
                  {t('app.generation.docker_compose.volume_prefix')}
                </Label>
                <Input
                  id="compose-volume"
                  value={draft.volumePrefix}
                  onChange={event => updateDraft('volumePrefix', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-health">
                  {t('app.generation.docker_compose.healthcheck_path')}
                </Label>
                <Input
                  id="compose-health"
                  value={draft.healthcheckPath}
                  onChange={event =>
                    updateDraft('healthcheckPath', event.target.value.slice(0, 120))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-postgres-version">
                  {t('app.generation.docker_compose.postgres_version')}
                </Label>
                <Input
                  id="compose-postgres-version"
                  value={draft.postgresVersion}
                  onChange={event =>
                    updateDraft('postgresVersion', event.target.value.slice(0, 40))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-redis-version">
                  {t('app.generation.docker_compose.redis_version')}
                </Label>
                <Input
                  id="compose-redis-version"
                  value={draft.redisVersion}
                  onChange={event => updateDraft('redisVersion', event.target.value.slice(0, 40))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-minio-version">
                  {t('app.generation.docker_compose.minio_version')}
                </Label>
                <Input
                  id="compose-minio-version"
                  value={draft.minioVersion}
                  onChange={event => updateDraft('minioVersion', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-env">{t('app.generation.docker_compose.env_keys')}</Label>
                <Textarea
                  id="compose-env"
                  value={draft.envKeys}
                  onChange={event => updateDraft('envKeys', event.target.value.slice(0, 1600))}
                  className="min-h-[130px] font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compose-secrets">
                  {t('app.generation.docker_compose.secret_keys')}
                </Label>
                <Textarea
                  id="compose-secrets"
                  value={draft.secretKeys}
                  onChange={event => updateDraft('secretKeys', event.target.value.slice(0, 1600))}
                  className="min-h-[130px] font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Checkbox
                checked={draft.useEnvFile}
                onChange={event => updateDraft('useEnvFile', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.use_env_file')}
              />
              <Checkbox
                checked={draft.publicBind}
                onChange={event => updateDraft('publicBind', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.public_bind')}
              />
              <Checkbox
                checked={draft.includeHealthcheck}
                onChange={event => updateDraft('includeHealthcheck', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_healthcheck')}
              />
              <Checkbox
                checked={draft.includeRestart}
                onChange={event => updateDraft('includeRestart', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_restart')}
              />
              <Checkbox
                checked={draft.useNamedNetwork}
                onChange={event => updateDraft('useNamedNetwork', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.use_named_network')}
              />
              <Checkbox
                checked={draft.useNamedVolumes}
                onChange={event => updateDraft('useNamedVolumes', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.use_named_volumes')}
              />
              <Checkbox
                checked={draft.includePostgres}
                onChange={event => updateDraft('includePostgres', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_postgres')}
              />
              <Checkbox
                checked={draft.includeRedis}
                onChange={event => updateDraft('includeRedis', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_redis')}
              />
              <Checkbox
                checked={draft.includeMinio}
                onChange={event => updateDraft('includeMinio', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_minio')}
              />
              <Checkbox
                checked={draft.includeWorker}
                onChange={event => updateDraft('includeWorker', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.docker_compose.include_worker')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.docker_compose.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.docker_compose.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.generation.docker_compose.workspace_placeholder')}
              className="min-h-[740px] font-mono"
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
                onClick={() => setWorkspace(output)}
                className="w-full sm:w-auto"
              >
                <FileCode2 className="h-4 w-4" />
                {t('app.generation.docker_compose.use_output')}
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
              <CardTitle className="text-base">
                {t('app.generation.docker_compose.audit')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.docker_compose.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.generation.docker_compose.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 80).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.generation.docker_compose.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.generation.docker_compose.level.${finding.level}`)}
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
                  {t('app.generation.docker_compose.output')}
                </CardTitle>
                <CardDescription>{t('app.generation.docker_compose.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="compose-output">
                  {t('app.generation.docker_compose.output_type')}
                </Label>
                <Select
                  id="compose-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.docker_compose.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[430px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.generation.docker_compose.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    output,
                    getOutputFilename(draft, outputType),
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.generation.docker_compose.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'docker-compose-audit.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.generation.docker_compose.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.docker_compose.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {parsed.services.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {parsed.services.slice(0, SERVICE_RENDER_LIMIT).map(service => (
                  <div key={service.name} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {service.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(service.sensitivePlainKeys.length || service.privileged || rootUser(service.user) ? 'danger' : service.healthcheck ? 'good' : 'warn')}`}
                      >
                        {service.healthcheck
                          ? t('app.generation.docker_compose.parsed.health')
                          : t('app.generation.docker_compose.parsed.no_health')}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {service.image || 'build'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                      {t('app.generation.docker_compose.parsed.ports')}:{' '}
                      {service.ports.join(', ') || '-'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      {t('app.generation.docker_compose.parsed.secrets')}:{' '}
                      {service.sensitivePlainKeys.join(', ') || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.generation.docker_compose.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.generation.docker_compose.reference')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.docker_compose.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.generation.docker_compose.reference.${item}_hint`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.generation.docker_compose.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.docker_compose.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.generation.docker_compose.checklist.${item}.body`)}
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
