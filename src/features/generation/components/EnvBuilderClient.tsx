'use client'

import {
  ClipboardPaste,
  Copy,
  Download,
  FileCode2,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Wand2
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
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'

type EnvOutput = 'example' | 'redacted' | 'zod' | 'types' | 'process' | 'json' | 'keys' | 'docker'
type EnvSamplePreset = 'next' | 'vite' | 'node' | 'docker' | 'vercel' | 'cloudflare'
type EnvSample = EnvSamplePreset | 'custom'
type EnvTarget = 'example' | 'local' | 'production'
type EnvParseErrorCode = 'invalid_key' | 'missing_separator' | 'unterminated_quote'
type EnvAuditFlag =
  | 'duplicate'
  | 'empty_sensitive'
  | 'non_standard_case'
  | 'placeholder_secret'
  | 'public_sensitive'
type EnvAuditFilter = 'all' | 'issues' | 'public' | 'sensitive' | 'empty' | 'duplicates'
type EnvAuditSort = 'source' | 'name' | 'risk'

interface EnvEntry {
  comment: string
  key: string
  line: number
  quoted: boolean
  raw: string
  value: string
}

interface EnvParseError {
  code: EnvParseErrorCode
  line: number
  value?: string
}

interface EnvOptions {
  includeComments: boolean
  optionalEmpty: boolean
  quoteExampleValues: boolean
  redactValues: boolean
  sortKeys: boolean
}

interface EnvAuditRow extends EnvEntry {
  flags: EnvAuditFlag[]
  inferredType: string
  isPublic: boolean
  isSensitive: boolean
  riskScore: number
}

const SAMPLE_ENV = `# Daily Tools deployment
NEXT_PUBLIC_SITE_URL=https://daily-tools.vercel.app
NEXT_PUBLIC_APP_NAME=Daily Tools
DATABASE_URL=
OPENAI_API_KEY=sk-example
JWT_SECRET=change-me
FEATURE_ANALYTICS=false
RATE_LIMIT=120`

const ENV_SAMPLE_OPTIONS: EnvSamplePreset[] = [
  'next',
  'vite',
  'node',
  'docker',
  'vercel',
  'cloudflare'
]
const ENV_OUTPUT_OPTIONS: EnvOutput[] = [
  'example',
  'redacted',
  'zod',
  'types',
  'process',
  'json',
  'keys',
  'docker'
]
const ENV_TARGET_OPTIONS: EnvTarget[] = ['example', 'local', 'production']
const ENV_AUDIT_FILTER_OPTIONS: EnvAuditFilter[] = [
  'all',
  'issues',
  'public',
  'sensitive',
  'empty',
  'duplicates'
]
const ENV_AUDIT_SORT_OPTIONS: EnvAuditSort[] = ['source', 'risk', 'name']

const ENV_SAMPLES: Record<EnvSamplePreset, string> = {
  next: SAMPLE_ENV,
  vite: `# Vite app
VITE_APP_NAME=Daily Tools
VITE_API_BASE_URL=https://api.example.com
VITE_FEATURE_SEARCH=true
SENTRY_AUTH_TOKEN=
DATABASE_URL=postgres://user:pass@example.com:5432/app`,
  node: `# Node API
NODE_ENV=production
PORT=3000
DATABASE_URL=
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
LOG_LEVEL=info`,
  docker: `# Docker Compose
POSTGRES_USER=app
POSTGRES_PASSWORD=change-me
POSTGRES_DB=daily_tools
DATABASE_URL=postgres://app:change-me@db:5432/daily_tools
NEXT_PUBLIC_SITE_URL=http://localhost:3000`,
  vercel: `# Vercel deployment
NEXT_PUBLIC_SITE_URL=https://daily-tools.vercel.app
NEXT_PUBLIC_ANALYTICS_ID=
VERCEL_PROJECT_ID=
VERCEL_ORG_ID=
DATABASE_URL=
CRON_SECRET=change-me`,
  cloudflare: `# Cloudflare Worker
PUBLIC_APP_URL=https://tools.example.com
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
KV_NAMESPACE_ID=
R2_BUCKET=daily-tools
JWT_SECRET=your-secret-here`
}

const ENV_TARGET_FILENAMES: Record<EnvTarget, string> = {
  example: '.env.example',
  local: '.env.local',
  production: '.env.production'
}
const REDACTED_VALUE = '***REDACTED***'
const SENSITIVE_PATTERN = /(secret|token|key|password|passwd|private|credential|database_url)/i
const PUBLIC_PATTERN = /^(NEXT_PUBLIC_|PUBLIC_|VITE_|NUXT_PUBLIC_)/i
const BOOLEAN_PATTERN = /^(true|false)$/i
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const STANDARD_ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/
const PLACEHOLDER_SECRET_PATTERN =
  /^(change-?me|changeme|todo|example|your[-_\s]?(secret|token|key|password)|replace[-_\s]?me|secret|password)$/i
const MAX_ENV_INPUT_CHARS = 200000
const MAX_AUDIT_ROWS = 300
const envNumberFormatter = new Intl.NumberFormat()
const envKeyCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const isEscaped = (value: string, index: number) => {
  let slashCount = 0

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }

  return slashCount % 2 === 1
}

const stripInlineComment = (value: string) => {
  let quote: '"' | "'" | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const previous = value[index - 1]

    if ((char === '"' || char === "'") && !isEscaped(value, index)) {
      quote = quote === char ? null : (quote ?? char)
      continue
    }

    if (char === '#' && !quote && (index === 0 || /\s/.test(previous))) {
      return value.slice(0, index).trimEnd()
    }
  }

  return value
}

const stripQuotes = (value: string) => {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const parseEnv = (input: string) => {
  const entries: EnvEntry[] = []
  const errors: EnvParseError[] = []
  let pendingComments: string[] = []

  input.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    const lineNumber = index + 1

    if (!trimmed) {
      pendingComments = []
      return
    }

    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed.replace(/^#+\s?/, ''))
      return
    }

    const assignmentLine = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trimStart()
      : line
    const separatorIndex = assignmentLine.indexOf('=')
    if (separatorIndex < 0) {
      errors.push({ code: 'missing_separator', line: lineNumber })
      return
    }

    const key = assignmentLine.slice(0, separatorIndex).trim()
    const rawValue = assignmentLine.slice(separatorIndex + 1)
    if (!ENV_KEY_PATTERN.test(key)) {
      errors.push({ code: 'invalid_key', line: lineNumber, value: key })
    }

    const valueWithoutInlineComment = stripInlineComment(rawValue)
    const trimmedValue = valueWithoutInlineComment.trim()
    const quote = trimmedValue[0]
    if ((quote === '"' || quote === "'") && !trimmedValue.endsWith(quote)) {
      errors.push({ code: 'unterminated_quote', line: lineNumber })
    }

    entries.push({
      comment: pendingComments.join('\n'),
      key,
      line: lineNumber,
      quoted:
        (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
        (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")),
      raw: valueWithoutInlineComment,
      value: stripQuotes(valueWithoutInlineComment)
    })
    pendingComments = []
  })

  return { entries, errors }
}

const formatEnvNumber = (value: number) => envNumberFormatter.format(value)

const inferType = (value: string) => {
  if (BOOLEAN_PATTERN.test(value)) return 'boolean'
  if (NUMBER_PATTERN.test(value)) return 'number'
  if (/^https?:\/\//i.test(value)) return 'url'
  return 'string'
}

const quoteValue = (value: string) => {
  if (!value) return ''
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value
  return JSON.stringify(value)
}

const formatGeneratedPropertyKey = (key: string) =>
  ENV_KEY_PATTERN.test(key) ? key : JSON.stringify(key)

const buildExample = (entries: EnvEntry[], options: EnvOptions) =>
  entries
    .flatMap(entry => {
      const lines: string[] = []
      if (options.includeComments && entry.comment) {
        entry.comment.split('\n').forEach(comment => lines.push(`# ${comment}`))
      }

      const exampleValue = SENSITIVE_PATTERN.test(entry.key) ? '' : entry.value
      const value = options.quoteExampleValues ? quoteValue(exampleValue) : exampleValue
      lines.push(`${entry.key}=${value}`)
      return lines
    })
    .join('\n')

const buildZodSchema = (entries: EnvEntry[], options: EnvOptions) => {
  const lines = entries.map(entry => {
    const type = inferType(entry.value)
    const optional = options.optionalEmpty && !entry.value ? '.optional()' : ''
    let schema = 'z.string()'

    if (type === 'url') schema = 'z.string().url()'
    if (type === 'number') schema = 'z.coerce.number()'
    if (type === 'boolean')
      schema = 'z.enum(["true", "false"]).transform(value => value === "true")'

    return `  ${formatGeneratedPropertyKey(entry.key)}: ${schema}${optional},`
  })

  return `import { z } from 'zod'

export const envSchema = z.object({
${lines.join('\n')}
})

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>`
}

const buildTypes = (entries: EnvEntry[], options: EnvOptions) => {
  const lines = entries.map(entry => {
    const optional = options.optionalEmpty && !entry.value ? '?' : ''
    const type = inferType(entry.value)
    const tsType = type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string'
    return `  ${formatGeneratedPropertyKey(entry.key)}${optional}: ${tsType}`
  })

  return `export interface Env {
${lines.join('\n')}
}`
}

const buildProcessEnvDeclaration = (entries: EnvEntry[], options: EnvOptions) => {
  const lines = entries.map(entry => {
    const optional = options.optionalEmpty && !entry.value ? '?' : ''
    return `      ${formatGeneratedPropertyKey(entry.key)}${optional}: string`
  })

  return `declare namespace NodeJS {
  interface ProcessEnv {
${lines.join('\n')}
  }
}`
}

const getGeneratedEntries = (entries: EnvEntry[], options: EnvOptions) => {
  if (!options.sortKeys) return entries

  return [...entries].sort((first, second) => envKeyCollator.compare(first.key, second.key))
}

const getOutputValue = (entry: EnvEntry, options: EnvOptions) => {
  if (!options.redactValues) return entry.value
  if (SENSITIVE_PATTERN.test(entry.key) && entry.value) return REDACTED_VALUE
  return entry.value
}

const buildJsonSummary = (entries: EnvEntry[], options: EnvOptions) =>
  JSON.stringify(
    entries.map(entry => ({
      key: entry.key,
      line: entry.line,
      public: PUBLIC_PATTERN.test(entry.key),
      sensitive: SENSITIVE_PATTERN.test(entry.key),
      type: inferType(entry.value),
      hasValue: Boolean(entry.value),
      value: getOutputValue(entry, options) || undefined,
      comment: entry.comment || undefined
    })),
    null,
    2
  )

const buildKeyList = (entries: EnvEntry[]) => entries.map(entry => entry.key).join('\n')

const buildRedactedEnv = (entries: EnvEntry[], options: EnvOptions) =>
  entries
    .flatMap(entry => {
      const lines: string[] = []
      if (options.includeComments && entry.comment) {
        entry.comment.split('\n').forEach(comment => lines.push(`# ${comment}`))
      }

      const value = SENSITIVE_PATTERN.test(entry.key) && entry.value ? REDACTED_VALUE : entry.value
      lines.push(`${entry.key}=${options.quoteExampleValues ? quoteValue(value) : value}`)
      return lines
    })
    .join('\n')

const buildDockerEnvironment = (entries: EnvEntry[], options: EnvOptions) => {
  const lines = entries.map(entry => {
    const value = getOutputValue(entry, options)
    return `      ${entry.key}: ${JSON.stringify(value)}`
  })

  return `services:
  app:
    environment:
${lines.join('\n')}`
}

const buildOutput = (entries: EnvEntry[], output: EnvOutput, options: EnvOptions) => {
  const generatedEntries = getGeneratedEntries(entries, options)

  if (output === 'example') return buildExample(generatedEntries, options)
  if (output === 'redacted') return buildRedactedEnv(generatedEntries, options)
  if (output === 'zod') return buildZodSchema(generatedEntries, options)
  if (output === 'types') return buildTypes(generatedEntries, options)
  if (output === 'process') return buildProcessEnvDeclaration(generatedEntries, options)
  if (output === 'keys') return buildKeyList(generatedEntries)
  if (output === 'docker') return buildDockerEnvironment(generatedEntries, options)
  return buildJsonSummary(generatedEntries, options)
}

const getOutputFilename = (output: EnvOutput, target: EnvTarget) => {
  if (output === 'example') return ENV_TARGET_FILENAMES[target]
  if (output === 'redacted') return `${ENV_TARGET_FILENAMES[target]}.redacted`
  if (output === 'zod') return 'env.ts'
  if (output === 'types') return 'env-types.ts'
  if (output === 'process') return 'env.d.ts'
  if (output === 'keys') return 'env-keys.txt'
  if (output === 'docker') return 'docker-environment.yml'
  return 'env-summary.json'
}

const getDuplicateKeys = (entries: EnvEntry[]) => {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  entries.forEach(entry => {
    if (seen.has(entry.key)) {
      duplicates.add(entry.key)
      return
    }
    seen.add(entry.key)
  })

  return duplicates
}

const getEntryFlags = (entry: EnvEntry, duplicateKeys: Set<string>): EnvAuditFlag[] => {
  const flags: EnvAuditFlag[] = []
  const isSensitive = SENSITIVE_PATTERN.test(entry.key)

  if (duplicateKeys.has(entry.key)) flags.push('duplicate')
  if (PUBLIC_PATTERN.test(entry.key) && isSensitive) flags.push('public_sensitive')
  if (isSensitive && !entry.value) flags.push('empty_sensitive')
  if (ENV_KEY_PATTERN.test(entry.key) && !STANDARD_ENV_KEY_PATTERN.test(entry.key)) {
    flags.push('non_standard_case')
  }
  if (isSensitive && PLACEHOLDER_SECRET_PATTERN.test(entry.value.trim())) {
    flags.push('placeholder_secret')
  }

  return flags
}

const getRiskScore = (flags: EnvAuditFlag[]) =>
  flags.reduce((score, flag) => {
    if (flag === 'public_sensitive') return score + 5
    if (flag === 'placeholder_secret') return score + 4
    if (flag === 'empty_sensitive') return score + 3
    if (flag === 'duplicate') return score + 2
    return score + 1
  }, 0)

const getAuditRows = (entries: EnvEntry[], duplicateKeys: Set<string>): EnvAuditRow[] =>
  entries.map(entry => {
    const flags = getEntryFlags(entry, duplicateKeys)

    return {
      ...entry,
      flags,
      inferredType: inferType(entry.value),
      isPublic: PUBLIC_PATTERN.test(entry.key),
      isSensitive: SENSITIVE_PATTERN.test(entry.key),
      riskScore: getRiskScore(flags)
    }
  })

const filterAuditRows = (
  rows: EnvAuditRow[],
  filter: EnvAuditFilter,
  query: string,
  sort: EnvAuditSort
) => {
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = rows.filter(row => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'issues' && row.flags.length > 0) ||
      (filter === 'public' && row.isPublic) ||
      (filter === 'sensitive' && row.isSensitive) ||
      (filter === 'empty' && !row.value) ||
      (filter === 'duplicates' && row.flags.includes('duplicate'))

    if (!matchesFilter) return false
    if (!normalizedQuery) return true

    return (
      row.key.toLowerCase().includes(normalizedQuery) ||
      row.value.toLowerCase().includes(normalizedQuery) ||
      row.comment.toLowerCase().includes(normalizedQuery)
    )
  })

  if (sort === 'name') {
    return filtered.sort((first, second) => envKeyCollator.compare(first.key, second.key))
  }

  if (sort === 'risk') {
    return filtered.sort(
      (first, second) => second.riskScore - first.riskScore || first.line - second.line
    )
  }

  return filtered
}

const EnvBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const toast = useToast()
  const [input, setInput] = useState(SAMPLE_ENV)
  const [sample, setSample] = useState<EnvSample>('next')
  const [targetFile, setTargetFile] = useState<EnvTarget>('example')
  const [outputType, setOutputType] = useState<EnvOutput>('example')
  const [includeComments, setIncludeComments] = useState(true)
  const [optionalEmpty, setOptionalEmpty] = useState(true)
  const [quoteExampleValues, setQuoteExampleValues] = useState(false)
  const [redactValues, setRedactValues] = useState(true)
  const [sortKeys, setSortKeys] = useState(false)
  const [auditFilter, setAuditFilter] = useState<EnvAuditFilter>('all')
  const [auditSort, setAuditSort] = useState<EnvAuditSort>('source')
  const [auditQuery, setAuditQuery] = useState('')
  const deferredInput = useDeferredValue(input)
  const deferredAuditQuery = useDeferredValue(auditQuery)
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_ENV_INPUT_CHARS
        ? deferredInput.slice(0, MAX_ENV_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )
  const isInputTruncated = deferredInput.length > MAX_ENV_INPUT_CHARS

  const parsed = useMemo(() => parseEnv(safeInput), [safeInput])
  const options = useMemo(
    () => ({ includeComments, optionalEmpty, quoteExampleValues, redactValues, sortKeys }),
    [includeComments, optionalEmpty, quoteExampleValues, redactValues, sortKeys]
  )
  const outputPreviewEntries = useMemo(
    () => parsed.entries.slice(0, OUTPUT_PREVIEW_ROWS),
    [parsed.entries]
  )
  const outputPreviewSource = useMemo(
    () => buildOutput(outputPreviewEntries, outputType, options),
    [options, outputPreviewEntries, outputType]
  )
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewLimited = isOutputPreviewLimited(outputPreviewSource)
  const outputPreviewRowsLimited = parsed.entries.length > outputPreviewEntries.length
  const hasOutput = parsed.entries.length > 0
  const buildCurrentOutput = useCallback(
    () => buildOutput(parsed.entries, outputType, options),
    [options, outputType, parsed.entries]
  )
  const outputFilename = useMemo(
    () => getOutputFilename(outputType, targetFile),
    [outputType, targetFile]
  )
  const duplicateKeys = useMemo(() => getDuplicateKeys(parsed.entries), [parsed.entries])
  const auditRows = useMemo(
    () => getAuditRows(parsed.entries, duplicateKeys),
    [duplicateKeys, parsed.entries]
  )
  const filteredAuditRows = useMemo(
    () => filterAuditRows(auditRows, auditFilter, deferredAuditQuery, auditSort),
    [auditFilter, auditRows, auditSort, deferredAuditQuery]
  )
  const visibleAuditEntries = useMemo(
    () => filteredAuditRows.slice(0, MAX_AUDIT_ROWS),
    [filteredAuditRows]
  )
  const hiddenAuditRows = Math.max(filteredAuditRows.length - visibleAuditEntries.length, 0)
  const formattedErrors = useMemo(
    () =>
      parsed.errors.map(error =>
        t(`app.generation.env.error.${error.code}`, {
          key: error.value,
          line: formatEnvNumber(error.line)
        })
      ),
    [parsed.errors, t]
  )

  const metrics = useMemo(() => {
    let publicCount = 0
    let sensitiveCount = 0
    let emptyCount = 0
    let requiredCount = 0

    parsed.entries.forEach(entry => {
      if (PUBLIC_PATTERN.test(entry.key)) publicCount += 1
      if (SENSITIVE_PATTERN.test(entry.key)) sensitiveCount += 1
      if (!entry.value) emptyCount += 1
      if (entry.value || !optionalEmpty) requiredCount += 1
    })

    return {
      duplicateCount: duplicateKeys.size,
      emptyCount,
      errors: parsed.errors.length,
      issueCount: auditRows.filter(row => row.flags.length > 0).length,
      publicCount,
      requiredCount,
      sensitiveCount,
      variables: parsed.entries.length
    }
  }, [auditRows, duplicateKeys.size, optionalEmpty, parsed.entries, parsed.errors.length])

  const auditJson = useMemo(
    () =>
      JSON.stringify(
        {
          summary: metrics,
          items: auditRows.map(row => ({
            key: row.key,
            line: row.line,
            type: row.inferredType,
            public: row.isPublic,
            sensitive: row.isSensitive,
            hasValue: Boolean(row.value),
            flags: row.flags
          }))
        },
        null,
        2
      ),
    [auditRows, metrics]
  )

  const handleSampleChange = (nextSample: EnvSample) => {
    if (nextSample === 'custom') return

    setSample(nextSample)
    setInput(ENV_SAMPLES[nextSample])
  }

  const handleInputChange = (nextInput: string) => {
    setInput(nextInput)
    setSample('custom')
  }

  const handleClear = () => {
    setInput('')
    setSample('custom')
    setAuditQuery('')
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      handleInputChange(text)
    } catch {
      toast.error(t('public.error'))
    }
  }

  const handleDownload = () => {
    if (!hasOutput) return

    const blob = new Blob([buildCurrentOutput()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = outputFilename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setInput(SAMPLE_ENV)
    setSample('next')
    setTargetFile('example')
    setOutputType('example')
    setIncludeComments(true)
    setOptionalEmpty(true)
    setQuoteExampleValues(false)
    setRedactValues(true)
    setSortKeys(false)
    setAuditFilter('all')
    setAuditSort('source')
    setAuditQuery('')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.env')}
              </CardTitle>
              <CardDescription>{t('app.generation.env.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="ghost"
                icon={<ClipboardPaste className="h-4 w-4" />}
                onClick={handlePaste}
              >
                {t('app.generation.env.paste')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                disabled={!input}
                onClick={handleClear}
              >
                {t('public.clear')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="env-input">{t('app.generation.env.input')}</Label>
              <Textarea
                id="env-input"
                value={input}
                onChange={event => handleInputChange(event.target.value)}
                aria-describedby={
                  formattedErrors.length > 0 || isInputTruncated ? 'env-input-alerts' : undefined
                }
                aria-invalid={formattedErrors.length > 0}
                rows={14}
                className="min-h-[320px] resize-y font-mono"
                placeholder={t('app.generation.env.placeholder')}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="env-sample">{t('app.generation.env.sample')}</Label>
                <Select
                  id="env-sample"
                  value={sample}
                  onChange={event => handleSampleChange(event.target.value as EnvSample)}
                >
                  {ENV_SAMPLE_OPTIONS.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.env.sample.${type}`)}
                    </option>
                  ))}
                  {sample === 'custom' && (
                    <option value="custom">{t('app.generation.env.sample.custom')}</option>
                  )}
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="env-target-file">{t('app.generation.env.target_file')}</Label>
                <Select
                  id="env-target-file"
                  value={targetFile}
                  onChange={event => setTargetFile(event.target.value as EnvTarget)}
                >
                  {ENV_TARGET_OPTIONS.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.env.target.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="env-output-type">{t('app.generation.env.output_type')}</Label>
                <Select
                  id="env-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as EnvOutput)}
                >
                  {ENV_OUTPUT_OPTIONS.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.env.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="glass-input rounded-xl p-3">
                <Checkbox
                  checked={includeComments}
                  onChange={event => setIncludeComments(event.target.checked)}
                  label={t('app.generation.env.include_comments')}
                />
                <Checkbox
                  checked={optionalEmpty}
                  onChange={event => setOptionalEmpty(event.target.checked)}
                  label={t('app.generation.env.optional_empty')}
                />
                <Checkbox
                  checked={quoteExampleValues}
                  onChange={event => setQuoteExampleValues(event.target.checked)}
                  label={t('app.generation.env.quote_values')}
                />
                <Checkbox
                  checked={redactValues}
                  onChange={event => setRedactValues(event.target.checked)}
                  label={t('app.generation.env.redact_values')}
                />
                <Checkbox
                  checked={sortKeys}
                  onChange={event => setSortKeys(event.target.checked)}
                  label={t('app.generation.env.sort_keys')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <EnvMetric
                  label={t('app.generation.env.variables')}
                  value={formatEnvNumber(metrics.variables)}
                />
                <EnvMetric
                  label={t('app.generation.env.public')}
                  value={formatEnvNumber(metrics.publicCount)}
                />
                <EnvMetric
                  label={t('app.generation.env.sensitive')}
                  value={formatEnvNumber(metrics.sensitiveCount)}
                />
                <EnvMetric
                  label={t('app.generation.env.empty')}
                  value={formatEnvNumber(metrics.emptyCount)}
                />
                <EnvMetric
                  label={t('app.generation.env.issues')}
                  value={formatEnvNumber(metrics.issueCount)}
                />
                <EnvMetric
                  label={t('app.generation.env.errors')}
                  value={formatEnvNumber(metrics.errors)}
                />
              </div>

              {(formattedErrors.length > 0 || isInputTruncated) && (
                <div id="env-input-alerts" className="space-y-2" role="alert">
                  {formattedErrors.length > 0 && (
                    <div className="rounded-xl border border-[var(--error)] bg-[var(--error-subtle)] p-3 text-sm text-[var(--error)]">
                      {formattedErrors.slice(0, 4).map(error => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  )}

                  {isInputTruncated && (
                    <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                      {t('app.generation.env.warning.truncated', {
                        limit: formatEnvNumber(MAX_ENV_INPUT_CHARS)
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('app.generation.env.output_panel')}</CardTitle>
              <CardDescription>{outputFilename}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                icon={<Wand2 className="h-4 w-4" />}
                disabled={
                  !hasOutput ||
                  outputType === 'zod' ||
                  outputType === 'types' ||
                  outputType === 'process'
                }
                onClick={() => handleInputChange(buildCurrentOutput())}
              >
                {t('app.generation.env.use_as_input')}
              </Button>
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                disabled={!hasOutput}
                onClick={() => copy(buildCurrentOutput())}
              >
                {t('public.copy')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                disabled={!hasOutput}
                onClick={handleDownload}
              >
                {t('app.generation.env.download')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={outputPreview}
              readOnly
              rows={16}
              className="min-h-[320px] flex-1 resize-none font-mono"
              placeholder={t('app.generation.env.empty_state')}
            />
            {outputPreviewLimited && (
              <p className="mt-3 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_limited', {
                  total: outputPreviewSource.length.toLocaleString(),
                  visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                })}
              </p>
            )}
            {outputPreviewRowsLimited && (
              <p className="mt-3 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('public.output_preview_rows_limited', {
                  total: parsed.entries.length.toLocaleString(),
                  visible: outputPreviewEntries.length.toLocaleString()
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:flex-col xl:items-stretch">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.generation.env.audit')}
                </CardTitle>
                <CardDescription>{t('app.generation.env.audit_hint')}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                disabled={!auditRows.length}
                onClick={() => copy(auditJson)}
              >
                {t('app.generation.env.copy_audit')}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <EnvMetric
                label={t('app.generation.env.required')}
                value={formatEnvNumber(metrics.requiredCount)}
              />
              <EnvMetric
                label={t('app.generation.env.duplicates')}
                value={formatEnvNumber(metrics.duplicateCount)}
              />
              <EnvMetric
                label={t('app.generation.env.filtered')}
                value={formatEnvNumber(filteredAuditRows.length)}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px] xl:grid-cols-1">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
                  aria-hidden="true"
                />
                <Input
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                  className="h-10 pl-9"
                  placeholder={t('app.generation.env.audit_search')}
                  aria-label={t('app.generation.env.audit_search')}
                />
              </div>
              <Select
                value={auditFilter}
                aria-label={t('app.generation.env.audit_filter')}
                onChange={event => setAuditFilter(event.target.value as EnvAuditFilter)}
              >
                {ENV_AUDIT_FILTER_OPTIONS.map(filter => (
                  <option key={filter} value={filter}>
                    {t(`app.generation.env.filter.${filter}`)}
                  </option>
                ))}
              </Select>
              <Select
                value={auditSort}
                aria-label={t('app.generation.env.audit_sort')}
                onChange={event => setAuditSort(event.target.value as EnvAuditSort)}
              >
                {ENV_AUDIT_SORT_OPTIONS.map(sort => (
                  <option key={sort} value={sort}>
                    {t(`app.generation.env.sort.${sort}`)}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
            {hiddenAuditRows > 0 && (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-xs text-[var(--warning)]">
                {t('app.generation.env.warning.audit_rows', {
                  shown: formatEnvNumber(visibleAuditEntries.length),
                  total: formatEnvNumber(filteredAuditRows.length)
                })}
              </p>
            )}

            {parsed.entries.length && filteredAuditRows.length === 0 && (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] px-4 text-center text-sm text-[var(--text-tertiary)]">
                {t('app.generation.env.audit_no_match')}
              </div>
            )}

            {visibleAuditEntries.length > 0 ? (
              visibleAuditEntries.map(entry => {
                const valueText =
                  redactValues && entry.isSensitive && entry.value
                    ? t('app.generation.env.redacted')
                    : entry.value

                return (
                  <div key={`${entry.key}-${entry.line}`} className="glass-input rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {entry.key}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          entry.isSensitive
                            ? 'bg-[var(--error-subtle)] text-[var(--error)]'
                            : entry.isPublic
                              ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                              : 'bg-[var(--glass-input-bg)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {entry.isSensitive
                          ? t('app.generation.env.sensitive')
                          : entry.isPublic
                            ? t('app.generation.env.public')
                            : entry.inferredType}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {entry.value
                        ? t('app.generation.env.has_value')
                        : t('app.generation.env.no_value')}
                    </p>
                    {valueText && (
                      <p className="mt-2 truncate font-mono text-xs text-[var(--text-tertiary)]">
                        {valueText}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Copy className="h-3.5 w-3.5" />}
                        onClick={() => copy(entry.key)}
                      >
                        {t('app.generation.env.copy_key')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Copy className="h-3.5 w-3.5" />}
                        disabled={!entry.value || (redactValues && entry.isSensitive)}
                        onClick={() => copy(entry.value)}
                      >
                        {t('app.generation.env.copy_value')}
                      </Button>
                    </div>
                    {entry.flags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.flags.map(flag => (
                          <span
                            key={flag}
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              flag === 'public_sensitive'
                                ? 'bg-[var(--error-subtle)] text-[var(--error)]'
                                : 'bg-[var(--warning-subtle)] text-[var(--warning)]'
                            }`}
                          >
                            {t(`app.generation.env.flag.${flag}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            ) : parsed.entries.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] text-sm text-[var(--text-tertiary)]">
                {t('app.generation.env.empty_state')}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const EnvMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default EnvBuilderClient
