'use client'

import { Copy, FileCode2, RotateCcw, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type EnvOutput = 'example' | 'zod' | 'types' | 'json'

interface EnvEntry {
  comment: string
  key: string
  quoted: boolean
  raw: string
  value: string
}

interface EnvOptions {
  includeComments: boolean
  optionalEmpty: boolean
  quoteExampleValues: boolean
}

const SAMPLE_ENV = `# Daily Tools deployment
NEXT_PUBLIC_SITE_URL=https://daily-tools.vercel.app
NEXT_PUBLIC_APP_NAME=Daily Tools
DATABASE_URL=
OPENAI_API_KEY=sk-example
JWT_SECRET=change-me
FEATURE_ANALYTICS=false
RATE_LIMIT=120`

const SENSITIVE_PATTERN = /(secret|token|key|password|passwd|private|credential|database_url)/i
const PUBLIC_PATTERN = /^(NEXT_PUBLIC_|PUBLIC_|VITE_|NUXT_PUBLIC_)/i
const BOOLEAN_PATTERN = /^(true|false)$/i
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

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
  const errors: string[] = []
  let pendingComment = ''

  input.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      pendingComment = ''
      return
    }

    if (trimmed.startsWith('#')) {
      pendingComment = trimmed.replace(/^#+\s?/, '')
      return
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex < 0) {
      errors.push(`Line ${index + 1}: missing "="`)
      return
    }

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      errors.push(`Line ${index + 1}: invalid key "${key}"`)
    }

    const trimmedValue = rawValue.trim()
    entries.push({
      comment: pendingComment,
      key,
      quoted:
        (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
        (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")),
      raw: rawValue,
      value: stripQuotes(rawValue)
    })
    pendingComment = ''
  })

  return { entries, errors }
}

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

const buildExample = (entries: EnvEntry[], options: EnvOptions) =>
  entries
    .flatMap(entry => {
      const lines: string[] = []
      if (options.includeComments && entry.comment) lines.push(`# ${entry.comment}`)

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

    return `  ${entry.key}: ${schema}${optional},`
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
    return `  ${entry.key}${optional}: ${tsType}`
  })

  return `export interface Env {
${lines.join('\n')}
}`
}

const buildJsonSummary = (entries: EnvEntry[]) =>
  JSON.stringify(
    entries.map(entry => ({
      key: entry.key,
      public: PUBLIC_PATTERN.test(entry.key),
      sensitive: SENSITIVE_PATTERN.test(entry.key),
      type: inferType(entry.value),
      hasValue: Boolean(entry.value),
      comment: entry.comment || undefined
    })),
    null,
    2
  )

const buildOutput = (entries: EnvEntry[], output: EnvOutput, options: EnvOptions) => {
  if (output === 'example') return buildExample(entries, options)
  if (output === 'zod') return buildZodSchema(entries, options)
  if (output === 'types') return buildTypes(entries, options)
  return buildJsonSummary(entries)
}

const EnvBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_ENV)
  const [outputType, setOutputType] = useState<EnvOutput>('example')
  const [includeComments, setIncludeComments] = useState(true)
  const [optionalEmpty, setOptionalEmpty] = useState(true)
  const [quoteExampleValues, setQuoteExampleValues] = useState(false)

  const parsed = useMemo(() => parseEnv(input), [input])
  const options = useMemo(
    () => ({ includeComments, optionalEmpty, quoteExampleValues }),
    [includeComments, optionalEmpty, quoteExampleValues]
  )
  const output = useMemo(
    () => buildOutput(parsed.entries, outputType, options),
    [options, outputType, parsed.entries]
  )

  const publicCount = parsed.entries.filter(entry => PUBLIC_PATTERN.test(entry.key)).length
  const sensitiveCount = parsed.entries.filter(entry => SENSITIVE_PATTERN.test(entry.key)).length
  const emptyCount = parsed.entries.filter(entry => !entry.value).length

  const reset = () => {
    setInput(SAMPLE_ENV)
    setOutputType('example')
    setIncludeComments(true)
    setOptionalEmpty(true)
    setQuoteExampleValues(false)
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
                icon={<Copy className="h-4 w-4" />}
                disabled={!output}
                onClick={() => copy(output)}
              >
                {t('public.copy')}
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
                onChange={event => setInput(event.target.value)}
                rows={14}
                className="min-h-[320px] resize-y font-mono"
                placeholder="NEXT_PUBLIC_SITE_URL=https://example.com"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="env-output-type">{t('app.generation.env.output_type')}</Label>
                <Select
                  id="env-output-type"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as EnvOutput)}
                >
                  {(['example', 'zod', 'types', 'json'] as const).map(type => (
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <EnvMetric
                  label={t('app.generation.env.variables')}
                  value={parsed.entries.length}
                />
                <EnvMetric label={t('app.generation.env.public')} value={publicCount} />
                <EnvMetric label={t('app.generation.env.sensitive')} value={sensitiveCount} />
                <EnvMetric label={t('app.generation.env.empty')} value={emptyCount} />
              </div>

              {parsed.errors.length > 0 && (
                <div className="rounded-xl border border-[var(--error)] bg-[var(--error-subtle)] p-3 text-sm text-[var(--error)]">
                  {parsed.errors.slice(0, 4).map(error => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.env.output_panel')}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={output}
              readOnly
              rows={16}
              className="min-h-[320px] flex-1 resize-none font-mono"
              placeholder={t('app.generation.env.empty_state')}
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.env.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.env.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
            {parsed.entries.length ? (
              parsed.entries.map(entry => (
                <div key={entry.key} className="glass-input rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {entry.key}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        SENSITIVE_PATTERN.test(entry.key)
                          ? 'bg-[var(--error-subtle)] text-[var(--error)]'
                          : PUBLIC_PATTERN.test(entry.key)
                            ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                            : 'bg-[var(--glass-input-bg)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {SENSITIVE_PATTERN.test(entry.key)
                        ? t('app.generation.env.sensitive')
                        : PUBLIC_PATTERN.test(entry.key)
                          ? t('app.generation.env.public')
                          : inferType(entry.value)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    {entry.value
                      ? t('app.generation.env.has_value')
                      : t('app.generation.env.no_value')}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] text-sm text-[var(--text-tertiary)]">
                {t('app.generation.env.empty_state')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const EnvMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default EnvBuilderClient
