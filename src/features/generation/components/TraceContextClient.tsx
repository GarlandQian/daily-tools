'use client'

import {
  Activity,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import type { ReactNode } from 'react'
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

type AuditSeverity = 'error' | 'ok' | 'warn'
type OutputFormat =
  | 'curl'
  | 'fetch'
  | 'headers'
  | 'json'
  | 'markdown'
  | 'next'
  | 'otel'
  | 'propagation'
  | 'csv'

interface TraceDraft {
  baggage: string
  hopPlan: string
  operation: string
  parentId: string
  sampled: boolean
  service: string
  traceId: string
  tracestate: string
}

interface TracePreset {
  key: string
  value: TraceDraft
  workspace: string
}

interface ParsedTraceparent {
  errors: string[]
  flags: string
  parentId: string
  sampled: boolean
  traceId: string
  value: string
  version: string
}

interface ParsedTraceLine extends ParsedTraceparent {
  line: number
}

interface AuditItem {
  detail?: string
  key: string
  severity: AuditSeverity
  title: string
}

const MAX_WORKSPACE_LENGTH = 12000
const MAX_PARSED_TRACEPARENTS = 48
const MAX_HOPS = 12
const TRACEPARENT_PATTERN = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i
const ZERO_HEX_PATTERN = /^0+$/
const SENSITIVE_BAGGAGE_KEY_PATTERN =
  /(?:email|mail|phone|token|secret|password|passwd|session|cookie|auth|jwt|ip|address|name|customer|user|userid|account)/iu

const DEFAULT_DRAFT: TraceDraft = {
  baggage: 'locale=zh-CN,plan=pro',
  hopPlan:
    'checkout-web | GET /checkout\norders-api | POST /api/orders\nworker-billing | queue invoice-sync',
  operation: 'GET /checkout',
  parentId: '00f067aa0ba902b7',
  sampled: true,
  service: 'checkout-web',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  tracestate: 'rojo=00f067aa0ba902b7'
}

const PRESET_DRAFTS: TracePreset[] = [
  {
    key: 'frontend',
    value: DEFAULT_DRAFT,
    workspace:
      'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\ntracestate: rojo=00f067aa0ba902b7\nbaggage: locale=zh-CN,plan=pro'
  },
  {
    key: 'api',
    value: {
      baggage: 'tenant=acme,release=2026.06',
      hopPlan:
        'checkout-web | POST /checkout\norders-api | POST /api/orders\npayments-api | POST /api/payments',
      operation: 'POST /api/orders',
      parentId: '7ad6b7169203331b',
      sampled: true,
      service: 'orders-api',
      traceId: '6f9c2b98f5dc4bbf942bb8e0a6d7c8a1',
      tracestate: 'vendor=orders-api'
    },
    workspace:
      'traceparent: 00-6f9c2b98f5dc4bbf942bb8e0a6d7c8a1-7ad6b7169203331b-01\ntracestate: vendor=orders-api\nbaggage: tenant=acme,release=2026.06'
  },
  {
    key: 'queue',
    value: {
      baggage: 'job=invoice-sync,attempt=2',
      hopPlan:
        'orders-api | enqueue invoice-sync\nworker-billing | process invoice-sync\nledger-api | POST /ledger/events',
      operation: 'queue invoice-sync',
      parentId: '8f0a4c9959f1b1d4',
      sampled: false,
      service: 'worker-billing',
      traceId: '2f3a1f0e9d554c1ab61b93e5753d73db',
      tracestate: ''
    },
    workspace:
      'traceparent: 00-2f3a1f0e9d554c1ab61b93e5753d73db-8f0a4c9959f1b1d4-00\nbaggage: job=invoice-sync,attempt=2'
  },
  {
    key: 'incident',
    value: {
      baggage: 'incident=INC-1042,customer=demo',
      hopPlan:
        'edge-gateway | GET /api/search\nsearch-api | query catalog\nranking-api | rerank results',
      operation: 'GET /api/search',
      parentId: '4c721bf33e3caf8f',
      sampled: true,
      service: 'search-api',
      traceId: 'd1f25f9bb1bc43d2a6e7af1076bf27cc',
      tracestate: 'debug=sampled'
    },
    workspace:
      'traceparent: 00-d1f25f9bb1bc43d2a6e7af1076bf27cc-4c721bf33e3caf8f-01\ntracestate: debug=sampled\nbaggage: incident=INC-1042,customer=demo'
  },
  {
    key: 'invalid',
    value: {
      baggage: 'too-much-context',
      hopPlan: 'legacy-gateway | GET /broken\nunknown-service | missing span policy',
      operation: 'GET /broken',
      parentId: '0000000000000000',
      sampled: false,
      service: 'legacy-gateway',
      traceId: '00000000000000000000000000000000',
      tracestate: 'legacy,no-equals'
    },
    workspace:
      'traceparent: 00-00000000000000000000000000000000-0000000000000000-03\ntracestate: legacy,no-equals\nbaggage: too-much-context'
  }
]

const OUTPUT_FORMATS: OutputFormat[] = [
  'headers',
  'curl',
  'fetch',
  'next',
  'otel',
  'propagation',
  'markdown',
  'json',
  'csv'
]

const normalizeHex = (value: string, maxLength: number) =>
  value
    .toLowerCase()
    .replace(/[^0-9a-f]/g, '')
    .slice(0, maxLength)

const randomHex = (byteLength: number) => {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

const randomNonZeroHex = (byteLength: number) => {
  let value = randomHex(byteLength)
  while (ZERO_HEX_PATTERN.test(value)) {
    value = randomHex(byteLength)
  }
  return value
}

const getTraceFlags = (sampled: boolean) => (sampled ? '01' : '00')

const buildTraceparent = (draft: TraceDraft) =>
  `00-${draft.traceId.padEnd(32, '0').slice(0, 32)}-${draft.parentId.padEnd(16, '0').slice(0, 16)}-${getTraceFlags(draft.sampled)}`

const escapeSingle = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const escapeDouble = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const getHeaderLines = (draft: TraceDraft) => {
  const lines = [`traceparent: ${buildTraceparent(draft)}`]
  if (draft.tracestate.trim()) lines.push(`tracestate: ${draft.tracestate.trim()}`)
  if (draft.baggage.trim()) lines.push(`baggage: ${draft.baggage.trim()}`)
  return lines
}

const buildOutput = (draft: TraceDraft, format: OutputFormat) => {
  const traceparent = buildTraceparent(draft)
  const headerLines = getHeaderLines(draft)
  const propagationRows = buildPropagationRows(draft)
  const headersObject = {
    ...(draft.baggage.trim() ? { baggage: draft.baggage.trim() } : {}),
    traceparent,
    ...(draft.tracestate.trim() ? { tracestate: draft.tracestate.trim() } : {})
  }

  if (format === 'curl') {
    return [
      'curl https://api.example.com/resource \\',
      ...headerLines.map(
        (line, index) =>
          `  -H "${escapeDouble(line)}"${index === headerLines.length - 1 ? '' : ' \\'}`
      )
    ].join('\n')
  }

  if (format === 'fetch') {
    return `await fetch('/api/resource', {\n  headers: ${JSON.stringify(headersObject, null, 4).replace(/\n/g, '\n  ')}\n})`
  }

  if (format === 'next') {
    return [
      "import { NextResponse } from 'next/server'",
      '',
      'export function middleware(request: Request) {',
      '  const headers = new Headers(request.headers)',
      `  headers.set('traceparent', '${escapeSingle(traceparent)}')`,
      draft.tracestate.trim()
        ? `  headers.set('tracestate', '${escapeSingle(draft.tracestate.trim())}')`
        : '',
      draft.baggage.trim()
        ? `  headers.set('baggage', '${escapeSingle(draft.baggage.trim())}')`
        : '',
      '  return NextResponse.next({ request: { headers } })',
      '}'
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (format === 'otel') {
    return [
      `const traceparent = '${escapeSingle(traceparent)}'`,
      `const context = {`,
      `  traceId: '${draft.traceId}',`,
      `  spanId: '${draft.parentId}',`,
      `  traceFlags: ${draft.sampled ? 1 : 0},`,
      `  serviceName: '${escapeSingle(draft.service)}',`,
      `  operationName: '${escapeSingle(draft.operation)}'`,
      `}`
    ].join('\n')
  }

  if (format === 'propagation') {
    return [
      'service,operation,parent_id,traceparent',
      ...propagationRows.map(row =>
        [row.service, row.operation, row.parentId, row.traceparent]
          .map(value => `"${value.replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n')
  }

  if (format === 'markdown') {
    return [
      `# Trace context handoff`,
      '',
      `- Service: ${draft.service || 'unknown'}`,
      `- Operation: ${draft.operation || 'unknown'}`,
      `- Trace ID: \`${draft.traceId}\``,
      `- Sampled: ${draft.sampled ? 'yes' : 'no'}`,
      `- Header bytes: ${new TextEncoder().encode(headerLines.join('\n')).length}`,
      '',
      '## Headers',
      '',
      '```http',
      headerLines.join('\n'),
      '```',
      '',
      '## Propagation plan',
      '',
      ...propagationRows.map(
        (row, index) => `${index + 1}. ${row.service} - ${row.operation} - \`${row.traceparent}\``
      )
    ].join('\n')
  }

  if (format === 'json') {
    return JSON.stringify(
      {
        baggage: draft.baggage.trim(),
        headers: headersObject,
        operation: draft.operation,
        parentId: draft.parentId,
        propagation: propagationRows,
        sampled: draft.sampled,
        service: draft.service,
        traceId: draft.traceId,
        traceparent,
        tracestate: draft.tracestate.trim()
      },
      null,
      2
    )
  }

  if (format === 'csv') {
    return [
      'service,operation,trace_id,parent_id,sampled,traceparent,tracestate,baggage,hop_count',
      [
        draft.service,
        draft.operation,
        draft.traceId,
        draft.parentId,
        String(draft.sampled),
        traceparent,
        draft.tracestate,
        draft.baggage,
        String(propagationRows.length)
      ]
        .map(value => `"${value.replace(/"/g, '""')}"`)
        .join(',')
    ].join('\n')
  }

  return headerLines.join('\n')
}

const findHeaderValue = (input: string, name: string) => {
  const normalizedName = name.toLowerCase()
  const lines = input.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    const separatorIndex = [trimmed.indexOf(':'), trimmed.indexOf('=')]
      .filter(index => index > 0)
      .sort((a, b) => a - b)[0]

    if (!separatorIndex) continue

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase()
    if (key === normalizedName) return trimmed.slice(separatorIndex + 1).trim()
  }

  if (name === 'traceparent') {
    return input.match(/[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}/i)?.[0] ?? ''
  }

  return ''
}

const parseTraceparent = (value: string): ParsedTraceparent | null => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  const match = normalized.match(TRACEPARENT_PATTERN)
  const parts = normalized.split('-')
  const version = parts[0] ?? ''
  const traceId = parts[1] ?? ''
  const parentId = parts[2] ?? ''
  const flags = parts[3] ?? ''
  const errors: string[] = []

  if (!match) {
    errors.push('shape')
  }

  if (!/^[0-9a-f]{2}$/i.test(version) || version === 'ff') {
    errors.push('version')
  }

  if (!/^[0-9a-f]{32}$/i.test(traceId) || ZERO_HEX_PATTERN.test(traceId)) {
    errors.push('trace_id')
  }

  if (!/^[0-9a-f]{16}$/i.test(parentId) || ZERO_HEX_PATTERN.test(parentId)) {
    errors.push('parent_id')
  }

  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    errors.push('flags')
  }

  return {
    errors,
    flags,
    parentId,
    sampled: /^[0-9a-f]{2}$/i.test(flags) ? (Number.parseInt(flags, 16) & 1) === 1 : false,
    traceId,
    value: normalized,
    version
  }
}

const parseListHeader = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const parseKeyValueItems = (value: string) =>
  parseListHeader(value).map(item => {
    const [key = '', ...rest] = item.split('=')

    return {
      key: key.trim(),
      raw: item,
      value: rest.join('=').trim()
    }
  })

const duplicateKeys = (items: Array<{ key: string }>) => {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = item.key.toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
}

const parseTraceparentLines = (input: string): ParsedTraceLine[] =>
  input
    .slice(0, MAX_WORKSPACE_LENGTH)
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const traceparentMatch = line.match(/^\s*traceparent\s*[:=]\s*(.+)$/i)
      const looseMatch = line.match(/[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}/i)
      const value = traceparentMatch?.[1]?.trim() || looseMatch?.[0] || ''
      const parsed = parseTraceparent(value)

      return parsed ? [{ ...parsed, line: index + 1 }] : []
    })
    .slice(0, MAX_PARSED_TRACEPARENTS)

const parseHopPlan = (value: string) =>
  value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, MAX_HOPS)
    .map((line, index) => {
      const [service = '', operation = ''] = line.split('|').map(part => part.trim())

      return {
        operation: operation || `hop ${index + 1}`,
        service: service || `service-${index + 1}`
      }
    })

const deriveSpanId = (traceId: string, index: number) => {
  const seed = `${traceId}${index.toString(16).padStart(2, '0')}`
  let hash = 0x811c9dc5

  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }

  const part = (hash >>> 0).toString(16).padStart(8, '0')
  const mirrored = `${part}${part.split('').reverse().join('')}`.slice(0, 16)

  return ZERO_HEX_PATTERN.test(mirrored) ? `1${mirrored.slice(1)}` : mirrored
}

const buildPropagationRows = (draft: TraceDraft) =>
  parseHopPlan(draft.hopPlan).map((hop, index) => {
    const parentId = deriveSpanId(draft.traceId, index + 1)
    const traceparent = `00-${draft.traceId.padEnd(32, '0').slice(0, 32)}-${parentId}-${getTraceFlags(draft.sampled)}`

    return {
      ...hop,
      baggage: draft.baggage.trim(),
      parentId,
      sampled: draft.sampled,
      traceId: draft.traceId,
      traceparent,
      tracestate: draft.tracestate.trim()
    }
  })

const isTraceIdValid = (value: string) =>
  /^[0-9a-f]{32}$/.test(value) && !ZERO_HEX_PATTERN.test(value)
const isParentIdValid = (value: string) =>
  /^[0-9a-f]{16}$/.test(value) && !ZERO_HEX_PATTERN.test(value)

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getDownloadMeta = (format: OutputFormat) => {
  if (format === 'csv' || format === 'propagation') {
    return {
      filename: format === 'propagation' ? 'trace-propagation.csv' : 'trace-context.csv',
      type: 'text/csv;charset=utf-8'
    }
  }
  if (format === 'json')
    return { filename: 'trace-context.json', type: 'application/json;charset=utf-8' }
  if (format === 'markdown')
    return { filename: 'trace-context.md', type: 'text/markdown;charset=utf-8' }
  if (format === 'next')
    return { filename: 'trace-context-middleware.ts', type: 'text/plain;charset=utf-8' }

  return { filename: 'trace-context.txt', type: 'text/plain;charset=utf-8' }
}

const TraceContextClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<TraceDraft>(DEFAULT_DRAFT)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('headers')
  const [workspace, setWorkspace] = useState(PRESET_DRAFTS[0]?.workspace ?? '')
  const deferredWorkspace = useDeferredValue(workspace)

  const traceparent = useMemo(() => buildTraceparent(draft), [draft])
  const output = useMemo(() => buildOutput(draft, outputFormat), [draft, outputFormat])
  const headerBytes = useMemo(
    () => new TextEncoder().encode(getHeaderLines(draft).join('\n')).length,
    [draft]
  )
  const propagationRows = useMemo(() => buildPropagationRows(draft), [draft])
  const workspaceTruncated = workspace.length >= MAX_WORKSPACE_LENGTH

  const parsed = useMemo(() => {
    const traceparentValue = findHeaderValue(deferredWorkspace, 'traceparent')
    const tracestateValue = findHeaderValue(deferredWorkspace, 'tracestate')
    const baggageValue = findHeaderValue(deferredWorkspace, 'baggage')
    const baggageItems = parseKeyValueItems(baggageValue)
    const tracestateItems = parseKeyValueItems(tracestateValue)
    const traceparents = parseTraceparentLines(deferredWorkspace)

    return {
      baggage: baggageValue,
      baggageItems,
      duplicateBaggageKeys: duplicateKeys(baggageItems),
      duplicateTracestateKeys: duplicateKeys(tracestateItems),
      traceparent: parseTraceparent(traceparentValue),
      traceparents,
      traceparentValue,
      tracestate: tracestateValue,
      tracestateItems
    }
  }, [deferredWorkspace])

  const audits = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = []
    const parsedTraceparent = parsed.traceparent

    items.push({
      key: 'trace_id',
      severity: isTraceIdValid(draft.traceId) ? 'ok' : 'error',
      title: t(
        isTraceIdValid(draft.traceId)
          ? 'app.generation.trace_context.audit.trace_id_ok'
          : 'app.generation.trace_context.audit.trace_id_bad'
      ),
      detail: draft.traceId || t('app.generation.trace_context.empty_value')
    })

    items.push({
      key: 'parent_id',
      severity: isParentIdValid(draft.parentId) ? 'ok' : 'error',
      title: t(
        isParentIdValid(draft.parentId)
          ? 'app.generation.trace_context.audit.parent_id_ok'
          : 'app.generation.trace_context.audit.parent_id_bad'
      ),
      detail: draft.parentId || t('app.generation.trace_context.empty_value')
    })

    if (!draft.sampled) {
      items.push({
        key: 'sampled',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.unsampled'),
        detail: getTraceFlags(draft.sampled)
      })
    }

    if (draft.tracestate.length > 512) {
      items.push({
        key: 'tracestate_length',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.tracestate_long'),
        detail: `${draft.tracestate.length} chars`
      })
    }

    const invalidTracestate = parseListHeader(draft.tracestate).filter(
      item => !/^[a-z0-9_.-]+=[^=]+$/i.test(item)
    )
    if (invalidTracestate.length) {
      items.push({
        key: 'tracestate_shape',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.tracestate_bad'),
        detail: invalidTracestate.join(', ')
      })
    }

    if (draft.baggage.length > 1024) {
      items.push({
        key: 'baggage_length',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.baggage_long'),
        detail: `${draft.baggage.length} chars`
      })
    }

    const baggageItems = parseKeyValueItems(draft.baggage)
    const sensitiveBaggageKeys = baggageItems
      .filter(item => SENSITIVE_BAGGAGE_KEY_PATTERN.test(item.key))
      .map(item => item.key)
    if (sensitiveBaggageKeys.length) {
      items.push({
        key: 'baggage_sensitive',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.baggage_sensitive'),
        detail: sensitiveBaggageKeys.join(', ')
      })
    }

    const draftDuplicateBaggage = duplicateKeys(baggageItems)
    if (draftDuplicateBaggage.length) {
      items.push({
        key: 'baggage_duplicate',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.baggage_duplicate'),
        detail: draftDuplicateBaggage.join(', ')
      })
    }

    const draftDuplicateTracestate = duplicateKeys(parseKeyValueItems(draft.tracestate))
    if (draftDuplicateTracestate.length) {
      items.push({
        key: 'tracestate_duplicate',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.tracestate_duplicate'),
        detail: draftDuplicateTracestate.join(', ')
      })
    }

    if (headerBytes > 2048) {
      items.push({
        key: 'header_budget',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.header_budget'),
        detail: `${headerBytes} bytes`
      })
    }

    if (propagationRows.length >= MAX_HOPS) {
      items.push({
        key: 'hop_plan_capped',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.hop_plan_capped'),
        detail: `${MAX_HOPS} hops`
      })
    }

    if (!parsed.traceparentValue) {
      items.push({
        key: 'parsed_missing',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.parsed_missing')
      })
    } else if (!parsedTraceparent) {
      items.push({
        key: 'parsed_invalid',
        severity: 'error',
        title: t('app.generation.trace_context.audit.parsed_invalid')
      })
    } else if (parsedTraceparent.errors.length) {
      items.push({
        key: 'parsed_invalid',
        severity: 'error',
        title: t('app.generation.trace_context.audit.parsed_invalid'),
        detail: parsedTraceparent.errors
          .map(error => t(`app.generation.trace_context.error.${error}`))
          .join(', ')
      })
    } else {
      items.push({
        key: 'parsed_ok',
        severity: 'ok',
        title: t('app.generation.trace_context.audit.parsed_ok'),
        detail: parsedTraceparent.value
      })
    }

    if (workspaceTruncated) {
      items.push({
        key: 'workspace_truncated',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.workspace_truncated'),
        detail: `${MAX_WORKSPACE_LENGTH} chars`
      })
    }

    if (parsed.traceparents.length > 1) {
      items.push({
        key: 'parsed_multiple',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.parsed_multiple'),
        detail: `${parsed.traceparents.length}`
      })
    }

    if (parsed.duplicateBaggageKeys.length) {
      items.push({
        key: 'parsed_baggage_duplicate',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.parsed_baggage_duplicate'),
        detail: parsed.duplicateBaggageKeys.join(', ')
      })
    }

    const parsedSensitiveBaggage = parsed.baggageItems
      .filter(item => SENSITIVE_BAGGAGE_KEY_PATTERN.test(item.key))
      .map(item => item.key)
    if (parsedSensitiveBaggage.length) {
      items.push({
        key: 'parsed_baggage_sensitive',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.parsed_baggage_sensitive'),
        detail: parsedSensitiveBaggage.join(', ')
      })
    }

    if (parsed.duplicateTracestateKeys.length) {
      items.push({
        key: 'parsed_tracestate_duplicate',
        severity: 'warn',
        title: t('app.generation.trace_context.audit.parsed_tracestate_duplicate'),
        detail: parsed.duplicateTracestateKeys.join(', ')
      })
    }

    return items
  }, [
    draft,
    headerBytes,
    parsed.baggageItems,
    parsed.duplicateBaggageKeys,
    parsed.duplicateTracestateKeys,
    parsed.traceparent,
    parsed.traceparentValue,
    parsed.traceparents.length,
    propagationRows.length,
    t,
    workspaceTruncated
  ])

  const filteredAudits = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return audits

    return audits.filter(item =>
      `${item.title} ${item.detail ?? ''} ${item.key}`.toLowerCase().includes(query)
    )
  }, [auditQuery, audits])

  const statusCounts = useMemo(
    () => ({
      error: audits.filter(item => item.severity === 'error').length,
      ok: audits.filter(item => item.severity === 'ok').length,
      warn: audits.filter(item => item.severity === 'warn').length
    }),
    [audits]
  )

  const handleGenerate = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      parentId: randomNonZeroHex(8),
      traceId: randomNonZeroHex(16)
    }))
  }, [])

  const handleGenerateChildSpan = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      parentId: randomNonZeroHex(8)
    }))
  }, [])

  const handleApplyPreset = useCallback((preset: TracePreset) => {
    setDraft(preset.value)
    setWorkspace(preset.workspace)
  }, [])

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setAuditQuery('')
    setOutputFormat('headers')
    setWorkspace(PRESET_DRAFTS[0]?.workspace ?? '')
  }, [])

  const handleUseOutput = useCallback(() => {
    setWorkspace(buildOutput(draft, 'headers'))
  }, [draft])

  const handleAdoptParsed = useCallback(() => {
    if (!parsed.traceparent) return

    setDraft(prev => ({
      ...prev,
      baggage: parsed.baggage,
      parentId: parsed.traceparent?.parentId ?? prev.parentId,
      sampled: parsed.traceparent?.sampled ?? prev.sampled,
      traceId: parsed.traceparent?.traceId ?? prev.traceId,
      tracestate: parsed.tracestate
    }))
  }, [parsed.baggage, parsed.traceparent, parsed.tracestate])

  const copyTraceparent = useCallback(() => {
    void copy(traceparent)
  }, [copy, traceparent])

  const downloadMeta = getDownloadMeta(outputFormat)

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.trace_context')}
              </CardTitle>
              <CardDescription>{t('app.generation.trace_context.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="default"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              {t('public.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              icon={<ShieldCheck className="h-4 w-4" />}
              label={t('app.generation.trace_context.metric.status')}
              value={
                statusCounts.error
                  ? t('app.generation.trace_context.status.error')
                  : statusCounts.warn
                    ? t('app.generation.trace_context.status.warn')
                    : t('app.generation.trace_context.status.ok')
              }
            />
            <Metric
              label={t('app.generation.trace_context.metric.sampled')}
              value={draft.sampled ? '01' : '00'}
            />
            <Metric label={t('app.generation.trace_context.metric.bytes')} value={headerBytes} />
            <Metric
              label={t('app.generation.trace_context.metric.parsed')}
              value={parsed.traceparents.length}
            />
            <Metric
              label={t('app.generation.trace_context.metric.baggage')}
              value={parsed.baggageItems.length || parseKeyValueItems(draft.baggage).length}
            />
            <Metric
              label={t('app.generation.trace_context.metric.hops')}
              value={propagationRows.length}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_DRAFTS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleApplyPreset(preset)}
              >
                {t(`app.generation.trace_context.preset.${preset.key}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.generation.trace_context.builder')}</CardTitle>
            <CardDescription>{t('app.generation.trace_context.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                id="trace-service"
                label={t('app.generation.trace_context.service')}
                value={draft.service}
                onChange={value => setDraft(prev => ({ ...prev, service: value.slice(0, 80) }))}
              />
              <Field
                id="trace-operation"
                label={t('app.generation.trace_context.operation')}
                value={draft.operation}
                onChange={value => setDraft(prev => ({ ...prev, operation: value.slice(0, 120) }))}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="trace-id">{t('app.generation.trace_context.trace_id')}</Label>
              <Input
                id="trace-id"
                value={draft.traceId}
                onChange={event =>
                  setDraft(prev => ({ ...prev, traceId: normalizeHex(event.target.value, 32) }))
                }
                className="font-mono"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="parent-id">{t('app.generation.trace_context.parent_id')}</Label>
              <Input
                id="parent-id"
                value={draft.parentId}
                onChange={event =>
                  setDraft(prev => ({ ...prev, parentId: normalizeHex(event.target.value, 16) }))
                }
                className="font-mono"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Checkbox
                checked={draft.sampled}
                onChange={event => setDraft(prev => ({ ...prev, sampled: event.target.checked }))}
                label={t('app.generation.trace_context.sampled')}
              />
              <Button
                type="button"
                variant="default"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={handleGenerate}
              >
                {t('app.generation.trace_context.regenerate')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<GitBranch className="h-4 w-4" />}
                onClick={handleGenerateChildSpan}
              >
                {t('app.generation.trace_context.regenerate_span')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={copyTraceparent}
              >
                {t('app.generation.trace_context.copy_traceparent')}
              </Button>
            </div>

            <div className="space-y-3">
              <Label htmlFor="tracestate">{t('app.generation.trace_context.tracestate')}</Label>
              <Input
                id="tracestate"
                value={draft.tracestate}
                onChange={event =>
                  setDraft(prev => ({ ...prev, tracestate: event.target.value.slice(0, 700) }))
                }
                className="font-mono"
                placeholder="vendor=value"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="baggage">{t('app.generation.trace_context.baggage')}</Label>
              <Input
                id="baggage"
                value={draft.baggage}
                onChange={event =>
                  setDraft(prev => ({ ...prev, baggage: event.target.value.slice(0, 1400) }))
                }
                className="font-mono"
                placeholder="key=value,key2=value2"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="trace-hop-plan">{t('app.generation.trace_context.hop_plan')}</Label>
              <Textarea
                id="trace-hop-plan"
                value={draft.hopPlan}
                onChange={event =>
                  setDraft(prev => ({ ...prev, hopPlan: event.target.value.slice(0, 1000) }))
                }
                className="min-h-[120px] font-mono"
                placeholder="service | operation"
                spellCheck={false}
              />
            </div>

            <div className="glass-input rounded-2xl p-4">
              <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">
                {t('app.generation.trace_context.traceparent_preview')}
              </div>
              <code className="block break-all font-mono text-sm text-[var(--text-primary)]">
                {traceparent}
              </code>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.generation.trace_context.workspace')}</CardTitle>
            <CardDescription>{t('app.generation.trace_context.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, MAX_WORKSPACE_LENGTH))}
              className="min-h-[220px] font-mono"
              spellCheck={false}
              placeholder={t('app.generation.trace_context.workspace_placeholder')}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={handleUseOutput}>
                {t('app.generation.trace_context.use_output')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleAdoptParsed}
                disabled={!parsed.traceparent}
              >
                {t('app.generation.trace_context.adopt_parsed')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setWorkspace('')}>
                {t('public.clear')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParsedItem
                label={t('app.generation.trace_context.version')}
                value={parsed.traceparent?.version || '-'}
              />
              <ParsedItem
                label={t('app.generation.trace_context.flags')}
                value={parsed.traceparent?.flags || '-'}
              />
              <ParsedItem
                label={t('app.generation.trace_context.parsed_trace_id')}
                value={parsed.traceparent?.traceId || '-'}
              />
              <ParsedItem
                label={t('app.generation.trace_context.parsed_parent_id')}
                value={parsed.traceparent?.parentId || '-'}
              />
            </div>

            {parsed.traceparents.length > 0 ? (
              <div className="grid max-h-[260px] gap-2 overflow-auto pr-1">
                {parsed.traceparents.map(item => (
                  <div
                    key={`${item.line}-${item.value}`}
                    className="glass-panel min-w-0 rounded-2xl p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {t('app.generation.trace_context.line')} {item.line}
                      </span>
                      <span
                        className={
                          item.errors.length
                            ? 'text-xs font-semibold text-red-500'
                            : 'text-xs font-semibold text-emerald-600'
                        }
                      >
                        {item.errors.length
                          ? t('app.generation.trace_context.status.error')
                          : t('app.generation.trace_context.status.ok')}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-[var(--text-primary)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.generation.trace_context.audit')}</CardTitle>
            <CardDescription>{t('app.generation.trace_context.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                className="pl-9"
                placeholder={t('app.generation.trace_context.audit_search')}
              />
            </div>
            {filteredAudits.map(item => (
              <div
                key={item.key}
                className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      item.severity === 'error'
                        ? 'rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-500'
                        : item.severity === 'warn'
                          ? 'rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600'
                          : 'rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-600'
                    }
                  >
                    {t(`app.generation.trace_context.severity.${item.severity}`)}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                </div>
                {item.detail ? (
                  <p className="mt-2 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('app.generation.trace_context.output')}</CardTitle>
            <CardDescription>{t('app.generation.trace_context.output_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="space-y-3">
                <Label htmlFor="trace-output">
                  {t('app.generation.trace_context.output_format')}
                </Label>
                <Select
                  id="trace-output"
                  value={outputFormat}
                  onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                >
                  {OUTPUT_FORMATS.map(format => (
                    <option key={format} value={format}>
                      {t(`app.generation.trace_context.output.${format}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => void copy(output)}
                className="self-end"
              >
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<ClipboardCheck className="h-4 w-4" />}
                onClick={() => void copy(buildOutput(draft, 'propagation'))}
                className="self-end"
              >
                {t('app.generation.trace_context.copy_propagation')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<Download className="h-4 w-4" />}
                onClick={() => downloadText(output, downloadMeta.filename, downloadMeta.type)}
                className="self-end"
              >
                {t('app.generation.trace_context.download')}
              </Button>
            </div>

            <div className="glass-input min-h-[260px] rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                <FileJson className="h-4 w-4" />
                {t(`app.generation.trace_context.output.${outputFormat}`)}
              </div>
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--text-primary)]">
                {output}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.trace_context.reference')}</CardTitle>
          <CardDescription>{t('app.generation.trace_context.reference_hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(['version', 'trace_id', 'parent_id', 'flags'] as const).map(key => (
              <div
                key={key}
                className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-4"
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.trace_context.reference.${key}`)}
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`app.generation.trace_context.reference.${key}_hint`)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const Field = ({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
  </div>
)

const Metric = ({
  icon,
  label,
  value
}: {
  icon?: ReactNode
  label: string
  value: number | string
}) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
      {icon}
      {label}
    </div>
    <div className="mt-2 break-all font-mono text-xl font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

const ParsedItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)] p-3">
    <div className="text-xs font-medium text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">{value}</div>
  </div>
)

export default TraceContextClient
