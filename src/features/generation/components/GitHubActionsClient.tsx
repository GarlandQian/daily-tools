'use client'

import {
  AlertTriangle,
  BadgeCheck,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  GitBranch,
  Github,
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

const TRIGGERS = ['push_pull', 'deploy', 'schedule', 'manual'] as const
const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const
const DEPLOY_TARGETS = ['none', 'vercel', 'cloudflare', 'docker', 'pages'] as const
const PERMISSION_PROFILES = ['read', 'deploy', 'pages', 'write_all'] as const
const OUTPUT_TYPES = ['workflow', 'matrix', 'secrets', 'badge', 'markdown', 'json'] as const
const WORKSPACE_LIMIT = 70000
const PARSED_LIST_LIMIT = 120
const SECRET_REF_PATTERN = new RegExp('\\$\\{\\{\\s*secrets\\.([A-Z0-9_]+)\\s*\\}\\}', 'giu')
const PLAIN_SENSITIVE_ENV_PATTERN = new RegExp(
  '^\\s*([A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PRIVATE|CREDENTIAL|DATABASE)[A-Z0-9_]*)\\s*:\\s*(?!\\$\\{\\{\\s*secrets\\.)',
  'iu'
)

type Trigger = (typeof TRIGGERS)[number]
type PackageManager = (typeof PACKAGE_MANAGERS)[number]
type DeployTarget = (typeof DEPLOY_TARGETS)[number]
type PermissionProfile = (typeof PERMISSION_PROFILES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface WorkflowDraft {
  artifactPath: string
  branch: string
  buildCommand: string
  cacheDependencies: boolean
  concurrency: boolean
  deployTarget: DeployTarget
  envKeys: string
  failFast: boolean
  installCommand: string
  matrix: boolean
  nodeVersions: string
  osMatrix: string
  packageManager: PackageManager
  permissionProfile: PermissionProfile
  repo: string
  schedule: string
  secretKeys: string
  testCommand: string
  timeoutMinutes: string
  timezone: string
  trigger: Trigger
  uploadArtifact: boolean
  useCorepack: boolean
  verifyLockfile: boolean
  workflowName: string
}

interface Preset {
  draft: WorkflowDraft
  key: string
  workspace: string
}

interface ParsedWorkflow {
  cacheDetected: boolean
  capped: boolean
  deployDetected: boolean
  hasCheckout: boolean
  hasSetupNode: boolean
  jobs: number
  nodeVersions: string[]
  packageManagers: PackageManager[]
  permissions: string
  plainSensitiveEnv: string[]
  scheduleCount: number
  secretRefs: string[]
  triggers: string[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: WorkflowDraft = {
  artifactPath: 'dist',
  branch: 'main',
  buildCommand: 'pnpm build',
  cacheDependencies: true,
  concurrency: true,
  deployTarget: 'none',
  envKeys: 'NEXT_PUBLIC_SITE_URL\nNODE_ENV',
  failFast: false,
  installCommand: 'pnpm install --frozen-lockfile',
  matrix: true,
  nodeVersions: '20.x\n22.x',
  osMatrix: 'ubuntu-latest',
  packageManager: 'pnpm',
  permissionProfile: 'read',
  repo: 'garland/daily-tools',
  schedule: '0 2 * * 1',
  secretKeys: '',
  testCommand: 'pnpm test',
  timeoutMinutes: '20',
  timezone: 'UTC',
  trigger: 'push_pull',
  uploadArtifact: false,
  useCorepack: true,
  verifyLockfile: true,
  workflowName: 'CI'
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build`
  },
  {
    key: 'vite',
    draft: {
      ...DEFAULT_DRAFT,
      artifactPath: 'dist',
      envKeys: 'VITE_API_BASE_URL\nVITE_APP_NAME',
      nodeVersions: '20.x',
      testCommand: 'pnpm test -- --run',
      uploadArtifact: true,
      workflowName: 'Vite preview'
    },
    workspace: `name: Vite preview
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: vite-dist
          path: dist`
  },
  {
    key: 'node_api',
    draft: {
      ...DEFAULT_DRAFT,
      buildCommand: 'pnpm build',
      envKeys: 'NODE_ENV\nLOG_LEVEL',
      nodeVersions: '20.x\n22.x',
      secretKeys: 'DATABASE_URL\nJWT_SECRET',
      testCommand: 'pnpm test',
      workflowName: 'API checks'
    },
    workspace: `name: API checks
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  api:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: \${{ secrets.DATABASE_URL }}
      JWT_SECRET: \${{ secrets.JWT_SECRET }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm test`
  },
  {
    key: 'deploy',
    draft: {
      ...DEFAULT_DRAFT,
      deployTarget: 'vercel',
      permissionProfile: 'deploy',
      secretKeys: 'VERCEL_TOKEN\nVERCEL_ORG_ID\nVERCEL_PROJECT_ID',
      trigger: 'deploy',
      workflowName: 'Deploy web'
    },
    workspace: `name: Deploy web
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  deployments: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm dlx vercel deploy --prod --yes --token "$VERCEL_TOKEN"
        env:
          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}`
  },
  {
    key: 'schedule',
    draft: {
      ...DEFAULT_DRAFT,
      buildCommand: '',
      matrix: false,
      nodeVersions: '22.x',
      schedule: '15 3 * * *',
      secretKeys: 'CRON_SECRET',
      testCommand: 'pnpm run job:daily',
      trigger: 'schedule',
      workflowName: 'Scheduled maintenance'
    },
    workspace: `name: Scheduled maintenance
on:
  schedule:
    - cron: '15 3 * * *'
  workflow_dispatch:
permissions:
  contents: read
jobs:
  daily:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: pnpm
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm run job:daily
        env:
          CRON_SECRET: \${{ secrets.CRON_SECRET }}`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      cacheDependencies: false,
      deployTarget: 'docker',
      envKeys: 'NODE_ENV\nAPI_TOKEN\nDATABASE_URL',
      matrix: false,
      nodeVersions: '18.x',
      permissionProfile: 'write_all',
      secretKeys: '',
      timeoutMinutes: '90',
      trigger: 'deploy',
      useCorepack: false,
      verifyLockfile: false,
      workflowName: 'Risk sample'
    },
    workspace: `name: Risk sample
on: [push]
permissions: write-all
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      API_TOKEN: plain-token
      DATABASE_URL: postgres://user:pass@example.com/app
    steps:
      - run: npm install
      - run: npm test
      - run: docker build -t app .`
  }
]

const REFERENCE_ITEMS = ['permissions', 'cache', 'matrix', 'secrets', 'schedule'] as const
const CHECKLIST_ITEMS = ['permissions', 'cache', 'secrets', 'deploy'] as const

const splitList = (value: string) =>
  value
    .split(/[\n,]+/u)
    .map(item => item.trim())
    .filter(Boolean)

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
const escapeYaml = (value: string) => JSON.stringify(value.trim() || '')
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const numberFromInput = (value: string, fallback = 0) => {
  const next = Number(value.replace(/[,_\s]+/gu, ''))
  return Number.isFinite(next) && next >= 0 ? next : fallback
}

const workflowFileName = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')

  return `${slug || 'ci'}.yml`
}

const defaultDeploySecrets = (target: DeployTarget) => {
  if (target === 'vercel') return ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']
  if (target === 'cloudflare') return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
  if (target === 'docker') return ['REGISTRY_USERNAME', 'REGISTRY_TOKEN']
  if (target === 'pages') return []
  return []
}

const getAllSecrets = (draft: WorkflowDraft) =>
  unique([...splitList(draft.secretKeys), ...defaultDeploySecrets(draft.deployTarget)])
const getPlainEnvKeys = (draft: WorkflowDraft) => unique(splitList(draft.envKeys))
const isSensitiveKey = (value: string) =>
  /(secret|token|key|password|passwd|private|credential|database|dsn)/iu.test(value)

const packageLockfile = (manager: PackageManager) => {
  if (manager === 'pnpm') return 'pnpm-lock.yaml'
  if (manager === 'yarn') return 'yarn.lock'
  if (manager === 'bun') return 'bun.lockb'
  return 'package-lock.json'
}

const packageCacheName = (manager: PackageManager) => (manager === 'bun' ? 'bun' : manager)

const buildTriggerLines = (draft: WorkflowDraft) => {
  const branch = escapeYaml(draft.branch || 'main')
  if (draft.trigger === 'manual') {
    return ['on:', '  workflow_dispatch:']
  }
  if (draft.trigger === 'schedule') {
    return [
      'on:',
      '  schedule:',
      `    - cron: ${escapeYaml(draft.schedule || '0 2 * * 1')}`,
      '  workflow_dispatch:'
    ]
  }
  if (draft.trigger === 'deploy') {
    return ['on:', '  push:', `    branches: [${branch}]`, '  workflow_dispatch:']
  }
  return [
    'on:',
    '  push:',
    `    branches: [${branch}]`,
    '  pull_request:',
    `    branches: [${branch}]`
  ]
}

const buildPermissionLines = (profile: PermissionProfile) => {
  if (profile === 'write_all') return ['permissions: write-all']
  if (profile === 'deploy') return ['permissions:', '  contents: read', '  deployments: write']
  if (profile === 'pages')
    return ['permissions:', '  contents: read', '  pages: write', '  id-token: write']
  return ['permissions:', '  contents: read']
}

const buildJobEnvLines = (draft: WorkflowDraft) => {
  const envKeys = getPlainEnvKeys(draft)
  const secretKeys = getAllSecrets(draft)
  if (!envKeys.length && !secretKeys.length) return []

  return [
    '    env:',
    ...envKeys.map(key => `      ${key}: \${{ vars.${key} }}`),
    ...secretKeys.map(key => `      ${key}: \${{ secrets.${key} }}`)
  ]
}

const buildDeployLines = (draft: WorkflowDraft) => {
  if (draft.deployTarget === 'none') return []
  if (draft.deployTarget === 'vercel') {
    return [
      '      - name: Deploy to Vercel',
      `        if: github.ref == 'refs/heads/${draft.branch || 'main'}'`,
      '        run: pnpm dlx vercel deploy --prod --yes --token "$VERCEL_TOKEN"'
    ]
  }
  if (draft.deployTarget === 'cloudflare') {
    return [
      '      - name: Deploy to Cloudflare',
      `        if: github.ref == 'refs/heads/${draft.branch || 'main'}'`,
      '        run: pnpm dlx wrangler deploy'
    ]
  }
  if (draft.deployTarget === 'docker') {
    return [
      '      - uses: docker/login-action@v3',
      '        with:',
      '          username: ${{ secrets.REGISTRY_USERNAME }}',
      '          password: ${{ secrets.REGISTRY_TOKEN }}',
      '      - uses: docker/build-push-action@v6',
      '        with:',
      '          context: .',
      `          push: \${{ github.ref == 'refs/heads/${draft.branch || 'main'}' }}`,
      '          tags: ghcr.io/${{ github.repository }}:latest'
    ]
  }

  return [
    '      - uses: actions/configure-pages@v5',
    '      - uses: actions/upload-pages-artifact@v3',
    '        with:',
    `          path: ${escapeYaml(draft.artifactPath || 'dist')}`,
    '      - uses: actions/deploy-pages@v4'
  ]
}

const buildWorkflow = (draft: WorkflowDraft) => {
  const nodeVersions = splitList(draft.nodeVersions)
  const osMatrix = splitList(draft.osMatrix)
  const primaryNode = nodeVersions[0] || '22.x'
  const primaryOs = osMatrix[0] || 'ubuntu-latest'
  const useMatrix = draft.matrix && (nodeVersions.length > 1 || osMatrix.length > 1)
  const timeout = Math.min(Math.max(numberFromInput(draft.timeoutMinutes, 20), 1), 360)
  const lines = [
    `name: ${escapeYaml(draft.workflowName || 'CI')}`,
    '',
    ...buildTriggerLines(draft),
    '',
    ...buildPermissionLines(draft.deployTarget === 'pages' ? 'pages' : draft.permissionProfile),
    '',
    ...(draft.concurrency
      ? [
          'concurrency:',
          '  group: ${{ github.workflow }}-${{ github.ref }}',
          '  cancel-in-progress: true',
          ''
        ]
      : []),
    'jobs:',
    '  build:',
    `    runs-on: ${useMatrix ? '${{ matrix.os }}' : primaryOs}`,
    `    timeout-minutes: ${timeout}`,
    ...(useMatrix
      ? [
          '    strategy:',
          `      fail-fast: ${draft.failFast ? 'true' : 'false'}`,
          '      matrix:',
          `        os: [${osMatrix.map(escapeYaml).join(', ')}]`,
          `        node-version: [${nodeVersions.map(escapeYaml).join(', ')}]`
        ]
      : []),
    ...buildJobEnvLines(draft),
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    `          node-version: ${useMatrix ? '${{ matrix.node-version }}' : escapeYaml(primaryNode)}`,
    ...(draft.cacheDependencies
      ? [
          `          cache: ${packageCacheName(draft.packageManager)}`,
          `          cache-dependency-path: ${packageLockfile(draft.packageManager)}`
        ]
      : []),
    ...(draft.useCorepack && draft.packageManager !== 'npm'
      ? ['      - run: corepack enable']
      : []),
    `      - run: ${draft.installCommand || `${draft.packageManager} install`}`,
    ...(draft.verifyLockfile && draft.packageManager === 'npm'
      ? ['      - run: npm ci --dry-run']
      : []),
    ...(draft.testCommand.trim() ? [`      - run: ${draft.testCommand.trim()}`] : []),
    ...(draft.buildCommand.trim() ? [`      - run: ${draft.buildCommand.trim()}`] : []),
    ...(draft.uploadArtifact
      ? [
          '      - uses: actions/upload-artifact@v4',
          '        with:',
          `          name: ${workflowFileName(draft.workflowName).replace(/\.ya?ml$/u, '')}-artifact`,
          `          path: ${escapeYaml(draft.artifactPath || 'dist')}`
        ]
      : []),
    ...buildDeployLines(draft)
  ]

  return lines.join('\n')
}

const buildMatrix = (draft: WorkflowDraft) =>
  [
    'strategy:',
    `  fail-fast: ${draft.failFast ? 'true' : 'false'}`,
    '  matrix:',
    `    os: [${splitList(draft.osMatrix).map(escapeYaml).join(', ')}]`,
    `    node-version: [${splitList(draft.nodeVersions).map(escapeYaml).join(', ')}]`
  ].join('\n')

const buildSecretsChecklist = (draft: WorkflowDraft) => {
  const secrets = getAllSecrets(draft)
  const variables = getPlainEnvKeys(draft)
  return [
    `# ${draft.workflowName || 'CI'} release checklist`,
    '',
    `Workflow file: .github/workflows/${workflowFileName(draft.workflowName)}`,
    `Branch: ${draft.branch || 'main'}`,
    '',
    '## Repository secrets',
    ...(secrets.length
      ? secrets.map(secret => `- [ ] ${secret}`)
      : ['- [ ] No repository secrets required']),
    '',
    '## Repository variables',
    ...(variables.length
      ? variables.map(variable => `- [ ] ${variable}`)
      : ['- [ ] No repository variables required']),
    '',
    '## Before enabling',
    '- [ ] Confirm least-privilege permissions',
    '- [ ] Confirm cache dependency path matches the lockfile',
    '- [ ] Run the workflow once on a non-production branch'
  ].join('\n')
}

const buildBadge = (draft: WorkflowDraft) =>
  `![${draft.workflowName || 'CI'}](https://github.com/${draft.repo || 'owner/repo'}/actions/workflows/${workflowFileName(draft.workflowName)}/badge.svg?branch=${draft.branch || 'main'})`

const buildMarkdown = (draft: WorkflowDraft, findings: Finding[], parsed: ParsedWorkflow) =>
  [
    `# GitHub Actions plan: ${draft.workflowName || 'CI'}`,
    '',
    `- Trigger: ${draft.trigger}`,
    `- Package manager: ${draft.packageManager}`,
    `- Node versions: ${splitList(draft.nodeVersions).join(', ') || '22.x'}`,
    `- Deployment: ${draft.deployTarget}`,
    `- Secrets: ${getAllSecrets(draft).join(', ') || 'none'}`,
    `- Parsed jobs: ${parsed.jobs}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 30)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`)
  ].join('\n')

const buildOutput = (
  draft: WorkflowDraft,
  findings: Finding[],
  parsed: ParsedWorkflow,
  outputType: OutputType
) => {
  if (outputType === 'workflow') return buildWorkflow(draft)
  if (outputType === 'matrix') return buildMatrix(draft)
  if (outputType === 'secrets') return buildSecretsChecklist(draft)
  if (outputType === 'badge') return buildBadge(draft)
  if (outputType === 'markdown') return buildMarkdown(draft, findings, parsed)
  return JSON.stringify({ draft, findings, parsed, workflow: buildWorkflow(draft) }, null, 2)
}

const extractUnique = (source: string, pattern: RegExp, group = 1) =>
  unique(Array.from(source.matchAll(pattern)).map(match => match[group] ?? '')).slice(
    0,
    PARSED_LIST_LIMIT
  )

const parseWorkflow = (input: string): ParsedWorkflow => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const lines = source.split(/\r?\n/u)
  const secretRefs = extractUnique(source, SECRET_REF_PATTERN)
  const nodeVersions = extractUnique(source, /node-version:\s*["']?([0-9.x*-]+)/giu)
  const plainSensitiveEnv = lines
    .map(line => line.match(PLAIN_SENSITIVE_ENV_PATTERN)?.[1] ?? '')
    .filter(Boolean)
    .slice(0, PARSED_LIST_LIMIT)
  const packageManagers = PACKAGE_MANAGERS.filter(manager =>
    new RegExp(`\\b${manager}\\b`, 'iu').test(source)
  )
  const triggers = ['push', 'pull_request', 'workflow_dispatch', 'schedule'].filter(
    trigger =>
      new RegExp(`(^|\\n)\\s*${trigger}\\s*:`, 'iu').test(source) ||
      (trigger === 'push' && /\bon:\s*\[[^\]]*push/iu.test(source))
  )
  const permissionsLine = lines.find(line => /^\s*permissions\s*:/iu.test(line))?.trim() ?? ''
  let jobs = 0
  let insideJobs = false
  lines.forEach(line => {
    if (/^jobs\s*:/iu.test(line)) {
      insideJobs = true
      return
    }
    if (insideJobs && /^\S/u.test(line)) insideJobs = false
    if (insideJobs && /^ {2}[\w-]+\s*:\s*(?:#.*)?$/u.test(line)) jobs += 1
  })

  return {
    cacheDetected: /cache:\s*(pnpm|npm|yarn|bun)|actions\/cache/iu.test(source),
    capped: input.length > WORKSPACE_LIMIT,
    deployDetected: /\b(vercel|wrangler|docker\/build-push-action|deploy-pages|deploy)\b/iu.test(
      source
    ),
    hasCheckout: /actions\/checkout@v\d+/iu.test(source),
    hasSetupNode: /actions\/setup-node@v\d+/iu.test(source),
    jobs,
    nodeVersions,
    packageManagers,
    permissions:
      permissionsLine || (/\bwrite-all\b/iu.test(source) ? 'permissions: write-all' : ''),
    plainSensitiveEnv: unique(plainSensitiveEnv),
    scheduleCount: (source.match(/\bcron\s*:/giu) ?? []).length,
    secretRefs,
    triggers
  }
}

const auditWorkflow = (draft: WorkflowDraft, parsed: ParsedWorkflow): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const secrets = getAllSecrets(draft)
  const envKeys = getPlainEnvKeys(draft)
  const sensitiveEnv = envKeys.filter(isSensitiveKey)
  const timeout = numberFromInput(draft.timeoutMinutes, 20)
  const nodeVersions = splitList(draft.nodeVersions)
  const osMatrix = splitList(draft.osMatrix)

  if (!draft.workflowName.trim()) add('danger', 'name_missing', 'workflow')
  if (!draft.branch.trim() && draft.trigger !== 'manual' && draft.trigger !== 'schedule')
    add('danger', 'branch_missing', 'branch')
  if (!draft.installCommand.trim()) add('danger', 'install_missing', draft.packageManager)
  if (!draft.testCommand.trim() && !draft.buildCommand.trim())
    add('warn', 'verification_missing', draft.workflowName)
  if (draft.permissionProfile === 'write_all')
    add('danger', 'permissions_write_all', draft.workflowName)
  if (draft.permissionProfile === 'deploy' && draft.deployTarget === 'none')
    add('warn', 'deploy_permissions_without_deploy', draft.workflowName)
  if (!draft.cacheDependencies) add('warn', 'cache_missing', draft.packageManager)
  if (draft.packageManager !== 'npm' && !draft.useCorepack)
    add('warn', 'corepack_missing', draft.packageManager)
  if (!draft.verifyLockfile)
    add('warn', 'lockfile_not_verified', packageLockfile(draft.packageManager))
  if (draft.matrix && nodeVersions.length < 2 && osMatrix.length < 2)
    add('warn', 'matrix_too_small', draft.workflowName)
  if (!draft.matrix && nodeVersions.length > 1)
    add('warn', 'matrix_disabled', nodeVersions.join(', '))
  if (timeout > 60) add('warn', 'timeout_high', `${timeout}m`)
  if (draft.trigger === 'schedule' && !draft.schedule.trim())
    add('danger', 'schedule_missing', 'cron')
  if (draft.trigger === 'schedule' && !draft.timezone.trim())
    add('warn', 'timezone_missing', draft.schedule || 'cron')
  if (draft.deployTarget !== 'none' && !secrets.length && draft.deployTarget !== 'pages')
    add('warn', 'deploy_secrets_missing', draft.deployTarget)
  if (sensitiveEnv.length) add('danger', 'sensitive_env_plain', sensitiveEnv.join(', '))
  if (draft.uploadArtifact && !draft.artifactPath.trim())
    add('warn', 'artifact_path_missing', 'artifact')

  if (parsed.capped) add('warn', 'workspace_capped', `${WORKSPACE_LIMIT}`)
  if (parsed.permissions && /write-all/iu.test(parsed.permissions))
    add('danger', 'parsed_write_all', parsed.permissions)
  if (parsed.jobs === 0 && parsed.triggers.length) add('warn', 'parsed_no_jobs', 'jobs')
  if (!parsed.hasCheckout && parsed.jobs > 0) add('warn', 'parsed_no_checkout', 'actions/checkout')
  if (!parsed.hasSetupNode && parsed.packageManagers.length)
    add('warn', 'parsed_no_setup_node', parsed.packageManagers.join(', '))
  if (!parsed.cacheDetected && parsed.packageManagers.length)
    add('warn', 'parsed_no_cache', parsed.packageManagers.join(', '))
  if (parsed.plainSensitiveEnv.length)
    add('danger', 'parsed_plain_secret', parsed.plainSensitiveEnv.join(', '))
  if (
    parsed.scheduleCount &&
    !/timezone|utc|tz/iu.test(parsed.permissions + parsed.triggers.join(' ') + draft.timezone)
  )
    add('warn', 'parsed_schedule_timezone', `${parsed.scheduleCount}`)
  if (parsed.deployDetected && !parsed.secretRefs.length && draft.deployTarget !== 'pages')
    add('warn', 'parsed_deploy_no_secret', 'deploy')
  if (!parsed.triggers.length && !parsed.jobs && inputLooksEmpty(parsed))
    add('warn', 'parser_empty', 'workspace')

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.workflowName)
    add('good', 'permissions_ok', draft.permissionProfile)
    add('good', 'cache_ok', draft.packageManager)
  }

  return findings
}

const inputLooksEmpty = (parsed: ParsedWorkflow) =>
  !parsed.cacheDetected &&
  !parsed.deployDetected &&
  !parsed.hasCheckout &&
  !parsed.hasSetupNode &&
  !parsed.jobs &&
  !parsed.secretRefs.length

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

export default function GitHubActionsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<WorkflowDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('workflow')
  const [auditQuery, setAuditQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)

  const parsed = useMemo(() => parseWorkflow(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditWorkflow(draft, parsed), [draft, parsed])
  const output = useMemo(
    () => buildOutput(draft, findings, parsed, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(
    () =>
      [
        [
          'workflow',
          'trigger',
          'package_manager',
          'deploy_target',
          'secrets',
          'warnings',
          'critical'
        ]
          .map(escapeCsv)
          .join(','),
        [
          draft.workflowName,
          draft.trigger,
          draft.packageManager,
          draft.deployTarget,
          getAllSecrets(draft).length,
          findings.filter(item => item.level === 'warn').length,
          findings.filter(item => item.level === 'danger').length
        ]
          .map(escapeCsv)
          .join(',')
      ].join('\n'),
    [draft, findings]
  )
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.github_actions.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const metrics = useMemo(
    () => ({
      critical: findings.filter(item => item.level === 'danger').length,
      parsed: parsed.jobs || parsed.triggers.length || parsed.secretRefs.length,
      secrets: getAllSecrets(draft).length,
      status: findings.some(item => item.level === 'danger')
        ? t('app.generation.github_actions.status.risk')
        : findings.some(item => item.level === 'warn')
          ? t('app.generation.github_actions.status.review')
          : t('app.generation.github_actions.status.ready'),
      triggers: t(`app.generation.github_actions.trigger.${draft.trigger}`),
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft, findings, parsed.jobs, parsed.secretRefs.length, parsed.triggers.length, t]
  )

  const updateDraft = <Key extends keyof WorkflowDraft>(key: Key, value: WorkflowDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('workflow')
    setAuditQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.generation.github_actions.summary_title'),
        `${t('app.generation.github_actions.metric.status')}: ${metrics.status}`,
        `${t('app.generation.github_actions.metric.trigger')}: ${metrics.triggers}`,
        `${t('app.generation.github_actions.metric.secrets')}: ${metrics.secrets}`,
        `${t('app.generation.github_actions.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.github_actions.metric.critical')}: ${metrics.critical}`
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
                <Github className="h-4 w-4" />
                {t('app.generation.github-actions')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.generation.github-actions')}</CardTitle>
              <CardDescription>{t('app.generation.github_actions.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.generation.github_actions.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              label={t('app.generation.github_actions.metric.status')}
              value={metrics.status}
            />
            <Metric
              label={t('app.generation.github_actions.metric.trigger')}
              value={metrics.triggers}
            />
            <Metric
              label={t('app.generation.github_actions.metric.secrets')}
              value={metrics.secrets}
            />
            <Metric
              label={t('app.generation.github_actions.metric.parsed')}
              value={metrics.parsed}
            />
            <Metric
              label={t('app.generation.github_actions.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.generation.github_actions.metric.critical')}
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
              {t('app.generation.github_actions.presets')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input min-w-0 rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.generation.github_actions.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.generation.github_actions.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(380px,0.96fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.github_actions.builder')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.github_actions.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gha-name">{t('app.generation.github_actions.workflow_name')}</Label>
                <Input
                  id="gha-name"
                  value={draft.workflowName}
                  onChange={event => updateDraft('workflowName', event.target.value.slice(0, 80))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-repo">{t('app.generation.github_actions.repo')}</Label>
                <Input
                  id="gha-repo"
                  value={draft.repo}
                  onChange={event => updateDraft('repo', event.target.value.slice(0, 120))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-branch">{t('app.generation.github_actions.branch')}</Label>
                <Input
                  id="gha-branch"
                  value={draft.branch}
                  onChange={event => updateDraft('branch', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-trigger">{t('app.generation.github_actions.trigger')}</Label>
                <Select
                  id="gha-trigger"
                  value={draft.trigger}
                  onChange={event => updateDraft('trigger', event.target.value as Trigger)}
                >
                  {TRIGGERS.map(trigger => (
                    <option key={trigger} value={trigger}>
                      {t(`app.generation.github_actions.trigger.${trigger}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-package">
                  {t('app.generation.github_actions.package_manager')}
                </Label>
                <Select
                  id="gha-package"
                  value={draft.packageManager}
                  onChange={event =>
                    updateDraft('packageManager', event.target.value as PackageManager)
                  }
                >
                  {PACKAGE_MANAGERS.map(manager => (
                    <option key={manager} value={manager}>
                      {t(`app.generation.github_actions.package.${manager}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-deploy">
                  {t('app.generation.github_actions.deploy_target')}
                </Label>
                <Select
                  id="gha-deploy"
                  value={draft.deployTarget}
                  onChange={event =>
                    updateDraft('deployTarget', event.target.value as DeployTarget)
                  }
                >
                  {DEPLOY_TARGETS.map(target => (
                    <option key={target} value={target}>
                      {t(`app.generation.github_actions.deploy.${target}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-permissions">
                  {t('app.generation.github_actions.permissions')}
                </Label>
                <Select
                  id="gha-permissions"
                  value={draft.permissionProfile}
                  onChange={event =>
                    updateDraft('permissionProfile', event.target.value as PermissionProfile)
                  }
                >
                  {PERMISSION_PROFILES.map(profile => (
                    <option key={profile} value={profile}>
                      {t(`app.generation.github_actions.permission.${profile}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-timeout">{t('app.generation.github_actions.timeout')}</Label>
                <Input
                  id="gha-timeout"
                  value={draft.timeoutMinutes}
                  onChange={event => updateDraft('timeoutMinutes', event.target.value.slice(0, 4))}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-node">{t('app.generation.github_actions.node_versions')}</Label>
                <Textarea
                  id="gha-node"
                  value={draft.nodeVersions}
                  onChange={event => updateDraft('nodeVersions', event.target.value.slice(0, 160))}
                  className="min-h-[96px] font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-os">{t('app.generation.github_actions.os_matrix')}</Label>
                <Textarea
                  id="gha-os"
                  value={draft.osMatrix}
                  onChange={event => updateDraft('osMatrix', event.target.value.slice(0, 180))}
                  className="min-h-[96px] font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-install">
                  {t('app.generation.github_actions.install_command')}
                </Label>
                <Input
                  id="gha-install"
                  value={draft.installCommand}
                  onChange={event =>
                    updateDraft('installCommand', event.target.value.slice(0, 180))
                  }
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-test">{t('app.generation.github_actions.test_command')}</Label>
                <Input
                  id="gha-test"
                  value={draft.testCommand}
                  onChange={event => updateDraft('testCommand', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-build">
                  {t('app.generation.github_actions.build_command')}
                </Label>
                <Input
                  id="gha-build"
                  value={draft.buildCommand}
                  onChange={event => updateDraft('buildCommand', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-artifact">
                  {t('app.generation.github_actions.artifact_path')}
                </Label>
                <Input
                  id="gha-artifact"
                  value={draft.artifactPath}
                  onChange={event => updateDraft('artifactPath', event.target.value.slice(0, 140))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-schedule">{t('app.generation.github_actions.schedule')}</Label>
                <Input
                  id="gha-schedule"
                  value={draft.schedule}
                  onChange={event => updateDraft('schedule', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-timezone">{t('app.generation.github_actions.timezone')}</Label>
                <Input
                  id="gha-timezone"
                  value={draft.timezone}
                  onChange={event => updateDraft('timezone', event.target.value.slice(0, 80))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-env">{t('app.generation.github_actions.env_keys')}</Label>
                <Textarea
                  id="gha-env"
                  value={draft.envKeys}
                  onChange={event => updateDraft('envKeys', event.target.value.slice(0, 1600))}
                  className="min-h-[130px] font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gha-secrets">
                  {t('app.generation.github_actions.secret_keys')}
                </Label>
                <Textarea
                  id="gha-secrets"
                  value={draft.secretKeys}
                  onChange={event => updateDraft('secretKeys', event.target.value.slice(0, 1600))}
                  className="min-h-[130px] font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Checkbox
                checked={draft.matrix}
                onChange={event => updateDraft('matrix', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.matrix')}
              />
              <Checkbox
                checked={draft.cacheDependencies}
                onChange={event => updateDraft('cacheDependencies', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.cache_dependencies')}
              />
              <Checkbox
                checked={draft.useCorepack}
                onChange={event => updateDraft('useCorepack', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.use_corepack')}
              />
              <Checkbox
                checked={draft.verifyLockfile}
                onChange={event => updateDraft('verifyLockfile', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.verify_lockfile')}
              />
              <Checkbox
                checked={draft.concurrency}
                onChange={event => updateDraft('concurrency', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.concurrency')}
              />
              <Checkbox
                checked={draft.uploadArtifact}
                onChange={event => updateDraft('uploadArtifact', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.upload_artifact')}
              />
              <Checkbox
                checked={draft.failFast}
                onChange={event => updateDraft('failFast', event.target.checked)}
                className="glass-input min-w-0 rounded-xl px-3 py-2"
                label={t('app.generation.github_actions.fail_fast')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.github_actions.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.github_actions.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.generation.github_actions.workspace_placeholder')}
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
                {t('app.generation.github_actions.use_output')}
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
                {t('app.generation.github_actions.audit')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.generation.github_actions.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.generation.github_actions.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 70).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.generation.github_actions.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.generation.github_actions.level.${finding.level}`)}
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
                  {t('app.generation.github_actions.output')}
                </CardTitle>
                <CardDescription>{t('app.generation.github_actions.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="gha-output">{t('app.generation.github_actions.output_type')}</Label>
                <Select
                  id="gha-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.github_actions.output.${type}`)}
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
                {t('app.generation.github_actions.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    output,
                    outputType === 'workflow'
                      ? workflowFileName(draft.workflowName)
                      : 'github-actions-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.generation.github_actions.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(csvOutput, 'github-actions-audit.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.generation.github_actions.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.github_actions.parsed')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ['triggers', parsed.triggers.join(', ') || '-'],
              ['jobs', parsed.jobs || '-'],
              ['package', parsed.packageManagers.join(', ') || '-'],
              ['node', parsed.nodeVersions.join(', ') || '-'],
              ['secrets', parsed.secretRefs.join(', ') || '-'],
              ['sensitive', parsed.plainSensitiveEnv.join(', ') || '-']
            ].map(([key, value]) => (
              <div key={key} className="glass-input min-w-0 rounded-xl p-3">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t(`app.generation.github_actions.parsed.${key}`)}
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.generation.github_actions.reference')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.github_actions.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.generation.github_actions.reference.${item}_hint`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">
                  {t('app.generation.github_actions.checklist')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.generation.github_actions.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.generation.github_actions.checklist.${item}.body`)}
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
