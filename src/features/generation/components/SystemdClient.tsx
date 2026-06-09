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
  ServerCog,
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

const OUTPUT_TYPES = [
  'service',
  'timer',
  'env',
  'commands',
  'hardening',
  'override',
  'markdown',
  'json',
  'csv'
] as const
const RESTART_POLICIES = ['always', 'on-failure', 'on-abnormal', 'no'] as const
const UNIT_MODES = ['service', 'timer'] as const
const WORKSPACE_LIMIT = 80000
const UNIT_RENDER_LIMIT = 80
const UNSAFE_FIELD_PATTERN = /[\r\n]/u
const SENSITIVE_ENV_PATTERN =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|DATABASE_URL|API_KEY|KEY)/iu
const SERVICE_HARDENING_KEYS = [
  'NoNewPrivileges',
  'PrivateTmp',
  'ProtectSystem',
  'ProtectHome',
  'DynamicUser',
  'PrivateDevices',
  'LockPersonality',
  'RestrictAddressFamilies',
  'RestrictSUIDSGID',
  'CapabilityBoundingSet',
  'StateDirectory'
]
const SINGLETON_SERVICE_DIRECTIVES = [
  'Type',
  'User',
  'Group',
  'WorkingDirectory',
  'Restart',
  'RestartSec',
  'MemoryMax',
  'CPUQuota',
  'ProtectSystem',
  'ProtectHome',
  'NoNewPrivileges',
  'PrivateTmp',
  'PrivateDevices'
]

type OutputType = (typeof OUTPUT_TYPES)[number]
type RestartPolicy = (typeof RESTART_POLICIES)[number]
type UnitMode = (typeof UNIT_MODES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface SystemdDraft {
  accuracySec: string
  afterTargets: string
  capabilityBoundingSet: string
  cpuQuota: string
  description: string
  dynamicUser: boolean
  environmentFile: string
  environmentLines: string
  execReload: string
  execStart: string
  groupName: string
  lockPersonality: boolean
  memoryMax: string
  noNewPrivileges: boolean
  onCalendar: string
  persistentTimer: boolean
  privateDevices: boolean
  privateTmp: boolean
  protectHome: boolean
  protectSystem: boolean
  randomDelaySec: string
  readWritePaths: string
  restartPolicy: RestartPolicy
  restartSec: string
  restrictAddressFamilies: boolean
  restrictSuidSgid: boolean
  secretKeys: string
  serviceName: string
  startLimitBurst: string
  startLimitIntervalSec: string
  stateDirectory: string
  syslogIdentifier: string
  timeoutStopSec: string
  unitMode: UnitMode
  userName: string
  wantedBy: string
  watchdogSec: string
  workingDirectory: string
}

interface Preset {
  draft: SystemdDraft
  key: string
  workspace: string
}

interface ParsedUnit {
  capabilityBoundingSet: string
  description: string
  environment: string[]
  environmentFiles: string[]
  execStart: string
  execStartResets: number
  execStarts: string[]
  installWantedBy: string
  hasHardening: boolean
  hasInstall: boolean
  hasTimer: boolean
  onCalendar: string
  persistent: boolean
  randomDelay: string
  readWritePaths: string[]
  restart: string
  restartSec: string
  restrictSuidSgid: string
  sections: string[]
  serviceType: string
  startLimitBurst: string
  startLimitIntervalSec: string
  stateDirectory: string
  timerExecStart: string
  timerUnit: string
  timerSchedules: string[]
  sensitiveEnv: string[]
  duplicateScalarDirectives: string[]
  unitType: string
  user: string
  workingDirectory: string
}

interface ParsedSystemd {
  capped: boolean
  syntaxHints: string[]
  units: ParsedUnit[]
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: SystemdDraft = {
  accuracySec: '1min',
  afterTargets: 'network-online.target',
  capabilityBoundingSet: '~CAP_SYS_ADMIN CAP_SYS_PTRACE CAP_NET_ADMIN',
  cpuQuota: '80%',
  description: 'Daily Tools web service',
  dynamicUser: false,
  environmentFile: '/etc/daily-tools/web.env',
  environmentLines: 'NODE_ENV=production\nPORT=3000',
  execReload: '',
  execStart: '/usr/bin/corepack pnpm start',
  groupName: 'daily-tools',
  lockPersonality: true,
  memoryMax: '768M',
  noNewPrivileges: true,
  onCalendar: 'Mon..Fri 03:30',
  persistentTimer: true,
  privateDevices: true,
  privateTmp: true,
  protectHome: true,
  protectSystem: true,
  randomDelaySec: '10min',
  readWritePaths: '/var/lib/daily-tools\n/var/log/daily-tools',
  restartPolicy: 'on-failure',
  restartSec: '5s',
  restrictAddressFamilies: true,
  restrictSuidSgid: true,
  secretKeys: 'DATABASE_URL\nJWT_SECRET',
  serviceName: 'daily-tools-web',
  startLimitBurst: '5',
  startLimitIntervalSec: '60s',
  stateDirectory: 'daily-tools',
  syslogIdentifier: 'daily-tools-web',
  timeoutStopSec: '30s',
  unitMode: 'service',
  userName: 'daily-tools',
  wantedBy: 'multi-user.target',
  watchdogSec: '',
  workingDirectory: '/srv/daily-tools'
}

const PRESETS: Preset[] = [
  {
    key: 'node',
    draft: DEFAULT_DRAFT,
    workspace: `[Unit]
Description=Daily Tools web service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=daily-tools
Group=daily-tools
WorkingDirectory=/srv/daily-tools
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=-/etc/daily-tools/web.env
ExecStart=/usr/bin/corepack pnpm start
Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60s
StartLimitBurst=5
TimeoutStopSec=30s
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/daily-tools /var/log/daily-tools
LockPersonality=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
MemoryMax=768M
CPUQuota=80%
SyslogIdentifier=daily-tools-web

[Install]
WantedBy=multi-user.target`
  },
  {
    key: 'worker',
    draft: {
      ...DEFAULT_DRAFT,
      afterTargets: 'network-online.target redis.service',
      description: 'Daily Tools queue worker',
      environmentFile: '/etc/daily-tools/worker.env',
      environmentLines: 'NODE_ENV=production\nQUEUE_NAME=default',
      execStart: '/usr/bin/corepack pnpm worker',
      memoryMax: '512M',
      serviceName: 'daily-tools-worker',
      syslogIdentifier: 'daily-tools-worker',
      workingDirectory: '/srv/daily-tools'
    },
    workspace: `[Unit]
Description=Daily Tools queue worker
After=network-online.target redis.service
Wants=network-online.target

[Service]
Type=simple
User=daily-tools
Group=daily-tools
WorkingDirectory=/srv/daily-tools
Environment=NODE_ENV=production
Environment=QUEUE_NAME=default
EnvironmentFile=-/etc/daily-tools/worker.env
ExecStart=/usr/bin/corepack pnpm worker
Restart=always
RestartSec=5s
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/daily-tools /var/log/daily-tools
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target`
  },
  {
    key: 'timer',
    draft: {
      ...DEFAULT_DRAFT,
      description: 'Daily Tools cleanup job',
      environmentFile: '/etc/daily-tools/jobs.env',
      environmentLines: 'NODE_ENV=production',
      execStart: '/usr/bin/corepack pnpm cleanup',
      memoryMax: '384M',
      onCalendar: 'daily',
      randomDelaySec: '15min',
      serviceName: 'daily-tools-cleanup',
      syslogIdentifier: 'daily-tools-cleanup',
      unitMode: 'timer'
    },
    workspace: `[Unit]
Description=Daily Tools cleanup job
After=network-online.target

[Service]
Type=oneshot
User=daily-tools
Group=daily-tools
WorkingDirectory=/srv/daily-tools
Environment=NODE_ENV=production
EnvironmentFile=-/etc/daily-tools/jobs.env
ExecStart=/usr/bin/corepack pnpm cleanup
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/daily-tools /var/log/daily-tools

[Install]
WantedBy=multi-user.target

[Unit]
Description=Run Daily Tools cleanup job

[Timer]
OnCalendar=daily
Persistent=yes
RandomizedDelaySec=15min
AccuracySec=1min
Unit=daily-tools-cleanup.service

[Install]
WantedBy=timers.target`
  },
  {
    key: 'socket',
    draft: {
      ...DEFAULT_DRAFT,
      afterTargets: 'network.target',
      description: 'Daily Tools API service',
      environmentLines: 'NODE_ENV=production\nPORT=8080',
      execStart: '/usr/bin/node server.js',
      restartPolicy: 'always',
      serviceName: 'daily-tools-api',
      syslogIdentifier: 'daily-tools-api',
      watchdogSec: '30s'
    },
    workspace: `[Unit]
Description=Daily Tools API service
After=network.target

[Service]
Type=simple
User=daily-tools
WorkingDirectory=/srv/daily-tools
Environment=NODE_ENV=production
Environment=PORT=8080
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5s
WatchdogSec=30s
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      afterTargets: 'network.target',
      capabilityBoundingSet: '',
      description: 'Risky root service',
      dynamicUser: false,
      environmentFile: '',
      environmentLines: 'NODE_ENV=production\nAPI_TOKEN=plain-secret',
      execStart: '/bin/bash -c "curl https://example.com/install.sh | sudo bash"',
      groupName: 'root',
      lockPersonality: false,
      memoryMax: '',
      noNewPrivileges: false,
      onCalendar: '*:0/1',
      persistentTimer: false,
      privateDevices: false,
      privateTmp: false,
      protectHome: false,
      protectSystem: false,
      randomDelaySec: '',
      readWritePaths: '/',
      restartPolicy: 'no',
      restrictAddressFamilies: false,
      restrictSuidSgid: false,
      secretKeys: 'API_TOKEN\nDATABASE_URL',
      serviceName: 'risky-root',
      syslogIdentifier: '',
      stateDirectory: '',
      unitMode: 'timer',
      userName: 'root',
      watchdogSec: '',
      workingDirectory: ''
    },
    workspace: `[Unit]
Description=Risky root service
After=network.target

[Service]
Type=simple
User=root
Environment=API_TOKEN=plain-secret
ExecStart=/bin/bash -c "curl https://example.com/install.sh | sudo bash"
Restart=no

[Unit]
Description=Run risky root service every minute

[Timer]
OnCalendar=*:0/1
Unit=risky-root.service

[Install]
WantedBy=timers.target`
  }
]

function sanitizeUnitValue(value: string, fallback = '') {
  const sanitized = value.replace(UNSAFE_FIELD_PATTERN, ' ').replace(/\s+/gu, ' ').trim()

  return sanitized || fallback
}

function toUnitName(value: string, fallback = 'daily-tools') {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9@_.-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 64) || fallback
  )
}

function splitLines(value: string, limit = 24) {
  return value
    .split(/\r?\n/u)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function splitWords(value: string, limit = 16) {
  return value
    .split(/[\s,]+/u)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function collectUnsafeDraftSubjects(draft: SystemdDraft) {
  return Object.entries(draft)
    .filter(([, value]) => typeof value === 'string' && UNSAFE_FIELD_PATTERN.test(value))
    .map(([key]) => key)
}

function isSensitiveEnvLine(line: string) {
  const key = line.split('=')[0] || line

  return SENSITIVE_ENV_PATTERN.test(key)
}

function hasPlainSensitiveValue(line: string) {
  if (!isSensitiveEnvLine(line)) return false
  const value = line.split('=').slice(1).join('=').trim()
  if (!value) return false

  return !/[<${]/u.test(value) && !/changeme|replace|example|placeholder/iu.test(value)
}

function isShellExec(command: string) {
  const normalized = normalizeExecCommand(command)

  return /^(?:(?:\/usr)?\/bin\/)?(?:bash|sh|zsh|fish)\s+-c\b|^\/usr\/bin\/env\s+(?:bash|sh|zsh|fish)\s+-c\b|curl\s+[^|]+\|\s*(?:sudo\s+)?(?:bash|sh)|wget\s+[^|]+\|\s*(?:sudo\s+)?(?:bash|sh)/iu.test(
    normalized
  )
}

function normalizeExecCommand(command: string) {
  return command
    .trim()
    .replace(/^[!:+@-]+/u, '')
    .trim()
}

function hasShellMetachar(command: string) {
  return /(?:&&|\|\||\||[<>*?{}])/u.test(normalizeExecCommand(command))
}

function normalizeSystemdPath(value: string) {
  return value.trim().replace(/^-+/u, '').trim()
}

function isRootUser(value: string) {
  const normalized = value.trim().toLowerCase()

  return !normalized || normalized === 'root' || normalized === '0'
}

function isValidWorkingDirectory(value: string) {
  const normalized = normalizeSystemdPath(value)

  return normalized.startsWith('/') || normalized.startsWith('~')
}

function isRiskyWorkingDirectory(value: string) {
  const normalized = normalizeSystemdPath(value)

  return normalized === '/' || normalized === '/tmp' || normalized.startsWith('/tmp/')
}

function parseDurationSeconds(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d+(?:\.\d+)?)\s*(ms|msec|millisecond|milliseconds|s|sec|second|seconds|min|minute|minutes|h|hr|hour|hours|d|day|days)?$/iu
    )
  if (!match?.[1]) return Number.NaN

  const amount = Number(match[1])
  const unit = (match[2] || 's').toLowerCase()

  if (unit.startsWith('ms') || unit.startsWith('millisecond')) return amount / 1000
  if (unit === 'min' || unit.startsWith('minute')) return amount * 60
  if (unit === 'h' || unit === 'hr' || unit.startsWith('hour')) return amount * 3600
  if (unit === 'd' || unit.startsWith('day')) return amount * 86400

  return amount
}

function buildEnvironmentLines(draft: SystemdDraft) {
  return splitLines(draft.environmentLines).map(line => `Environment=${sanitizeUnitValue(line)}`)
}

function buildHardeningLines(draft: SystemdDraft) {
  return [
    draft.noNewPrivileges ? 'NoNewPrivileges=yes' : '',
    draft.privateTmp ? 'PrivateTmp=yes' : '',
    draft.privateDevices ? 'PrivateDevices=yes' : '',
    draft.protectSystem ? 'ProtectSystem=strict' : '',
    draft.protectHome ? 'ProtectHome=yes' : '',
    draft.lockPersonality ? 'LockPersonality=yes' : '',
    draft.restrictAddressFamilies ? 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' : '',
    draft.restrictSuidSgid ? 'RestrictSUIDSGID=yes' : '',
    draft.dynamicUser ? 'DynamicUser=yes' : '',
    draft.capabilityBoundingSet.trim()
      ? `CapabilityBoundingSet=${sanitizeUnitValue(draft.capabilityBoundingSet)}`
      : '',
    draft.stateDirectory.trim() ? `StateDirectory=${sanitizeUnitValue(draft.stateDirectory)}` : '',
    ...splitLines(draft.readWritePaths).map(path => `ReadWritePaths=${sanitizeUnitValue(path)}`)
  ].filter(Boolean)
}

function buildServiceUnit(draft: SystemdDraft) {
  const service = toUnitName(draft.serviceName)
  const afterTargets = splitWords(draft.afterTargets)
  const execStartLine = draft.execStart.trim()
    ? `ExecStart=${sanitizeUnitValue(draft.execStart)}`
    : '# ExecStart is required before enabling this unit.'
  const lines = [
    '[Unit]',
    `Description=${sanitizeUnitValue(draft.description, service)}`,
    afterTargets.length > 0
      ? `After=${afterTargets.map(item => sanitizeUnitValue(item)).join(' ')}`
      : '',
    afterTargets.includes('network-online.target') ? 'Wants=network-online.target' : '',
    '',
    '[Service]',
    draft.unitMode === 'timer' ? 'Type=oneshot' : 'Type=simple',
    !draft.dynamicUser && draft.userName.trim() ? `User=${sanitizeUnitValue(draft.userName)}` : '',
    !draft.dynamicUser && draft.groupName.trim()
      ? `Group=${sanitizeUnitValue(draft.groupName)}`
      : '',
    draft.workingDirectory.trim()
      ? `WorkingDirectory=${sanitizeUnitValue(draft.workingDirectory)}`
      : '',
    ...buildEnvironmentLines(draft),
    draft.environmentFile.trim()
      ? `EnvironmentFile=-${sanitizeUnitValue(draft.environmentFile)}`
      : '',
    execStartLine,
    draft.execReload.trim() ? `ExecReload=${sanitizeUnitValue(draft.execReload)}` : '',
    draft.unitMode === 'service' ? `Restart=${draft.restartPolicy}` : '',
    draft.unitMode === 'service' && draft.restartPolicy !== 'no'
      ? `RestartSec=${sanitizeUnitValue(draft.restartSec, '5s')}`
      : '',
    draft.startLimitIntervalSec.trim()
      ? `StartLimitIntervalSec=${sanitizeUnitValue(draft.startLimitIntervalSec)}`
      : '',
    draft.startLimitBurst.trim()
      ? `StartLimitBurst=${sanitizeUnitValue(draft.startLimitBurst)}`
      : '',
    draft.timeoutStopSec.trim() ? `TimeoutStopSec=${sanitizeUnitValue(draft.timeoutStopSec)}` : '',
    draft.watchdogSec.trim() ? `WatchdogSec=${sanitizeUnitValue(draft.watchdogSec)}` : '',
    ...buildHardeningLines(draft),
    draft.memoryMax.trim() ? `MemoryMax=${sanitizeUnitValue(draft.memoryMax)}` : '',
    draft.cpuQuota.trim() ? `CPUQuota=${sanitizeUnitValue(draft.cpuQuota)}` : '',
    draft.syslogIdentifier.trim()
      ? `SyslogIdentifier=${sanitizeUnitValue(draft.syslogIdentifier)}`
      : '',
    '',
    draft.unitMode === 'service' ? '[Install]' : '',
    draft.unitMode === 'service'
      ? `WantedBy=${sanitizeUnitValue(draft.wantedBy, 'multi-user.target')}`
      : ''
  ]

  return lines
    .filter(line => line !== '')
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
}

function buildTimerUnit(draft: SystemdDraft) {
  const service = toUnitName(draft.serviceName)
  const lines = [
    '[Unit]',
    `Description=Run ${sanitizeUnitValue(draft.description, service)}`,
    '',
    '[Timer]',
    `OnCalendar=${sanitizeUnitValue(draft.onCalendar, 'daily')}`,
    draft.persistentTimer ? 'Persistent=yes' : '',
    draft.randomDelaySec.trim()
      ? `RandomizedDelaySec=${sanitizeUnitValue(draft.randomDelaySec)}`
      : '',
    draft.accuracySec.trim() ? `AccuracySec=${sanitizeUnitValue(draft.accuracySec)}` : '',
    `Unit=${service}.service`,
    '',
    '[Install]',
    'WantedBy=timers.target'
  ]

  return lines
    .filter(line => line !== '')
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
}

function buildEnvFile(draft: SystemdDraft) {
  const envLines = splitLines(draft.environmentLines)
  const secretLines = splitLines(draft.secretKeys).map(
    key => `${sanitizeUnitValue(key)}=<set securely>`
  )

  return [...envLines, ...secretLines].join('\n')
}

function buildOverrideConf(draft: SystemdDraft) {
  const lines = [
    '[Service]',
    '# Drop-in overrides only the service directives you need to change.',
    draft.environmentFile.trim()
      ? `EnvironmentFile=-${sanitizeUnitValue(draft.environmentFile)}`
      : '',
    draft.restartPolicy !== 'no' ? `Restart=${draft.restartPolicy}` : '',
    draft.restartPolicy !== 'no' ? `RestartSec=${sanitizeUnitValue(draft.restartSec, '5s')}` : '',
    draft.startLimitIntervalSec.trim()
      ? `StartLimitIntervalSec=${sanitizeUnitValue(draft.startLimitIntervalSec)}`
      : '',
    draft.startLimitBurst.trim()
      ? `StartLimitBurst=${sanitizeUnitValue(draft.startLimitBurst)}`
      : '',
    ...buildHardeningLines(draft),
    draft.memoryMax.trim() ? `MemoryMax=${sanitizeUnitValue(draft.memoryMax)}` : '',
    draft.cpuQuota.trim() ? `CPUQuota=${sanitizeUnitValue(draft.cpuQuota)}` : ''
  ]

  return lines.filter(Boolean).join('\n')
}

function buildInstallCommands(draft: SystemdDraft) {
  const service = toUnitName(draft.serviceName)
  const servicePath = `/etc/systemd/system/${service}.service`
  const timerPath = `/etc/systemd/system/${service}.timer`
  const envPath = sanitizeUnitValue(draft.environmentFile, `/etc/${service}.env`).replace(/^-/, '')

  return [
    draft.execStart.trim()
      ? ''
      : '# Review blocked: ExecStart is missing. Fill it before running the commands below.',
    `sudo tee ${servicePath} > /dev/null <<'SERVICE'`,
    buildServiceUnit(draft),
    'SERVICE',
    draft.environmentFile.trim()
      ? `sudo install -m 0640 -o root -g ${sanitizeUnitValue(draft.groupName || draft.userName || 'root')} /dev/null ${envPath}`
      : '',
    draft.environmentFile.trim() ? `sudo tee ${envPath} > /dev/null <<'ENV'` : '',
    draft.environmentFile.trim() ? buildEnvFile(draft) : '',
    draft.environmentFile.trim() ? 'ENV' : '',
    draft.unitMode === 'timer' ? `sudo tee ${timerPath} > /dev/null <<'TIMER'` : '',
    draft.unitMode === 'timer' ? buildTimerUnit(draft) : '',
    draft.unitMode === 'timer' ? 'TIMER' : '',
    draft.unitMode === 'timer' && draft.onCalendar.trim()
      ? `systemd-analyze calendar '${sanitizeUnitValue(draft.onCalendar).replace(/'/gu, `'\\''`)}'`
      : '',
    `sudo systemd-analyze verify ${servicePath}`,
    draft.unitMode === 'timer' ? `sudo systemd-analyze verify ${timerPath}` : '',
    'sudo systemctl daemon-reload',
    draft.unitMode === 'timer'
      ? `sudo systemctl enable --now ${service}.timer`
      : `sudo systemctl enable --now ${service}.service`,
    draft.unitMode === 'timer'
      ? `systemctl list-timers ${service}.timer`
      : `systemctl status ${service}.service`,
    draft.unitMode === 'timer'
      ? `journalctl -u ${service}.service -u ${service}.timer -n 100 --no-pager`
      : `journalctl -u ${service}.service -n 100 --no-pager`
  ]
    .filter(Boolean)
    .join('\n')
}

function buildHardeningSnippet(draft: SystemdDraft) {
  return buildHardeningLines(draft).join('\n') || '# Hardening flags are disabled in this draft.'
}

function buildMarkdown(draft: SystemdDraft, findings: Finding[], parsed: ParsedSystemd) {
  return [
    `# ${draft.serviceName || 'service'} systemd plan`,
    '',
    `- Description: ${draft.description || 'service'}`,
    `- Mode: ${draft.unitMode}`,
    `- User: ${draft.dynamicUser ? 'DynamicUser' : draft.userName || 'root'}`,
    `- Working directory: ${draft.workingDirectory || 'missing'}`,
    `- Restart: ${draft.restartPolicy}`,
    `- Timer: ${draft.unitMode === 'timer' ? draft.onCalendar : 'disabled'}`,
    `- Parsed units: ${parsed.units.length}`,
    `- Audit findings: ${findings.length}`,
    '',
    '## Next checks',
    '',
    '- Run `systemd-analyze verify` before enabling the unit.',
    '- Keep secrets in `EnvironmentFile=` files with restrictive permissions.',
    '- Avoid root services unless the workload truly needs host-level privileges.',
    '- Pair restart policies with sane StartLimit settings and resource controls.'
  ].join('\n')
}

function getOutputFilename(outputType: OutputType, serviceName: string) {
  const service = toUnitName(serviceName)
  if (outputType === 'service') return `${service}.service`
  if (outputType === 'timer') return `${service}.timer`
  if (outputType === 'env') return `${service}.env`
  if (outputType === 'commands') return `install-${service}.sh`
  if (outputType === 'hardening') return `${service}.hardening.conf`
  if (outputType === 'override') return `override-${service}.conf`
  if (outputType === 'json') return `${service}-systemd-summary.json`
  if (outputType === 'csv') return `${service}-systemd-audit.csv`

  return `${service}-systemd-plan.md`
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

function unfoldSystemdLines(chunk: string) {
  const lines: string[] = []
  let pending = ''

  for (const rawLine of chunk.split(/\r?\n/u)) {
    const rightTrimmed = rawLine.replace(/\s+$/u, '')
    if (rightTrimmed.endsWith('\\') && !rightTrimmed.endsWith('\\\\')) {
      pending += `${rightTrimmed.slice(0, -1)} `
      continue
    }

    lines.push(`${pending}${rawLine}`)
    pending = ''
  }

  if (pending.trim()) lines.push(pending.trimEnd())

  return lines
}

function parseSections(chunk: string) {
  const sections = new Map<string, Array<{ key: string; value: string }>>()
  let current = ''

  for (const rawLine of unfoldSystemdLines(chunk)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const sectionMatch = line.match(/^\[([^\]]+)\]$/u)
    if (sectionMatch?.[1]) {
      current = sectionMatch[1]
      if (!sections.has(current)) sections.set(current, [])
      continue
    }
    const equalIndex = line.indexOf('=')
    if (!current || equalIndex <= 0) continue
    const key = line.slice(0, equalIndex).trim()
    const value = line.slice(equalIndex + 1).trim()
    sections.get(current)?.push({ key, value })
  }

  return sections
}

function getDirective(
  sections: Map<string, Array<{ key: string; value: string }>>,
  section: string,
  key: string
) {
  const directives =
    sections.get(section)?.filter(item => item.key.toLowerCase() === key.toLowerCase()) || []

  return directives.at(-1)?.value || ''
}

function getDirectives(
  sections: Map<string, Array<{ key: string; value: string }>>,
  section: string,
  key: string
) {
  return (
    sections
      .get(section)
      ?.filter(item => item.key.toLowerCase() === key.toLowerCase())
      .map(item => item.value) || []
  )
}

function findDuplicateScalarDirectives(
  sections: Map<string, Array<{ key: string; value: string }>>
) {
  return SINGLETON_SERVICE_DIRECTIVES.filter(
    key => getDirectives(sections, 'Service', key).length > 1
  )
}

function hasUnterminatedContinuation(source: string) {
  const lines = source.split(/\r?\n/u)
  const lastLine = [...lines].reverse().find(line => line.trim())
  if (!lastLine) return false

  const rightTrimmed = lastLine.replace(/\s+$/u, '')

  return rightTrimmed.endsWith('\\') && !rightTrimmed.endsWith('\\\\')
}

function parseSystemdWorkspace(input: string): ParsedSystemd {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const capped = input.length > WORKSPACE_LIMIT
  const syntaxHints: string[] = []

  if (!source.includes('[Unit]') && source.trim()) syntaxHints.push('missing_unit_section')
  if (hasUnterminatedContinuation(source)) syntaxHints.push('unterminated_continuation')
  const chunks = source
    .split(/(?=^\[Unit\])/gmu)
    .map(chunk => chunk.trim())
    .filter(Boolean)
    .slice(0, UNIT_RENDER_LIMIT)
  const units = chunks.map(chunk => {
    const sections = parseSections(chunk)
    const environment = getDirectives(sections, 'Service', 'Environment')
    const rawExecStarts = getDirectives(sections, 'Service', 'ExecStart')
    const execStarts = rawExecStarts.filter(value => value.trim())
    const execStartResets = rawExecStarts.length - execStarts.length
    const timerSchedules = [
      ...getDirectives(sections, 'Timer', 'OnCalendar'),
      ...getDirectives(sections, 'Timer', 'OnActiveSec'),
      ...getDirectives(sections, 'Timer', 'OnBootSec'),
      ...getDirectives(sections, 'Timer', 'OnStartupSec'),
      ...getDirectives(sections, 'Timer', 'OnUnitActiveSec'),
      ...getDirectives(sections, 'Timer', 'OnUnitInactiveSec')
    ].filter(Boolean)
    const hasHardening = SERVICE_HARDENING_KEYS.some(key =>
      Boolean(getDirective(sections, 'Service', key))
    )
    const onCalendar = getDirective(sections, 'Timer', 'OnCalendar')
    const unitType = sections.has('Timer') ? 'timer' : sections.has('Service') ? 'service' : 'unit'

    return {
      capabilityBoundingSet: getDirective(sections, 'Service', 'CapabilityBoundingSet'),
      description: getDirective(sections, 'Unit', 'Description'),
      duplicateScalarDirectives: findDuplicateScalarDirectives(sections),
      environment,
      environmentFiles: getDirectives(sections, 'Service', 'EnvironmentFile'),
      execStartResets,
      execStart: execStarts[0] || '',
      execStarts,
      hasHardening,
      hasInstall: sections.has('Install'),
      hasTimer: sections.has('Timer'),
      installWantedBy: getDirective(sections, 'Install', 'WantedBy'),
      onCalendar,
      persistent: /^yes$/iu.test(getDirective(sections, 'Timer', 'Persistent')),
      randomDelay: getDirective(sections, 'Timer', 'RandomizedDelaySec'),
      readWritePaths: getDirectives(sections, 'Service', 'ReadWritePaths'),
      restart: getDirective(sections, 'Service', 'Restart'),
      restartSec: getDirective(sections, 'Service', 'RestartSec'),
      restrictSuidSgid: getDirective(sections, 'Service', 'RestrictSUIDSGID'),
      sections: Array.from(sections.keys()),
      serviceType: getDirective(sections, 'Service', 'Type') || 'simple',
      sensitiveEnv: environment.filter(hasPlainSensitiveValue),
      startLimitBurst: getDirective(sections, 'Service', 'StartLimitBurst'),
      startLimitIntervalSec: getDirective(sections, 'Service', 'StartLimitIntervalSec'),
      stateDirectory: getDirective(sections, 'Service', 'StateDirectory'),
      timerExecStart: getDirective(sections, 'Timer', 'ExecStart'),
      timerSchedules,
      timerUnit: getDirective(sections, 'Timer', 'Unit'),
      unitType,
      user: getDirective(sections, 'Service', 'User'),
      workingDirectory: getDirective(sections, 'Service', 'WorkingDirectory')
    }
  })

  return { capped, syntaxHints, units }
}

function isValidTimerExpression(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^(hourly|daily|weekly|monthly|yearly|annually|quarterly|semiannually)$/iu.test(trimmed))
    return true
  if (/\d{2}:\d{2}|\bMon\b|\bTue\b|\bWed\b|\bThu\b|\bFri\b|\bSat\b|\bSun\b|\*/iu.test(trimmed))
    return true

  return false
}

function auditDraft(draft: SystemdDraft, parsed: ParsedSystemd): Finding[] {
  const findings: Finding[] = []
  const envLines = splitLines(draft.environmentLines)
  const secretKeys = splitLines(draft.secretKeys)

  for (const subject of collectUnsafeDraftSubjects(draft)) {
    findings.push({ key: 'unsafe_field_value', level: 'danger', subject })
  }
  if (!draft.serviceName.trim())
    findings.push({ key: 'service_name_missing', level: 'danger', subject: 'serviceName' })
  if (!draft.description.trim())
    findings.push({ key: 'description_missing', level: 'warn', subject: 'Description' })
  if (!draft.execStart.trim())
    findings.push({ key: 'exec_start_missing', level: 'danger', subject: 'ExecStart' })
  if (isShellExec(draft.execStart))
    findings.push({ key: 'exec_shell_pipeline', level: 'danger', subject: draft.execStart })
  if (draft.execStart.trim() && hasShellMetachar(draft.execStart) && !isShellExec(draft.execStart))
    findings.push({ key: 'exec_shell_metachar', level: 'warn', subject: draft.execStart })
  if (/\bsudo\b/iu.test(draft.execStart))
    findings.push({ key: 'exec_sudo', level: 'danger', subject: draft.execStart })
  if (!draft.workingDirectory.trim() && !draft.dynamicUser)
    findings.push({ key: 'working_directory_missing', level: 'warn', subject: 'WorkingDirectory' })
  if (draft.workingDirectory.trim() && !isValidWorkingDirectory(draft.workingDirectory))
    findings.push({
      key: 'working_directory_relative',
      level: 'danger',
      subject: draft.workingDirectory
    })
  if (draft.workingDirectory.trim() && isRiskyWorkingDirectory(draft.workingDirectory))
    findings.push({
      key: 'working_directory_risky',
      level: 'warn',
      subject: draft.workingDirectory
    })
  if (!draft.dynamicUser && isRootUser(draft.userName))
    findings.push({ key: 'root_user', level: 'danger', subject: draft.userName || 'root' })
  if (draft.restartPolicy === 'no' && draft.unitMode === 'service')
    findings.push({ key: 'restart_missing', level: 'warn', subject: 'Restart' })
  if (draft.unitMode === 'service' && draft.restartPolicy !== 'no' && !draft.restartSec.trim())
    findings.push({ key: 'restart_sec_missing', level: 'warn', subject: 'RestartSec' })
  if (
    draft.unitMode === 'service' &&
    draft.restartSec.trim() &&
    parseDurationSeconds(draft.restartSec) < 2
  )
    findings.push({ key: 'restart_sec_low', level: 'warn', subject: draft.restartSec })
  if (!draft.startLimitBurst.trim() || !draft.startLimitIntervalSec.trim())
    findings.push({ key: 'start_limit_missing', level: 'warn', subject: 'StartLimit' })
  if (!draft.memoryMax.trim())
    findings.push({ key: 'memory_limit_missing', level: 'warn', subject: 'MemoryMax' })
  if (!draft.cpuQuota.trim())
    findings.push({ key: 'cpu_quota_missing', level: 'warn', subject: 'CPUQuota' })
  if (secretKeys.length > 0 && !draft.environmentFile.trim())
    findings.push({ key: 'environment_file_missing', level: 'danger', subject: 'EnvironmentFile' })
  for (const line of envLines) {
    if (hasPlainSensitiveValue(line))
      findings.push({
        key: 'plain_secret_env',
        level: 'danger',
        subject: line.split('=')[0] || line
      })
  }
  if (!draft.noNewPrivileges)
    findings.push({ key: 'nonewprivileges_missing', level: 'warn', subject: 'NoNewPrivileges' })
  if (!draft.privateTmp)
    findings.push({ key: 'private_tmp_missing', level: 'warn', subject: 'PrivateTmp' })
  if (!draft.protectSystem)
    findings.push({ key: 'protect_system_missing', level: 'warn', subject: 'ProtectSystem' })
  if (!draft.protectHome)
    findings.push({ key: 'protect_home_missing', level: 'warn', subject: 'ProtectHome' })
  if (!draft.privateDevices)
    findings.push({ key: 'private_devices_missing', level: 'warn', subject: 'PrivateDevices' })
  if (!draft.restrictSuidSgid)
    findings.push({ key: 'restrict_suid_missing', level: 'warn', subject: 'RestrictSUIDSGID' })
  if (!draft.capabilityBoundingSet.trim())
    findings.push({
      key: 'capability_bounding_missing',
      level: 'warn',
      subject: 'CapabilityBoundingSet'
    })
  if (!draft.stateDirectory.trim())
    findings.push({ key: 'state_directory_missing', level: 'warn', subject: 'StateDirectory' })
  for (const path of splitLines(draft.readWritePaths)) {
    if (draft.protectSystem && normalizeSystemdPath(path) === '/')
      findings.push({ key: 'root_write_path', level: 'danger', subject: path })
  }
  if (draft.unitMode === 'timer') {
    if (!isValidTimerExpression(draft.onCalendar))
      findings.push({ key: 'timer_invalid', level: 'danger', subject: draft.onCalendar })
    if (!draft.persistentTimer)
      findings.push({ key: 'timer_persistent_missing', level: 'warn', subject: 'Persistent' })
    if (!draft.randomDelaySec.trim())
      findings.push({
        key: 'timer_random_delay_missing',
        level: 'warn',
        subject: 'RandomizedDelaySec'
      })
  }

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: String(WORKSPACE_LIMIT) })
  if (parsed.syntaxHints.includes('missing_unit_section'))
    findings.push({ key: 'parsed_missing_unit', level: 'danger', subject: 'workspace' })
  if (parsed.syntaxHints.includes('unterminated_continuation'))
    findings.push({
      key: 'parsed_unterminated_continuation',
      level: 'danger',
      subject: 'workspace'
    })
  if (parsed.units.length === 0)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })
  for (const unit of parsed.units) {
    const subject = unit.description || unit.unitType
    if (unit.unitType === 'service' && !unit.execStart)
      findings.push({ key: 'parsed_no_execstart', level: 'danger', subject })
    if (unit.execStartResets > 0)
      findings.push({
        key: 'parsed_reset_directive',
        level: 'warn',
        subject: `${subject}: ExecStart=`
      })
    for (const directive of unit.duplicateScalarDirectives) {
      findings.push({
        key: 'parsed_duplicate_scalar',
        level: 'warn',
        subject: `${subject}: ${directive}`
      })
    }
    if (
      unit.unitType === 'service' &&
      unit.execStarts.length > 1 &&
      unit.serviceType.toLowerCase() !== 'oneshot'
    )
      findings.push({ key: 'parsed_multiple_execstart', level: 'danger', subject })
    for (const execStart of unit.execStarts) {
      if (isShellExec(execStart))
        findings.push({ key: 'parsed_shell_exec', level: 'danger', subject })
      if (hasShellMetachar(execStart) && !isShellExec(execStart))
        findings.push({ key: 'parsed_exec_shell_metachar', level: 'warn', subject: execStart })
      if (/\bsudo\b/iu.test(execStart))
        findings.push({ key: 'parsed_sudo_exec', level: 'danger', subject })
    }
    if (unit.unitType === 'service' && isRootUser(unit.user))
      findings.push({ key: 'parsed_root_user', level: 'danger', subject })
    if (unit.unitType === 'service' && !unit.workingDirectory)
      findings.push({ key: 'parsed_no_workdir', level: 'warn', subject })
    if (unit.workingDirectory && !isValidWorkingDirectory(unit.workingDirectory))
      findings.push({
        key: 'parsed_workdir_relative',
        level: 'danger',
        subject: unit.workingDirectory
      })
    if (unit.workingDirectory && isRiskyWorkingDirectory(unit.workingDirectory))
      findings.push({ key: 'parsed_workdir_risky', level: 'warn', subject: unit.workingDirectory })
    if (unit.unitType === 'service' && !unit.restart)
      findings.push({ key: 'parsed_no_restart', level: 'warn', subject })
    if (
      unit.unitType === 'service' &&
      unit.serviceType.toLowerCase() === 'oneshot' &&
      unit.restart === 'always'
    )
      findings.push({ key: 'parsed_restart_invalid_oneshot', level: 'danger', subject })
    if (
      unit.unitType === 'service' &&
      unit.restart === 'always' &&
      (!unit.restartSec || !unit.startLimitBurst || !unit.startLimitIntervalSec)
    )
      findings.push({ key: 'parsed_restart_unbounded', level: 'warn', subject })
    if (unit.restartSec && parseDurationSeconds(unit.restartSec) < 2)
      findings.push({ key: 'parsed_restart_sec_low', level: 'warn', subject: unit.restartSec })
    if (unit.unitType === 'service' && !unit.hasHardening)
      findings.push({ key: 'parsed_no_hardening', level: 'warn', subject })
    if (unit.unitType === 'service' && !unit.restrictSuidSgid)
      findings.push({ key: 'parsed_restrict_suid_missing', level: 'warn', subject })
    if (unit.unitType === 'service' && !unit.capabilityBoundingSet)
      findings.push({ key: 'parsed_capability_unbounded', level: 'warn', subject })
    if (unit.unitType === 'service' && !unit.stateDirectory && unit.readWritePaths.length > 0)
      findings.push({ key: 'parsed_state_directory_missing', level: 'warn', subject })
    if (!unit.hasInstall && unit.serviceType.toLowerCase() !== 'oneshot')
      findings.push({ key: 'parsed_no_install', level: 'warn', subject })
    if (
      unit.unitType === 'service' &&
      unit.serviceType.toLowerCase() === 'oneshot' &&
      unit.hasInstall &&
      unit.installWantedBy === 'multi-user.target'
    )
      findings.push({ key: 'parsed_timer_service_install_unneeded', level: 'warn', subject })
    for (const env of unit.sensitiveEnv)
      findings.push({
        key: 'parsed_plain_secret',
        level: 'danger',
        subject: env.split('=')[0] || env
      })
    if (unit.unitType === 'timer') {
      if (unit.timerExecStart)
        findings.push({ key: 'parsed_timer_execstart', level: 'danger', subject })
      if (unit.timerSchedules.length === 0)
        findings.push({ key: 'parsed_timer_no_schedule', level: 'danger', subject })
      if (unit.onCalendar && !isValidTimerExpression(unit.onCalendar))
        findings.push({ key: 'parsed_timer_invalid', level: 'danger', subject })
      if (!unit.persistent)
        findings.push({ key: 'parsed_timer_not_persistent', level: 'warn', subject })
      if (!unit.randomDelay)
        findings.push({ key: 'parsed_timer_no_random_delay', level: 'warn', subject })
      if (unit.installWantedBy && unit.installWantedBy !== 'timers.target')
        findings.push({
          key: 'parsed_timer_wrong_install_target',
          level: 'danger',
          subject: unit.installWantedBy
        })
      if (!unit.timerUnit)
        findings.push({ key: 'parsed_timer_orphan_service', level: 'warn', subject })
    }
  }

  if (findings.length === 0)
    findings.push({ key: 'baseline_ok', level: 'good', subject: draft.serviceName || 'systemd' })

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

export default function SystemdClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<SystemdDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputType, setOutputType] = useState<OutputType>('service')
  const deferredWorkspace = useDeferredValue(workspace)

  const serviceOutput = useMemo(() => buildServiceUnit(draft), [draft])
  const timerOutput = useMemo(() => buildTimerUnit(draft), [draft])
  const parsed = useMemo(() => parseSystemdWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditDraft(draft, parsed), [draft, parsed])
  const csvOutput = useMemo(() => buildCsv(findings), [findings])
  const outputValue = useMemo(() => {
    if (outputType === 'service') return serviceOutput
    if (outputType === 'timer') return timerOutput
    if (outputType === 'env') return buildEnvFile(draft)
    if (outputType === 'commands') return buildInstallCommands(draft)
    if (outputType === 'hardening') return buildHardeningSnippet(draft)
    if (outputType === 'override') return buildOverrideConf(draft)
    if (outputType === 'json') return JSON.stringify({ draft, findings, parsed }, null, 2)
    if (outputType === 'csv') return csvOutput

    return buildMarkdown(draft, findings, parsed)
  }, [csvOutput, draft, findings, outputType, parsed, serviceOutput, timerOutput])

  const filteredFindings = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return findings

    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.systemd.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, findings, t])

  const metrics = useMemo(() => {
    const critical = findings.filter(item => item.level === 'danger').length
    const warnings = findings.filter(item => item.level === 'warn').length
    const timers = parsed.units.filter(unit => unit.unitType === 'timer').length
    const secrets =
      splitLines(draft.secretKeys).length +
      parsed.units.reduce((sum, unit) => sum + unit.sensitiveEnv.length, 0)

    return {
      critical,
      secrets,
      status:
        critical > 0
          ? t('app.generation.systemd.status.risk')
          : warnings > 0
            ? t('app.generation.systemd.status.review')
            : t('app.generation.systemd.status.ready'),
      timers,
      units: parsed.units.length,
      warnings
    }
  }, [draft.secretKeys, findings, parsed.units, t])

  const updateDraft = useCallback(
    <K extends keyof SystemdDraft>(key: K, value: SystemdDraft[K]) => {
      setDraft(current => ({ ...current, [key]: value }))
    },
    []
  )

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setOutputType(preset.draft.unitMode === 'timer' ? 'timer' : 'service')
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0].workspace)
    setAuditQuery('')
    setOutputType('service')
  }, [])

  const copySummary = useCallback(() => {
    copy(
      [
        t('app.generation.systemd.summary_title'),
        `${t('app.generation.systemd.metric.status')}: ${metrics.status}`,
        `${t('app.generation.systemd.metric.units')}: ${metrics.units}`,
        `${t('app.generation.systemd.metric.timers')}: ${metrics.timers}`,
        `${t('app.generation.systemd.metric.secrets')}: ${metrics.secrets}`,
        `${t('app.generation.systemd.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.systemd.metric.critical')}: ${metrics.critical}`
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
                  <ServerCog className="h-3.5 w-3.5" />
                  {t('app.generation.systemd')}
                </div>
                <CardTitle className="mt-2 text-2xl">{t('app.generation.systemd')}</CardTitle>
                <CardDescription>{t('app.generation.systemd.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copySummary}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('app.generation.systemd.copy_summary')}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('public.reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label={t('app.generation.systemd.metric.status')} value={metrics.status} />
            <Metric label={t('app.generation.systemd.metric.units')} value={metrics.units} />
            <Metric label={t('app.generation.systemd.metric.timers')} value={metrics.timers} />
            <Metric label={t('app.generation.systemd.metric.secrets')} value={metrics.secrets} />
            <Metric label={t('app.generation.systemd.metric.warnings')} value={metrics.warnings} />
            <Metric label={t('app.generation.systemd.metric.critical')} value={metrics.critical} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.systemd.presets')}</CardTitle>
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
                  {t(`app.generation.systemd.preset.${preset.key}`)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.systemd.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.generation.systemd.builder')}</CardTitle>
              <CardDescription>{t('app.generation.systemd.builder_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="systemd-name">{t('app.generation.systemd.service_name')}</Label>
                  <Input
                    id="systemd-name"
                    value={draft.serviceName}
                    onChange={event => updateDraft('serviceName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-description">
                    {t('app.generation.systemd.unit_description')}
                  </Label>
                  <Input
                    id="systemd-description"
                    value={draft.description}
                    onChange={event => updateDraft('description', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-mode">{t('app.generation.systemd.unit_mode')}</Label>
                  <Select
                    id="systemd-mode"
                    value={draft.unitMode}
                    onChange={event => updateDraft('unitMode', event.target.value as UnitMode)}
                  >
                    {UNIT_MODES.map(mode => (
                      <option key={mode} value={mode}>
                        {t(`app.generation.systemd.mode.${mode}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-user">{t('app.generation.systemd.user_name')}</Label>
                  <Input
                    id="systemd-user"
                    value={draft.userName}
                    onChange={event => updateDraft('userName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-group">{t('app.generation.systemd.group_name')}</Label>
                  <Input
                    id="systemd-group"
                    value={draft.groupName}
                    onChange={event => updateDraft('groupName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-workdir">
                    {t('app.generation.systemd.working_directory')}
                  </Label>
                  <Input
                    id="systemd-workdir"
                    value={draft.workingDirectory}
                    onChange={event => updateDraft('workingDirectory', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2 xl:col-span-3">
                  <Label htmlFor="systemd-exec">{t('app.generation.systemd.exec_start')}</Label>
                  <Input
                    id="systemd-exec"
                    value={draft.execStart}
                    onChange={event => updateDraft('execStart', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="systemd-env">
                    {t('app.generation.systemd.environment_lines')}
                  </Label>
                  <Textarea
                    id="systemd-env"
                    value={draft.environmentLines}
                    onChange={event => updateDraft('environmentLines', event.target.value)}
                    className="min-h-[110px] font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-secret">{t('app.generation.systemd.secret_keys')}</Label>
                  <Textarea
                    id="systemd-secret"
                    value={draft.secretKeys}
                    onChange={event => updateDraft('secretKeys', event.target.value)}
                    className="min-h-[110px] font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-envfile">
                    {t('app.generation.systemd.environment_file')}
                  </Label>
                  <Input
                    id="systemd-envfile"
                    value={draft.environmentFile}
                    onChange={event => updateDraft('environmentFile', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-restart">
                    {t('app.generation.systemd.restart_policy')}
                  </Label>
                  <Select
                    id="systemd-restart"
                    value={draft.restartPolicy}
                    onChange={event =>
                      updateDraft('restartPolicy', event.target.value as RestartPolicy)
                    }
                  >
                    {RESTART_POLICIES.map(policy => (
                      <option key={policy} value={policy}>
                        {t(`app.generation.systemd.restart.${policy}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-restart-sec">
                    {t('app.generation.systemd.restart_sec')}
                  </Label>
                  <Input
                    id="systemd-restart-sec"
                    value={draft.restartSec}
                    onChange={event => updateDraft('restartSec', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-memory">{t('app.generation.systemd.memory_max')}</Label>
                  <Input
                    id="systemd-memory"
                    value={draft.memoryMax}
                    onChange={event => updateDraft('memoryMax', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-cpu">{t('app.generation.systemd.cpu_quota')}</Label>
                  <Input
                    id="systemd-cpu"
                    value={draft.cpuQuota}
                    onChange={event => updateDraft('cpuQuota', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-after">{t('app.generation.systemd.after_targets')}</Label>
                  <Input
                    id="systemd-after"
                    value={draft.afterTargets}
                    onChange={event => updateDraft('afterTargets', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-wanted">{t('app.generation.systemd.wanted_by')}</Label>
                  <Input
                    id="systemd-wanted"
                    value={draft.wantedBy}
                    onChange={event => updateDraft('wantedBy', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-on-calendar">
                    {t('app.generation.systemd.on_calendar')}
                  </Label>
                  <Input
                    id="systemd-on-calendar"
                    value={draft.onCalendar}
                    onChange={event => updateDraft('onCalendar', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-random-delay">
                    {t('app.generation.systemd.random_delay')}
                  </Label>
                  <Input
                    id="systemd-random-delay"
                    value={draft.randomDelaySec}
                    onChange={event => updateDraft('randomDelaySec', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-readwrite">
                    {t('app.generation.systemd.read_write_paths')}
                  </Label>
                  <Textarea
                    id="systemd-readwrite"
                    value={draft.readWritePaths}
                    onChange={event => updateDraft('readWritePaths', event.target.value)}
                    className="min-h-[92px] font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="systemd-state-directory">
                    {t('app.generation.systemd.state_directory')}
                  </Label>
                  <Input
                    id="systemd-state-directory"
                    value={draft.stateDirectory}
                    onChange={event => updateDraft('stateDirectory', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="systemd-capability">
                    {t('app.generation.systemd.capability_bounding_set')}
                  </Label>
                  <Input
                    id="systemd-capability"
                    value={draft.capabilityBoundingSet}
                    onChange={event => updateDraft('capabilityBoundingSet', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  checked={draft.dynamicUser}
                  onChange={event => updateDraft('dynamicUser', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.dynamic_user')}
                />
                <Checkbox
                  checked={draft.noNewPrivileges}
                  onChange={event => updateDraft('noNewPrivileges', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.no_new_privileges')}
                />
                <Checkbox
                  checked={draft.privateTmp}
                  onChange={event => updateDraft('privateTmp', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.private_tmp')}
                />
                <Checkbox
                  checked={draft.privateDevices}
                  onChange={event => updateDraft('privateDevices', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.private_devices')}
                />
                <Checkbox
                  checked={draft.protectSystem}
                  onChange={event => updateDraft('protectSystem', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.protect_system')}
                />
                <Checkbox
                  checked={draft.protectHome}
                  onChange={event => updateDraft('protectHome', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.protect_home')}
                />
                <Checkbox
                  checked={draft.lockPersonality}
                  onChange={event => updateDraft('lockPersonality', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.lock_personality')}
                />
                <Checkbox
                  checked={draft.restrictAddressFamilies}
                  onChange={event => updateDraft('restrictAddressFamilies', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.restrict_address_families')}
                />
                <Checkbox
                  checked={draft.restrictSuidSgid}
                  onChange={event => updateDraft('restrictSuidSgid', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.restrict_suid_sgid')}
                />
                <Checkbox
                  checked={draft.persistentTimer}
                  onChange={event => updateDraft('persistentTimer', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.systemd.persistent_timer')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.systemd.audit')}</CardTitle>
              <CardDescription>{t('app.generation.systemd.audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  className="pl-9"
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value)}
                  placeholder={t('app.generation.systemd.audit_search')}
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
                        {t(`app.generation.systemd.audit.${finding.key}`)}
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
              <CardTitle className="text-base">{t('app.generation.systemd.workspace')}</CardTitle>
              <CardDescription>{t('app.generation.systemd.workspace_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea
                value={workspace}
                onChange={event => setWorkspace(event.target.value)}
                placeholder={t('app.generation.systemd.workspace_placeholder')}
                className="min-h-[260px] font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setWorkspace(
                      draft.unitMode === 'timer'
                        ? `${serviceOutput}\n\n${timerOutput}`
                        : serviceOutput
                    )
                  }
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('app.generation.systemd.use_output')}
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
              <CardTitle className="text-base">{t('app.generation.systemd.output')}</CardTitle>
              <CardDescription>{t('app.generation.systemd.output_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="systemd-output-type">
                  {t('app.generation.systemd.output_type')}
                </Label>
                <Select
                  id="systemd-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.systemd.output.${type}`)}
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
                  {t('app.generation.systemd.copy_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      outputValue,
                      getOutputFilename(outputType, draft.serviceName),
                      outputType === 'json'
                        ? 'application/json;charset=utf-8'
                        : outputType === 'csv'
                          ? 'text/csv;charset=utf-8'
                          : 'text/plain;charset=utf-8'
                    )
                  }
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('app.generation.systemd.download_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadText(
                      csvOutput,
                      getOutputFilename('csv', draft.serviceName),
                      'text/csv;charset=utf-8'
                    )
                  }
                  className="w-full sm:w-auto"
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {t('app.generation.systemd.download_csv')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.systemd.parsed')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {parsed.units.length === 0 ? (
              <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--text-muted)]">
                {t('app.generation.systemd.empty')}
              </div>
            ) : (
              parsed.units.map((unit, index) => (
                <div
                  key={`${unit.description}-${index}`}
                  className="glass-panel min-w-0 rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
                      {unit.description || unit.unitType}
                    </p>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                      {t(`app.generation.systemd.parsed.${unit.unitType}`)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
                    <span>
                      {t('app.generation.systemd.parsed.user')}: {unit.user || '-'}
                    </span>
                    <span>
                      {t('app.generation.systemd.parsed.restart')}: {unit.restart || '-'}
                    </span>
                    <span>
                      {t('app.generation.systemd.parsed.workdir')}: {unit.workingDirectory || '-'}
                    </span>
                    <span>
                      {t('app.generation.systemd.parsed.hardening')}:{' '}
                      {unit.hasHardening
                        ? t('app.generation.systemd.level.good')
                        : t('app.generation.systemd.level.warn')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.systemd.reference')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {['user', 'secrets', 'restart', 'hardening', 'timer'].map(item => (
              <div key={item} className="glass-panel rounded-2xl p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.systemd.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.systemd.reference.${item}_hint`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
