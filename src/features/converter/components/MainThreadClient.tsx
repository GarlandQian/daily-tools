'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
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

const TASK_KINDS = ['longtask', 'loaf', 'interaction', 'trace'] as const
const DEVICES = ['mobile', 'desktop'] as const
const OUTPUT_TYPES = ['observer', 'next', 'trace', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 70000
const TASK_LIMIT = 140

type TaskKind = (typeof TASK_KINDS)[number]
type Device = (typeof DEVICES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface MainThreadDraft {
  blockingDurationMs: string
  device: Device
  durationMs: string
  frameType: string
  interactionTarget: string
  interactionType: string
  invoker: string
  routePattern: string
  sampleCount: string
  scriptUrl: string
  sourceKind: TaskKind
  startTimeMs: string
}

interface ParsedTask {
  blockingDuration: number
  duration: number
  id: string
  invoker: string
  kind: TaskKind
  route: string
  scriptUrl: string
  source: 'json' | 'text'
  startTime: number
  target: string
}

interface ParsedWorkspace {
  errors: string[]
  rawRows: Array<{ label: string; value: string }>
  tasks: ParsedTask[]
}

interface Preset {
  draft: MainThreadDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: MainThreadDraft = {
  blockingDurationMs: '72',
  device: 'mobile',
  durationMs: '128',
  frameType: 'top-level',
  interactionTarget: 'button[data-buy]',
  interactionType: 'click',
  invoker: 'hydrateProductCard',
  routePattern: '/products/:slug',
  sampleCount: '1200',
  scriptUrl: '/_next/static/chunks/product-card.js',
  sourceKind: 'interaction',
  startTimeMs: '2860'
}

const PRESETS: Preset[] = [
  {
    key: 'inp_handler',
    draft: DEFAULT_DRAFT,
    workspace: [
      '{"entryType":"long-animation-frame","duration":128,"blockingDuration":72,"startTime":2860,"route":"/products/example","scripts":[{"sourceURL":"/_next/static/chunks/product-card.js","invoker":"hydrateProductCard","duration":96}],"target":"button[data-buy]"}',
      '{"entryType":"longtask","duration":84,"startTime":3140,"name":"self","attribution":[{"containerType":"window","scriptURL":"/_next/static/chunks/cart.js"}],"route":"/products/example"}'
    ].join('\n')
  },
  {
    key: 'hydration',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '148',
      durationMs: '260',
      interactionTarget: '#__next',
      interactionType: 'hydrate',
      invoker: 'hydrateRoot',
      routePattern: '/dashboard',
      scriptUrl: '/_next/static/chunks/app-dashboard.js',
      sourceKind: 'longtask',
      startTimeMs: '940'
    },
    workspace: [
      'longtask duration=260ms blocking=148ms start=940ms script=/_next/static/chunks/app-dashboard.js invoker=hydrateRoot target=#__next route=/dashboard',
      'longtask duration=180ms blocking=95ms start=1240ms script=/_next/static/chunks/widgets.js invoker=mountWidgets target=.widget-grid route=/dashboard'
    ].join('\n')
  },
  {
    key: 'third_party',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '96',
      durationMs: '210',
      interactionTarget: '',
      interactionType: 'timer',
      invoker: 'setTimeout',
      routePattern: '/campaign/:slug',
      scriptUrl: 'https://tags.example.com/analytics.js',
      sourceKind: 'loaf',
      startTimeMs: '4200'
    },
    workspace: [
      '{"entryType":"long-animation-frame","duration":210,"blockingDuration":96,"route":"/campaign/summer","scripts":[{"sourceURL":"https://tags.example.com/analytics.js","invoker":"setTimeout","duration":184}]}',
      '{"entryType":"long-animation-frame","duration":178,"blockingDuration":80,"route":"/campaign/summer","scripts":[{"sourceURL":"https://ads.example.com/bid.js","invoker":"message","duration":160}]}'
    ].join('\n')
  },
  {
    key: 'animation',
    draft: {
      ...DEFAULT_DRAFT,
      blockingDurationMs: '38',
      durationMs: '78',
      interactionTarget: '.hero-carousel',
      interactionType: 'animation',
      invoker: 'requestAnimationFrame',
      routePattern: '/',
      scriptUrl: '/_next/static/chunks/hero.js',
      sourceKind: 'loaf',
      startTimeMs: '1800'
    },
    workspace: [
      'loaf duration=78ms blocking=38ms start=1800ms script=/_next/static/chunks/hero.js invoker=requestAnimationFrame target=.hero-carousel route=/',
      'loaf duration=64ms blocking=24ms start=1888ms script=/_next/static/chunks/hero.js invoker=requestAnimationFrame target=.hero-carousel route=/'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      blockingDurationMs: '420',
      device: 'mobile',
      durationMs: '760',
      frameType: 'iframe',
      interactionTarget: 'input[name=search]',
      interactionType: 'keydown',
      invoker: 'eval',
      routePattern: '/checkout',
      sampleCount: '36',
      scriptUrl: 'http://cdn.example.com/search.js?token=abc',
      sourceKind: 'interaction',
      startTimeMs: '8120'
    },
    workspace: [
      '{"entryType":"long-animation-frame","duration":760,"blockingDuration":420,"startTime":8120,"route":"/checkout","scripts":[{"sourceURL":"http://cdn.example.com/search.js?token=abc","invoker":"eval","duration":700}],"target":"input[name=search]"}',
      '{"entryType":"longtask","duration":540,"startTime":8280,"name":"cross-origin-ancestor","attribution":[{"scriptURL":"https://ads.example.com/bid.js","containerType":"iframe"}],"route":"/checkout"}',
      'longtask duration=310ms blocking=210ms start=8500ms script=/_next/static/chunks/cart.js invoker=whileLoop target=button[data-submit] route=/checkout'
    ].join('\n')
  }
]

const CHECKLIST_ITEMS = ['budget', 'split', 'third_party', 'measure'] as const
const REFERENCE_ITEMS = ['longtask', 'loaf', 'blocking', 'inp', 'third_party', 'privacy'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const textValue = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const next = Number(value.replace(/[,_\s]/g, ''))
    return Number.isFinite(next) ? next : null
  }
  return null
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const normalizeKind = (value: unknown): TaskKind => {
  const token = String(value ?? '').toLowerCase()
  if (token.includes('animation-frame') || token.includes('loaf')) return 'loaf'
  if (token.includes('interaction')) return 'interaction'
  if (token.includes('trace')) return 'trace'
  return 'longtask'
}

const firstScript = (record: Record<string, unknown>) => {
  const scripts = Array.isArray(record.scripts) ? record.scripts : []
  const script =
    asRecord(scripts[0]) ??
    asRecord(record.attribution) ??
    asRecord(Array.isArray(record.attribution) ? record.attribution[0] : null)
  return script ?? {}
}

const taskFromRecord = (record: Record<string, unknown>, index: number): ParsedTask | null => {
  const script = firstScript(record)
  const duration = numericValue(record.duration ?? record.dur ?? script.duration)
  if (duration === null) return null

  const kind = normalizeKind(record.entryType ?? record.name ?? record.kind)
  const blocking =
    numericValue(record.blockingDuration ?? record.blockingTime ?? script.blockingDuration) ??
    Math.max(0, duration - 50)
  return {
    blockingDuration: round(blocking),
    duration: round(duration),
    id: textValue(record.id) || `${kind}-${index + 1}`,
    invoker: textValue(record.invoker ?? script.invoker ?? script.invokerType),
    kind,
    route: textValue(record.route ?? record.path ?? record.url) || '/',
    scriptUrl: textValue(
      record.scriptUrl ??
        record.scriptURL ??
        record.sourceURL ??
        script.scriptURL ??
        script.sourceURL
    ),
    source: 'json',
    startTime: round(numericValue(record.startTime ?? record.ts ?? record.start) ?? 0),
    target: textValue(record.target ?? record.interactionTarget ?? script.target)
  }
}

const collectTasks = (value: unknown, tasks: ParsedTask[], depth = 0) => {
  if (tasks.length >= TASK_LIMIT || depth > 6) return
  if (Array.isArray(value)) {
    value.forEach(item => collectTasks(item, tasks, depth + 1))
    return
  }
  const record = asRecord(value)
  if (!record) return
  const task = taskFromRecord(record, tasks.length)
  if (task) {
    tasks.push(task)
    return
  }
  Object.values(record)
    .slice(0, 40)
    .forEach(item => collectTasks(item, tasks, depth + 1))
}

const parseJson = (parsed: ParsedWorkspace, input: string, reportError = true) => {
  try {
    collectTasks(JSON.parse(input), parsed.tasks)
  } catch {
    if (reportError) parsed.errors.push('json_error')
  }
}

const tokenValue = (line: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = line.match(new RegExp(`${escaped}=([^\\s]+)`, 'iu'))
  return match?.[1] ?? ''
}

const parseTextTask = (line: string, index: number): ParsedTask | null => {
  const durationMatch = line.match(/\b(?:duration|dur)\s*=\s*([\d.,]+)\s*(ms)?/iu)
  if (!durationMatch?.[1]) return null
  const duration = Number(durationMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(duration)) return null
  const blocking = Number(tokenValue(line, 'blocking').replace(/ms$/iu, ''))
  const kind = normalizeKind(line)
  return {
    blockingDuration: Number.isFinite(blocking)
      ? round(blocking)
      : Math.max(0, round(duration - 50)),
    duration: round(duration),
    id: `text-${index + 1}`,
    invoker: tokenValue(line, 'invoker'),
    kind,
    route: tokenValue(line, 'route') || '/',
    scriptUrl: tokenValue(line, 'script'),
    source: 'text',
    startTime: round(Number(tokenValue(line, 'start').replace(/ms$/iu, '')) || 0),
    target: tokenValue(line, 'target')
  }
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const parsed: ParsedWorkspace = { errors: [], rawRows: [], tasks: [] }
  const trimmed = source.trim()
  const parseJsonLines = () => {
    source
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line.startsWith('{') || line.startsWith('['))
      .slice(0, TASK_LIMIT)
      .forEach(line => parseJson(parsed, line, false))
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const before = parsed.tasks.length
    parseJson(parsed, trimmed)
    if (parsed.tasks.length === before) parseJsonLines()
  } else {
    parseJsonLines()
  }

  source
    .split(/\r?\n/u)
    .slice(0, TASK_LIMIT)
    .forEach((line, index) => {
      const clean = line.trim()
      if (!clean) return
      const textTask = parseTextTask(clean, index)
      if (textTask) parsed.tasks.push(textTask)
      if (/longtask|long-animation-frame|loaf|duration=|blocking=/iu.test(clean)) {
        parsed.rawRows.push({
          label: clean.split(/\s/u)[0]?.slice(0, 80) ?? 'row',
          value: clean.slice(0, 220)
        })
      }
    })

  parsed.tasks = parsed.tasks.slice(0, TASK_LIMIT)
  if (input.length > WORKSPACE_LIMIT) parsed.errors.push('truncated')
  return parsed
}

const isThirdParty = (scriptUrl: string) => {
  if (!scriptUrl || scriptUrl.startsWith('/') || scriptUrl.startsWith('_next')) return false
  try {
    return new URL(scriptUrl, 'https://www.example.com').hostname !== 'www.example.com'
  } catch {
    return false
  }
}

const hasSensitiveUrl = (value: string) =>
  /token|session|account|private|user|auth|jwt/iu.test(value)

const buildObserverSnippet = (draft: MainThreadDraft) =>
  [
    "const endpoint = '/api/main-thread'",
    '',
    'function send(payload) {',
    '  const body = JSON.stringify({',
    '    ...payload,',
    '    route: location.pathname,',
    `    device: '${draft.device}'`,
    '  })',
    "  navigator.sendBeacon?.(endpoint, body) || fetch(endpoint, { body, keepalive: true, method: 'POST' })",
    '}',
    '',
    'new PerformanceObserver(list => {',
    '  for (const entry of list.getEntries()) {',
    '    send({',
    '      kind: entry.entryType,',
    '      duration: entry.duration,',
    '      startTime: entry.startTime,',
    '      attribution: entry.attribution',
    '    })',
    '  }',
    "}).observe({ type: 'longtask', buffered: true })",
    '',
    "if (PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {",
    '  new PerformanceObserver(list => {',
    '    for (const entry of list.getEntries()) {',
    '      send({',
    '        kind: entry.entryType,',
    '        duration: entry.duration,',
    '        blockingDuration: entry.blockingDuration,',
    '        scripts: entry.scripts',
    '      })',
    '    }',
    "  }).observe({ type: 'long-animation-frame', buffered: true })",
    '}'
  ].join('\n')

const buildNextSnippet = (draft: MainThreadDraft) =>
  [
    "'use client'",
    '',
    "import { useEffect } from 'react'",
    '',
    'export function MainThreadReporter() {',
    '  useEffect(() => {',
    '    const supported = PerformanceObserver.supportedEntryTypes || []',
    '    const report = entry => navigator.sendBeacon?.(',
    "      '/api/main-thread',",
    '      JSON.stringify({ entryType: entry.entryType, duration: entry.duration, route: location.pathname })',
    '    )',
    '',
    '    const longTasks = new PerformanceObserver(list => list.getEntries().forEach(report))',
    "    longTasks.observe({ type: 'longtask', buffered: true })",
    '',
    "    if (supported.includes('long-animation-frame')) {",
    '      const frames = new PerformanceObserver(list => list.getEntries().forEach(report))',
    "      frames.observe({ type: 'long-animation-frame', buffered: true })",
    '      return () => { longTasks.disconnect(); frames.disconnect() }',
    '    }',
    '',
    '    return () => longTasks.disconnect()',
    '  }, [])',
    '',
    '  return null',
    '}',
    '',
    `// Current route segment: ${draft.routePattern}`
  ].join('\n')

const buildTraceNotes = (draft: MainThreadDraft) =>
  [
    '# Chrome trace focus',
    '',
    'Filter trace events by:',
    '- LongTask',
    '- RunTask',
    '- EvaluateScript',
    '- FunctionCall',
    '- EventDispatch',
    '',
    `Route: ${draft.routePattern}`,
    `Script URL: ${draft.scriptUrl}`,
    `Interaction target: ${draft.interactionTarget}`,
    `Duration budget: keep tasks under 50 ms; split anything above ${draft.durationMs} ms first.`
  ].join('\n')

const buildMarkdownSummary = (
  draft: MainThreadDraft,
  parsed: ParsedWorkspace,
  findings: Finding[]
) => {
  const risky = findings.filter(item => item.level !== 'good').slice(0, 8)
  const tasks = parsed.tasks.slice(0, 8)
  return [
    '# Main-thread triage',
    '',
    `Route: ${draft.routePattern}`,
    `Device: ${draft.device}`,
    `Draft task: ${draft.durationMs} ms / blocking ${draft.blockingDurationMs} ms`,
    '',
    '## Findings',
    risky.length
      ? risky.map(item => `- [${item.level}] ${item.subject}: ${item.key}`).join('\n')
      : '- No high-risk findings.',
    '',
    '## Parsed tasks',
    tasks.length
      ? tasks
          .map(
            task =>
              `- ${task.kind} ${task.duration} ms, blocking ${task.blockingDuration} ms, ${task.scriptUrl || 'unknown script'}`
          )
          .join('\n')
      : '- No parsed tasks yet.',
    '',
    '## Next actions',
    '- Split or defer the largest synchronous task.',
    '- Move third-party work after user-visible rendering.',
    '- Re-test INP and Web Vitals attribution after the main-thread fix.'
  ].join('\n')
}

const buildCsv = (draft: MainThreadDraft, parsed: ParsedWorkspace) => {
  const rows = parsed.tasks.length
    ? parsed.tasks.map(task => [
        task.kind,
        task.duration,
        task.blockingDuration,
        task.startTime,
        task.route,
        task.scriptUrl,
        task.invoker,
        task.target,
        task.source
      ])
    : [
        [
          draft.sourceKind,
          draft.durationMs,
          draft.blockingDurationMs,
          draft.startTimeMs,
          draft.routePattern,
          draft.scriptUrl,
          draft.invoker,
          draft.interactionTarget,
          'draft'
        ]
      ]
  return [
    'kind,durationMs,blockingDurationMs,startTimeMs,route,scriptUrl,invoker,target,source',
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n')
}

const buildJsonSummary = (draft: MainThreadDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  JSON.stringify(
    {
      draft,
      findings,
      parsed,
      thresholds: {
        longTaskMs: 50,
        severeTaskMs: 200,
        severeBlockingMs: 200
      }
    },
    null,
    2
  )

const buildOutput = (
  draft: MainThreadDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'next') return buildNextSnippet(draft)
  if (outputType === 'trace') return buildTraceNotes(draft)
  if (outputType === 'markdown') return buildMarkdownSummary(draft, parsed, findings)
  if (outputType === 'json') return buildJsonSummary(draft, parsed, findings)
  if (outputType === 'csv') return buildCsv(draft, parsed)
  return buildObserverSnippet(draft)
}

const addFinding = (findings: Finding[], level: FindingLevel, key: string, subject: string) => {
  findings.push({ key, level, subject })
}

const auditMainThread = (draft: MainThreadDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const duration = numberFromInput(draft.durationMs)
  const blocking = numberFromInput(draft.blockingDurationMs)
  const samples = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) addFinding(findings, 'danger', 'route_missing', 'route')
  if (samples > 0 && samples < 100)
    addFinding(findings, 'warn', 'low_sample_count', String(samples))
  if (duration > 500) addFinding(findings, 'danger', 'task_extreme', `${duration} ms`)
  else if (duration > 200) addFinding(findings, 'danger', 'task_severe', `${duration} ms`)
  else if (duration > 50) addFinding(findings, 'warn', 'task_long', `${duration} ms`)
  else addFinding(findings, 'good', 'task_budget_ok', `${duration} ms`)
  if (blocking > 200) addFinding(findings, 'danger', 'blocking_severe', `${blocking} ms`)
  else if (blocking > 50) addFinding(findings, 'warn', 'blocking_watch', `${blocking} ms`)
  if (draft.device === 'mobile' && duration > 120)
    addFinding(findings, 'warn', 'mobile_main_thread', `${duration} ms`)
  if (/keydown|input/iu.test(draft.interactionType) && blocking > 50)
    addFinding(findings, 'warn', 'typing_interaction', draft.interactionType)
  if (!draft.scriptUrl.trim()) addFinding(findings, 'warn', 'missing_script_url', 'script')
  if (isThirdParty(draft.scriptUrl))
    addFinding(findings, 'warn', 'third_party_script', draft.scriptUrl)
  if (draft.scriptUrl.startsWith('http:'))
    addFinding(findings, 'danger', 'http_script', draft.scriptUrl)
  if (hasSensitiveUrl(draft.scriptUrl))
    addFinding(findings, 'warn', 'sensitive_script_url', draft.scriptUrl)
  if (/eval|while|sync|document\.write/iu.test(draft.invoker))
    addFinding(findings, 'danger', 'risky_invoker', draft.invoker)
  if (/iframe|cross-origin/iu.test(draft.frameType))
    addFinding(findings, 'warn', 'iframe_context', draft.frameType)
  if (!draft.interactionTarget.trim() && draft.sourceKind === 'interaction')
    addFinding(findings, 'warn', 'missing_interaction_target', 'interaction')

  const severeTasks = parsed.tasks.filter(task => task.duration > 200)
  const severeBlocking = parsed.tasks.filter(task => task.blockingDuration > 200)
  const thirdPartyTasks = parsed.tasks.filter(task => isThirdParty(task.scriptUrl))
  if (severeTasks.length)
    addFinding(findings, 'danger', 'parsed_severe_tasks', String(severeTasks.length))
  if (severeBlocking.length)
    addFinding(findings, 'danger', 'parsed_severe_blocking', String(severeBlocking.length))
  if (thirdPartyTasks.length)
    addFinding(findings, 'warn', 'parsed_third_party', String(thirdPartyTasks.length))

  const scriptCounts = new Map<string, number>()
  parsed.tasks.forEach(task => {
    if (!task.scriptUrl) addFinding(findings, 'warn', 'parsed_missing_script', task.id)
    if (task.scriptUrl.startsWith('http:'))
      addFinding(findings, 'danger', 'parsed_http_script', task.scriptUrl)
    if (hasSensitiveUrl(task.scriptUrl))
      addFinding(findings, 'warn', 'parsed_sensitive_script', task.scriptUrl)
    if (/eval|while|sync|document\.write/iu.test(task.invoker))
      addFinding(findings, 'danger', 'parsed_risky_invoker', `${task.id}: ${task.invoker}`)
    if (/input|search|coupon|textarea/iu.test(task.target) && task.blockingDuration > 50) {
      addFinding(findings, 'warn', 'parsed_typing_block', `${task.id}: ${task.target}`)
    }
    scriptCounts.set(
      task.scriptUrl || 'unknown',
      (scriptCounts.get(task.scriptUrl || 'unknown') ?? 0) + 1
    )
  })
  Array.from(scriptCounts.entries()).forEach(([scriptUrl, count]) => {
    if (scriptUrl !== 'unknown' && count >= 3)
      addFinding(findings, 'warn', 'repeated_script', `${scriptUrl} x${count}`)
  })

  if (parsed.tasks.length > 40)
    addFinding(findings, 'warn', 'many_tasks', String(parsed.tasks.length))
  if (parsed.tasks.length) addFinding(findings, 'good', 'parser_found', String(parsed.tasks.length))
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
  return Math.max(0, Math.min(100, 90 + good * 2 - warn * 6 - danger * 18))
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

export default function MainThreadClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<MainThreadDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [outputType, setOutputType] = useState<OutputType>('observer')
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
  const findings = useMemo(() => auditMainThread(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewParsed = useMemo<ParsedWorkspace>(
    () => ({
      errors: parsed.errors.slice(0, OUTPUT_PREVIEW_ROWS),
      rawRows: parsed.rawRows.slice(0, OUTPUT_PREVIEW_ROWS),
      tasks: parsed.tasks.slice(0, OUTPUT_PREVIEW_ROWS)
    }),
    [parsed.errors, parsed.rawRows, parsed.tasks]
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
  const outputPreviewUsesParsedRows =
    outputType === 'markdown' || outputType === 'json' || outputType === 'csv'
  const outputPreviewUsesFindings = outputType === 'markdown' || outputType === 'json'
  const outputPreviewVisibleRows =
    (outputPreviewUsesParsedRows ? outputPreviewParsed.tasks.length : 0) +
    (outputPreviewUsesFindings ? outputPreviewFindings.length : 0)
  const outputPreviewTotalRows =
    (outputPreviewUsesParsedRows ? parsed.tasks.length : 0) +
    (outputPreviewUsesFindings ? findings.length : 0)
  const outputPreviewRowsLimited = outputPreviewTotalRows > outputPreviewVisibleRows
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const buildCurrentCsv = useCallback(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item => {
      const text =
        `${item.key} ${item.subject} ${t(`app.converter.main_thread.audit.${item.key}`)}`.toLowerCase()
      return text.includes(query)
    })
  }, [deferredAuditQuery, findings, t])
  const filteredTasks = useMemo(() => {
    const query = deferredParsedQuery.trim().toLowerCase()
    if (!query) return parsed.tasks
    return parsed.tasks.filter(task =>
      `${task.kind} ${task.duration} ${task.scriptUrl} ${task.invoker} ${task.target} ${task.route}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredParsedQuery, parsed.tasks])
  const metrics = useMemo(
    () => ({
      blocking: `${numberFromInput(draft.blockingDurationMs)} ms`,
      critical: findings.filter(item => item.level === 'danger').length,
      duration: `${numberFromInput(draft.durationMs)} ms`,
      score,
      tasks: parsed.tasks.length,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.blockingDurationMs, draft.durationMs, findings, parsed.tasks.length, score]
  )

  const updateDraft = <Key extends keyof MainThreadDraft>(
    key: Key,
    value: MainThreadDraft[Key]
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
    setOutputType('observer')
    setAuditQuery('')
    setParsedQuery('')
  }, [updateWorkspace])

  const copySummary = () => {
    copy(
      [
        t('app.converter.main_thread.summary_title'),
        `${t('app.converter.main_thread.metric.score')}: ${metrics.score}`,
        `${t('app.converter.main_thread.metric.duration')}: ${metrics.duration}`,
        `${t('app.converter.main_thread.metric.blocking')}: ${metrics.blocking}`,
        `${t('app.converter.main_thread.metric.tasks')}: ${metrics.tasks}`,
        `${t('app.converter.main_thread.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.main_thread.metric.critical')}: ${metrics.critical}`
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
                <Cpu className="h-4 w-4" />
                {t('app.converter.main-thread')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.main-thread')}</CardTitle>
              <CardDescription>{t('app.converter.main_thread.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.main_thread.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.main_thread.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.main_thread.metric.duration')}
              value={metrics.duration}
            />
            <Metric
              label={t('app.converter.main_thread.metric.blocking')}
              value={metrics.blocking}
            />
            <Metric label={t('app.converter.main_thread.metric.tasks')} value={metrics.tasks} />
            <Metric
              label={t('app.converter.main_thread.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.main_thread.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.main_thread.presets')}</CardTitle>
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
                {t(`app.converter.main_thread.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.main_thread.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.main_thread.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.main_thread.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="main-thread-route">
                  {t('app.converter.main_thread.route_pattern')}
                </Label>
                <Input
                  id="main-thread-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-kind">
                  {t('app.converter.main_thread.source_kind')}
                </Label>
                <Select
                  id="main-thread-kind"
                  value={draft.sourceKind}
                  onChange={event => updateDraft('sourceKind', event.target.value as TaskKind)}
                >
                  {TASK_KINDS.map(kind => (
                    <option key={kind} value={kind}>
                      {t(`app.converter.main_thread.kind.${kind}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-duration">
                  {t('app.converter.main_thread.duration')}
                </Label>
                <Input
                  id="main-thread-duration"
                  value={draft.durationMs}
                  onChange={event => updateDraft('durationMs', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-blocking">
                  {t('app.converter.main_thread.blocking_duration')}
                </Label>
                <Input
                  id="main-thread-blocking"
                  value={draft.blockingDurationMs}
                  onChange={event =>
                    updateDraft('blockingDurationMs', event.target.value.slice(0, 12))
                  }
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-start">
                  {t('app.converter.main_thread.start_time')}
                </Label>
                <Input
                  id="main-thread-start"
                  value={draft.startTimeMs}
                  onChange={event => updateDraft('startTimeMs', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-samples">
                  {t('app.converter.main_thread.sample_count')}
                </Label>
                <Input
                  id="main-thread-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-device">{t('app.converter.main_thread.device')}</Label>
                <Select
                  id="main-thread-device"
                  value={draft.device}
                  onChange={event => updateDraft('device', event.target.value as Device)}
                >
                  {DEVICES.map(device => (
                    <option key={device} value={device}>
                      {t(`app.converter.main_thread.device.${device}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="main-thread-frame">
                  {t('app.converter.main_thread.frame_type')}
                </Label>
                <Input
                  id="main-thread-frame"
                  value={draft.frameType}
                  onChange={event => updateDraft('frameType', event.target.value.slice(0, 80))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.main_thread.attribution')}</Label>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="main-thread-script">
                    {t('app.converter.main_thread.script_url')}
                  </Label>
                  <Input
                    id="main-thread-script"
                    value={draft.scriptUrl}
                    onChange={event => updateDraft('scriptUrl', event.target.value.slice(0, 260))}
                    className="font-mono"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="main-thread-invoker">
                    {t('app.converter.main_thread.invoker')}
                  </Label>
                  <Input
                    id="main-thread-invoker"
                    value={draft.invoker}
                    onChange={event => updateDraft('invoker', event.target.value.slice(0, 140))}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="main-thread-interaction">
                    {t('app.converter.main_thread.interaction_type')}
                  </Label>
                  <Input
                    id="main-thread-interaction"
                    value={draft.interactionType}
                    onChange={event =>
                      updateDraft('interactionType', event.target.value.slice(0, 100))
                    }
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="main-thread-target">
                    {t('app.converter.main_thread.interaction_target')}
                  </Label>
                  <Input
                    id="main-thread-target"
                    value={draft.interactionTarget}
                    onChange={event =>
                      updateDraft('interactionTarget', event.target.value.slice(0, 180))
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
                {t('app.converter.main_thread.workspace')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.main_thread.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.converter.main_thread.workspace_placeholder')}
              className="min-h-[460px] font-mono"
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
              <CardTitle className="text-base">{t('app.converter.main_thread.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.main_thread.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 30).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-all leading-5">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2 inline-block">/</span>
                      {t(`app.converter.main_thread.audit.${finding.key}`)}
                    </span>
                    <span className="shrink-0 font-medium">
                      {t(`app.converter.main_thread.level.${finding.level}`)}
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
                <CardTitle className="text-base">{t('app.converter.main_thread.output')}</CardTitle>
                <CardDescription>{t('app.converter.main_thread.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="main-thread-output">
                  {t('app.converter.main_thread.output_type')}
                </Label>
                <Select
                  id="main-thread-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.main_thread.output.${type}`)}
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
                {t('app.converter.main_thread.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCurrentOutput(),
                    'main-thread-output.txt',
                    'text/plain;charset=utf-8'
                  )
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.main_thread.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentCsv(), 'main-thread-tasks.csv', 'text/csv;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.main_thread.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.main_thread.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={parsedQuery}
                onChange={event => setParsedQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.main_thread.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredTasks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredTasks.slice(0, 48).map(task => (
                  <div
                    key={`${task.id}:${task.scriptUrl}`}
                    className="glass-input min-w-0 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {task.kind} {task.duration} ms
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(task.duration > 200 ? 'danger' : task.duration > 50 ? 'warn' : 'good')}`}
                      >
                        {task.blockingDuration} ms
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {task.scriptUrl || '-'}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {task.invoker || '-'} / {task.target || '-'} / {task.route}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.main_thread.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.main_thread.reference')}
              </CardTitle>
            </div>
            <CardDescription>{t('app.converter.main_thread.reference_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFERENCE_ITEMS.map(item => (
              <div key={item} className="glass-input rounded-xl p-3">
                <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.converter.main_thread.reference.${item}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {t(`app.converter.main_thread.reference.${item}_hint`)}
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
            <CardTitle className="text-base">{t('app.converter.main_thread.checklist')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {CHECKLIST_ITEMS.map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {item === 'measure' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <ListChecks className="h-4 w-4" />
                )}
                {t(`app.converter.main_thread.checklist.${item}.title`)}
              </div>
              {t(`app.converter.main_thread.checklist.${item}.body`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
