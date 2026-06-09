'use client'

import {
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Languages,
  ListChecks,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const OUTPUT_TYPES = ['txt', 'next', 'nginx', 'apache', 'json'] as const
const SECURITY_INPUT_LIMIT = 28000
const SECURITY_ROW_LIMIT = 160
const FIELD_NAMES = [
  'Contact',
  'Expires',
  'Encryption',
  'Acknowledgments',
  'Preferred-Languages',
  'Canonical',
  'Policy',
  'Hiring'
] as const

type OutputType = (typeof OUTPUT_TYPES)[number]
type SecurityField = (typeof FIELD_NAMES)[number]
type PresetKey = 'saas' | 'open_source' | 'bug_bounty' | 'agency' | 'minimal' | 'hiring'
type FindingLevel = 'good' | 'warn' | 'danger'

interface SecurityTxtDraft {
  acknowledgmentsUrl: string
  contactLines: string
  encryptionUrl: string
  expiresDate: string
  hiringUrl: string
  includeCanonical: boolean
  policyUrl: string
  preferredLanguages: string
  siteUrl: string
}

interface Preset {
  draft: SecurityTxtDraft
  key: PresetKey
  workspace: string
}

interface ParsedLine {
  field: string
  known: boolean
  raw: string
  valid: boolean
  value: string
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: SecurityTxtDraft = {
  siteUrl: 'https://example.com',
  contactLines: 'mailto:security@example.com\nhttps://example.com/security',
  expiresDate: '2026-12-31',
  encryptionUrl: 'https://example.com/.well-known/pgp-key.txt',
  acknowledgmentsUrl: 'https://example.com/security/thanks',
  preferredLanguages: 'en, zh',
  policyUrl: 'https://example.com/security-policy',
  hiringUrl: '',
  includeCanonical: true
}

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/u, '')
  if (!trimmed) return ''
  if (/^https?:\/\//iu.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

const securityPath = (siteUrl: string) => {
  const origin = normalizeSiteUrl(siteUrl) || 'https://example.com'

  return `${origin}/.well-known/security.txt`
}

const makeDraft = (draft: SecurityTxtDraft) => draft

const PRESETS: Preset[] = [
  {
    key: 'saas',
    draft: DEFAULT_DRAFT,
    workspace: `Contact: mailto:security@example.com
Contact: https://example.com/security
Expires: 2026-12-31T23:59:59Z
Encryption: https://example.com/.well-known/pgp-key.txt
Acknowledgments: https://example.com/security/thanks
Preferred-Languages: en, zh
Canonical: https://example.com/.well-known/security.txt
Policy: https://example.com/security-policy`
  },
  {
    key: 'open_source',
    draft: makeDraft({
      siteUrl: 'https://project.example.org',
      contactLines:
        'mailto:security@project.example.org\nhttps://github.com/example/project/security/advisories/new',
      expiresDate: '2026-10-01',
      encryptionUrl: 'https://project.example.org/pgp.txt',
      acknowledgmentsUrl: 'https://project.example.org/security/thanks',
      preferredLanguages: 'en',
      policyUrl: 'https://project.example.org/security',
      hiringUrl: '',
      includeCanonical: true
    }),
    workspace: `Contact: mailto:security@project.example.org
Contact: https://github.com/example/project/security/advisories/new
Expires: 2026-10-01T23:59:59Z
Encryption: https://project.example.org/pgp.txt
Acknowledgments: https://project.example.org/security/thanks
Preferred-Languages: en
Canonical: https://project.example.org/.well-known/security.txt
Policy: https://project.example.org/security`
  },
  {
    key: 'bug_bounty',
    draft: makeDraft({
      siteUrl: 'https://app.example.com',
      contactLines: 'https://hackerone.com/example\nmailto:bounty@example.com',
      expiresDate: '2026-09-30',
      encryptionUrl: 'https://app.example.com/security/pgp',
      acknowledgmentsUrl: 'https://app.example.com/security/hall-of-fame',
      preferredLanguages: 'en, es',
      policyUrl: 'https://app.example.com/security/bug-bounty',
      hiringUrl: '',
      includeCanonical: true
    }),
    workspace: `Contact: https://hackerone.com/example
Contact: mailto:bounty@example.com
Expires: 2026-09-30T23:59:59Z
Encryption: https://app.example.com/security/pgp
Acknowledgments: https://app.example.com/security/hall-of-fame
Preferred-Languages: en, es
Canonical: https://app.example.com/.well-known/security.txt
Policy: https://app.example.com/security/bug-bounty`
  },
  {
    key: 'agency',
    draft: makeDraft({
      siteUrl: 'https://agency.example',
      contactLines: 'mailto:security@agency.example',
      expiresDate: '2026-08-31',
      encryptionUrl: '',
      acknowledgmentsUrl: '',
      preferredLanguages: 'en',
      policyUrl: 'https://agency.example/security',
      hiringUrl: '',
      includeCanonical: true
    }),
    workspace: `Contact: mailto:security@agency.example
Expires: 2026-08-31T23:59:59Z
Preferred-Languages: en
Canonical: https://agency.example/.well-known/security.txt
Policy: https://agency.example/security`
  },
  {
    key: 'minimal',
    draft: makeDraft({
      siteUrl: 'https://example.com',
      contactLines: 'mailto:security@example.com',
      expiresDate: '2026-07-31',
      encryptionUrl: '',
      acknowledgmentsUrl: '',
      preferredLanguages: '',
      policyUrl: '',
      hiringUrl: '',
      includeCanonical: true
    }),
    workspace: `Contact: mailto:security@example.com
Expires: 2026-07-31T23:59:59Z
Canonical: https://example.com/.well-known/security.txt`
  },
  {
    key: 'hiring',
    draft: makeDraft({
      siteUrl: 'https://security.example.com',
      contactLines: 'mailto:security@security.example.com\nhttps://security.example.com/report',
      expiresDate: '2026-12-01',
      encryptionUrl: 'https://security.example.com/pgp.txt',
      acknowledgmentsUrl: 'https://security.example.com/thanks',
      preferredLanguages: 'en, de',
      policyUrl: 'https://security.example.com/disclosure',
      hiringUrl: 'https://security.example.com/jobs',
      includeCanonical: true
    }),
    workspace: `Contact: mailto:security@security.example.com
Contact: https://security.example.com/report
Expires: 2026-12-01T23:59:59Z
Encryption: https://security.example.com/pgp.txt
Acknowledgments: https://security.example.com/thanks
Preferred-Languages: en, de
Canonical: https://security.example.com/.well-known/security.txt
Policy: https://security.example.com/disclosure
Hiring: https://security.example.com/jobs`
  }
]

const getContactList = (value: string) =>
  value
    .split(/\r?\n/u)
    .map(item => item.trim())
    .filter(Boolean)

const getExpiresValue = (date: string) => (date.trim() ? `${date.trim()}T23:59:59Z` : '')

const isValidUri = (value: string) => /^[a-z][a-z\d+.-]*:/iu.test(value.trim())

const isValidLanguageList = (value: string) =>
  !value.trim() ||
  value
    .split(',')
    .map(language => language.trim())
    .filter(Boolean)
    .every(language => /^[a-z]{2,3}(-[A-Za-z]{2,8})?$/u.test(language))

const buildSecurityTxt = (draft: SecurityTxtDraft) => {
  const lines: string[] = []

  getContactList(draft.contactLines).forEach(contact => lines.push(`Contact: ${contact}`))
  if (draft.expiresDate.trim()) lines.push(`Expires: ${getExpiresValue(draft.expiresDate)}`)
  if (draft.encryptionUrl.trim()) lines.push(`Encryption: ${draft.encryptionUrl.trim()}`)
  if (draft.acknowledgmentsUrl.trim())
    lines.push(`Acknowledgments: ${draft.acknowledgmentsUrl.trim()}`)
  if (draft.preferredLanguages.trim())
    lines.push(`Preferred-Languages: ${draft.preferredLanguages.trim()}`)
  if (draft.includeCanonical) lines.push(`Canonical: ${securityPath(draft.siteUrl)}`)
  if (draft.policyUrl.trim()) lines.push(`Policy: ${draft.policyUrl.trim()}`)
  if (draft.hiringUrl.trim()) lines.push(`Hiring: ${draft.hiringUrl.trim()}`)

  return lines.join('\n')
}

const escapeJsTemplate = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${')
const escapeNginxText = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/\r?\n/gu, '\\n')

const buildOutput = (draft: SecurityTxtDraft, outputType: OutputType) => {
  const txt = buildSecurityTxt(draft)
  const canonical = securityPath(draft.siteUrl)

  switch (outputType) {
    case 'next':
      return `export function GET() {
  return new Response(\`${escapeJsTemplate(txt)}\`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  })
}`
    case 'nginx':
      return `location = /.well-known/security.txt {
  default_type text/plain;
  return 200 "${escapeNginxText(txt)}";
}`
    case 'apache':
      return `Alias "/.well-known/security.txt" "/var/www/security.txt"
<Location "/.well-known/security.txt">
  Header set Content-Type "text/plain; charset=utf-8"
</Location>`
    case 'json':
      return JSON.stringify(
        {
          canonical,
          fields: parseSecurityTxt(txt),
          text: txt
        },
        null,
        2
      )
    case 'txt':
    default:
      return txt
  }
}

const normalizeFieldName = (value: string): SecurityField | null => {
  const normalized = value.toLowerCase()

  return FIELD_NAMES.find(field => field.toLowerCase() === normalized) ?? null
}

const isValidFieldValue = (field: SecurityField, value: string) => {
  if (field === 'Expires') return !Number.isNaN(Date.parse(value))
  if (field === 'Preferred-Languages') return isValidLanguageList(value)

  return isValidUri(value)
}

const parseSecurityTxt = (input: string): ParsedLine[] => {
  const rows: ParsedLine[] = []

  for (const line of input.slice(0, SECURITY_INPUT_LIMIT).split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Za-z-]+)\s*:\s*(.+)$/u.exec(trimmed)
    if (!match) continue

    const field = normalizeFieldName(match[1])
    const value = match[2].trim()
    rows.push({
      field: field ?? match[1],
      known: Boolean(field),
      raw: trimmed,
      valid: field ? isValidFieldValue(field, value) : false,
      value
    })

    if (rows.length >= SECURITY_ROW_LIMIT) break
  }

  return rows
}

const auditSecurityTxt = (draft: SecurityTxtDraft, parsedRows: ParsedLine[]): Finding[] => {
  const findings: Finding[] = []
  const contacts = getContactList(draft.contactLines)
  const expiresValue = getExpiresValue(draft.expiresDate)
  const expiresTime = expiresValue ? Date.parse(expiresValue) : Number.NaN
  const parsedContacts = parsedRows.filter(row => row.field.toLowerCase() === 'contact')
  const parsedExpires = parsedRows.filter(row => row.field.toLowerCase() === 'expires')

  if (contacts.length) findings.push({ key: 'contact_ok', level: 'good', subject: 'Contact' })
  else findings.push({ key: 'contact_missing', level: 'danger', subject: 'Contact' })

  contacts.forEach(contact => {
    if (!isValidUri(contact)) {
      findings.push({ key: 'contact_invalid', level: 'danger', subject: contact })
    } else if (!/^mailto:|^https?:/iu.test(contact)) {
      findings.push({ key: 'contact_unusual', level: 'warn', subject: contact })
    }
  })

  if (!expiresValue) {
    findings.push({ key: 'expires_missing', level: 'danger', subject: 'Expires' })
  } else if (Number.isNaN(expiresTime)) {
    findings.push({ key: 'expires_invalid', level: 'danger', subject: 'Expires' })
  } else {
    findings.push({ key: 'expires_future', level: 'good', subject: 'Expires' })
  }

  if (draft.includeCanonical) {
    findings.push({ key: 'canonical_ok', level: 'good', subject: 'Canonical' })
  } else {
    findings.push({ key: 'canonical_missing', level: 'warn', subject: 'Canonical' })
  }

  if (draft.encryptionUrl.trim())
    findings.push({ key: 'encryption_ok', level: 'good', subject: 'Encryption' })
  else findings.push({ key: 'encryption_missing', level: 'warn', subject: 'Encryption' })

  if (!isValidLanguageList(draft.preferredLanguages)) {
    findings.push({ key: 'languages_invalid', level: 'warn', subject: 'Preferred-Languages' })
  }

  for (const row of parsedRows) {
    if (!row.known) findings.push({ key: 'parsed_unknown', level: 'warn', subject: row.field })
    else if (!row.valid)
      findings.push({ key: 'parsed_invalid', level: 'danger', subject: row.field })
  }

  if (parsedRows.length) {
    if (!parsedContacts.length)
      findings.push({ key: 'parsed_contact_missing', level: 'danger', subject: 'parser' })
    if (!parsedExpires.length)
      findings.push({ key: 'parsed_expires_missing', level: 'danger', subject: 'parser' })
  }

  return findings
}

const escapeCsv = (value: boolean | number | string) => `"${String(value).replaceAll('"', '""')}"`

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const getFindingClass = (level: FindingLevel) => {
  if (level === 'danger') return 'border-red-300/50 bg-red-500/10 text-red-600'
  if (level === 'warn') return 'border-amber-300/50 bg-amber-500/10 text-amber-700'

  return 'border-emerald-300/50 bg-emerald-500/10 text-emerald-700'
}

function SecurityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-input rounded-xl p-3">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  )
}

export default function SecurityTxtClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<SecurityTxtDraft>(DEFAULT_DRAFT)
  const [outputType, setOutputType] = useState<OutputType>('txt')
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const deferredWorkspace = useDeferredValue(workspace)

  const output = useMemo(() => buildOutput(draft, outputType), [draft, outputType])
  const generatedText = useMemo(() => buildSecurityTxt(draft), [draft])
  const parsedRows = useMemo(() => parseSecurityTxt(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => auditSecurityTxt(draft, parsedRows), [draft, parsedRows])
  const metrics = useMemo(() => {
    const contacts = getContactList(draft.contactLines).length
    const risks = findings.filter(finding => finding.level !== 'good').length
    const validRows = parsedRows.filter(row => row.valid).length
    const expiresTime = Date.parse(getExpiresValue(draft.expiresDate))
    const expiresStatus = !Number.isNaN(expiresTime) ? t('public.yes') : t('public.no')

    return {
      contacts: String(contacts),
      expires: expiresStatus,
      fields: String(generatedText.split(/\r?\n/u).filter(Boolean).length),
      parsed: String(parsedRows.length),
      valid: String(validRows),
      risks: String(risks)
    }
  }, [draft.contactLines, draft.expiresDate, findings, generatedText, parsedRows, t])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        {
          canonical: securityPath(draft.siteUrl),
          generated: parseSecurityTxt(generatedText),
          parsedRows,
          findings
        },
        null,
        2
      ),
    [draft.siteUrl, findings, generatedText, parsedRows]
  )
  const exportCsv = useMemo(
    () =>
      [
        ['field', 'value', 'known', 'valid', 'raw'],
        ...parsedRows.map(row => [
          row.field,
          row.value,
          String(row.known),
          String(row.valid),
          row.raw
        ])
      ]
        .map(row => row.map(escapeCsv).join(','))
        .join('\n'),
    [parsedRows]
  )

  const updateDraft = <Key extends keyof SecurityTxtDraft>(
    key: Key,
    value: SecurityTxtDraft[Key]
  ) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const applyPreset = (preset: Preset) => {
    setDraft(preset.draft)
    setWorkspace(preset.workspace)
    setOutputType('txt')
  }

  const copySummary = () => {
    copy(
      [
        t('app.generation.security_txt.summary_title'),
        `${t('app.generation.security_txt.metric.contacts')}: ${metrics.contacts}`,
        `${t('app.generation.security_txt.metric.expires')}: ${metrics.expires}`,
        `${t('app.generation.security_txt.metric.risks')}: ${metrics.risks}`,
        securityPath(draft.siteUrl)
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
                <ShieldCheck className="h-4 w-4" />
                {t('app.generation.security-txt')}
              </div>
              <CardTitle className="mt-2 text-2xl">{t('app.generation.security-txt')}</CardTitle>
              <CardDescription>{t('app.generation.security_txt.description')}</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={copySummary} className="shrink-0">
              <ClipboardCheck className="h-4 w-4" />
              {t('app.generation.security_txt.copy_summary')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <SecurityMetric
              label={t('app.generation.security_txt.metric.contacts')}
              value={metrics.contacts}
            />
            <SecurityMetric
              label={t('app.generation.security_txt.metric.expires')}
              value={metrics.expires}
            />
            <SecurityMetric
              label={t('app.generation.security_txt.metric.fields')}
              value={metrics.fields}
            />
            <SecurityMetric
              label={t('app.generation.security_txt.metric.parsed')}
              value={metrics.parsed}
            />
            <SecurityMetric
              label={t('app.generation.security_txt.metric.valid')}
              value={metrics.valid}
            />
            <SecurityMetric
              label={t('app.generation.security_txt.metric.risks')}
              value={metrics.risks}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <CardTitle className="text-base">{t('app.generation.security_txt.presets')}</CardTitle>
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
                {t(`app.generation.security_txt.preset.${preset.key}`)}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                {t(`app.generation.security_txt.preset.${preset.key}_hint`)}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="glass-panel glass-clip">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.security_txt.builder')}</CardTitle>
            <CardDescription>{t('app.generation.security_txt.builder_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="security-site">{t('app.generation.security_txt.site')}</Label>
                <Input
                  id="security-site"
                  value={draft.siteUrl}
                  onChange={event => updateDraft('siteUrl', event.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="security-expires">{t('app.generation.security_txt.expires')}</Label>
                <Input
                  id="security-expires"
                  type="date"
                  value={draft.expiresDate}
                  onChange={event => updateDraft('expiresDate', event.target.value)}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="security-contacts">
                  {t('app.generation.security_txt.contacts')}
                </Label>
                <Textarea
                  id="security-contacts"
                  value={draft.contactLines}
                  onChange={event => updateDraft('contactLines', event.target.value.slice(0, 4000))}
                  className="min-h-[110px] font-mono"
                />
              </div>
              <SecurityInput
                id="security-encryption"
                label={t('app.generation.security_txt.encryption')}
                value={draft.encryptionUrl}
                onChange={value => updateDraft('encryptionUrl', value)}
              />
              <SecurityInput
                id="security-acknowledgments"
                label={t('app.generation.security_txt.acknowledgments')}
                value={draft.acknowledgmentsUrl}
                onChange={value => updateDraft('acknowledgmentsUrl', value)}
              />
              <SecurityInput
                id="security-policy"
                label={t('app.generation.security_txt.policy')}
                value={draft.policyUrl}
                onChange={value => updateDraft('policyUrl', value)}
              />
              <SecurityInput
                id="security-hiring"
                label={t('app.generation.security_txt.hiring')}
                value={draft.hiringUrl}
                onChange={value => updateDraft('hiringUrl', value)}
              />
              <div className="space-y-3">
                <Label htmlFor="security-languages">
                  {t('app.generation.security_txt.languages')}
                </Label>
                <Input
                  id="security-languages"
                  value={draft.preferredLanguages}
                  onChange={event => updateDraft('preferredLanguages', event.target.value)}
                  placeholder="en, zh"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="security-canonical">
                  {t('app.generation.security_txt.include_canonical')}
                </Label>
                <Select
                  id="security-canonical"
                  value={draft.includeCanonical ? 'yes' : 'no'}
                  onChange={event => updateDraft('includeCanonical', event.target.value === 'yes')}
                >
                  <option value="yes">{t('public.yes')}</option>
                  <option value="no">{t('public.no')}</option>
                </Select>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="security-output-type">
                  {t('app.generation.security_txt.output_type')}
                </Label>
                <Select
                  id="security-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(value => (
                    <option key={value} value={value}>
                      {t(`app.generation.security_txt.output.${value}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel glass-clip">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              <CardTitle className="text-base">
                {t('app.generation.security_txt.output_preview')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly value={output} className="min-h-[260px] font-mono" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button type="button" onClick={() => copy(output)}>
                <Copy className="h-4 w-4" />
                {t('public.copy')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace(generatedText)}>
                <Search className="h-4 w-4" />
                {t('app.generation.security_txt.use_output')}
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.security_txt.audit')}
              </h3>
              <div className="space-y-2">
                {findings.slice(0, 10).map((finding, index) => (
                  <div
                    key={`${finding.key}:${finding.subject}:${index}`}
                    className={`rounded-xl border px-3 py-2 text-xs ${getFindingClass(finding.level)}`}
                  >
                    <span className="font-semibold">{finding.subject}</span>
                    <span className="mx-2">/</span>
                    {t(`app.generation.security_txt.audit.${finding.key}`)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel glass-clip">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">
                {t('app.generation.security_txt.workspace')}
              </CardTitle>
              <CardDescription>{t('app.generation.security_txt.workspace_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copy(exportJson)}>
                <Copy className="h-4 w-4" />
                {t('app.generation.security_txt.copy_json')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(exportCsv, 'security-txt.csv', 'text/csv;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.generation.security_txt.download_csv')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadText(generatedText, 'security.txt', 'text/plain;charset=utf-8')
                }
              >
                <Download className="h-4 w-4" />
                {t('app.generation.security_txt.download_txt')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setWorkspace('')}>
                <Trash2 className="h-4 w-4" />
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={workspace}
            onChange={event => setWorkspace(event.target.value.slice(0, SECURITY_INPUT_LIMIT))}
            placeholder={t('app.generation.security_txt.workspace_placeholder')}
            className="min-h-[180px] font-mono"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Mail className="h-3.5 w-3.5" />
                Contact
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.security_txt.reference.contact')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Expires
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.security_txt.reference.expires')}
              </p>
            </div>
            <div className="glass-input rounded-xl p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Languages className="h-3.5 w-3.5" />
                Preferred-Languages
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.generation.security_txt.reference.languages')}
              </p>
            </div>
          </div>

          {parsedRows.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsedRows.map((row, index) => (
                <div
                  key={`${row.field}:${row.value}:${index}`}
                  className="glass-input rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {row.field}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {row.known
                          ? t('app.generation.security_txt.known')
                          : t('app.generation.security_txt.unknown')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.valid
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : 'bg-red-500/10 text-red-600'
                      }`}
                    >
                      {row.valid
                        ? t('app.generation.security_txt.valid')
                        : t('app.generation.security_txt.invalid')}
                    </span>
                  </div>
                  <p className="mt-3 break-all font-mono text-sm text-[var(--text-primary)]">
                    {row.value}
                  </p>
                  <p className="mt-3 line-clamp-3 break-all font-mono text-xs text-[var(--text-tertiary)]">
                    {row.raw}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-input rounded-xl p-6 text-center text-sm text-[var(--text-secondary)]">
              {t('app.generation.security_txt.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SecurityInput({
  id,
  label,
  onChange,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={event => onChange(event.target.value)} />
    </div>
  )
}
