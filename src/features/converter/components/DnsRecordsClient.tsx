'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Globe2,
  ListChecks,
  Plus,
  Search,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV', 'NS', 'SOA'] as const
const OUTPUT_TYPES = ['zone', 'cloudflare', 'route53', 'terraform', 'json'] as const
const WORKSPACE_LIMIT = 32000
const DNS_DOMAIN_LIMIT = 253
const DNS_TTL_LIMIT = 10
const DNS_SMALL_NUMBER_LIMIT = 5
const DRAFT_VALUE_LIMIT = 4000
const RECORD_LIMIT = 240
const OUTPUT_PREVIEW_RECORD_LIMIT = 80
const VISIBLE_AUDIT_LIMIT = 16
const VISIBLE_RECORD_LIMIT = 36
const DEFAULT_ORIGIN = 'example.com'

type RecordType = (typeof RECORD_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type AuditLevel = 'good' | 'warn' | 'danger'
type PresetKey = 'website' | 'email_auth' | 'cdn' | 'verification' | 'srv' | 'caa'

interface DraftRecord {
  name: string
  priority: string
  ttl: string
  type: RecordType
  value: string
  weight: string
  port: string
}

interface DnsPreset {
  draft: DraftRecord
  key: PresetKey
  origin: string
  workspace: string
}

interface ParsedRecord {
  fullName: string
  issueKey?: string
  line: string
  name: string
  port?: number
  priority?: number
  ttl: number
  type: string
  valid: boolean
  value: string
  weight?: number
}

interface AuditItem {
  key: string
  level: AuditLevel
  subject: string
}

interface RecordReference {
  key: Lowercase<RecordType>
  type: RecordType
}

const RECORD_REFERENCE: RecordReference[] = RECORD_TYPES.map(type => ({
  key: type.toLowerCase() as Lowercase<RecordType>,
  type
}))

const DEFAULT_DRAFT: DraftRecord = {
  name: '@',
  priority: '10',
  ttl: '300',
  type: 'A',
  value: '203.0.113.10',
  weight: '5',
  port: '443'
}

const PRESETS: DnsPreset[] = [
  {
    key: 'website',
    origin: 'example.com',
    draft: DEFAULT_DRAFT,
    workspace: `@ 300 IN A 203.0.113.10
www 300 IN CNAME example.com.
@ 3600 IN NS ns1.example-dns.com.
@ 3600 IN NS ns2.example-dns.com.
@ 3600 IN CAA 0 issue "letsencrypt.org"`
  },
  {
    key: 'email_auth',
    origin: 'example.com',
    draft: {
      name: '@',
      priority: '10',
      ttl: '300',
      type: 'MX',
      value: 'mail.example.com.',
      weight: '5',
      port: '443'
    },
    workspace: `@ 300 IN MX 10 mail.example.com.
@ 300 IN TXT "v=spf1 include:_spf.examplemail.com -all"
_dmarc 300 IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
default._domainkey 300 IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqh..."`
  },
  {
    key: 'cdn',
    origin: 'example.com',
    draft: {
      name: 'assets',
      priority: '10',
      ttl: '120',
      type: 'CNAME',
      value: 'example-cdn.global.edgekey.net.',
      weight: '5',
      port: '443'
    },
    workspace: `assets 120 IN CNAME example-cdn.global.edgekey.net.
img 120 IN CNAME example-cdn.global.edgekey.net.
downloads 300 IN CNAME dl.example-cdn.net.`
  },
  {
    key: 'verification',
    origin: 'example.com',
    draft: {
      name: '@',
      priority: '10',
      ttl: '300',
      type: 'TXT',
      value: 'google-site-verification=abc123',
      weight: '5',
      port: '443'
    },
    workspace: `@ 300 IN TXT "google-site-verification=abc123"
_github-challenge-org 300 IN TXT "0123456789abcdef"
_acme-challenge 60 IN TXT "temporary-token"`
  },
  {
    key: 'srv',
    origin: 'example.com',
    draft: {
      name: '_sip._tcp',
      priority: '10',
      ttl: '300',
      type: 'SRV',
      value: 'sipserver.example.com.',
      weight: '5',
      port: '5060'
    },
    workspace: `_sip._tcp 300 IN SRV 10 5 5060 sipserver.example.com.
_xmpp-server._tcp 300 IN SRV 5 10 5269 xmpp.example.com.`
  },
  {
    key: 'caa',
    origin: 'example.com',
    draft: {
      name: '@',
      priority: '0',
      ttl: '3600',
      type: 'CAA',
      value: 'issue "letsencrypt.org"',
      weight: '5',
      port: '443'
    },
    workspace: `@ 3600 IN CAA 0 issue "letsencrypt.org"
@ 3600 IN CAA 0 issuewild ";"
@ 3600 IN CAA 0 iodef "mailto:security@example.com"`
  }
]

const stripTrailingDot = (value: string) => value.replace(/\.$/u, '')
const isKnownType = (value: string): value is RecordType =>
  RECORD_TYPES.includes(value as RecordType)
const cleanInteger = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const stripInlineComment = (line: string) => {
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const previous = line[index - 1]

    if (char === '"' && previous !== '\\') quoted = !quoted
    if (!quoted && (char === ';' || char === '#')) return line.slice(0, index)
  }

  return line
}

const tokenize = (line: string) => stripInlineComment(line).match(/"(?:\\.|[^"])*"|\S+/gu) ?? []
const unquote = (value: string) => value.replace(/^"(.*)"$/u, '$1').replace(/\\"/gu, '"')
const quoteTxt = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return '""'
  if (/^".*"$/u.test(trimmed)) return trimmed
  if (/\s/u.test(trimmed) || trimmed.includes(';')) return `"${trimmed.replaceAll('"', '\\"')}"`
  return trimmed
}

const normalizeName = (name: string, origin: string) => {
  const cleanOrigin = stripTrailingDot(origin.trim().toLowerCase())
  const cleanName = stripTrailingDot(name.trim().toLowerCase())

  if (!cleanName || cleanName === '@') return cleanOrigin || '@'
  if (!cleanOrigin || cleanName.endsWith(cleanOrigin)) return cleanName
  return `${cleanName}.${cleanOrigin}`
}

const isApexName = (name: string, origin: string) => {
  const normalized = normalizeName(name, origin)
  const cleanOrigin = stripTrailingDot(origin.trim().toLowerCase())

  return normalized === cleanOrigin || name.trim() === '@'
}

const isIpv4 = (value: string) => {
  const parts = value.trim().split('.')

  return parts.length === 4 && parts.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
}

const isIpv6 = (value: string) => /^[0-9a-f:]+$/iu.test(value.trim()) && value.includes(':')
const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const buildRecordsCsv = (records: ParsedRecord[]) =>
  [
    ['name', 'type', 'ttl', 'value', 'priority', 'valid'],
    ...records.map(record => [
      record.fullName,
      record.type,
      String(record.ttl),
      record.value,
      String(record.priority ?? ''),
      String(record.valid)
    ])
  ]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const parseZoneRecords = (input: string, origin: string): ParsedRecord[] => {
  const rows: ParsedRecord[] = []

  for (const rawLine of input.slice(0, WORKSPACE_LIMIT).split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('$')) continue

    const tokens = tokenize(line)
    if (tokens.length < 2) continue

    const name = tokens[0] ?? ''
    if (!name) continue
    let cursor = 1
    let ttl = 300

    if (/^\d+$/u.test(tokens[cursor] ?? '')) {
      ttl = cleanInteger(tokens[cursor], 300, 0, 2147483647)
      cursor += 1
    }

    if ((tokens[cursor] ?? '').toUpperCase() === 'IN') cursor += 1

    const type = (tokens[cursor] ?? '').toUpperCase()
    cursor += 1

    let valueTokens = tokens.slice(cursor)
    let priority: number | undefined
    let weight: number | undefined
    let port: number | undefined
    let valid = isKnownType(type)
    let issueKey: string | undefined

    if (!valid) {
      issueKey = 'unknown_type'
    } else if (!valueTokens.length) {
      valid = false
      issueKey = 'missing_value'
    }

    if (type === 'MX') {
      priority = cleanInteger(valueTokens[0] ?? '', -1, -1, 65535)
      valueTokens = valueTokens.slice(1)
      if (priority < 0 || !valueTokens.length) {
        valid = false
        issueKey = 'mx_priority'
      }
    }

    if (type === 'SRV') {
      priority = cleanInteger(valueTokens[0] ?? '', -1, -1, 65535)
      weight = cleanInteger(valueTokens[1] ?? '', -1, -1, 65535)
      port = cleanInteger(valueTokens[2] ?? '', -1, -1, 65535)
      valueTokens = valueTokens.slice(3)
      if (priority < 0 || weight < 0 || port < 0 || !valueTokens.length) {
        valid = false
        issueKey = 'srv_shape'
      }
    }

    if (type === 'CAA') {
      priority = cleanInteger(valueTokens[0] ?? '', -1, -1, 255)
      valueTokens = valueTokens.slice(1)
      if (priority < 0 || valueTokens.length < 2) {
        valid = false
        issueKey = 'caa_shape'
      }
    }

    const value = valueTokens.map(unquote).join(' ').trim()

    rows.push({
      fullName: normalizeName(name, origin),
      issueKey,
      line,
      name,
      port,
      priority,
      ttl,
      type,
      valid,
      value,
      weight
    })

    if (rows.length >= RECORD_LIMIT) break
  }

  return rows
}

const toZoneLine = (record: ParsedRecord) => {
  if (record.type === 'MX') {
    return `${record.name} ${record.ttl} IN MX ${record.priority ?? 10} ${record.value}`
  }

  if (record.type === 'SRV') {
    return `${record.name} ${record.ttl} IN SRV ${record.priority ?? 10} ${record.weight ?? 5} ${record.port ?? 443} ${record.value}`
  }

  if (record.type === 'CAA') {
    return `${record.name} ${record.ttl} IN CAA ${record.priority ?? 0} ${record.value}`
  }

  if (record.type === 'TXT') {
    return `${record.name} ${record.ttl} IN TXT ${quoteTxt(record.value)}`
  }

  return `${record.name} ${record.ttl} IN ${record.type} ${record.value}`
}

const buildRecordLine = (record: DraftRecord) => {
  const ttl = cleanInteger(record.ttl, 300, 0, 2147483647)
  const name = record.name.trim() || '@'
  const value = record.value.trim()

  if (record.type === 'MX') {
    return `${name} ${ttl} IN MX ${cleanInteger(record.priority, 10, 0, 65535)} ${value}`
  }

  if (record.type === 'SRV') {
    return `${name} ${ttl} IN SRV ${cleanInteger(record.priority, 10, 0, 65535)} ${cleanInteger(
      record.weight,
      5,
      0,
      65535
    )} ${cleanInteger(record.port, 443, 0, 65535)} ${value}`
  }

  if (record.type === 'CAA') {
    return `${name} ${ttl} IN CAA ${cleanInteger(record.priority, 0, 0, 255)} ${value}`
  }

  if (record.type === 'TXT') {
    return `${name} ${ttl} IN TXT ${quoteTxt(value)}`
  }

  return `${name} ${ttl} IN ${record.type} ${value}`
}

const addAudit = (items: AuditItem[], level: AuditLevel, key: string, subject: string) => {
  items.push({ key, level, subject })
}

const auditRecords = (records: ParsedRecord[], origin: string): AuditItem[] => {
  const audits: AuditItem[] = []
  const validRecords = records.filter(record => record.valid)

  if (!records.length) return [{ key: 'empty', level: 'warn', subject: '-' }]

  records
    .filter(record => !record.valid)
    .forEach(record => addAudit(audits, 'danger', record.issueKey ?? 'invalid', record.line))

  validRecords.forEach(record => {
    if (record.type === 'A' && !isIpv4(record.value))
      addAudit(audits, 'danger', 'invalid_ipv4', record.name)
    if (record.type === 'AAAA' && !isIpv6(record.value))
      addAudit(audits, 'danger', 'invalid_ipv6', record.name)
    if (record.ttl > 0 && record.ttl < 60)
      addAudit(audits, 'warn', 'low_ttl', `${record.name} TTL ${record.ttl}`)
    if (record.ttl > 86400) addAudit(audits, 'warn', 'high_ttl', `${record.name} TTL ${record.ttl}`)
    if (record.fullName.length > 253) addAudit(audits, 'danger', 'long_name', record.fullName)
    if (record.fullName.split('.').some(label => label.length > 63))
      addAudit(audits, 'danger', 'long_label', record.fullName)
    if (record.type === 'TXT' && record.value.length > 255)
      addAudit(audits, 'warn', 'long_txt', record.name)
    if (record.type === 'CAA' && !/\b(issue|issuewild|iodef)\b/iu.test(record.value)) {
      addAudit(audits, 'warn', 'caa_tag', record.name)
    }
  })

  const byName = new Map<string, ParsedRecord[]>()
  validRecords.forEach(record =>
    byName.set(record.fullName, [...(byName.get(record.fullName) ?? []), record])
  )

  byName.forEach((group, fullName) => {
    const hasCname = group.some(record => record.type === 'CNAME')
    const otherTypes = group.filter(record => record.type !== 'CNAME')

    if (hasCname && otherTypes.length) addAudit(audits, 'danger', 'cname_conflict', fullName)
  })

  const seenLines = new Set<string>()
  validRecords.forEach(record => {
    const signature = `${record.fullName}:${record.type}:${record.value}`.toLowerCase()
    if (seenLines.has(signature)) addAudit(audits, 'warn', 'duplicate_record', record.line)
    seenLines.add(signature)
  })

  validRecords
    .filter(record => record.type === 'CNAME' && isApexName(record.name, origin))
    .forEach(record => addAudit(audits, 'danger', 'apex_cname', record.name))

  const mxRecords = validRecords.filter(record => record.type === 'MX')
  const txtRecords = validRecords.filter(record => record.type === 'TXT')
  const spfRecords = txtRecords.filter(record => /^v=spf1\b/iu.test(record.value))
  const dmarcRecords = txtRecords.filter(
    record => record.fullName.split('.')[0] === '_dmarc' && /^v=DMARC1\b/iu.test(record.value)
  )
  const dkimRecords = txtRecords.filter(
    record =>
      record.fullName.includes('._domainkey.') || record.fullName.startsWith('default._domainkey')
  )
  const addressRecords = validRecords.filter(
    record => record.type === 'A' || record.type === 'AAAA'
  )
  const caaRecords = validRecords.filter(record => record.type === 'CAA')
  const nsRecords = validRecords.filter(record => record.type === 'NS')

  if (mxRecords.length && !spfRecords.length) addAudit(audits, 'warn', 'missing_spf', 'SPF')
  if (spfRecords.length > 1) addAudit(audits, 'warn', 'multiple_spf', 'SPF')
  spfRecords.forEach(record => {
    if (/(^|\s)\+all(\s|$)/iu.test(record.value))
      addAudit(audits, 'danger', 'spf_plus_all', record.name)
    if (/(^|\s)ptr(?=[:\s]|$)/iu.test(record.value))
      addAudit(audits, 'warn', 'spf_ptr', record.name)
  })
  if (spfRecords.length === 1) addAudit(audits, 'good', 'spf_present', spfRecords[0]?.name ?? 'SPF')

  if ((mxRecords.length || spfRecords.length) && !dmarcRecords.length)
    addAudit(audits, 'warn', 'missing_dmarc', '_dmarc')
  dmarcRecords.forEach(record => {
    if (/\bp=none\b/iu.test(record.value)) addAudit(audits, 'warn', 'dmarc_none', record.name)
    else addAudit(audits, 'good', 'dmarc_enforced', record.name)
  })

  if (dkimRecords.length) addAudit(audits, 'good', 'dkim_present', dkimRecords[0].name)
  if (addressRecords.length && !caaRecords.length) addAudit(audits, 'warn', 'missing_caa', 'CAA')
  if (caaRecords.length) addAudit(audits, 'good', 'caa_present', caaRecords[0].name)
  if (!nsRecords.length) addAudit(audits, 'warn', 'missing_ns', 'NS')
  if (nsRecords.length >= 2) addAudit(audits, 'good', 'ns_redundant', 'NS')

  if (!audits.some(item => item.level !== 'good')) addAudit(audits, 'good', 'baseline_ok', origin)

  return audits
}

const getScore = (audits: AuditItem[]) => {
  const danger = audits.filter(item => item.level === 'danger').length
  const warn = audits.filter(item => item.level === 'warn').length
  const good = audits.filter(item => item.level === 'good').length

  return Math.max(0, Math.min(100, 86 + good * 3 - warn * 8 - danger * 18))
}

const levelClass = (level: AuditLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const toCloudflareRecord = (record: ParsedRecord) => ({
  type: record.type,
  name: record.fullName,
  content: record.value,
  ttl: record.ttl,
  priority: record.priority,
  proxied: false
})

const toRoute53Record = (record: ParsedRecord) => ({
  Action: 'UPSERT',
  ResourceRecordSet: {
    Name: `${record.fullName}.`,
    Type: record.type,
    TTL: record.ttl,
    ResourceRecords: [{ Value: record.type === 'TXT' ? quoteTxt(record.value) : record.value }]
  }
})

const terraformName = (record: ParsedRecord, index: number) =>
  `${record.type.toLowerCase()}_${record.fullName.replace(/[^a-z0-9]+/giu, '_')}_${index}`.replace(
    /^_+|_+$/gu,
    ''
  )

const buildOutput = (records: ParsedRecord[], outputType: OutputType) => {
  const validRecords = records.filter(record => record.valid)

  if (outputType === 'json') {
    return JSON.stringify(validRecords, null, 2)
  }

  if (outputType === 'cloudflare') {
    return JSON.stringify(validRecords.map(toCloudflareRecord), null, 2)
  }

  if (outputType === 'route53') {
    return JSON.stringify({ Changes: validRecords.map(toRoute53Record) }, null, 2)
  }

  if (outputType === 'terraform') {
    return validRecords
      .map(
        (record, index) => `resource "cloudflare_dns_record" "${terraformName(record, index)}" {
  zone_id = var.cloudflare_zone_id
  name    = "${record.fullName}"
  type    = "${record.type}"
  content = "${record.value.replaceAll('"', '\\"')}"
  ttl     = ${record.ttl}
${record.priority === undefined ? '' : `  priority = ${record.priority}\n`}  proxied = false
}`
      )
      .join('\n\n')
  }

  return validRecords.map(toZoneLine).join('\n')
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function DnsRecordsClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [draft, setDraft] = useState<DraftRecord>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('zone')
  const [referenceQuery, setReferenceQuery] = useState('')
  const deferredWorkspace = useDeferredValue(workspace)
  const deferredQuery = useDeferredValue(referenceQuery)

  const parsedRecords = useMemo(
    () => parseZoneRecords(deferredWorkspace, origin),
    [deferredWorkspace, origin]
  )
  const audits = useMemo(() => auditRecords(parsedRecords, origin), [origin, parsedRecords])
  const score = useMemo(() => getScore(audits), [audits])
  const visibleAudits = useMemo(() => audits.slice(0, VISIBLE_AUDIT_LIMIT), [audits])
  const visibleParsedRecords = useMemo(
    () => parsedRecords.slice(0, VISIBLE_RECORD_LIMIT),
    [parsedRecords]
  )
  const outputPreviewRecords = useMemo(
    () => parsedRecords.slice(0, OUTPUT_PREVIEW_RECORD_LIMIT),
    [parsedRecords]
  )
  const outputPreviewSource = useMemo(
    () => buildOutput(outputPreviewRecords, outputType),
    [outputPreviewRecords, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited = parsedRecords.length > outputPreviewRecords.length
  const buildCurrentOutput = useCallback(
    () => buildOutput(parsedRecords, outputType),
    [outputType, parsedRecords]
  )
  const metrics = useMemo(() => {
    const valid = parsedRecords.filter(record => record.valid)
    const ttlAverage = valid.length
      ? String(Math.round(valid.reduce((sum, record) => sum + record.ttl, 0) / valid.length))
      : '-'

    return {
      critical: String(audits.filter(item => item.level === 'danger').length),
      score: String(score),
      ttlAverage,
      total: String(parsedRecords.length),
      types: String(new Set(valid.map(record => record.type)).size),
      warnings: String(audits.filter(item => item.level === 'warn').length)
    }
  }, [audits, parsedRecords, score])
  const filteredReference = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase()

    if (!query) return RECORD_REFERENCE
    return RECORD_REFERENCE.filter(item => {
      const haystack =
        `${item.type} ${t(`app.converter.dns_records.reference.${item.key}`)}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [deferredQuery, t])

  const applyPreset = (preset: DnsPreset) => {
    setOrigin(preset.origin)
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
  }

  const appendDraft = () => {
    const line = buildRecordLine(draft)
    setWorkspace(current =>
      [current.trim(), line].filter(Boolean).join('\n').slice(0, WORKSPACE_LIMIT)
    )
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.dns_records.summary_title'),
        `${t('app.converter.dns_records.metric.score')}: ${metrics.score}`,
        `${t('app.converter.dns_records.metric.total')}: ${metrics.total}`,
        `${t('app.converter.dns_records.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.converter.dns_records.metric.critical')}: ${metrics.critical}`
      ].join('\n')
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card className="glass-panel glass-clip">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <Globe2 className="h-4 w-4" />
                {t('app.converter.dns-records')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.dns-records')}</CardTitle>
              <CardDescription>{t('app.converter.dns_records.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.dns_records.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.dns_records.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.dns_records.metric.total')} value={metrics.total} />
            <Metric label={t('app.converter.dns_records.metric.types')} value={metrics.types} />
            <Metric
              label={t('app.converter.dns_records.metric.avg_ttl')}
              value={metrics.ttlAverage}
            />
            <Metric
              label={t('app.converter.dns_records.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.dns_records.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.dns_records.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.dns_records.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.dns_records.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.dns_records.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.dns_records.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dns-origin">{t('app.converter.dns_records.origin')}</Label>
                <Input
                  id="dns-origin"
                  value={origin}
                  onChange={event => setOrigin(event.target.value.slice(0, DNS_DOMAIN_LIMIT))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns-type">{t('app.converter.dns_records.type')}</Label>
                <Select
                  id="dns-type"
                  value={draft.type}
                  onChange={event =>
                    setDraft(current => ({ ...current, type: event.target.value as RecordType }))
                  }
                >
                  {RECORD_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns-name">{t('app.converter.dns_records.name')}</Label>
                <Input
                  id="dns-name"
                  value={draft.name}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      name: event.target.value.slice(0, DNS_DOMAIN_LIMIT)
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns-ttl">{t('app.converter.dns_records.ttl')}</Label>
                <Input
                  id="dns-ttl"
                  inputMode="numeric"
                  value={draft.ttl}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      ttl: event.target.value.slice(0, DNS_TTL_LIMIT)
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns-priority">{t('app.converter.dns_records.priority')}</Label>
                <Input
                  id="dns-priority"
                  inputMode="numeric"
                  value={draft.priority}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      priority: event.target.value.slice(0, DNS_SMALL_NUMBER_LIMIT)
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dns-weight">{t('app.converter.dns_records.weight')}</Label>
                  <Input
                    id="dns-weight"
                    inputMode="numeric"
                    value={draft.weight}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        weight: event.target.value.slice(0, DNS_SMALL_NUMBER_LIMIT)
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dns-port">{t('app.converter.dns_records.port')}</Label>
                  <Input
                    id="dns-port"
                    inputMode="numeric"
                    value={draft.port}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        port: event.target.value.slice(0, DNS_SMALL_NUMBER_LIMIT)
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns-value">{t('app.converter.dns_records.value')}</Label>
              <Textarea
                id="dns-value"
                value={draft.value}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    value: event.target.value.slice(0, DRAFT_VALUE_LIMIT)
                  }))
                }
                className="min-h-[110px] font-mono"
              />
              <InputCapNotice
                visible={draft.value.length >= DRAFT_VALUE_LIMIT}
                limit={DRAFT_VALUE_LIMIT}
              />
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.dns_records.preview')}
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                {buildRecordLine(draft)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={appendDraft}>
                <Plus className="h-4 w-4" />
                {t('app.converter.dns_records.add_record')}
              </Button>
              <Button type="button" variant="outline" onClick={() => copy(buildRecordLine(draft))}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.dns_records.workspace')}</CardTitle>
            <CardDescription>{t('app.converter.dns_records.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value.slice(0, WORKSPACE_LIMIT))}
              placeholder={t('app.converter.dns_records.workspace_placeholder')}
              className="min-h-[360px] font-mono"
            />
            <InputCapNotice visible={workspace.length >= WORKSPACE_LIMIT} limit={WORKSPACE_LIMIT} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(buildCurrentOutput())}>
                <Copy className="h-4 w-4" />
                {t('app.converter.dns_records.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentOutput(), 'dns-records.txt', 'text/plain;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.dns_records.download_output')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(380px,1.18fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.dns_records.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleAudits.map((item, index) => (
              <div
                key={`${item.key}:${item.subject}:${index}`}
                className={`rounded-xl border px-3 py-2 text-xs ${levelClass(item.level)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-all leading-5">
                    <span className="font-semibold">{item.subject}</span>
                    <span className="mx-2 inline-block">/</span>
                    {t(`app.converter.dns_records.audit.${item.key}`)}
                  </span>
                  <span className="shrink-0 font-medium">
                    {t(`app.converter.dns_records.level.${item.level}`)}
                  </span>
                </div>
              </div>
            ))}
            {audits.length > visibleAudits.length && (
              <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.rows_render_limited', {
                  total: audits.length.toLocaleString(),
                  visible: visibleAudits.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">{t('app.converter.dns_records.output')}</CardTitle>
                <CardDescription>{t('app.converter.dns_records.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 md:w-56">
                <Label htmlFor="dns-output-type">
                  {t('app.converter.dns_records.output_type')}
                </Label>
                <Select
                  id="dns-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.dns_records.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={outputPreview} className="min-h-[260px] font-mono" />
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
                  total: parsedRecords.length.toLocaleString(),
                  visible: outputPreviewRecords.length.toLocaleString()
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(JSON.stringify(parsedRecords, null, 2))}
              >
                <Copy className="h-4 w-4" />
                {t('app.converter.dns_records.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildRecordsCsv(parsedRecords),
                    'dns-records.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.dns_records.download_csv')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.dns_records.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {parsedRecords.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleParsedRecords.map((record, index) => (
                  <div key={`${record.line}:${index}`} className="glass-input rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {record.name}
                      </p>
                      <span className="rounded-full bg-[var(--primary)]/10 px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        {record.type}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-xs leading-5 text-[var(--text-secondary)]">
                      {record.value || record.issueKey}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      TTL {record.ttl} /{' '}
                      {record.valid
                        ? t('app.converter.dns_records.valid')
                        : t('app.converter.dns_records.invalid')}
                    </p>
                  </div>
                ))}
                {parsedRecords.length > visibleParsedRecords.length && (
                  <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)] md:col-span-2 xl:col-span-3">
                    {t('public.rows_render_limited', {
                      total: parsedRecords.length.toLocaleString(),
                      visible: visibleParsedRecords.length.toLocaleString()
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.dns_records.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.converter.dns_records.reference')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.dns_records.reference_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredReference.map(item => (
                <div key={item.type} className="glass-input rounded-xl p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {item.type}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(`app.converter.dns_records.reference.${item.key}`)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
