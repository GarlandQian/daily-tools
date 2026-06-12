'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  LockKeyhole,
  Search,
  ServerCog,
  ShieldAlert,
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

const TLS_VERSIONS = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'] as const
const OUTPUT_TYPES = ['nginx', 'apache', 'caddy', 'node', 'json'] as const
const CIPHER_INPUT_LIMIT = 24000
const CIPHER_LIMIT = 140
const OUTPUT_PREVIEW_CIPHER_LIMIT = 80
const OUTPUT_PREVIEW_FINDING_LIMIT = 40
const VISIBLE_CIPHER_LIMIT = 42

type TlsVersion = (typeof TLS_VERSIONS)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type CipherStatus = 'modern' | 'acceptable' | 'legacy' | 'danger'
type FindingLevel = 'good' | 'warn' | 'danger'
type PresetKey = 'modern' | 'balanced' | 'api' | 'cdn' | 'iot' | 'legacy'

interface TlsDraft {
  alpn: string
  ciphers: string
  compression: boolean
  curves: string
  domain: string
  earlyData: boolean
  hsts: boolean
  maxVersion: TlsVersion
  minVersion: TlsVersion
  ocsp: boolean
  preferServerOrder: boolean
  sessionTickets: boolean
}

interface CipherInfo {
  name: string
  noteKey: string
  protocol: TlsVersion
  status: CipherStatus
  tags: string[]
}

interface ParsedCipher {
  known: boolean
  name: string
  noteKey?: string
  protocol?: TlsVersion
  status: CipherStatus
  tags: string[]
}

interface TlsPreset {
  draft: TlsDraft
  key: PresetKey
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const TLS13_CIPHERS = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256'
].join('\n')

const BALANCED_TLS12_CIPHERS = [
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305'
].join('\n')

const DEFAULT_DRAFT: TlsDraft = {
  alpn: 'h2,http/1.1',
  ciphers: `${TLS13_CIPHERS}\n${BALANCED_TLS12_CIPHERS}`,
  compression: false,
  curves: 'X25519:P-256:P-384',
  domain: 'example.com',
  earlyData: false,
  hsts: true,
  maxVersion: 'TLSv1.3',
  minVersion: 'TLSv1.2',
  ocsp: true,
  preferServerOrder: true,
  sessionTickets: false
}

const CIPHER_CATALOG: CipherInfo[] = [
  {
    name: 'TLS_AES_128_GCM_SHA256',
    protocol: 'TLSv1.3',
    status: 'modern',
    tags: ['tls13', 'aead', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.tls_aes_128'
  },
  {
    name: 'TLS_AES_256_GCM_SHA384',
    protocol: 'TLSv1.3',
    status: 'modern',
    tags: ['tls13', 'aead', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.tls_aes_256'
  },
  {
    name: 'TLS_CHACHA20_POLY1305_SHA256',
    protocol: 'TLSv1.3',
    status: 'modern',
    tags: ['tls13', 'aead', 'mobile', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.tls_chacha'
  },
  {
    name: 'ECDHE-ECDSA-AES128-GCM-SHA256',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'ecdsa', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_ecdsa_128'
  },
  {
    name: 'ECDHE-RSA-AES128-GCM-SHA256',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'pfs', 'rsa-cert'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_rsa_128'
  },
  {
    name: 'ECDHE-ECDSA-AES256-GCM-SHA384',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'ecdsa', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_ecdsa_256'
  },
  {
    name: 'ECDHE-RSA-AES256-GCM-SHA384',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'pfs', 'rsa-cert'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_rsa_256'
  },
  {
    name: 'ECDHE-ECDSA-CHACHA20-POLY1305',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'ecdsa', 'mobile', 'pfs'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_ecdsa_chacha'
  },
  {
    name: 'ECDHE-RSA-CHACHA20-POLY1305',
    protocol: 'TLSv1.2',
    status: 'modern',
    tags: ['aead', 'mobile', 'pfs', 'rsa-cert'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_rsa_chacha'
  },
  {
    name: 'ECDHE-RSA-AES128-SHA',
    protocol: 'TLSv1.2',
    status: 'legacy',
    tags: ['cbc', 'pfs', 'sha1'],
    noteKey: 'app.converter.tls_config.cipher.ecdhe_rsa_aes128_sha'
  },
  {
    name: 'AES128-GCM-SHA256',
    protocol: 'TLSv1.2',
    status: 'acceptable',
    tags: ['aead', 'rsa-kx'],
    noteKey: 'app.converter.tls_config.cipher.aes128_gcm'
  },
  {
    name: 'AES256-SHA',
    protocol: 'TLSv1.2',
    status: 'legacy',
    tags: ['cbc', 'rsa-kx', 'sha1'],
    noteKey: 'app.converter.tls_config.cipher.aes256_sha'
  },
  {
    name: 'DES-CBC3-SHA',
    protocol: 'TLSv1.2',
    status: 'danger',
    tags: ['3des', 'cbc', 'rsa-kx'],
    noteKey: 'app.converter.tls_config.cipher.des3'
  },
  {
    name: 'RC4-SHA',
    protocol: 'TLSv1.2',
    status: 'danger',
    tags: ['rc4', 'rsa-kx'],
    noteKey: 'app.converter.tls_config.cipher.rc4'
  },
  {
    name: 'NULL-SHA',
    protocol: 'TLSv1.2',
    status: 'danger',
    tags: ['null', 'rsa-kx'],
    noteKey: 'app.converter.tls_config.cipher.null'
  },
  {
    name: 'EXP-RC4-MD5',
    protocol: 'TLSv1.2',
    status: 'danger',
    tags: ['export', 'md5', 'rc4'],
    noteKey: 'app.converter.tls_config.cipher.export'
  }
]

const CIPHER_MAP = new Map(CIPHER_CATALOG.map(cipher => [cipher.name, cipher]))

const PRESETS: TlsPreset[] = [
  {
    key: 'modern',
    draft: {
      ...DEFAULT_DRAFT,
      ciphers: TLS13_CIPHERS,
      minVersion: 'TLSv1.3'
    }
  },
  {
    key: 'balanced',
    draft: DEFAULT_DRAFT
  },
  {
    key: 'api',
    draft: {
      ...DEFAULT_DRAFT,
      domain: 'api.example.com',
      hsts: true,
      sessionTickets: false
    }
  },
  {
    key: 'cdn',
    draft: {
      ...DEFAULT_DRAFT,
      domain: 'assets.example.com',
      ciphers: `${TLS13_CIPHERS}\nECDHE-ECDSA-CHACHA20-POLY1305\nECDHE-RSA-CHACHA20-POLY1305\nECDHE-ECDSA-AES128-GCM-SHA256\nECDHE-RSA-AES128-GCM-SHA256`,
      sessionTickets: true
    }
  },
  {
    key: 'iot',
    draft: {
      ...DEFAULT_DRAFT,
      alpn: 'http/1.1',
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256\nECDHE-RSA-AES256-GCM-SHA384',
      curves: 'P-256:P-384',
      maxVersion: 'TLSv1.2',
      minVersion: 'TLSv1.2'
    }
  },
  {
    key: 'legacy',
    draft: {
      ...DEFAULT_DRAFT,
      ciphers: 'ECDHE-RSA-AES128-SHA\nAES256-SHA\nDES-CBC3-SHA\nRC4-SHA',
      compression: true,
      hsts: false,
      maxVersion: 'TLSv1.2',
      minVersion: 'TLSv1',
      ocsp: false,
      preferServerOrder: false,
      sessionTickets: true
    }
  }
]

const versionRank = (version: TlsVersion) => TLS_VERSIONS.indexOf(version)
const normalizeCipher = (value: string) => value.trim().replace(/^!+/u, '').toUpperCase()
const splitList = (value: string) =>
  value
    .split(/[\s,:;'"|]+/u)
    .map(item => item.trim())
    .filter(Boolean)

const parseCiphers = (input: string): ParsedCipher[] => {
  const seen = new Set<string>()
  const rows: ParsedCipher[] = []

  for (const token of splitList(input.slice(0, CIPHER_INPUT_LIMIT))) {
    const name = normalizeCipher(token)
    if (!/[A-Z0-9]/u.test(name) || seen.has(name)) continue
    seen.add(name)

    const known = CIPHER_MAP.get(name)
    if (known) {
      rows.push({
        known: true,
        name,
        noteKey: known.noteKey,
        protocol: known.protocol,
        status: known.status,
        tags: known.tags
      })
    } else if (/^(TLS_|ECDHE|DHE|AES|DES|RC4|NULL|EXP)/u.test(name)) {
      rows.push({
        known: false,
        name,
        status: /RC4|DES|NULL|EXP|MD5/u.test(name) ? 'danger' : 'acceptable',
        tags: ['unknown']
      })
    }

    if (rows.length >= CIPHER_LIMIT) break
  }

  return rows
}

const hasAnyTag = (cipher: ParsedCipher, tags: string[]) =>
  tags.some(tag => cipher.tags.includes(tag))
const addFinding = (items: Finding[], level: FindingLevel, key: string, subject: string) => {
  items.push({ key, level, subject })
}

const auditTls = (draft: TlsDraft, ciphers: ParsedCipher[]): Finding[] => {
  const findings: Finding[] = []
  const hasTls13 = versionRank(draft.maxVersion) >= versionRank('TLSv1.3')
  const tls12Allowed =
    versionRank(draft.minVersion) <= versionRank('TLSv1.2') &&
    versionRank(draft.maxVersion) >= versionRank('TLSv1.2')
  const weakCiphers = ciphers.filter(cipher => cipher.status === 'danger')
  const legacyCiphers = ciphers.filter(cipher => cipher.status === 'legacy')
  const unknownCiphers = ciphers.filter(cipher => !cipher.known)
  const tls13Ciphers = ciphers.filter(cipher => cipher.protocol === 'TLSv1.3')
  const hasAead = ciphers.some(cipher => hasAnyTag(cipher, ['aead']))
  const hasPfs = ciphers.some(cipher => hasAnyTag(cipher, ['pfs', 'tls13']))
  const hasRsaKx = ciphers.some(cipher => hasAnyTag(cipher, ['rsa-kx']))
  const hasH2 = splitList(draft.alpn.toLowerCase()).includes('h2')
  const hasX25519OrP256 = /(^|[:\s,])(X25519|P-256)(?=[:\s,]|$)/iu.test(draft.curves)
  const invalidVersionOrder = versionRank(draft.minVersion) > versionRank(draft.maxVersion)

  if (!ciphers.length) return [{ key: 'empty', level: 'warn', subject: '-' }]

  if (invalidVersionOrder)
    addFinding(
      findings,
      'danger',
      'invalid_version_order',
      `${draft.minVersion} > ${draft.maxVersion}`
    )

  if (versionRank(draft.minVersion) < versionRank('TLSv1.2')) {
    addFinding(findings, 'danger', 'old_protocol', draft.minVersion)
  } else {
    addFinding(findings, 'good', 'protocol_floor', draft.minVersion)
  }

  if (!hasTls13) addFinding(findings, 'warn', 'missing_tls13', draft.maxVersion)
  else if (tls13Ciphers.length)
    addFinding(findings, 'good', 'tls13_ready', `${tls13Ciphers.length}`)
  else addFinding(findings, 'warn', 'missing_tls13_ciphers', 'TLS 1.3')

  weakCiphers.forEach(cipher => addFinding(findings, 'danger', 'weak_cipher', cipher.name))
  legacyCiphers.forEach(cipher => addFinding(findings, 'warn', 'legacy_cipher', cipher.name))
  unknownCiphers.forEach(cipher => addFinding(findings, 'warn', 'unknown_cipher', cipher.name))

  if (hasAead) addFinding(findings, 'good', 'aead_ready', 'AEAD')
  else addFinding(findings, 'warn', 'missing_aead', 'AEAD')

  if (hasPfs) addFinding(findings, 'good', 'pfs_ready', 'PFS')
  else addFinding(findings, 'danger', 'missing_pfs', 'PFS')

  if (hasRsaKx) addFinding(findings, 'warn', 'rsa_key_exchange', 'RSA')
  if (draft.compression) addFinding(findings, 'danger', 'compression_on', 'TLS compression')
  else addFinding(findings, 'good', 'compression_off', 'TLS compression')

  if (draft.earlyData) addFinding(findings, 'warn', 'early_data', '0-RTT')
  if (draft.sessionTickets) addFinding(findings, 'warn', 'session_tickets', 'Session tickets')
  if (draft.ocsp) addFinding(findings, 'good', 'ocsp_on', 'OCSP')
  else addFinding(findings, 'warn', 'ocsp_missing', 'OCSP')

  if (draft.hsts) addFinding(findings, 'good', 'hsts_on', 'HSTS')
  else addFinding(findings, 'warn', 'hsts_missing', 'HSTS')

  if (tls12Allowed && !draft.preferServerOrder)
    addFinding(findings, 'warn', 'server_order_missing', 'TLS 1.2')
  if (hasH2) addFinding(findings, 'good', 'alpn_h2', 'ALPN')
  else addFinding(findings, 'warn', 'alpn_h2_missing', 'ALPN')

  if (
    hasH2 &&
    (versionRank(draft.minVersion) < versionRank('TLSv1.2') ||
      weakCiphers.length ||
      legacyCiphers.length)
  ) {
    addFinding(findings, 'warn', 'h2_legacy_mix', 'HTTP/2')
  }

  if (hasX25519OrP256) addFinding(findings, 'good', 'curves_ok', draft.curves)
  else addFinding(findings, 'warn', 'curves_missing', draft.curves || '-')

  if (!findings.some(item => item.level !== 'good'))
    addFinding(findings, 'good', 'baseline_ok', draft.domain)

  return findings
}

const getScore = (findings: Finding[]) => {
  const good = findings.filter(item => item.level === 'good').length
  const warn = findings.filter(item => item.level === 'warn').length
  const danger = findings.filter(item => item.level === 'danger').length

  return Math.max(0, Math.min(100, 88 + good * 2 - warn * 7 - danger * 18))
}

const levelClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'
  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

const statusClass = (status: CipherStatus) => {
  if (status === 'danger') return 'bg-red-500/10 text-red-600'
  if (status === 'legacy') return 'bg-amber-500/10 text-amber-700'
  if (status === 'acceptable') return 'bg-sky-500/10 text-sky-700'
  return 'bg-emerald-500/10 text-emerald-700'
}

const versionsFor = (draft: TlsDraft) =>
  TLS_VERSIONS.filter(
    version =>
      versionRank(version) >= versionRank(draft.minVersion) &&
      versionRank(version) <= versionRank(draft.maxVersion)
  )

const buildNginx = (draft: TlsDraft, ciphers: ParsedCipher[]) => {
  const tls13 = ciphers.filter(cipher => cipher.protocol === 'TLSv1.3').map(cipher => cipher.name)
  const tls12 = ciphers.filter(cipher => cipher.protocol !== 'TLSv1.3').map(cipher => cipher.name)

  return [
    `ssl_protocols ${versionsFor(draft).join(' ')};`,
    tls12.length ? `ssl_ciphers '${tls12.join(':')}';` : '',
    tls13.length ? `ssl_conf_command Ciphersuites ${tls13.join(':')};` : '',
    `ssl_prefer_server_ciphers ${draft.preferServerOrder ? 'on' : 'off'};`,
    `ssl_ecdh_curve ${draft.curves};`,
    `ssl_session_tickets ${draft.sessionTickets ? 'on' : 'off'};`,
    `ssl_stapling ${draft.ocsp ? 'on' : 'off'};`,
    `ssl_stapling_verify ${draft.ocsp ? 'on' : 'off'};`,
    draft.hsts
      ? 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
      : ''
  ]
    .filter(Boolean)
    .join('\n')
}

const buildApache = (draft: TlsDraft, ciphers: ParsedCipher[]) => {
  const tls12 = ciphers.filter(cipher => cipher.protocol !== 'TLSv1.3').map(cipher => cipher.name)
  const tls13 = ciphers.filter(cipher => cipher.protocol === 'TLSv1.3').map(cipher => cipher.name)

  return [
    `SSLProtocol -all ${versionsFor(draft)
      .map(version => `+${version.replace('v', 'v')}`)
      .join(' ')}`,
    tls12.length ? `SSLCipherSuite ${tls12.join(':')}` : '',
    tls13.length ? `SSLOpenSSLConfCmd Ciphersuites ${tls13.join(':')}` : '',
    `SSLHonorCipherOrder ${draft.preferServerOrder ? 'on' : 'off'}`,
    `SSLOpenSSLConfCmd Curves ${draft.curves.replaceAll(':', ':')}`,
    `SSLCompression ${draft.compression ? 'on' : 'off'}`,
    `SSLUseStapling ${draft.ocsp ? 'on' : 'off'}`,
    draft.hsts
      ? 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"'
      : ''
  ]
    .filter(Boolean)
    .join('\n')
}

const buildCaddy = (draft: TlsDraft, ciphers: ParsedCipher[]) =>
  `${draft.domain} {
  tls {
    protocols ${draft.minVersion.toLowerCase().replace('v', '')} ${draft.maxVersion.toLowerCase().replace('v', '')}
    ciphers ${ciphers.map(cipher => cipher.name).join(' ')}
    curves ${draft.curves.replaceAll(':', ' ')}
  }
${draft.hsts ? '  header Strict-Transport-Security "max-age=31536000; includeSubDomains"\n' : ''}}`

const buildNode = (draft: TlsDraft, ciphers: ParsedCipher[]) =>
  `const tlsOptions = {
  minVersion: '${draft.minVersion}',
  maxVersion: '${draft.maxVersion}',
  ciphers: '${ciphers
    .filter(cipher => cipher.protocol !== 'TLSv1.3')
    .map(cipher => cipher.name)
    .join(':')}',
  ecdhCurve: '${draft.curves}',
  honorCipherOrder: ${draft.preferServerOrder},
  ALPNProtocols: ${JSON.stringify(splitList(draft.alpn))}
}`

const buildOutput = (
  draft: TlsDraft,
  ciphers: ParsedCipher[],
  findings: Finding[],
  outputType: OutputType
) => {
  if (outputType === 'json') {
    return JSON.stringify({ draft, ciphers, findings, score: getScore(findings) }, null, 2)
  }

  if (outputType === 'apache') return buildApache(draft, ciphers)
  if (outputType === 'caddy') return buildCaddy(draft, ciphers)
  if (outputType === 'node') return buildNode(draft, ciphers)
  return buildNginx(draft, ciphers)
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`
const buildCiphersCsv = (ciphers: ParsedCipher[]) =>
  [
    ['name', 'protocol', 'status', 'known', 'tags'],
    ...ciphers.map(cipher => [
      cipher.name,
      cipher.protocol ?? '',
      cipher.status,
      String(cipher.known),
      cipher.tags.join('|')
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

export default function TlsConfigClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<TlsDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('nginx')
  const [referenceQuery, setReferenceQuery] = useState('')
  const deferredCiphers = useDeferredValue(draft.ciphers)
  const deferredReferenceQuery = useDeferredValue(referenceQuery)

  const parsedCiphers = useMemo(() => parseCiphers(deferredCiphers), [deferredCiphers])
  const findings = useMemo(() => auditTls(draft, parsedCiphers), [draft, parsedCiphers])
  const score = useMemo(() => getScore(findings), [findings])
  const outputPreviewCiphers = useMemo(
    () => parsedCiphers.slice(0, OUTPUT_PREVIEW_CIPHER_LIMIT),
    [parsedCiphers]
  )
  const outputPreviewFindings = useMemo(
    () => findings.slice(0, OUTPUT_PREVIEW_FINDING_LIMIT),
    [findings]
  )
  const outputPreviewSource = useMemo(
    () => buildOutput(draft, outputPreviewCiphers, outputPreviewFindings, outputType),
    [draft, outputPreviewCiphers, outputPreviewFindings, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited =
    parsedCiphers.length > outputPreviewCiphers.length ||
    findings.length > outputPreviewFindings.length
  const buildCurrentOutput = useCallback(
    () => buildOutput(draft, parsedCiphers, findings, outputType),
    [draft, findings, outputType, parsedCiphers]
  )
  const visibleCiphers = useMemo(
    () => parsedCiphers.slice(0, VISIBLE_CIPHER_LIMIT),
    [parsedCiphers]
  )
  const parsedCiphersLimited = parsedCiphers.length > visibleCiphers.length
  const metrics = useMemo(() => {
    const weak = parsedCiphers.filter(
      cipher => cipher.status === 'danger' || cipher.status === 'legacy'
    ).length
    const tls13 = parsedCiphers.filter(cipher => cipher.protocol === 'TLSv1.3').length

    return {
      critical: String(findings.filter(item => item.level === 'danger').length),
      score: String(score),
      total: String(parsedCiphers.length),
      tls13: String(tls13),
      warnings: String(findings.filter(item => item.level === 'warn').length),
      weak: String(weak)
    }
  }, [findings, parsedCiphers, score])
  const filteredReference = useMemo(() => {
    const query = deferredReferenceQuery.trim().toLowerCase()

    if (!query) return CIPHER_CATALOG
    return CIPHER_CATALOG.filter(cipher => {
      const haystack = `${cipher.name} ${cipher.tags.join(' ')} ${t(cipher.noteKey)}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [deferredReferenceQuery, t])
  const updateDraft = <Key extends keyof TlsDraft>(key: Key, value: TlsDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const copySummary = () => {
    copy(
      [
        t('app.converter.tls_config.summary_title'),
        `${t('app.converter.tls_config.metric.score')}: ${metrics.score}`,
        `${t('app.converter.tls_config.metric.total')}: ${metrics.total}`,
        `${t('app.converter.tls_config.metric.weak')}: ${metrics.weak}`,
        `${t('app.converter.tls_config.metric.critical')}: ${metrics.critical}`
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
                <LockKeyhole className="h-4 w-4" />
                {t('app.converter.tls-config')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.converter.tls-config')}</CardTitle>
              <CardDescription>{t('app.converter.tls_config.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.converter.tls_config.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label={t('app.converter.tls_config.metric.score')} value={metrics.score} />
            <Metric label={t('app.converter.tls_config.metric.total')} value={metrics.total} />
            <Metric label={t('app.converter.tls_config.metric.tls13')} value={metrics.tls13} />
            <Metric label={t('app.converter.tls_config.metric.weak')} value={metrics.weak} />
            <Metric
              label={t('app.converter.tls_config.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.converter.tls_config.metric.critical')}
              value={metrics.critical}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.tls_config.presets')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setDraft(preset.draft)}
              className="glass-input rounded-xl p-3 text-left transition hover:scale-[1.01]"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {t(`app.converter.tls_config.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.converter.tls_config.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.tls_config.builder')}</CardTitle>
            </div>
            <CardDescription>{t('app.converter.tls_config.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tls-domain">{t('app.converter.tls_config.domain')}</Label>
                <Input
                  id="tls-domain"
                  value={draft.domain}
                  onChange={event => updateDraft('domain', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tls-min">{t('app.converter.tls_config.min_version')}</Label>
                <Select
                  id="tls-min"
                  value={draft.minVersion}
                  onChange={event => updateDraft('minVersion', event.target.value as TlsVersion)}
                >
                  {TLS_VERSIONS.map(version => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tls-max">{t('app.converter.tls_config.max_version')}</Label>
                <Select
                  id="tls-max"
                  value={draft.maxVersion}
                  onChange={event => updateDraft('maxVersion', event.target.value as TlsVersion)}
                >
                  {TLS_VERSIONS.map(version => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tls-alpn">{t('app.converter.tls_config.alpn')}</Label>
                <Input
                  id="tls-alpn"
                  value={draft.alpn}
                  onChange={event => updateDraft('alpn', event.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tls-curves">{t('app.converter.tls_config.curves')}</Label>
                <Input
                  id="tls-curves"
                  value={draft.curves}
                  onChange={event => updateDraft('curves', event.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="glass-input grid grid-cols-1 gap-1 rounded-xl p-3 md:grid-cols-2">
              <Checkbox
                checked={draft.preferServerOrder}
                onChange={event => updateDraft('preferServerOrder', event.target.checked)}
                label={t('app.converter.tls_config.prefer_server_order')}
              />
              <Checkbox
                checked={draft.ocsp}
                onChange={event => updateDraft('ocsp', event.target.checked)}
                label={t('app.converter.tls_config.ocsp')}
              />
              <Checkbox
                checked={draft.hsts}
                onChange={event => updateDraft('hsts', event.target.checked)}
                label={t('app.converter.tls_config.hsts')}
              />
              <Checkbox
                checked={draft.sessionTickets}
                onChange={event => updateDraft('sessionTickets', event.target.checked)}
                label={t('app.converter.tls_config.session_tickets')}
              />
              <Checkbox
                checked={draft.compression}
                onChange={event => updateDraft('compression', event.target.checked)}
                label={t('app.converter.tls_config.compression')}
              />
              <Checkbox
                checked={draft.earlyData}
                onChange={event => updateDraft('earlyData', event.target.checked)}
                label={t('app.converter.tls_config.early_data')}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.tls_config.workspace')}</CardTitle>
            <CardDescription>{t('app.converter.tls_config.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={draft.ciphers}
              onChange={event =>
                updateDraft('ciphers', event.target.value.slice(0, CIPHER_INPUT_LIMIT))
              }
              placeholder={t('app.converter.tls_config.workspace_placeholder')}
              className="min-h-[360px] font-mono"
            />
            <InputCapNotice
              visible={draft.ciphers.length >= CIPHER_INPUT_LIMIT}
              limit={CIPHER_INPUT_LIMIT}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(draft.ciphers)}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button type="button" variant="outline" onClick={() => updateDraft('ciphers', '')}>
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
              <CardTitle className="text-base">{t('app.converter.tls_config.audit')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {findings.slice(0, 18).map((finding, index) => (
              <div
                key={`${finding.key}:${finding.subject}:${index}`}
                className={`rounded-xl border px-3 py-2 text-xs ${levelClass(finding.level)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-all leading-5">
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2 inline-block">/</span>
                    {t(`app.converter.tls_config.audit.${finding.key}`)}
                  </span>
                  <span className="shrink-0 font-medium">
                    {t(`app.converter.tls_config.level.${finding.level}`)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-base">{t('app.converter.tls_config.output')}</CardTitle>
                <CardDescription>{t('app.converter.tls_config.output_hint')}</CardDescription>
              </div>
              <div className="w-full space-y-2 md:w-56">
                <Label htmlFor="tls-output-type">{t('app.converter.tls_config.output_type')}</Label>
                <Select
                  id="tls-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.converter.tls_config.output.${type}`)}
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
                  total: (parsedCiphers.length + findings.length).toLocaleString(),
                  visible: (
                    outputPreviewCiphers.length + outputPreviewFindings.length
                  ).toLocaleString()
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(buildCurrentOutput())}>
                <Copy className="h-4 w-4" />
                {t('app.converter.tls_config.copy_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(buildCurrentOutput(), 'tls-config.txt', 'text/plain;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.tls_config.download_output')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(
                    buildCiphersCsv(parsedCiphers),
                    'tls-ciphers.csv',
                    'text/csv;charset=utf-8'
                  )
                }
              >
                <Download className="h-4 w-4" />
                {t('app.converter.tls_config.download_csv')}
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
              <CardTitle className="text-base">{t('app.converter.tls_config.parsed')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {parsedCiphers.length ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleCiphers.map(cipher => (
                    <div key={cipher.name} className="glass-input min-w-0 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {cipher.name}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusClass(cipher.status)}`}
                        >
                          {t(`app.converter.tls_config.status.${cipher.status}`)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                        {cipher.protocol ?? t('app.converter.tls_config.unknown')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cipher.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--bg-hover)] px-2 py-1 text-[10px] text-[var(--text-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {parsedCiphersLimited && (
                  <p className="mt-3 text-xs leading-5 text-amber-600 dark:text-amber-300">
                    {t('public.rows_render_limited', {
                      total: parsedCiphers.length,
                      visible: visibleCiphers.length
                    })}
                  </p>
                )}
              </>
            ) : (
              <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
                {t('app.converter.tls_config.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">{t('app.converter.tls_config.reference')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value.slice(0, 160))}
                placeholder={t('app.converter.tls_config.reference_search')}
                className="pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredReference.slice(0, 16).map(cipher => (
                <div key={cipher.name} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {cipher.name}
                    </p>
                    <Gauge className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {t(cipher.noteKey)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.converter.tls_config.checklist')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {['protocols', 'ciphers', 'deployment'].map(item => (
            <div
              key={item}
              className="glass-input rounded-xl p-3 text-sm leading-6 text-[var(--text-secondary)]"
            >
              {t(`app.converter.tls_config.checklist.${item}`)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
