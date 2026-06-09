'use client'

import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  History,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Zap
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

const PAGE_TYPES = ['content', 'dashboard', 'checkout', 'auth', 'embedded'] as const
const OUTPUT_TYPES = ['probe', 'next', 'headers', 'playbook', 'markdown', 'json', 'csv'] as const
const WORKSPACE_LIMIT = 90000
const REASON_LIMIT = 220

type PageType = (typeof PAGE_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'
type ReasonSource = 'header' | 'json' | 'manual' | 'text'

interface BfcacheDraft {
  activeBroadcastChannel: boolean
  activePaymentRequest: boolean
  activeWebLock: boolean
  activeWebRtc: boolean
  activeWebSocket: boolean
  authSensitive: boolean
  beforeUnloadListener: boolean
  cacheControl: string
  cacheNoStore: boolean
  crossOriginIframe: boolean
  indexedDbTransaction: boolean
  memoryPressure: boolean
  outstandingFetch: boolean
  pageType: PageType
  pendingUnloadBeacon: boolean
  restoreRate: string
  routePattern: string
  sampleCount: string
  serviceWorkerClaim: boolean
  unloadListener: boolean
  windowOpener: boolean
}

interface ParsedReason {
  frame: string
  id: string
  level: FindingLevel
  reason: string
  source: ReasonSource
  subject: string
  url: string
}

interface ParsedWorkspace {
  errors: string[]
  reasons: ParsedReason[]
}

interface Preset {
  draft: BfcacheDraft
  key: string
  workspace: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

type FlagKey = Exclude<
  keyof BfcacheDraft,
  'cacheControl' | 'pageType' | 'restoreRate' | 'routePattern' | 'sampleCount'
>

const FLAG_KEYS = [
  'unloadListener',
  'beforeUnloadListener',
  'cacheNoStore',
  'authSensitive',
  'activeWebSocket',
  'activeWebRtc',
  'activeBroadcastChannel',
  'activeWebLock',
  'indexedDbTransaction',
  'outstandingFetch',
  'pendingUnloadBeacon',
  'windowOpener',
  'crossOriginIframe',
  'activePaymentRequest',
  'serviceWorkerClaim',
  'memoryPressure'
] as const satisfies readonly FlagKey[]

const DEFAULT_DRAFT: BfcacheDraft = {
  activeBroadcastChannel: false,
  activePaymentRequest: false,
  activeWebLock: false,
  activeWebRtc: false,
  activeWebSocket: false,
  authSensitive: false,
  beforeUnloadListener: false,
  cacheControl: 'public, max-age=0, must-revalidate',
  cacheNoStore: false,
  crossOriginIframe: false,
  indexedDbTransaction: false,
  memoryPressure: false,
  outstandingFetch: false,
  pageType: 'content',
  pendingUnloadBeacon: false,
  restoreRate: '86',
  routePattern: '/docs/:slug',
  sampleCount: '2400',
  serviceWorkerClaim: false,
  unloadListener: false,
  windowOpener: false
}

const PRESETS: Preset[] = [
  {
    key: 'content',
    draft: DEFAULT_DRAFT,
    workspace: [
      'pageshow persisted=true route=/docs/cache navType=back_forward activationStart=18',
      'pagehide persisted=true route=/docs/cache',
      'Cache-Control: public, max-age=0, must-revalidate'
    ].join('\n')
  },
  {
    key: 'dashboard',
    draft: {
      ...DEFAULT_DRAFT,
      activeBroadcastChannel: true,
      activeWebSocket: true,
      pageType: 'dashboard',
      restoreRate: '64',
      routePattern: '/dashboard',
      sampleCount: '820'
    },
    workspace: [
      'reason=websocket url=/dashboard frame=top',
      'reason=broadcastchannel url=/dashboard frame=top',
      '{"url":"/dashboard","notRestoredReasons":[{"reason":"WebSocket","context":"realtime socket"},{"reason":"BroadcastChannel"}]}'
    ].join('\n')
  },
  {
    key: 'checkout',
    draft: {
      ...DEFAULT_DRAFT,
      authSensitive: true,
      beforeUnloadListener: true,
      pageType: 'checkout',
      pendingUnloadBeacon: true,
      restoreRate: '38',
      routePattern: '/checkout',
      sampleCount: '420'
    },
    workspace: [
      'beforeunload listener detected on /checkout',
      'pagehide persisted=false route=/checkout',
      'reason=outstanding-network-request url=/checkout frame=top'
    ].join('\n')
  },
  {
    key: 'auth',
    draft: {
      ...DEFAULT_DRAFT,
      authSensitive: true,
      cacheControl: 'private, no-store',
      cacheNoStore: true,
      pageType: 'auth',
      restoreRate: '22',
      routePattern: '/account',
      sampleCount: '310'
    },
    workspace: [
      'Cache-Control: private, no-store',
      '{"notRestoredReasons":{"reasons":[{"reason":"response-cache-control-no-store","url":"/account"}]}}',
      'pageshow persisted=false route=/account navType=back_forward'
    ].join('\n')
  },
  {
    key: 'risk',
    draft: {
      activeBroadcastChannel: true,
      activePaymentRequest: true,
      activeWebLock: true,
      activeWebRtc: true,
      activeWebSocket: true,
      authSensitive: true,
      beforeUnloadListener: true,
      cacheControl: 'private, no-store, no-cache',
      cacheNoStore: true,
      crossOriginIframe: true,
      indexedDbTransaction: true,
      memoryPressure: true,
      outstandingFetch: true,
      pageType: 'checkout',
      pendingUnloadBeacon: true,
      restoreRate: '8',
      routePattern: '/checkout',
      sampleCount: '36',
      serviceWorkerClaim: true,
      unloadListener: true,
      windowOpener: true
    },
    workspace: [
      '{"url":"/checkout","notRestoredReasons":{"reasons":[{"reason":"unload-listener","url":"/checkout"},{"reason":"response-cache-control-no-store","url":"/checkout"},{"reason":"websocket","url":"/checkout"},{"reason":"outstanding-network-request","url":"/checkout"}],"children":[{"url":"https://pay.example.com/frame","reasons":[{"reason":"paymentrequest"},{"reason":"masked"}]}]}}',
      'Cache-Control: private, no-store, no-cache',
      'window.addEventListener("beforeunload", confirmExit)',
      'pagehide persisted=false route=/checkout',
      'reason=web-lock url=/checkout frame=top'
    ].join('\n')
  }
]

const REFERENCE_ITEMS = ['unload', 'headers', 'lifecycle', 'connections', 'iframes', 'rum'] as const
const CHECKLIST_ITEMS = ['measure', 'remove', 'headers', 'segment'] as const

const numberFromInput = (value: string) => {
  const next = Number(value.replace(/[,_\s%]/g, ''))
  return Number.isFinite(next) && next >= 0 ? next : 0
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const escapeJs = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const normalizeReason = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[_\s]+/g, '-')

const reasonLevel = (reason: string): FindingLevel => {
  const token = normalizeReason(reason)
  if (
    /unload|beforeunload|no-store|cache-control|not-cacheable|response-cache-control/u.test(token)
  )
    return 'danger'
  if (
    /websocket|webrtc|rtc|web-lock|lock|payment|opener|outstanding|fetch|broadcast|indexeddb|idb|iframe|serviceworker|service-worker|memory|masked/u.test(
      token
    )
  )
    return 'warn'
  if (/persisted=false|not-restored|restore-false/u.test(token)) return 'warn'
  return 'warn'
}

const reasonKey = (reason: string) => {
  const token = normalizeReason(reason)
  if (/beforeunload/u.test(token)) return 'parsed_beforeunload'
  if (/unload/u.test(token)) return 'parsed_unload'
  if (/no-store|cache-control|not-cacheable|response-cache-control/u.test(token))
    return 'parsed_no_store'
  if (/websocket/u.test(token)) return 'parsed_websocket'
  if (/webrtc|rtc/u.test(token)) return 'parsed_webrtc'
  if (/broadcast/u.test(token)) return 'parsed_broadcast'
  if (/web-lock|lock/u.test(token)) return 'parsed_weblock'
  if (/indexeddb|idb/u.test(token)) return 'parsed_idb'
  if (/outstanding|fetch|network/u.test(token)) return 'parsed_pending_fetch'
  if (/payment/u.test(token)) return 'parsed_payment'
  if (/opener/u.test(token)) return 'parsed_opener'
  if (/iframe|masked/u.test(token)) return 'parsed_iframe'
  if (/serviceworker|service-worker/u.test(token)) return 'parsed_service_worker'
  if (/memory/u.test(token)) return 'parsed_memory'
  if (/persisted=false|not-restored|restore-false/u.test(token)) return 'parsed_not_restored'
  return 'parsed_unknown'
}

const addParsedReason = (
  reasons: ParsedReason[],
  reason: string,
  source: ReasonSource,
  index: number,
  options: { frame?: string; subject?: string; url?: string } = {}
) => {
  const normalized = normalizeReason(reason)
  if (!normalized) return
  reasons.push({
    frame: options.frame ?? '',
    id: `${source}-${index}-${reasons.length}`,
    level: reasonLevel(normalized),
    reason: normalized,
    source,
    subject: options.subject ?? normalized,
    url: options.url ?? ''
  })
}

const tokenValue = (line: string, key: string) => {
  const match = line.match(new RegExp(`${key}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s,]+)`, 'iu'))
  return match?.[1]?.replace(/^["']|["']$/gu, '') ?? ''
}

const collectReasonObjects = (
  value: unknown,
  reasons: ParsedReason[],
  source: ReasonSource,
  index: number,
  inherited: { frame?: string; url?: string } = {}
) => {
  if (!value) return
  if (typeof value === 'string') {
    if (
      /unload|cache-control|no-store|websocket|broadcast|lock|indexeddb|fetch|payment|iframe|opener|not-restored|persisted=false|serviceworker|memory/iu.test(
        value
      )
    ) {
      addParsedReason(reasons, value, source, index, inherited)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, childIndex) =>
      collectReasonObjects(item, reasons, source, index + childIndex, inherited)
    )
    return
  }
  if (typeof value !== 'object') return

  const record = value as Record<string, unknown>
  const nextInherited = {
    frame: String(record.frame ?? record.frameId ?? record.context ?? inherited.frame ?? ''),
    url: String(record.url ?? record.src ?? record.href ?? inherited.url ?? '')
  }
  const reason = record.reason ?? record.name ?? record.type
  if (typeof reason === 'string') {
    addParsedReason(reasons, reason, source, index, {
      ...nextInherited,
      subject: String(record.context ?? record.message ?? reason)
    })
  }

  ;['reasons', 'notRestoredReasons', 'children', 'frames', 'blockedReasons', 'details'].forEach(
    key => {
      if (record[key] !== undefined)
        collectReasonObjects(record[key], reasons, source, index, nextInherited)
    }
  )
}

const parseJsonWorkspace = (input: string): { errors: string[]; reasons: ParsedReason[] } => {
  const errors: string[] = []
  const reasons: ParsedReason[] = []
  const rows = input
    .split(/\n+/u)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') || line.startsWith('['))

  rows.forEach((row, rowIndex) => {
    try {
      const parsed = JSON.parse(row) as unknown
      collectReasonObjects(parsed, reasons, 'json', rowIndex)
    } catch {
      errors.push(`json:${rowIndex + 1}`)
    }
  })

  return { errors, reasons }
}

const parseTextWorkspace = (input: string): ParsedReason[] => {
  const reasons: ParsedReason[] = []
  input.split(/\n+/u).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return
    const lower = trimmed.toLowerCase()
    const url =
      tokenValue(trimmed, 'url') ||
      tokenValue(trimmed, 'route') ||
      (trimmed.match(/https?:\/\/[^\s,]+|\/[^\s,]+/iu)?.[0] ?? '')
    const frame = tokenValue(trimmed, 'frame')
    const reason = tokenValue(trimmed, 'reason') || tokenValue(trimmed, 'notRestoredReason')

    if (reason) addParsedReason(reasons, reason, 'text', index, { frame, subject: trimmed, url })
    if (/cache-control\s*:/iu.test(trimmed) && /no-store|no-cache/iu.test(trimmed))
      addParsedReason(reasons, 'response-cache-control-no-store', 'header', index, {
        subject: trimmed,
        url
      })
    if (/beforeunload/iu.test(trimmed))
      addParsedReason(reasons, 'beforeunload-listener', 'text', index, { subject: trimmed, url })
    if (/\bunload\b/iu.test(trimmed) && !/beforeunload/iu.test(trimmed))
      addParsedReason(reasons, 'unload-listener', 'text', index, { subject: trimmed, url })
    if (/pageshow|pagehide/iu.test(trimmed) && /persisted\s*=\s*false/iu.test(trimmed))
      addParsedReason(reasons, 'persisted=false', 'text', index, { subject: trimmed, url })
    if (/websocket|new WebSocket/iu.test(trimmed))
      addParsedReason(reasons, 'websocket', 'text', index, { subject: trimmed, url })
    if (/broadcastchannel/iu.test(lower))
      addParsedReason(reasons, 'broadcastchannel', 'text', index, { subject: trimmed, url })
    if (/web\s*lock|navigator\.locks/iu.test(trimmed))
      addParsedReason(reasons, 'web-lock', 'text', index, { subject: trimmed, url })
    if (/indexeddb|idb/iu.test(lower))
      addParsedReason(reasons, 'indexeddb-transaction', 'text', index, { subject: trimmed, url })
    if (/outstanding-network-request|pending fetch|keepalive|sendbeacon/iu.test(trimmed))
      addParsedReason(reasons, 'outstanding-network-request', 'text', index, {
        subject: trimmed,
        url
      })
    if (/paymentrequest/iu.test(lower))
      addParsedReason(reasons, 'paymentrequest', 'text', index, { subject: trimmed, url })
    if (/window\.opener|target=_blank/iu.test(trimmed))
      addParsedReason(reasons, 'opener', 'text', index, { subject: trimmed, url })
    if (/serviceworker|service worker|clients\.claim/iu.test(lower))
      addParsedReason(reasons, 'serviceworker', 'text', index, { subject: trimmed, url })
  })
  return reasons
}

const parseWorkspace = (input: string): ParsedWorkspace => {
  const source = input.length > WORKSPACE_LIMIT ? input.slice(0, WORKSPACE_LIMIT) : input
  const json = parseJsonWorkspace(source)
  return {
    errors: [...json.errors, ...(input.length > WORKSPACE_LIMIT ? ['capped_input'] : [])],
    reasons: [...json.reasons, ...parseTextWorkspace(source)].slice(0, REASON_LIMIT)
  }
}

const draftReasons = (draft: BfcacheDraft): ParsedReason[] => {
  const reasons: ParsedReason[] = []
  FLAG_KEYS.forEach((flag, index) => {
    if (!draft[flag]) return
    addParsedReason(reasons, flag, 'manual', index, {
      subject: flag,
      url: draft.routePattern
    })
  })
  if (/no-store|no-cache/iu.test(draft.cacheControl)) {
    addParsedReason(reasons, 'response-cache-control-no-store', 'manual', 99, {
      subject: draft.cacheControl,
      url: draft.routePattern
    })
  }
  return reasons
}

const auditBfcache = (draft: BfcacheDraft, parsed: ParsedWorkspace): Finding[] => {
  const findings: Finding[] = []
  const add = (level: FindingLevel, key: string, subject: string) =>
    findings.push({ key, level, subject })
  const restoreRate = numberFromInput(draft.restoreRate)
  const sampleCount = numberFromInput(draft.sampleCount)

  if (!draft.routePattern.trim()) add('danger', 'missing_route', draft.pageType)
  if (restoreRate < 25) add('danger', 'restore_rate_severe', `${restoreRate}%`)
  else if (restoreRate < 70) add('warn', 'restore_rate_low', `${restoreRate}%`)
  if (sampleCount < 100) add('warn', 'low_sample_count', String(sampleCount))
  if (draft.unloadListener) add('danger', 'unload_listener', draft.routePattern)
  if (draft.beforeUnloadListener) add('danger', 'beforeunload_listener', draft.routePattern)
  if (draft.cacheNoStore || /no-store/iu.test(draft.cacheControl))
    add('danger', 'cache_no_store', draft.cacheControl)
  else if (/no-cache|private/iu.test(draft.cacheControl))
    add('warn', 'cache_revalidation', draft.cacheControl)
  if (draft.authSensitive) add('warn', 'auth_sensitive', draft.routePattern)
  if (draft.activeWebSocket) add('warn', 'active_websocket', draft.routePattern)
  if (draft.activeWebRtc) add('warn', 'active_webrtc', draft.routePattern)
  if (draft.activeBroadcastChannel) add('warn', 'active_broadcast', draft.routePattern)
  if (draft.activeWebLock) add('warn', 'active_weblock', draft.routePattern)
  if (draft.indexedDbTransaction) add('warn', 'idb_transaction', draft.routePattern)
  if (draft.outstandingFetch) add('warn', 'pending_fetch', draft.routePattern)
  if (draft.pendingUnloadBeacon) add('warn', 'unload_beacon', draft.routePattern)
  if (draft.windowOpener) add('warn', 'window_opener', draft.routePattern)
  if (draft.crossOriginIframe) add('warn', 'cross_origin_iframe', draft.routePattern)
  if (draft.activePaymentRequest) add('warn', 'payment_request', draft.routePattern)
  if (draft.serviceWorkerClaim) add('warn', 'service_worker_claim', draft.routePattern)
  if (draft.memoryPressure) add('warn', 'memory_pressure', draft.routePattern)

  parsed.reasons.forEach(reason => {
    add(reason.level, reasonKey(reason.reason), reason.url || reason.subject || reason.reason)
  })
  parsed.errors.forEach(error =>
    add(
      error === 'capped_input' ? 'warn' : 'danger',
      error === 'capped_input' ? 'capped_input' : 'invalid_json',
      error
    )
  )

  if (!findings.some(item => item.level !== 'good')) {
    add('good', 'baseline_ok', draft.routePattern)
    add('good', 'restore_rate_ok', `${restoreRate}%`)
    add('good', 'lifecycle_ok', draft.pageType)
  }

  return findings
}

const getScore = (findings: Finding[]) => {
  const penalty = findings.reduce(
    (total, finding) =>
      total + (finding.level === 'danger' ? 17 : finding.level === 'warn' ? 7 : 0),
    0
  )
  return Math.max(0, 100 - penalty)
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-400/35 bg-red-500/10 text-red-700 dark:text-red-200'
  if (level === 'warn')
    return 'border-amber-400/35 bg-amber-500/10 text-amber-700 dark:text-amber-200'
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
}

const buildProbe = (draft: BfcacheDraft) =>
  [
    'export function installBFCacheProbe(report = console.log) {',
    '  const nav = () => performance.getEntriesByType("navigation")[0];',
    '  window.addEventListener("pagehide", event => {',
    '    report({',
    "      event: 'pagehide',",
    `      route: '${escapeJs(draft.routePattern)}',`,
    '      persisted: event.persisted,',
    '      navigationType: nav()?.type,',
    '      activationStart: nav()?.activationStart ?? 0',
    '    });',
    '  });',
    '  window.addEventListener("pageshow", event => {',
    '    const entry = nav();',
    '    report({',
    "      event: 'pageshow',",
    `      route: '${escapeJs(draft.routePattern)}',`,
    '      persisted: event.persisted,',
    '      navigationType: entry?.type,',
    '      activationStart: entry?.activationStart ?? 0,',
    '      notRestoredReasons: entry?.notRestoredReasons ?? null',
    '    });',
    '  });',
    '}'
  ].join('\n')

const buildNext = (draft: BfcacheDraft) =>
  [
    "'use client'",
    '',
    "import { useEffect } from 'react'",
    '',
    'export function BFCacheReporter() {',
    '  useEffect(() => {',
    '    const report = (event, persisted) => {',
    '      navigator.sendBeacon?.(',
    "        '/api/rum/bfcache',",
    `        JSON.stringify({ route: '${escapeJs(draft.routePattern)}', event, persisted, at: Date.now() })`,
    '      )',
    '    }',
    "    const onPageHide = event => report('pagehide', event.persisted)",
    "    const onPageShow = event => report('pageshow', event.persisted)",
    "    window.addEventListener('pagehide', onPageHide)",
    "    window.addEventListener('pageshow', onPageShow)",
    '    return () => {',
    "      window.removeEventListener('pagehide', onPageHide)",
    "      window.removeEventListener('pageshow', onPageShow)",
    '    }',
    '  }, [])',
    '',
    '  return null',
    '}'
  ].join('\n')

const buildHeaders = (draft: BfcacheDraft) =>
  [
    `# ${draft.routePattern}`,
    `Cache-Control: ${draft.cacheNoStore ? 'private, no-store' : draft.cacheControl}`,
    'BFCache checklist:',
    '- Remove unload listeners; prefer pagehide and visibilitychange.',
    '- Avoid beforeunload except while unsaved changes are actively present.',
    '- Close transient sockets, WebRTC, Web Locks, and IDB transactions before navigation.',
    '- Segment RUM by pageshow.persisted and navigation type.',
    draft.authSensitive
      ? '- Auth route: verify privacy requirements before loosening Cache-Control.'
      : '- Public route: avoid no-store unless the response truly cannot be restored.'
  ].join('\n')

const buildPlaybook = (draft: BfcacheDraft, findings: Finding[]) =>
  [
    `BFCache recovery playbook for ${draft.routePattern}`,
    '',
    '1. Capture pageshow/pagehide persisted values on real navigations.',
    '2. Paste DevTools NotRestoredReasons JSON into this tool.',
    '3. Remove hard blockers first: unload, beforeunload, and no-store.',
    '4. Make long-lived connections resumable after pageshow instead of blocking restore.',
    '5. Re-measure restore rate by route, browser, device, and release.',
    '',
    'Top findings:',
    ...findings
      .slice(0, 12)
      .map(finding => `- [${finding.level}] ${finding.key}: ${finding.subject}`)
  ].join('\n')

const buildMarkdown = (draft: BfcacheDraft, parsed: ParsedWorkspace, findings: Finding[]) =>
  [
    `# BFCache eligibility: ${draft.routePattern}`,
    '',
    `- Page type: ${draft.pageType}`,
    `- Restore rate: ${draft.restoreRate}%`,
    `- Samples: ${draft.sampleCount}`,
    `- Cache-Control: ${draft.cacheControl}`,
    '',
    '## Findings',
    ...findings
      .slice(0, 24)
      .map(finding => `- [${finding.level}] ${finding.subject}: ${finding.key}`),
    '',
    '## Parsed reasons',
    ...parsed.reasons
      .slice(0, 20)
      .map(reason => `- ${reason.reason} / ${reason.source} / ${reason.url || reason.frame || '-'}`)
  ].join('\n')

const buildCsv = (draft: BfcacheDraft, parsed: ParsedWorkspace) => {
  const reasons = [...draftReasons(draft), ...parsed.reasons]
  return [
    ['reason', 'level', 'source', 'url', 'frame', 'subject'].map(escapeCsv).join(','),
    ...reasons.map(reason =>
      [reason.reason, reason.level, reason.source, reason.url, reason.frame, reason.subject]
        .map(escapeCsv)
        .join(',')
    )
  ].join('\n')
}

const buildOutput = (
  draft: BfcacheDraft,
  parsed: ParsedWorkspace,
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'probe') return buildProbe(draft)
  if (outputType === 'next') return buildNext(draft)
  if (outputType === 'headers') return buildHeaders(draft)
  if (outputType === 'playbook') return buildPlaybook(draft, findings)
  if (outputType === 'markdown') return buildMarkdown(draft, parsed, findings)
  if (outputType === 'json')
    return JSON.stringify({ draft, findings, parsedReasons: parsed.reasons }, null, 2)
  return buildCsv(draft, parsed)
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

export default function BfcacheAuditClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<BfcacheDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0]?.workspace ?? '')
  const [outputType, setOutputType] = useState<OutputType>('probe')
  const [auditQuery, setAuditQuery] = useState('')
  const [reasonQuery, setReasonQuery] = useState('')

  const deferredWorkspace = useDeferredValue(workspace)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const deferredReasonQuery = useDeferredValue(reasonQuery)

  const parsed = useMemo(() => parseWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditBfcache(draft, parsed), [draft, parsed])
  const score = useMemo(() => getScore(findings), [findings])
  const output = useMemo(
    () => buildOutput(draft, parsed, findings, outputType),
    [draft, findings, outputType, parsed]
  )
  const csvOutput = useMemo(() => buildCsv(draft, parsed), [draft, parsed])
  const filteredFindings = useMemo(() => {
    const query = deferredAuditQuery.trim().toLowerCase()
    if (!query) return findings
    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.converter.bfcache.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredAuditQuery, findings, t])
  const filteredReasons = useMemo(() => {
    const query = deferredReasonQuery.trim().toLowerCase()
    if (!query) return parsed.reasons
    return parsed.reasons.filter(reason =>
      `${reason.reason} ${reason.url} ${reason.frame} ${reason.source} ${reason.subject}`
        .toLowerCase()
        .includes(query)
    )
  }, [deferredReasonQuery, parsed.reasons])
  const metrics = useMemo(
    () => ({
      blockers: findings.filter(item => item.level === 'danger').length,
      reasons: parsed.reasons.length,
      restoreRate: `${numberFromInput(draft.restoreRate)}%`,
      samples: numberFromInput(draft.sampleCount),
      score,
      warnings: findings.filter(item => item.level === 'warn').length
    }),
    [draft.restoreRate, draft.sampleCount, findings, parsed.reasons.length, score]
  )

  const updateDraft = <Key extends keyof BfcacheDraft>(key: Key, value: BfcacheDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const updateFlag = (key: FlagKey, value: boolean) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = useCallback((preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }, [])

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    setWorkspace(PRESETS[0]?.workspace ?? '')
    setOutputType('probe')
    setAuditQuery('')
    setReasonQuery('')
  }, [])

  const copySummary = () => {
    copy(
      [
        t('app.converter.bfcache.summary_title'),
        `${t('app.converter.bfcache.metric.score')}: ${metrics.score}`,
        `${t('app.converter.bfcache.metric.restore_rate')}: ${metrics.restoreRate}`,
        `${t('app.converter.bfcache.metric.samples')}: ${metrics.samples}`,
        `${t('app.converter.bfcache.metric.reasons')}: ${metrics.reasons}`,
        `${t('app.converter.bfcache.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.bfcache.metric.blockers')}: ${metrics.blockers}`
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
                <History className="h-4 w-4" />
                {t('app.converter.bfcache')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.bfcache')}</CardTitle>
              <CardDescription>{t('app.converter.bfcache.description')}</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={copySummary}
                className="w-full sm:w-auto"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t('app.converter.bfcache.copy_summary')}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                {t('public.reset')}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.bfcache.metric.score')} value={metrics.score} />
            <Metric
              label={t('app.converter.bfcache.metric.restore_rate')}
              value={metrics.restoreRate}
            />
            <Metric label={t('app.converter.bfcache.metric.samples')} value={metrics.samples} />
            <Metric label={t('app.converter.bfcache.metric.reasons')} value={metrics.reasons} />
            <Metric label={t('app.converter.bfcache.metric.warnings')} value={metrics.warnings} />
            <Metric label={t('app.converter.bfcache.metric.blockers')} value={metrics.blockers} />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.bfcache.presets')}</CardTitle>
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
                {t(`app.converter.bfcache.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.bfcache.preset.${preset.key}_hint`)}
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
              <CardTitle className="text-base">{t('app.converter.bfcache.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.bfcache.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bfcache-route">{t('app.converter.bfcache.route_pattern')}</Label>
                <Input
                  id="bfcache-route"
                  value={draft.routePattern}
                  onChange={event => updateDraft('routePattern', event.target.value.slice(0, 180))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bfcache-page-type">{t('app.converter.bfcache.page_type')}</Label>
                <Select
                  id="bfcache-page-type"
                  value={draft.pageType}
                  onChange={event => updateDraft('pageType', event.target.value as PageType)}
                >
                  {PAGE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.bfcache.page_type.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bfcache-restore">{t('app.converter.bfcache.restore_rate')}</Label>
                <Input
                  id="bfcache-restore"
                  value={draft.restoreRate}
                  onChange={event => updateDraft('restoreRate', event.target.value.slice(0, 8))}
                  className="font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bfcache-samples">{t('app.converter.bfcache.sample_count')}</Label>
                <Input
                  id="bfcache-samples"
                  value={draft.sampleCount}
                  onChange={event => updateDraft('sampleCount', event.target.value.slice(0, 12))}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="bfcache-cache">{t('app.converter.bfcache.cache_control')}</Label>
                <Input
                  id="bfcache-cache"
                  value={draft.cacheControl}
                  onChange={event => updateDraft('cacheControl', event.target.value.slice(0, 220))}
                  className="font-mono"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>{t('app.converter.bfcache.flags')}</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {FLAG_KEYS.map(flag => (
                  <Checkbox
                    key={flag}
                    checked={draft[flag]}
                    onChange={event => updateFlag(flag, event.target.checked)}
                    className="glass-input min-w-0 rounded-xl px-3 py-2"
                    label={t(`app.converter.bfcache.flag.${flag}`)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.bfcache.workspace')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.bfcache.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.bfcache.workspace_placeholder')}
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
              <CardTitle className="text-base">{t('app.converter.bfcache.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={auditQuery}
                onChange={event => setAuditQuery(event.target.value)}
                placeholder={t('app.converter.bfcache.audit_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredFindings.slice(0, 48).map((finding, index) => (
                <div
                  key={`${finding.key}:${finding.subject}:${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">{finding.subject}</span>
                      <span className="mx-2">/</span>
                      {t(`app.converter.bfcache.audit.${finding.key}`)}
                    </span>
                    <span className="font-medium">
                      {t(`app.converter.bfcache.level.${finding.level}`)}
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
                <CardTitle className="text-base">{t('app.converter.bfcache.output')}</CardTitle>
                <CardDescription>{t('app.converter.bfcache.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 lg:w-56">
                <Label htmlFor="bfcache-output">{t('app.converter.bfcache.output_type')}</Label>
                <Select
                  id="bfcache-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.bfcache.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[360px] font-mono" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(output)}
                className="w-full sm:w-auto"
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.bfcache.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(output, 'bfcache-output.txt', 'text/plain;charset=utf-8')
                }
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.bfcache.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadText(csvOutput, 'bfcache.csv', 'text/csv;charset=utf-8')}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                {t('app.converter.bfcache.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.bfcache.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={reasonQuery}
                onChange={event => setReasonQuery(event.target.value)}
                placeholder={t('app.converter.bfcache.parsed_search')}
                className="pl-10"
              />
            </div>
            {filteredReasons.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredReasons.slice(0, 60).map(reason => (
                  <div key={reason.id} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {reason.reason}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${levelClass(reason.level)}`}
                      >
                        {t(`app.converter.bfcache.level.${reason.level}`)}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {reason.url || reason.frame || reason.subject}
                    </p>
                    <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {reason.source} / {reasonKey(reason.reason)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.bfcache.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">{t('app.converter.bfcache.reference')}</CardTitle>
              </div>
              <CardDescription>{t('app.converter.bfcache.reference_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REFERENCE_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.bfcache.reference.${item}`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.bfcache.reference.${item}_hint`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-panel glass-clip">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                <CardTitle className="text-base">{t('app.converter.bfcache.checklist')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} className="glass-input rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.converter.bfcache.checklist.${item}.title`)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.bfcache.checklist.${item}.body`)}
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
