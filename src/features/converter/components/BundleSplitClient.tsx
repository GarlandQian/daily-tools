'use client'

import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  GitBranch,
  ListChecks,
  PackageSearch,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'

const DEVICES = ['mobile', 'desktop'] as const
const OUTPUT_TYPES = ['dynamic', 'next', 'budget', 'markdown', 'json', 'csv'] as const
const IMPORT_KINDS = ['component', 'library', 'route', 'worker'] as const
const WORKSPACE_LIMIT = 70000
const ROUTE_LIMIT = 160
const CHUNK_LIMIT = 180

type Device = (typeof DEVICES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type ImportKind = (typeof IMPORT_KINDS)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface BundleSplitDraft {
  appKb: string
  chunkKb: string
  chunkName: string
  device: Device
  dynamicCandidate: string
  firstLoadKb: string
  frameworkKb: string
  importKind: ImportKind
  initialChunks: string
  packageName: string
  routeCount: string
  routeJsKb: string
  routePattern: string
  serverOnlyPackage: string
  sharedKb: string
  thirdPartyKb: string
}

interface ParsedRoute {
  chunks: number
  firstLoadKb: number
  route: string
  routeJsKb: number
  source: 'json' | 'text'
}

interface ParsedChunk {
  id: string
  initial: boolean
  name: string
  packageName: string
  route: string
  sizeKb: number
  source: 'json' | 'text'
}

interface ParsedWorkspace {
  chunks: ParsedChunk[]
  errors: string[]
  rawRows: Array<{ label: string; value: string }>
  routes: ParsedRoute[]
}

interface Preset {
  draft: BundleSplitDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: BundleSplitDraft = {
  appKb: '96',
  chunkKb: '128',
  chunkName: 'components-chart-panel',
  device: 'mobile',
  dynamicCandidate: '@/components/ChartPanel',
  firstLoadKb: '170',
  frameworkKb: '88',
  importKind: 'component',
  initialChunks: '8',
  packageName: 'recharts',
  routeCount: '12',
  routeJsKb: '72',
  routePattern: '/dashboard',
  serverOnlyPackage: '',
  sharedKb: '110',
  thirdPartyKb: '120'
}

const PRESETS: Preset[] = [
  {
    key: 'next_build',
    draft: DEFAULT_DRAFT,
    workspace: [
      'Route (app)                              Size     First Load JS',
      '┌ ○ /                                    6.2 kB          168 kB',
      '├ ○ /dashboard                          42.5 kB         242 kB',
      '├ ○ /products/[slug]                    28.4 kB         216 kB',
      '+ First Load JS shared by all            112 kB',
      '  chunks/framework-9f4a1.js              88 kB',
      '  chunks/main-app-8ad31.js               24 kB'
    ].join('\n')
  },
  {
    key: 'dashboard_shell',
    draft: {
      ...DEFAULT_DRAFT,
      appKb: '150',
      chunkKb: '280',
      chunkName: 'vendors-charts-grid',
      dynamicCandidate: '@/components/DataGridPanel',
      firstLoadKb: '310',
      initialChunks: '16',
      packageName: '@tanstack/react-table',
      routeCount: '34',
      routeJsKb: '190',
      sharedKb: '220',
      thirdPartyKb: '180'
    },
    workspace: [
      'route=/dashboard firstLoad=310KB routeJs=190KB chunks=16',
      'chunk=vendors-charts-grid size=280KB package=@tanstack/react-table initial=true route=/dashboard',
      'chunk=recharts size=192KB package=recharts initial=true route=/dashboard',
      'chunk=filters-panel size=84KB package=local initial=false route=/dashboard'
    ].join('\n')
  },
  {
    key: 'commerce_pdp',
    draft: {
      ...DEFAULT_DRAFT,
      chunkName: 'product-reviews',
      dynamicCandidate: '@/components/ProductReviews',
      firstLoadKb: '255',
      packageName: 'swiper',
      routeJsKb: '118',
      routePattern: '/products/:slug',
      sharedKb: '150',
      thirdPartyKb: '260'
    },
    workspace: [
      'route,/products/example,255KB,118KB,11',
      'chunk,product-gallery,96KB,swiper,true,/products/example',
      'chunk,reviews-widget,124KB,@reviews/embed,true,/products/example',
      'chunk,recommendations,88KB,local,false,/products/example'
    ].join('\n')
  },
  {
    key: 'marketing_tags',
    draft: {
      ...DEFAULT_DRAFT,
      chunkName: 'tag-manager',
      dynamicCandidate: 'https://tags.example.com/analytics.js',
      firstLoadKb: '230',
      importKind: 'library',
      packageName: 'third-party-tags',
      routeJsKb: '82',
      routePattern: '/campaign/:slug',
      sharedKb: '130',
      thirdPartyKb: '420'
    },
    workspace: [
      '{"routes":[{"path":"/campaign/summer","firstLoadJs":230,"routeJs":82,"chunks":10}],"chunks":[{"name":"tag-manager","size":210,"package":"third-party-tags","initial":true,"route":"/campaign/summer"},{"name":"video-embed","size":168,"package":"@video/embed","initial":true,"route":"/campaign/summer"}]}'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      appKb: '420',
      chunkKb: '640',
      chunkName: 'vendors-admin-prisma-sharp',
      device: 'mobile',
      dynamicCandidate: '',
      firstLoadKb: '780',
      frameworkKb: '210',
      importKind: 'library',
      initialChunks: '31',
      packageName: '@mui/icons-material',
      routeCount: '74',
      routeJsKb: '360',
      routePattern: '/checkout',
      serverOnlyPackage: 'prisma, sharp',
      sharedKb: '520',
      thirdPartyKb: '640'
    },
    workspace: [
      'route=/checkout firstLoad=780KB routeJs=360KB chunks=31',
      'route=/account firstLoad=612KB routeJs=190KB chunks=22',
      'chunk=vendors-admin-prisma-sharp size=640KB package=prisma initial=true route=/checkout',
      'chunk=vendors-admin-prisma-sharp size=640KB package=sharp initial=true route=/account',
      'chunk=@mui-icons-material size=420KB package=@mui/icons-material initial=true route=/checkout',
      'chunk=checkout-sync-search size=310KB package=local initial=true route=/checkout',
      '{"name":"server-leak","size":260,"packageName":"fs","initial":true,"route":"/checkout"}'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['measure', 'split', 'third_party', 'server_only'] as const
const REFERENCE_ITEMS = [
  'first_load',
  'route_js',
  'shared',
  'dynamic',
  'third_party',
  'server_only'
] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const textValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.match(/([\d.,]+)\s*(b|kb|kib|mb|mib)?/iu)
    if (!match?.[1]) return null
    const amount = Number(match[1].replace(/,/g, ''))
    if (!Number.isFinite(amount)) return null
    const unit = match[2]?.toLowerCase() ?? 'kb'
    if (unit === 'b') return amount / 1024
    if (unit === 'mb' || unit === 'mib') return amount * 1024
    return amount
  }
  return null
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const boolValue = (value: unknown) => {
  if (typeof value === 'boolean') return value
  return /^(true|yes|initial|1)$/iu.test(String(value ?? ''))
}

const routeFromRecord = (record: Record<string, unknown>): string =>
  textValue(record.route ?? record.path ?? record.pathname ?? record.url)

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const next = numericValue(value)
    if (next !== null) return round(next)
  }
  return 0
}

const chunkFromRecord = (record: Record<string, unknown>, index: number): ParsedChunk | null => {
  const name = textValue(record.name ?? record.chunk ?? record.chunkName ?? record.label)
  const sizeKb = firstNumber(
    record.sizeKb,
    record.sizeKB,
    record.size,
    record.parsedSize,
    record.gzipSize,
    record.transferSize
  )
  const packageName = textValue(record.packageName ?? record.package ?? record.pkg ?? record.module)
  if (!name && !packageName) return null
  if (!sizeKb) return null
  return {
    id: textValue(record.id) || `json-chunk-${index + 1}`,
    initial: boolValue(record.initial ?? record.isInitial ?? record.firstLoad),
    name: name || packageName || `chunk-${index + 1}`,
    packageName,
    route: routeFromRecord(record),
    sizeKb,
    source: 'json'
  }
}

const routeRecordFromRecord = (record: Record<string, unknown>): ParsedRoute | null => {
  const route = routeFromRecord(record)
  const firstLoadKb = firstNumber(
    record.firstLoadKb,
    record.firstLoadKB,
    record.firstLoadJs,
    record.firstLoadJS,
    record.firstLoad
  )
  if (!route || !firstLoadKb) return null
  return {
    chunks: Math.round(firstNumber(record.chunks, record.initialChunks, record.chunkCount)),
    firstLoadKb,
    route,
    routeJsKb: firstNumber(
      record.routeJsKb,
      record.routeJSKb,
      record.routeJs,
      record.size,
      record.sizeKb
    ),
    source: 'json'
  }
}

const collectJson = (value: unknown, parsed: ParsedWorkspace, depth = 0) => {
  if (depth > 6 || parsed.chunks.length >= CHUNK_LIMIT || parsed.routes.length >= ROUTE_LIMIT)
    return
  if (Array.isArray(value)) {
    value.forEach(item => collectJson(item, parsed, depth + 1))
    return
  }
  const record = asRecord(value)
  if (!record) return
  const route = routeRecordFromRecord(record)
  if (route) parsed.routes.push(route)
  const chunk = chunkFromRecord(record, parsed.chunks.length)
  if (chunk) parsed.chunks.push(chunk)
  Object.values(record)
    .slice(0, 40)
    .forEach(item => collectJson(item, parsed, depth + 1))
}

const parseJson = (parsed: ParsedWorkspace, input: string, reportError = true) => {
  try {
    collectJson(JSON.parse(input), parsed)
  } catch {
    if (reportError) parsed.errors.push('json_error')
  }
}

const tokenValue = (line: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = line.match(new RegExp(`${escaped}=([^\\s,]+)`, 'iu'))
  return match?.[1] ?? ''
}

const parseRouteLine = (line: string): ParsedRoute | null => {
  const tokenRoute = tokenValue(line, 'route')
  const tokenFirst = tokenValue(line, 'firstLoad')
  if (tokenRoute && tokenFirst) {
    return {
      chunks: Math.round(numericValue(tokenValue(line, 'chunks')) ?? 0),
      firstLoadKb: round(numericValue(tokenFirst) ?? 0),
      route: tokenRoute,
      routeJsKb: round(numericValue(tokenValue(line, 'routeJs')) ?? 0),
      source: 'text'
    }
  }

  const csv = line.split(',').map(item => item.trim())
  if (csv.length >= 3 && csv[0]?.startsWith('/')) {
    return {
      chunks: Math.round(numericValue(csv[3]) ?? 0),
      firstLoadKb: round(numericValue(csv[1]) ?? 0),
      route: csv[0],
      routeJsKb: round(numericValue(csv[2]) ?? 0),
      source: 'text'
    }
  }
  if (csv[0]?.toLowerCase() === 'route' && csv[1]?.startsWith('/')) {
    return {
      chunks: Math.round(numericValue(csv[4]) ?? 0),
      firstLoadKb: round(numericValue(csv[2]) ?? 0),
      route: csv[1],
      routeJsKb: round(numericValue(csv[3]) ?? 0),
      source: 'text'
    }
  }

  const nextMatch = line.match(
    /(?:[┌├└│+\s○●ƒ]*)(\/[^\s]*)\s+([\d.,]+)\s*(b|kb|kib|mb|mib)\s+([\d.,]+)\s*(b|kb|kib|mb|mib)/iu
  )
  if (nextMatch?.[1] && nextMatch[4]) {
    return {
      chunks: 0,
      firstLoadKb: round(numericValue(`${nextMatch[4]}${nextMatch[5] ?? 'kb'}`) ?? 0),
      route: nextMatch[1],
      routeJsKb: round(numericValue(`${nextMatch[2]}${nextMatch[3] ?? 'kb'}`) ?? 0),
      source: 'text'
    }
  }
  return null
}

const parseChunkLine = (line: string, index: number): ParsedChunk | null => {
  const tokenChunk = tokenValue(line, 'chunk')
  const tokenSize = tokenValue(line, 'size')
  if (tokenChunk && tokenSize) {
    return {
      id: `text-chunk-${index + 1}`,
      initial: boolValue(tokenValue(line, 'initial')),
      name: tokenChunk,
      packageName: tokenValue(line, 'package') || tokenValue(line, 'pkg'),
      route: tokenValue(line, 'route'),
      sizeKb: round(numericValue(tokenSize) ?? 0),
      source: 'text'
    }
  }

  const csv = line.split(',').map(item => item.trim())
  if (csv[0]?.toLowerCase() === 'chunk' && csv.length >= 4) {
    return {
      id: `csv-chunk-${index + 1}`,
      initial: boolValue(csv[4]),
      name: csv[1] || `chunk-${index + 1}`,
      packageName: csv[3] || '',
      route: csv[5] || '',
      sizeKb: round(numericValue(csv[2]) ?? 0),
      source: 'text'
    }
  }

  const analyzer = line.match(
    /(?:chunks\/)?([@/\w.-]+)\s+([\d.,]+)\s*(b|kb|kib|mb|mib)(?:\s+([\w@/.-]+))?/iu
  )
  if (analyzer?.[1] && analyzer[2] && !line.includes('First Load JS')) {
    return {
      id: `analyzer-chunk-${index + 1}`,
      initial: /initial|first|shared|framework|main-app/iu.test(line),
      name: analyzer[1],
      packageName: analyzer[4] ?? '',
      route: '',
      sizeKb: round(numericValue(`${analyzer[2]}${analyzer[3] ?? 'kb'}`) ?? 0),
      source: 'text'
    }
  }
  return null
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedWorkspace = { chunks: [], errors: [], rawRows: [], routes: [] }
  const trimmed = source.trim()
  const parseJsonLines = () => {
    source
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line.startsWith('{') || line.startsWith('['))
      .slice(0, ROUTE_LIMIT)
      .forEach(line => parseJson(parsed, line, false))
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const before = parsed.routes.length + parsed.chunks.length
    parseJson(parsed, trimmed)
    if (parsed.routes.length + parsed.chunks.length === before) parseJsonLines()
  } else {
    parseJsonLines()
  }

  source
    .split(/\r?\n/u)
    .slice(0, Math.max(ROUTE_LIMIT, CHUNK_LIMIT))
    .forEach((line, index) => {
      const clean = line.trim()
      if (!clean) return
      const route = parseRouteLine(clean)
      if (route) parsed.routes.push(route)
      const chunk = parseChunkLine(clean, index)
      if (chunk) parsed.chunks.push(chunk)
      if (/route=|firstLoad|First Load JS|chunk=|size=|chunks\//iu.test(clean)) {
        parsed.rawRows.push({
          label: clean.split(/\s/u)[0]?.slice(0, 80) ?? 'row',
          value: clean.slice(0, 220)
        })
      }
    })

  parsed.routes = parsed.routes.slice(0, ROUTE_LIMIT)
  parsed.chunks = parsed.chunks.slice(0, CHUNK_LIMIT)
  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const serverOnlyPattern =
  /\b(fs|path|crypto|sharp|prisma|@prisma|pg|mysql|sqlite|bcrypt|argon2|aws-sdk|nodemailer)\b/iu
const heavyPackagePattern =
  /\b(@mui\/icons-material|antd|moment|lodash|chart\.js|recharts|three|monaco|mapbox|firebase|aws-sdk)\b/iu

const isThirdPartyPackage = (value: string) => {
  if (!value || value === 'local') return false
  return (
    !value.startsWith('@/') &&
    !value.startsWith('.') &&
    !/^app|main|framework|webpack$/iu.test(value)
  )
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditBundle = (draft: BundleSplitDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const firstLoad = numberFromInput(draft.firstLoadKb)
  const routeJs = numberFromInput(draft.routeJsKb)
  const shared = numberFromInput(draft.sharedKb)
  const framework = numberFromInput(draft.frameworkKb)
  const app = numberFromInput(draft.appKb)
  const thirdParty = numberFromInput(draft.thirdPartyKb)
  const chunkSize = numberFromInput(draft.chunkKb)
  const initialChunks = numberFromInput(draft.initialChunks)
  const routeCount = numberFromInput(draft.routeCount)
  const mobile = draft.device === 'mobile'
  const firstWarn = mobile ? 170 : 350
  const firstDanger = mobile ? 350 : 600

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (firstLoad > firstDanger)
    addFinding(findings, 'danger', 'first_load_severe', `${firstLoad} KB`)
  else if (firstLoad > firstWarn)
    addFinding(findings, 'warn', 'first_load_watch', `${firstLoad} KB`)
  else addFinding(findings, 'good', 'first_load_ok', `${firstLoad} KB`)
  if (routeJs > 250) addFinding(findings, 'danger', 'route_js_severe', `${routeJs} KB`)
  else if (routeJs > 110) addFinding(findings, 'warn', 'route_js_watch', `${routeJs} KB`)
  if (shared > 400) addFinding(findings, 'danger', 'shared_severe', `${shared} KB`)
  else if (shared > 220) addFinding(findings, 'warn', 'shared_watch', `${shared} KB`)
  if (framework > 180) addFinding(findings, 'warn', 'framework_heavy', `${framework} KB`)
  if (app > firstLoad * 0.55 && firstLoad > 0)
    addFinding(findings, 'warn', 'app_chunk_dominates', `${app} KB`)
  if (thirdParty > 500) addFinding(findings, 'danger', 'third_party_severe', `${thirdParty} KB`)
  else if (thirdParty > 200) addFinding(findings, 'warn', 'third_party_watch', `${thirdParty} KB`)
  if (chunkSize > 300)
    addFinding(findings, 'danger', 'chunk_severe', `${draft.chunkName}: ${chunkSize} KB`)
  else if (chunkSize > 150)
    addFinding(findings, 'warn', 'chunk_watch', `${draft.chunkName}: ${chunkSize} KB`)
  if (initialChunks > 24)
    addFinding(findings, 'danger', 'initial_chunks_severe', String(initialChunks))
  else if (initialChunks > 14)
    addFinding(findings, 'warn', 'initial_chunks_watch', String(initialChunks))
  if (routeCount > 60 && shared > 180)
    addFinding(findings, 'warn', 'shared_across_many_routes', `${routeCount} routes`)
  if (!draft.dynamicCandidate.trim() && firstLoad > firstWarn)
    addFinding(findings, 'warn', 'missing_dynamic_candidate', draft.routePattern)
  if (heavyPackagePattern.test(draft.packageName))
    addFinding(findings, 'warn', 'heavy_package', draft.packageName)
  if (serverOnlyPattern.test(`${draft.packageName} ${draft.serverOnlyPackage}`))
    addFinding(
      findings,
      'danger',
      'server_only_client',
      `${draft.packageName} ${draft.serverOnlyPackage}`.trim()
    )

  const duplicateChunks = new Map<string, number>()
  const duplicateChunkNames = new Map<string, number>()
  parsed.chunks.forEach(chunk => {
    if (chunk.packageName)
      duplicateChunks.set(chunk.packageName, (duplicateChunks.get(chunk.packageName) ?? 0) + 1)
    if (chunk.name)
      duplicateChunkNames.set(chunk.name, (duplicateChunkNames.get(chunk.name) ?? 0) + 1)
    if (chunk.initial && chunk.sizeKb > 300)
      addFinding(
        findings,
        'danger',
        'parsed_initial_chunk_severe',
        `${chunk.name}: ${chunk.sizeKb} KB`
      )
    else if (chunk.initial && chunk.sizeKb > 150)
      addFinding(
        findings,
        'warn',
        'parsed_initial_chunk_watch',
        `${chunk.name}: ${chunk.sizeKb} KB`
      )
    if (chunk.initial && isThirdPartyPackage(chunk.packageName) && chunk.sizeKb > 120)
      addFinding(
        findings,
        'warn',
        'parsed_third_party_initial',
        `${chunk.packageName || chunk.name}: ${chunk.sizeKb} KB`
      )
    if (serverOnlyPattern.test(`${chunk.packageName} ${chunk.name}`))
      addFinding(findings, 'danger', 'parsed_server_only', chunk.packageName || chunk.name)
  })
  Array.from(duplicateChunks.entries()).forEach(([name, count]) => {
    if (name && count >= 2) addFinding(findings, 'warn', 'duplicate_package', `${name} x${count}`)
  })
  Array.from(duplicateChunkNames.entries()).forEach(([name, count]) => {
    if (name && count >= 2) addFinding(findings, 'warn', 'duplicate_package', `${name} x${count}`)
  })

  parsed.routes.forEach(route => {
    if (route.firstLoadKb > firstDanger)
      addFinding(
        findings,
        'danger',
        'parsed_route_first_load_severe',
        `${route.route}: ${route.firstLoadKb} KB`
      )
    else if (route.firstLoadKb > firstWarn)
      addFinding(
        findings,
        'warn',
        'parsed_route_first_load_watch',
        `${route.route}: ${route.firstLoadKb} KB`
      )
    if (route.routeJsKb > 250)
      addFinding(
        findings,
        'danger',
        'parsed_route_js_severe',
        `${route.route}: ${route.routeJsKb} KB`
      )
    if (route.chunks > 24)
      addFinding(findings, 'warn', 'parsed_many_initial_chunks', `${route.route}: ${route.chunks}`)
  })

  if (parsed.routes.length || parsed.chunks.length)
    addFinding(findings, 'good', 'parser_found', `${parsed.routes.length}/${parsed.chunks.length}`)
  else addFinding(findings, 'warn', 'parser_empty', '-')
  if (parsed.errors.includes('truncated'))
    addFinding(findings, 'warn', 'workspace_truncated', String(WORKSPACE_LIMIT))
  if (parsed.errors.includes('json_error')) addFinding(findings, 'warn', 'json_error', 'JSON')
  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', draft.routePattern)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length
  return Math.max(0, Math.min(100, 92 + good * 2 - warn * 6 - danger * 18))
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const buildDynamicSnippet = (draft: BundleSplitDraft) => {
  const candidate = draft.dynamicCandidate.trim() || '@/components/HeavyPanel'
  if (draft.importKind === 'worker') {
    return [
      `const worker = new Worker(new URL('${candidate}', import.meta.url), { type: 'module' })`,
      '',
      '// Move parse, search, crypto, or report-building work off the main thread.',
      `// Route segment: ${draft.routePattern}`
    ].join('\n')
  }
  if (draft.importKind === 'library') {
    return [
      'async function loadHeavyLibrary() {',
      `  const mod = await import('${candidate}')`,
      '  return mod.default ?? mod',
      '}',
      '',
      '// Call this from a user action, viewport trigger, or idle callback instead of the initial route render.'
    ].join('\n')
  }
  if (draft.importKind === 'route') {
    return [
      '// Keep route-only code in the route segment that needs it.',
      `// Candidate: ${candidate}`,
      "export const dynamic = 'force-static'",
      "export const preferredRegion = 'auto'"
    ].join('\n')
  }
  return [
    "import dynamic from 'next/dynamic'",
    '',
    `const SplitComponent = dynamic(() => import('${candidate}'), {`,
    '  loading: () => null,',
    '  ssr: false',
    '})',
    '',
    `// Current candidate chunk: ${draft.chunkName || draft.packageName}`,
    `// Route segment: ${draft.routePattern}`
  ].join('\n')
}

const buildNextNotes = (draft: BundleSplitDraft) =>
  [
    "/** @type {import('next').NextConfig} */",
    'const nextConfig = {',
    `  experimental: { optimizePackageImports: ['${draft.packageName || 'recharts'}'] },`,
    '  webpack(config) {',
    '    config.optimization.splitChunks = {',
    '      ...config.optimization.splitChunks,',
    "      chunks: 'all'",
    '    }',
    '    return config',
    '  }',
    '}',
    '',
    'module.exports = nextConfig',
    '',
    `// Review ${draft.routePattern} after this with next build, Lighthouse, and Web Vitals field data.`
  ].join('\n')

const buildBudgetCsv = (draft: BundleSplitDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.routes.length
    ? parsed.routes.map(route => [
        route.route,
        route.firstLoadKb,
        route.routeJsKb,
        route.chunks,
        route.source
      ])
    : [[draft.routePattern, draft.firstLoadKb, draft.routeJsKb, draft.initialChunks, 'draft']]
  return [
    'route,firstLoadJsKb,routeJsKb,initialChunks,source',
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n')
}

const buildMarkdownSummary = (
  draft: BundleSplitDraft,
  parsed: ParsedWorkspace,
  findings: Finding[]
) => {
  const risky = findings.filter(item => item.level !== 'good').slice(0, 10)
  const chunks = parsed.chunks.slice(0, 8)
  return [
    '# Bundle split triage',
    '',
    `Route: ${draft.routePattern}`,
    `Device: ${draft.device}`,
    `First-load JS: ${draft.firstLoadKb} KB`,
    `Route JS: ${draft.routeJsKb} KB`,
    '',
    '## Findings',
    risky.length
      ? risky.map(item => `- [${item.level}] ${item.subject}: ${item.key}`).join('\n')
      : '- No high-risk findings.',
    '',
    '## Chunk candidates',
    chunks.length
      ? chunks
          .map(
            chunk =>
              `- ${chunk.name} ${chunk.sizeKb} KB, ${chunk.packageName || 'local'}, initial=${chunk.initial}`
          )
          .join('\n')
      : `- ${draft.dynamicCandidate || draft.chunkName || 'No candidate yet.'}`,
    '',
    '## Next actions',
    '- Move route-only panels, charts, editors, and rich previews behind dynamic imports.',
    '- Put third-party scripts behind interaction, consent, idle, or route-specific boundaries.',
    '- Re-check first-load JS, INP, and long tasks after every split.'
  ].join('\n')
}

const buildJsonSummary = (draft: BundleSplitDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify(
    {
      draft,
      findings,
      parsed,
      thresholds: {
        desktopFirstLoadWarnKb: 350,
        mobileFirstLoadWarnKb: 170,
        mobileFirstLoadSevereKb: 350,
        routeJsWarnKb: 110,
        sharedWarnKb: 220
      }
    },
    null,
    2
  )

const buildChunkCsv = (draft: BundleSplitDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.chunks.length
    ? parsed.chunks.map(chunk => [
        chunk.name,
        chunk.sizeKb,
        chunk.packageName,
        chunk.initial,
        chunk.route,
        chunk.source
      ])
    : [[draft.chunkName, draft.chunkKb, draft.packageName, true, draft.routePattern, 'draft']]
  return [
    'chunk,sizeKb,package,initial,route,source',
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n')
}

const buildOutput = (
  draft: BundleSplitDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'next') return buildNextNotes(draft)
  if (outputType === 'budget') return buildBudgetCsv(draft, parsed)
  if (outputType === 'markdown') return buildMarkdownSummary(draft, parsed, findings)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildChunkCsv(draft, parsed)
  return buildDynamicSnippet(draft)
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

export default function BundleSplitClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<BundleSplitDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('dynamic')
  const [auditQuery, setAuditQuery] = useState('')
  const [parsedQuery, setParsedQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredParsedQuery = useDeferredValue(parsedQuery)

  const parsed = useMemo(() => {
    const next = parseWorkspace(deferredWorkspace)

    if (!isWorkspaceCapped || next.errors.includes('truncated')) return next

    return { ...next, errors: [...next.errors, 'truncated'] }
  }, [deferredWorkspace, isWorkspaceCapped])
  const findings = useMemo(() => auditBundle(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      chunks: parsed.chunks.slice(0, OUTPUT_PREVIEW_ROWS),
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      rawRows: parsed.rawRows.slice(0, OUTPUT_PREVIEW_ROWS),
      routes: parsed.routes.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.chunks, parsed.errors, parsed.rawRows, parsed.routes]
  )
  const outputPreviewFindings = useMemo(() => findings.slice(0, OUTPUT_PREVIEW_ROWS), [findings])
  const outputPreviewSource = useMemo(
    () => buildOutput(draft, outputPreviewParsed, outputPreviewFindings, outputType),
    [draft, outputPreviewFindings, outputPreviewParsed, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewUsesChunks =
    outputType === 'markdown' || outputType === 'json' || outputType === 'csv'
  const outputPreviewUsesRoutes = outputType === 'budget' || outputType === 'json'
  const outputPreviewUsesRawRows = outputType === 'json'
  const outputPreviewUsesFindings = outputType === 'markdown' || outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesChunks ? outputPreviewParsed.chunks.length : 0) +
    (outputPreviewUsesRoutes ? outputPreviewParsed.routes.length : 0) +
    (outputPreviewUsesRawRows ? outputPreviewParsed.rawRows.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesChunks ? parsed.chunks.length : 0) +
    (outputPreviewUsesRoutes ? parsed.routes.length : 0) +
    (outputPreviewUsesRawRows ? parsed.rawRows.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentBudgetCsv = useCallback(() => buildBudgetCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.bundle_split.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredChunks = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return parsed.chunks
    return parsed.chunks.filter(chunk =>
      `${chunk.name} ${chunk.packageName} ${chunk.route} ${chunk.sizeKb}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredParsedQuery, parsed.chunks])
  const metrics = useMemo(
    () => ({
      chunks: parsed.chunks.length,
      critical: findings.filter(item => item.level === 'danger').length,
      firstLoad: `${numberFromInput(draft.firstLoadKb)} KB`,
      routes: parsed.routes.length,
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.firstLoadKb, findings, parsed.chunks.length, parsed.routes.length, score]
  )

  const updateDraft = <Key extends keyof BundleSplitDraft>(
    key: Key,
    value: BundleSplitDraft[Key]
  ) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

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
    updateWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('dynamic')
    setAuditQuery('')
    setParsedQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.bundle_split.summary_title'),
        `${t('app.converter.bundle_split.metric.score')}: ${metrics.score}`,
        `${t('app.converter.bundle_split.metric.first_load')}: ${metrics.firstLoad}`,
        `${t('app.converter.bundle_split.metric.routes')}: ${metrics.routes}`,
        `${t('app.converter.bundle_split.metric.chunks')}: ${metrics.chunks}`,
        `${t('app.converter.bundle_split.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.bundle_split.metric.critical')}: ${metrics.critical}`
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
                <Boxes className="h-4 w-4" />
                {t('app.converter.bundle-split')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.bundle-split')}</CardTitle>
              <CardDescription>{t('app.converter.bundle_split.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.bundle_split.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.bundle_split.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.bundle_split.metric.first_load')}
              value={metrics.firstLoad}
            />
            <Metric label={t('app.converter.bundle_split.metric.routes')} value={metrics.routes} />
            <Metric label={t('app.converter.bundle_split.metric.chunks')} value={metrics.chunks} />
            <Metric
              label={t('app.converter.bundle_split.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.bundle_split.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.bundle_split.presets')}</CardTitle>
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
                {t(`app.converter.bundle_split.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.bundle_split.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.bundle_split.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.bundle_split.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bundle-route">
                  {t('app.converter.bundle_split.route_pattern')}
                </Label>
                <Input
                  id="bundle-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-device">{t('app.converter.bundle_split.device')}</Label>
                <Select
                  id="bundle-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.bundle_split.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-first-load">
                  {t('app.converter.bundle_split.first_load')}
                </Label>
                <Input
                  id="bundle-first-load"
                  value={draft.firstLoadKb}
                  onChange={event => updateDraft('firstLoadKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-route-js">{t('app.converter.bundle_split.route_js')}</Label>
                <Input
                  id="bundle-route-js"
                  value={draft.routeJsKb}
                  onChange={event => updateDraft('routeJsKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-shared">{t('app.converter.bundle_split.shared')}</Label>
                <Input
                  id="bundle-shared"
                  value={draft.sharedKb}
                  onChange={event => updateDraft('sharedKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-third-party">
                  {t('app.converter.bundle_split.third_party')}
                </Label>
                <Input
                  id="bundle-third-party"
                  value={draft.thirdPartyKb}
                  onChange={event => updateDraft('thirdPartyKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-framework">
                  {t('app.converter.bundle_split.framework')}
                </Label>
                <Input
                  id="bundle-framework"
                  value={draft.frameworkKb}
                  onChange={event => updateDraft('frameworkKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-app">{t('app.converter.bundle_split.app_chunk')}</Label>
                <Input
                  id="bundle-app"
                  value={draft.appKb}
                  onChange={event => updateDraft('appKb', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-initial-chunks">
                  {t('app.converter.bundle_split.initial_chunks')}
                </Label>
                <Input
                  id="bundle-initial-chunks"
                  value={draft.initialChunks}
                  onChange={event => updateDraft('initialChunks', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-route-count">
                  {t('app.converter.bundle_split.route_count')}
                </Label>
                <Input
                  id="bundle-route-count"
                  value={draft.routeCount}
                  onChange={event => updateDraft('routeCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.bundle_split.candidate')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bundle-chunk-name">
                    {t('app.converter.bundle_split.chunk_name')}
                  </Label>
                  <Input
                    id="bundle-chunk-name"
                    value={draft.chunkName}
                    onChange={event => updateDraft('chunkName', event.target.value.slice(0, 180))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle-chunk-kb">
                    {t('app.converter.bundle_split.chunk_kb')}
                  </Label>
                  <Input
                    id="bundle-chunk-kb"
                    value={draft.chunkKb}
                    onChange={event => updateDraft('chunkKb', event.target.value.slice(0, 12))}
                    className="font-mono"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle-package">
                    {t('app.converter.bundle_split.package_name')}
                  </Label>
                  <Input
                    id="bundle-package"
                    value={draft.packageName}
                    onChange={event => updateDraft('packageName', event.target.value.slice(0, 180))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bundle-import-kind">
                    {t('app.converter.bundle_split.import_kind')}
                  </Label>
                  <Select
                    id="bundle-import-kind"
                    value={draft.importKind}
                    onChange={event => updateDraft('importKind', event.target.value as ImportKind)}
                  >
                    {IMPORT_KINDS.map(kind => (
                      <option key={kind} value={kind}>
                        {t(`app.converter.bundle_split.import_kind.${kind}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="bundle-candidate">
                    {t('app.converter.bundle_split.dynamic_candidate')}
                  </Label>
                  <Input
                    id="bundle-candidate"
                    value={draft.dynamicCandidate}
                    onChange={event =>
                      updateDraft('dynamicCandidate', event.target.value.slice(0, 240))
                    }
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="bundle-server-only">
                    {t('app.converter.bundle_split.server_only_package')}
                  </Label>
                  <Input
                    id="bundle-server-only"
                    value={draft.serverOnlyPackage}
                    onChange={event =>
                      updateDraft('serverOnlyPackage', event.target.value.slice(0, 220))
                    }
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.bundle_split.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.bundle_split.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.bundle_split.workspace_placeholder')}
              className="min-h-[470px] font-mono"
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
                onClick={() => updateWorkspace('')}
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
              <CardTitle className="text-base">{t('app.converter.bundle_split.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.bundle_split.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 36).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.bundle_split.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.bundle_split.level.${finding.level}`)}
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
                  {t('app.converter.bundle_split.output')}
                </CardTitle>
                <CardDescription>{t('app.converter.bundle_split.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="bundle-output">{t('app.converter.bundle_split.output_type')}</Label>
                <Select
                  id="bundle-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.bundle_split.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[360px] font-mono" />
            {outputPreviewLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            {outputPreviewRowsLimited && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_rows_limited', {
                  total: outputPreviewTotalRows.toLocaleString(),
                  visible: outputPreviewVisibleRows.toLocaleString()
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(buildCurrentOutput())}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.bundle_split.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'bundle-split-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.bundle_split.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentBudgetCsv(),
                    'bundle-route-budget.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.bundle_split.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.bundle_split.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.bundle_split.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredChunks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredChunks.slice(0, 54).map(chunk => (
                  <div
                    key={`${chunk.id}:${chunk.name}:${chunk.route}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {chunk.name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(chunk.sizeKb > 300 ? 'danger' : chunk.sizeKb > 150 ? 'warn' : 'good')}`}
                      >
                        {chunk.sizeKb} KB
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {chunk.packageName || '-'}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {chunk.initial
                        ? t('app.converter.bundle_split.initial')
                        : t('app.converter.bundle_split.async')}{' '}
                      / {chunk.route || '-'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.bundle_split.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.bundle_split.reference')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.bundle_split.reference_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.bundle_split.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.bundle_split.reference.${item}_hint`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.bundle_split.checklist')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {item === 'split' ? (
                  <GitBranch className="h-4 w-4" />
                ) : item === 'measure' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.bundle_split.checklist.${item}.title`)}
              </div>
              {t(`app.converter.bundle_split.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
