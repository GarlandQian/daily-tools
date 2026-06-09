'use client'

import {
  AlertTriangle,
  Copy,
  Download,
  FileJson2,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  Table2,
  Trash2
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type DelimiterOption = 'auto' | 'comma' | 'semicolon' | 'tab' | 'pipe'
type OutputFormat = 'json' | 'markdown' | 'tsv' | 'csv'

interface ParseResult {
  delimiter: string
  error: string | null
  rows: string[][]
}

interface CsvOptions {
  headerRow: boolean
  skipEmptyRows: boolean
  trimCells: boolean
}

interface ColumnProfile {
  booleanCount: number
  emptyCount: number
  name: string
  numericCount: number
  samples: string[]
  uniqueCount: number
}

const SAMPLE_CSV = `id,name,email,plan,active
1,Ada Lovelace,ada@example.com,Pro,true
2,Grace Hopper,grace@example.com,Team,true
3,Katherine Johnson,katherine@example.com,Starter,false`

const SAMPLE_CSVS = {
  contacts: SAMPLE_CSV,
  finance: `date;category;amount;currency;note
2026-06-01;hosting;29.00;USD;monthly invoice
2026-06-02;software;120.00;USD;annual renewal
2026-06-03;hardware;499.99;USD;team device`,
  tabular: `sku\tname\tstock\treorder
DT-001\tGlass Button\t42\tfalse
DT-002\tPanel Token\t8\ttrue
DT-003\tIcon Set\t120\tfalse`
} as const

const MAX_CSV_INPUT_CHARS = 200000
const MAX_CSV_PREVIEW_ROWS = 12
const MAX_CSV_COLUMN_PROFILES = 12
const csvNumberFormatter = new Intl.NumberFormat()

const DELIMITER_CHARS: Record<Exclude<DelimiterOption, 'auto'>, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|'
}

const delimiterLabelKey = (delimiter: string) => {
  if (delimiter === ';') return 'semicolon'
  if (delimiter === '\t') return 'tab'
  if (delimiter === '|') return 'pipe'
  return 'comma'
}

const formatCsvNumber = (value: number) => csvNumberFormatter.format(value)

const countDelimiter = (line: string, delimiter: string) => {
  let count = 0
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) count += 1
  }

  return count
}

const getDelimiterSampleLines = (input: string) => {
  const lines: string[] = []
  let start = 0

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index]
    const isLineEnd = index === input.length || char === '\n' || char === '\r'

    if (!isLineEnd) continue

    const line = input.slice(start, index).trim()
    if (line) lines.push(line)
    if (lines.length >= 8) break

    if (char === '\r' && input[index + 1] === '\n') index += 1
    start = index + 1
  }

  return lines
}

const inferDelimiter = (input: string) => {
  const lines = getDelimiterSampleLines(input)

  if (!lines.length) return ','

  const candidates = Object.values(DELIMITER_CHARS)
  const scored = candidates.map(delimiter => {
    const counts = lines.map(line => countDelimiter(line, delimiter)).filter(count => count > 0)
    const total = counts.reduce((sum, count) => sum + count, 0)
    const first = counts[0] ?? 0
    const consistency = counts.filter(count => count === first).length

    return { delimiter, score: total + consistency * 2 }
  })

  return scored.sort((a, b) => b.score - a.score)[0]?.delimiter ?? ','
}

const parseCsv = (input: string, option: DelimiterOption): ParseResult => {
  const delimiter = option === 'auto' ? inferDelimiter(input) : DELIMITER_CHARS[option]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  if (!input.trim()) return { delimiter, error: null, rows: [] }

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char === '"') {
      if (inQuotes && input[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (char === '\r' && input[index + 1] === '\n') index += 1
      continue
    }

    field += char
  }

  if (inQuotes) return { delimiter, error: 'unclosed_quote', rows: [] }

  row.push(field)
  rows.push(row)

  return { delimiter, error: null, rows }
}

const normalizeRows = (rows: string[][], options: CsvOptions) => {
  const cleaned: string[][] = []
  let maxColumns = 0

  rows.forEach(row => {
    const cleanedRow = options.trimCells ? row.map(cell => cell.trim()) : row
    if (options.skipEmptyRows && !cleanedRow.some(cell => cell.trim())) return

    cleaned.push(cleanedRow)
    if (cleanedRow.length > maxColumns) maxColumns = cleanedRow.length
  })

  return cleaned.map(row => [
    ...row,
    ...Array.from({ length: Math.max(0, maxColumns - row.length) }, () => '')
  ])
}

const uniqueHeaders = (headers: string[]) => {
  const seen = new Map<string, number>()

  return headers.map((header, index) => {
    const fallback = `column_${index + 1}`
    const base = header.trim() || fallback
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)

    return count === 0 ? base : `${base}_${count + 1}`
  })
}

const getHeaders = (rows: string[][], headerRow: boolean) => {
  const maxColumns = rows[0]?.length ?? 0
  if (!headerRow) {
    return Array.from({ length: maxColumns }, (_, index) => `column_${index + 1}`)
  }

  return uniqueHeaders(rows[0] ?? [])
}

const getDataRows = (rows: string[][], headerRow: boolean) => (headerRow ? rows.slice(1) : rows)

const toRecords = (normalizedRows: string[][], headerRow: boolean) => {
  const headers = getHeaders(normalizedRows, headerRow)
  const dataRows = getDataRows(normalizedRows, headerRow)

  return dataRows.map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))
  )
}

const quoteCsvField = (field: string, delimiter: string) => {
  if (!field.includes(delimiter) && !field.includes('"') && !/[\r\n]/.test(field)) return field
  return `"${field.replaceAll('"', '""')}"`
}

const toDelimited = (rows: string[][], delimiter: string) =>
  rows.map(row => row.map(field => quoteCsvField(field, delimiter)).join(delimiter)).join('\n')

const escapeMarkdownCell = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim()

const toMarkdown = (normalizedRows: string[][], headerRow: boolean) => {
  const headers = getHeaders(normalizedRows, headerRow)
  const dataRows = getDataRows(normalizedRows, headerRow)

  if (!headers.length) return ''

  return [
    `| ${headers.map(escapeMarkdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...dataRows.map(row => `| ${row.map(escapeMarkdownCell).join(' | ')} |`)
  ].join('\n')
}

const buildOutput = (
  normalizedRows: string[][],
  format: OutputFormat,
  headerRow: boolean,
  delimiter: string
) => {
  if (format === 'json') return JSON.stringify(toRecords(normalizedRows, headerRow), null, 2)
  if (format === 'markdown') return toMarkdown(normalizedRows, headerRow)
  if (format === 'tsv') return toDelimited(normalizedRows, '\t')
  return toDelimited(normalizedRows, delimiter)
}

const isNumericValue = (value: string) => {
  const normalized = value.trim().replaceAll(',', '')
  return normalized !== '' && Number.isFinite(Number(normalized))
}

const isBooleanValue = (value: string) => /^(true|false|yes|no|0|1)$/i.test(value.trim())

const getDuplicateHeaderCount = (headers: string[]) => {
  const counts = new Map<string, number>()

  headers.forEach(header => {
    const key = header.trim().toLowerCase()
    if (!key) return
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return [...counts.values()].filter(count => count > 1).length
}

const getColumnProfiles = (headers: string[], rows: string[][]): ColumnProfile[] =>
  headers.slice(0, MAX_CSV_COLUMN_PROFILES).map((header, columnIndex) => {
    const values = rows.map(row => row[columnIndex] ?? '')
    const nonEmptyValues = values.map(value => value.trim()).filter(Boolean)

    return {
      booleanCount: nonEmptyValues.filter(isBooleanValue).length,
      emptyCount: values.length - nonEmptyValues.length,
      name: header,
      numericCount: nonEmptyValues.filter(isNumericValue).length,
      samples: [...new Set(nonEmptyValues)].slice(0, 3),
      uniqueCount: new Set(nonEmptyValues).size
    }
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

const CsvClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_CSV)
  const [delimiterOption, setDelimiterOption] = useState<DelimiterOption>('auto')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('json')
  const [headerRow, setHeaderRow] = useState(true)
  const [trimCells, setTrimCells] = useState(true)
  const [skipEmptyRows, setSkipEmptyRows] = useState(true)
  const [previewQuery, setPreviewQuery] = useState('')
  const deferredInput = useDeferredValue(input)
  const deferredPreviewQuery = useDeferredValue(previewQuery)

  const options = useMemo(
    () => ({ headerRow, skipEmptyRows, trimCells }),
    [headerRow, skipEmptyRows, trimCells]
  )
  const safeInput = useMemo(
    () =>
      deferredInput.length > MAX_CSV_INPUT_CHARS
        ? deferredInput.slice(0, MAX_CSV_INPUT_CHARS)
        : deferredInput,
    [deferredInput]
  )
  const isInputTruncated = deferredInput.length > MAX_CSV_INPUT_CHARS
  const parsed = useMemo(() => parseCsv(safeInput, delimiterOption), [delimiterOption, safeInput])
  const normalizedRows = useMemo(() => normalizeRows(parsed.rows, options), [options, parsed.rows])
  const output = useMemo(() => {
    if (parsed.error || !normalizedRows.length) return ''
    return buildOutput(normalizedRows, outputFormat, headerRow, parsed.delimiter)
  }, [headerRow, normalizedRows, outputFormat, parsed.delimiter, parsed.error])

  const headers = useMemo(() => getHeaders(normalizedRows, headerRow), [headerRow, normalizedRows])
  const dataRows = useMemo(
    () => getDataRows(normalizedRows, headerRow),
    [headerRow, normalizedRows]
  )
  const previewRows = useMemo(() => {
    const query = deferredPreviewQuery.trim().toLowerCase()
    if (!query) return dataRows

    return dataRows.filter(row => row.some(cell => cell.toLowerCase().includes(query)))
  }, [dataRows, deferredPreviewQuery])
  const hasOutput = Boolean(output)
  const delimiterKey = delimiterLabelKey(parsed.delimiter)
  const metrics = useMemo(
    () => ({
      cells: formatCsvNumber(dataRows.length * headers.length),
      columns: formatCsvNumber(headers.length),
      filtered: formatCsvNumber(previewRows.length),
      rows: formatCsvNumber(dataRows.length)
    }),
    [dataRows.length, headers.length, previewRows.length]
  )
  const quality = useMemo(() => {
    const sourceHeaderRow = headerRow ? (normalizedRows[0] ?? []) : []
    const expectedColumns = parsed.rows[0]?.length ?? headers.length
    const unevenRows = parsed.rows.filter(row => row.length !== expectedColumns).length
    const emptyCells = dataRows.reduce(
      (total, row) => total + row.filter(cell => !cell.trim()).length,
      0
    )

    return {
      duplicateHeaders: headerRow ? getDuplicateHeaderCount(sourceHeaderRow) : 0,
      emptyCells,
      emptyHeaders: headerRow ? sourceHeaderRow.filter(header => !header.trim()).length : 0,
      unevenRows
    }
  }, [dataRows, headerRow, headers.length, normalizedRows, parsed.rows])
  const columnProfiles = useMemo(() => getColumnProfiles(headers, dataRows), [dataRows, headers])
  const qualityIssueCount =
    quality.duplicateHeaders + quality.emptyHeaders + quality.unevenRows + quality.emptyCells

  const handleDownload = () => {
    if (!output) return

    const extension = outputFormat === 'markdown' ? 'md' : outputFormat
    const type =
      outputFormat === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8'
    downloadText(output, `daily-tools-csv.${extension}`, type)
  }

  const handleReset = () => {
    setInput(SAMPLE_CSV)
    setDelimiterOption('auto')
    setOutputFormat('json')
    setHeaderRow(true)
    setTrimCells(true)
    setSkipEmptyRows(true)
    setPreviewQuery('')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.csv')}
              </CardTitle>
              <CardDescription>{t('app.format.csv.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={handleReset}>
                {t('public.reset')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setInput('')
                  setPreviewQuery('')
                }}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="csv-input">{t('app.format.csv.input')}</Label>
              <Textarea
                id="csv-input"
                value={input}
                onChange={event => setInput(event.target.value)}
                rows={12}
                className="min-h-[280px] resize-y font-mono"
                placeholder="name,email&#10;Ada,ada@example.com"
              />
              <div className="flex flex-wrap gap-2">
                {(['contacts', 'finance', 'tabular'] as const).map(sample => (
                  <Button
                    key={sample}
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    onClick={() => setInput(SAMPLE_CSVS[sample])}
                  >
                    {t(`app.format.csv.sample.${sample}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-3">
                  <Label htmlFor="csv-delimiter">{t('app.format.csv.delimiter')}</Label>
                  <Select
                    id="csv-delimiter"
                    value={delimiterOption}
                    onChange={event => setDelimiterOption(event.target.value as DelimiterOption)}
                  >
                    {(['auto', 'comma', 'semicolon', 'tab', 'pipe'] as const).map(option => (
                      <option key={option} value={option}>
                        {t(`app.format.csv.delimiter.${option}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="csv-output-format">{t('app.format.csv.output_format')}</Label>
                  <Select
                    id="csv-output-format"
                    value={outputFormat}
                    onChange={event => setOutputFormat(event.target.value as OutputFormat)}
                  >
                    {(['json', 'markdown', 'tsv', 'csv'] as const).map(format => (
                      <option key={format} value={format}>
                        {t(`app.format.csv.output.${format}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="glass-input rounded-xl p-3">
                <Checkbox
                  checked={headerRow}
                  onChange={event => setHeaderRow(event.target.checked)}
                  label={t('app.format.csv.header_row')}
                />
                <Checkbox
                  checked={trimCells}
                  onChange={event => setTrimCells(event.target.checked)}
                  label={t('app.format.csv.trim_cells')}
                />
                <Checkbox
                  checked={skipEmptyRows}
                  onChange={event => setSkipEmptyRows(event.target.checked)}
                  label={t('app.format.csv.skip_empty')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CsvMetric label={t('app.format.csv.rows')} value={metrics.rows} />
                <CsvMetric label={t('app.format.csv.columns')} value={metrics.columns} />
                <CsvMetric
                  label={t('app.format.csv.detected')}
                  value={t(`app.format.csv.delimiter.${delimiterKey}`)}
                />
                <CsvMetric label={t('app.format.csv.cells')} value={metrics.cells} />
                <CsvMetric label={t('app.format.csv.filtered')} value={metrics.filtered} />
              </div>

              {parsed.error && (
                <p className="text-sm text-[var(--error)]">
                  {t(`app.format.csv.error.${parsed.error}`)}
                </p>
              )}

              {isInputTruncated && (
                <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                  {t('app.format.csv.warning.truncated', {
                    limit: formatCsvNumber(MAX_CSV_INPUT_CHARS)
                  })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.csv.quality')}
            </CardTitle>
            <CardDescription>{t('app.format.csv.quality_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <CsvMetric
                label={t('app.format.csv.duplicate_headers')}
                value={formatCsvNumber(quality.duplicateHeaders)}
              />
              <CsvMetric
                label={t('app.format.csv.empty_headers')}
                value={formatCsvNumber(quality.emptyHeaders)}
              />
              <CsvMetric
                label={t('app.format.csv.uneven_rows')}
                value={formatCsvNumber(quality.unevenRows)}
              />
              <CsvMetric
                label={t('app.format.csv.empty_cells')}
                value={formatCsvNumber(quality.emptyCells)}
              />
            </div>
            {qualityIssueCount ? (
              <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
                {t('app.format.csv.quality_warning')}
              </p>
            ) : (
              <p className="rounded-lg border border-[var(--success)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success)]">
                {t('app.format.csv.quality_clean')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-[var(--primary)]" />
              {t('app.format.csv.columns_profile')}
            </CardTitle>
            <CardDescription>{t('app.format.csv.columns_profile_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {columnProfiles.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {columnProfiles.map(profile => (
                  <div key={profile.name} className="glass-input min-w-0 rounded-xl p-3">
                    <div className="truncate font-medium text-[var(--text-primary)]">
                      {profile.name}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <span>
                        {t('app.format.csv.unique')}: {formatCsvNumber(profile.uniqueCount)}
                      </span>
                      <span>
                        {t('app.format.csv.empty_cells')}: {formatCsvNumber(profile.emptyCount)}
                      </span>
                      <span>
                        {t('app.format.csv.numeric')}: {formatCsvNumber(profile.numericCount)}
                      </span>
                      <span>
                        {t('app.format.csv.boolean')}: {formatCsvNumber(profile.booleanCount)}
                      </span>
                    </div>
                    <div className="mt-2 truncate font-mono text-xs text-[var(--text-tertiary)]">
                      {profile.samples.length ? profile.samples.join(' · ') : '-'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel-static rounded-xl p-4 text-sm text-[var(--text-secondary)]">
                {t('app.format.csv.columns_profile_empty')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson2 className="h-4 w-4 text-[var(--primary)]" />
                {t('app.format.csv.output_panel')}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!hasOutput}
                  onClick={() => copy(output)}
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
                  {t('app.format.csv.download')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <Textarea
              value={output}
              readOnly
              rows={16}
              className="min-h-[300px] flex-1 resize-none font-mono"
              placeholder={t('app.format.csv.empty')}
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-base">{t('app.format.csv.preview')}</CardTitle>
                <CardDescription>{t('app.format.csv.preview_hint')}</CardDescription>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  value={previewQuery}
                  onChange={event => setPreviewQuery(event.target.value)}
                  placeholder={t('app.format.csv.search')}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {headers.length ? (
              <div className="space-y-3">
                <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[var(--glass-panel-bg)] backdrop-blur-xl">
                      <tr>
                        {headers.map((header, index) => (
                          <th
                            key={`${header}-${index}`}
                            className="whitespace-nowrap px-3 py-2 font-medium text-[var(--text-secondary)]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, MAX_CSV_PREVIEW_ROWS).map((row, rowIndex) => (
                        <tr
                          key={`row-${rowIndex}`}
                          className="border-t border-[var(--border-base)]"
                        >
                          {headers.map((header, columnIndex) => (
                            <td
                              key={`${header}-${columnIndex}`}
                              className="max-w-[220px] truncate px-3 py-2 font-mono text-xs"
                              title={row[columnIndex]}
                            >
                              {row[columnIndex]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!previewRows.length && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('app.format.csv.no_matches')}
                  </p>
                )}
                {previewRows.length > MAX_CSV_PREVIEW_ROWS && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('app.format.csv.preview_more', {
                      count: previewRows.length - MAX_CSV_PREVIEW_ROWS
                    })}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] text-sm text-[var(--text-tertiary)]">
                {t('app.format.csv.empty')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const CsvMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

export default CsvClient
