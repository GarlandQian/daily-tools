'use client'

import {
  Database,
  Download,
  FileCode2,
  ListChecks,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

type SqlLanguage =
  | 'sql'
  | 'mysql'
  | 'postgresql'
  | 'sqlite'
  | 'mariadb'
  | 'bigquery'
  | 'snowflake'
  | 'hive'

type KeywordCase = 'upper' | 'lower' | 'preserve'
type IndentWidth = '2' | '4' | 'tab'
type LogicalOperatorNewline = 'before' | 'after'
type SqlSampleId = 'analytics' | 'postgres' | 'mysql'

interface SqlStats {
  characters: number
  comments: number
  joins: number
  lines: number
  parameters: string[]
  statements: number
  tables: string[]
}

interface SqlFormatResult {
  error: string
  isLoading: boolean
  output: string
}

const SQL_SAMPLES: Record<SqlSampleId, { language: SqlLanguage; value: string }> = {
  analytics: {
    language: 'sql',
    value:
      "select u.id,u.email,count(o.id) as order_count from users u left join orders o on o.user_id=u.id where u.created_at >= DATE '2026-01-01' and u.status='active' group by u.id,u.email having count(o.id)>0 order by order_count desc;"
  },
  postgres: {
    language: 'postgresql',
    value:
      'select u.id,u.email,count(o.id) as order_count from users u left join orders o on o.user_id=u.id where u.created_at >= $1 and u.status=$2 group by u.id,u.email having count(o.id)>0 order by order_count desc;'
  },
  mysql: {
    language: 'mysql',
    value:
      'select p.id,p.sku,p.price from products p where p.deleted_at is null and p.price between ? and ? order by p.updated_at desc limit 50;'
  }
}

const languageOptions: { label: string; value: SqlLanguage }[] = [
  { label: 'Standard SQL', value: 'sql' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'SQLite', value: 'sqlite' },
  { label: 'MariaDB', value: 'mariadb' },
  { label: 'BigQuery', value: 'bigquery' },
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'Hive', value: 'hive' }
]

const caseOptions: { label: string; value: KeywordCase }[] = [
  { label: 'UPPER', value: 'upper' },
  { label: 'lower', value: 'lower' },
  { label: 'Preserve', value: 'preserve' }
]

const SQL_RESERVED_WORDS = new Set([
  'as',
  'by',
  'cross',
  'full',
  'group',
  'having',
  'inner',
  'join',
  'left',
  'limit',
  'on',
  'order',
  'right',
  'select',
  'set',
  'union',
  'where'
])

const MAX_SQL_FORMAT_INPUT_CHARS = 200000
const MAX_SQL_LIVE_OUTPUT_INPUT_CHARS = 60000
const MAX_SQL_OUTPUT_PREVIEW_CHARS = 60000
const sqlNumberFormatter = new Intl.NumberFormat()

const formatSqlNumber = (value: number) => sqlNumberFormatter.format(value)
const toOutputPreview = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit)}\n...` : value

const getTabWidth = (indentWidth: IndentWidth) => (indentWidth === 'tab' ? 2 : Number(indentWidth))
const getUseTabs = (indentWidth: IndentWidth) => indentWidth === 'tab'
type SqlFormatterModule = typeof import('sql-formatter')

const formatSqlWithOptions = (
  format: SqlFormatterModule['format'],
  input: string,
  {
    denseOperators,
    indentWidth,
    keywordCase,
    language,
    logicalOperatorNewline,
    newlineBeforeSemicolon
  }: {
    denseOperators: boolean
    indentWidth: IndentWidth
    keywordCase: KeywordCase
    language: SqlLanguage
    logicalOperatorNewline: LogicalOperatorNewline
    newlineBeforeSemicolon: boolean
  }
) =>
  format(input, {
    denseOperators,
    keywordCase,
    language,
    linesBetweenQueries: 1,
    logicalOperatorNewline,
    newlineBeforeSemicolon,
    tabWidth: getTabWidth(indentWidth),
    useTabs: getUseTabs(indentWidth)
  })

const stripSqlComments = (value: string) =>
  value.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const countSqlStatements = (value: string) =>
  stripSqlComments(value)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean).length

const extractTables = (value: string) => {
  const clean = stripSqlComments(value)
  const tables = new Set<string>()
  const tableRegex = /\b(?:from|join|update|into)\s+([`"[\]\w.-]+)/gi
  let match: RegExpExecArray | null

  while ((match = tableRegex.exec(clean)) !== null) {
    const table = match[1].replace(/^[`"[]|[`"\]]$/g, '')
    if (table && !SQL_RESERVED_WORDS.has(table.toLowerCase())) tables.add(table)
  }

  return [...tables].slice(0, 18)
}

const extractParameters = (value: string) => {
  const clean = stripSqlComments(value)
  const params = new Set<string>()
  const paramRegex = /(\$\d+|:[A-Za-z_][\w]*|@[A-Za-z_][\w]*|\?)/g
  let match: RegExpExecArray | null
  let questionIndex = 0

  while ((match = paramRegex.exec(clean)) !== null) {
    if (match[1] === '?') {
      questionIndex += 1
      params.add(`?${questionIndex}`)
    } else {
      params.add(match[1])
    }
  }

  return [...params].slice(0, 24)
}

const analyzeSql = (value: string): SqlStats => ({
  characters: value.length,
  comments: (value.match(/--.*$/gm) || []).length + (value.match(/\/\*[\s\S]*?\*\//g) || []).length,
  joins: (value.match(/\bjoin\b/gi) || []).length,
  lines: value ? value.split(/\r?\n/).length : 0,
  parameters: extractParameters(value),
  statements: countSqlStatements(value),
  tables: extractTables(value)
})

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const SqlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [isInputCapped, setIsInputCapped] = useState(false)
  const [language, setLanguage] = useState<SqlLanguage>('sql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('upper')
  const [indentWidth, setIndentWidth] = useState<IndentWidth>('2')
  const [logicalOperatorNewline, setLogicalOperatorNewline] =
    useState<LogicalOperatorNewline>('before')
  const [denseOperators, setDenseOperators] = useState(false)
  const [newlineBeforeSemicolon, setNewlineBeforeSemicolon] = useState(false)
  const [isActionProcessing, setIsActionProcessing] = useState(false)
  const [formatted, setFormatted] = useState<SqlFormatResult>({
    error: '',
    isLoading: false,
    output: ''
  })
  const deferredInput = useDeferredValue(input)
  const isInputTooLarge = isInputCapped || deferredInput.length > MAX_SQL_FORMAT_INPUT_CHARS
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_SQL_FORMAT_INPUT_CHARS
        ? deferredInput.slice(0, MAX_SQL_FORMAT_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )

  const updateInput = (value: string) => {
    const capped = value.length > MAX_SQL_FORMAT_INPUT_CHARS
    setIsInputCapped(capped)
    setInput(capped ? value.slice(0, MAX_SQL_FORMAT_INPUT_CHARS) : value)
  }

  const liveOutputDeferred =
    safeInput.trim().length > MAX_SQL_LIVE_OUTPUT_INPUT_CHARS && !isInputTooLarge

  useEffect(() => {
    const trimmed = safeInput.trim()
    if (!trimmed || isInputTooLarge) {
      setFormatted({ error: '', isLoading: false, output: '' })
      return
    }

    if (liveOutputDeferred) {
      setFormatted({ error: '', isLoading: false, output: '' })
      return
    }

    let isCurrent = true
    setFormatted({ error: '', isLoading: true, output: '' })

    void import('sql-formatter')
      .then(({ format }) => {
        if (!isCurrent) return

        try {
          setFormatted({
            error: '',
            isLoading: false,
            output: formatSqlWithOptions(format, trimmed, {
              denseOperators,
              indentWidth,
              keywordCase,
              language,
              logicalOperatorNewline,
              newlineBeforeSemicolon
            })
          })
        } catch (error) {
          setFormatted({
            error: error instanceof Error ? error.message : String(error),
            isLoading: false,
            output: ''
          })
        }
      })
      .catch(error => {
        if (!isCurrent) return
        setFormatted({
          error: error instanceof Error ? error.message : String(error),
          isLoading: false,
          output: ''
        })
      })

    return () => {
      isCurrent = false
    }
  }, [
    denseOperators,
    indentWidth,
    isInputTooLarge,
    keywordCase,
    language,
    liveOutputDeferred,
    logicalOperatorNewline,
    newlineBeforeSemicolon,
    safeInput
  ])

  const analysisInput = useMemo(
    () => safeInput.slice(0, MAX_SQL_LIVE_OUTPUT_INPUT_CHARS),
    [safeInput]
  )
  const stats = useMemo(
    () => ({
      ...analyzeSql(analysisInput),
      characters: safeInput.length,
      lines: safeInput ? safeInput.split(/\r?\n/).length : 0
    }),
    [analysisInput, safeInput]
  )
  const hasInput = input.trim().length > 0
  const outputPreviewSource = liveOutputDeferred ? safeInput.trim() : formatted.output
  const outputPreview = useMemo(
    () => toOutputPreview(outputPreviewSource, MAX_SQL_OUTPUT_PREVIEW_CHARS),
    [outputPreviewSource]
  )
  const isOutputPreviewLimited = outputPreviewSource.length > MAX_SQL_OUTPUT_PREVIEW_CHARS
  const canBuildOutput =
    Boolean(safeInput.trim()) &&
    !isInputTooLarge &&
    !formatted.isLoading &&
    !formatted.error &&
    !isActionProcessing &&
    (liveOutputDeferred || Boolean(formatted.output))

  const buildCurrentOutput = useCallback(async () => {
    const trimmed = safeInput.trim()
    if (!trimmed || isInputTooLarge) return ''
    if (!liveOutputDeferred && formatted.output) return formatted.output

    setIsActionProcessing(true)
    try {
      const { format } = await import('sql-formatter')
      return formatSqlWithOptions(format, trimmed, {
        denseOperators,
        indentWidth,
        keywordCase,
        language,
        logicalOperatorNewline,
        newlineBeforeSemicolon
      })
    } catch (error) {
      toast.error(
        `${t('app.format.sql.error')}: ${error instanceof Error ? error.message : String(error)}`
      )
      return ''
    } finally {
      setIsActionProcessing(false)
    }
  }, [
    denseOperators,
    formatted.output,
    indentWidth,
    isInputTooLarge,
    keywordCase,
    language,
    liveOutputDeferred,
    logicalOperatorNewline,
    newlineBeforeSemicolon,
    safeInput,
    t,
    toast
  ])

  const handleValidate = async () => {
    if (!hasInput) {
      toast.warning(t('app.format.sql.empty'))
      return
    }

    if (isInputTooLarge) {
      toast.warning(
        t('app.format.sql.warning.too_large', {
          limit: formatSqlNumber(MAX_SQL_FORMAT_INPUT_CHARS)
        })
      )
      return
    }

    if (liveOutputDeferred) {
      const output = await buildCurrentOutput()
      if (output) toast.success(t('app.format.sql.valid'))
      return
    }

    if (formatted.isLoading) {
      toast.warning(t('app.format.sql.formatting'))
      return
    }

    if (formatted.error) {
      toast.error(`${t('app.format.sql.error')}: ${formatted.error}`)
    } else {
      toast.success(t('app.format.sql.valid'))
    }
  }

  const handleCopyFormatted = async () => {
    const output = await buildCurrentOutput()
    if (output) await copy(output)
  }

  const handleDownload = async () => {
    const output = await buildCurrentOutput()
    if (output) downloadText(output, 'daily-tools-query.sql', 'text/sql;charset=utf-8')
  }

  const handleUseSample = (sampleId: SqlSampleId) => {
    const sample = SQL_SAMPLES[sampleId]
    updateInput(sample.value)
    setLanguage(sample.language)
    setKeywordCase('upper')
    setIndentWidth('2')
    setLogicalOperatorNewline('before')
    setDenseOperators(false)
    setNewlineBeforeSemicolon(false)
  }

  const handleUseOutput = () => {
    void (async () => {
      const output = await buildCurrentOutput()
      if (output) updateInput(output)
    })()
  }

  const handleClear = () => {
    updateInput('')
    setLanguage('sql')
    setKeywordCase('upper')
    setIndentWidth('2')
    setLogicalOperatorNewline('before')
    setDenseOperators(false)
    setNewlineBeforeSemicolon(false)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[var(--primary)]" />
              {t('app.format.sql')}
            </CardTitle>
            <CardDescription>{t('app.format.sql.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[180px_170px_170px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="sql-dialect">{t('app.format.sql.dialect')}</Label>
              <Select
                id="sql-dialect"
                value={language}
                onChange={event => setLanguage(event.target.value as SqlLanguage)}
              >
                {languageOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sql-indent">{t('app.format.sql.indent')}</Label>
              <Select
                id="sql-indent"
                value={indentWidth}
                onChange={event => setIndentWidth(event.target.value as IndentWidth)}
              >
                <option value="2">{t('app.format.sql.indent.2')}</option>
                <option value="4">{t('app.format.sql.indent.4')}</option>
                <option value="tab">{t('app.format.sql.indent.tab')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sql-operator-line">{t('app.format.sql.operator_line')}</Label>
              <Select
                id="sql-operator-line"
                value={logicalOperatorNewline}
                onChange={event =>
                  setLogicalOperatorNewline(event.target.value as LogicalOperatorNewline)
                }
              >
                <option value="before">{t('app.format.sql.operator_line.before')}</option>
                <option value="after">{t('app.format.sql.operator_line.after')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('app.format.sql.keyword_case')}</Label>
              <div
                className="glass-input inline-flex min-h-11 w-full items-center rounded-lg p-0.5"
                role="radiogroup"
                aria-label={t('app.format.sql.keyword_case')}
              >
                {caseOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={keywordCase === option.value}
                    onClick={() => setKeywordCase(option.value)}
                    className={cn(
                      'min-w-0 flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      keywordCase === option.value
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Checkbox
              checked={denseOperators}
              onChange={event => setDenseOperators(event.target.checked)}
              label={t('app.format.sql.dense_operators')}
            />
            <Checkbox
              checked={newlineBeforeSemicolon}
              onChange={event => setNewlineBeforeSemicolon(event.target.checked)}
              label={t('app.format.sql.semicolon_line')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              icon={<Paintbrush className="h-4 w-4" />}
              disabled={!hasInput || !canBuildOutput}
              onClick={() => void handleCopyFormatted()}
            >
              {isActionProcessing
                ? t('app.format.sql.formatting')
                : t('app.format.sql.copy_formatted')}
            </Button>
            <Button
              type="button"
              icon={<ListChecks className="h-4 w-4" />}
              onClick={handleValidate}
              disabled={!hasInput}
            >
              {t('app.format.sql.validate')}
            </Button>
            <Button
              type="button"
              icon={<Download className="h-4 w-4" />}
              disabled={!canBuildOutput}
              onClick={() => void handleDownload()}
            >
              {t('app.format.sql.download')}
            </Button>
            <Button
              type="button"
              icon={<RotateCcw className="h-4 w-4" />}
              disabled={!canBuildOutput}
              onClick={handleUseOutput}
            >
              {t('app.format.sql.use_output')}
            </Button>
            <Button type="button" icon={<Trash2 className="h-4 w-4" />} onClick={handleClear}>
              {t('public.clear')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['analytics', 'postgres', 'mysql'] as const).map(sampleId => (
              <Button
                key={sampleId}
                type="button"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => handleUseSample(sampleId)}
              >
                {t(`app.format.sql.sample.${sampleId}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <SqlMetric
          label={t('app.format.sql.metric.characters')}
          value={formatSqlNumber(stats.characters)}
        />
        <SqlMetric label={t('app.format.sql.metric.lines')} value={formatSqlNumber(stats.lines)} />
        <SqlMetric
          label={t('app.format.sql.metric.statements')}
          value={formatSqlNumber(stats.statements)}
        />
        <SqlMetric
          label={t('app.format.sql.metric.tables')}
          value={formatSqlNumber(stats.tables.length)}
        />
        <SqlMetric label={t('app.format.sql.metric.joins')} value={formatSqlNumber(stats.joins)} />
        <SqlMetric
          label={t('app.format.sql.metric.parameters')}
          value={formatSqlNumber(stats.parameters.length)}
        />
        <SqlMetric
          label={t('app.format.sql.metric.comments')}
          value={formatSqlNumber(stats.comments)}
        />
      </div>

      {isInputTooLarge && (
        <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
          {t('app.format.sql.warning.too_large', {
            limit: formatSqlNumber(MAX_SQL_FORMAT_INPUT_CHARS)
          })}
        </p>
      )}

      {formatted.error && (
        <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
          {t('app.format.sql.error')}: {formatted.error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.sql.input')}</CardTitle>
            <CardDescription>
              {hasInput
                ? t('app.format.sql.input_hint', { count: input.length })
                : t('app.format.sql.empty')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              id="sql-input"
              value={input}
              onChange={event => updateInput(event.target.value)}
              placeholder={t('app.format.sql.input_placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('app.format.sql.output')}</CardTitle>
            <CardDescription>
              {formatted.isLoading
                ? t('app.format.sql.formatting')
                : liveOutputDeferred
                  ? t('app.format.sql.preview_deferred')
                  : formatted.output
                    ? t('app.format.sql.valid')
                    : t('app.format.sql.output_hint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              id="sql-output"
              value={outputPreview}
              readOnly
              placeholder={t('app.format.sql.output_placeholder')}
              className="min-h-[320px] flex-1 resize-none font-mono"
            />
            {isOutputPreviewLimited && !liveOutputDeferred && (
              <p className="mt-3 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.format.sql.warning.output_preview_limited', {
                  total: formatSqlNumber(outputPreviewSource.length),
                  visible: formatSqlNumber(MAX_SQL_OUTPUT_PREVIEW_CHARS)
                })}
              </p>
            )}
            {liveOutputDeferred && (
              <p className="mt-3 rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                {t('app.format.sql.warning.live_output_deferred', {
                  total: formatSqlNumber(safeInput.trim().length),
                  visible: formatSqlNumber(MAX_SQL_OUTPUT_PREVIEW_CHARS)
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode2 className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.sql.tables')}
            </CardTitle>
            <CardDescription>{t('app.format.sql.tables_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.tables.length ? (
              <div className="flex flex-wrap gap-2">
                {stats.tables.map(table => (
                  <button
                    key={table}
                    type="button"
                    onClick={() => void copy(table)}
                    className="rounded-full bg-[var(--primary-subtle)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--primary)]"
                  >
                    {table}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {t('app.format.sql.tables_empty')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.sql.parameters')}
            </CardTitle>
            <CardDescription>{t('app.format.sql.parameters_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.parameters.length ? (
              <div className="flex flex-wrap gap-2">
                {stats.parameters.map(parameter => (
                  <button
                    key={parameter}
                    type="button"
                    onClick={() => void copy(parameter)}
                    className="rounded-full bg-[var(--glass-input-bg)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {parameter}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                {t('app.format.sql.parameters_empty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const SqlMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-3">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default SqlClient
