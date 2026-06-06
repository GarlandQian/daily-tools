'use client'

import { Copy, Download, FileJson2, RotateCcw, Table2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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

const SAMPLE_CSV = `id,name,email,plan,active
1,Ada Lovelace,ada@example.com,Pro,true
2,Grace Hopper,grace@example.com,Team,true
3,Katherine Johnson,katherine@example.com,Starter,false`

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

const inferDelimiter = (input: string) => {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 8)

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
  const cleaned = rows
    .map(row => (options.trimCells ? row.map(cell => cell.trim()) : row))
    .filter(row => !options.skipEmptyRows || row.some(cell => cell.trim()))

  const maxColumns = cleaned.reduce((max, row) => Math.max(max, row.length), 0)

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

const toRecords = (rows: string[][], options: CsvOptions) => {
  const normalized = normalizeRows(rows, options)
  const headers = getHeaders(normalized, options.headerRow)
  const dataRows = getDataRows(normalized, options.headerRow)

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

const toMarkdown = (rows: string[][], options: CsvOptions) => {
  const normalized = normalizeRows(rows, options)
  const headers = getHeaders(normalized, options.headerRow)
  const dataRows = getDataRows(normalized, options.headerRow)

  if (!headers.length) return ''

  return [
    `| ${headers.map(escapeMarkdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...dataRows.map(row => `| ${row.map(escapeMarkdownCell).join(' | ')} |`)
  ].join('\n')
}

const buildOutput = (
  rows: string[][],
  format: OutputFormat,
  options: CsvOptions,
  delimiter: string
) => {
  const normalized = normalizeRows(rows, options)

  if (format === 'json') return JSON.stringify(toRecords(rows, options), null, 2)
  if (format === 'markdown') return toMarkdown(rows, options)
  if (format === 'tsv') return toDelimited(normalized, '\t')
  return toDelimited(normalized, delimiter)
}

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

  const options = useMemo(
    () => ({ headerRow, skipEmptyRows, trimCells }),
    [headerRow, skipEmptyRows, trimCells]
  )
  const parsed = useMemo(() => parseCsv(input, delimiterOption), [delimiterOption, input])
  const normalizedRows = useMemo(() => normalizeRows(parsed.rows, options), [options, parsed.rows])
  const output = useMemo(() => {
    if (parsed.error || !normalizedRows.length) return ''
    return buildOutput(parsed.rows, outputFormat, options, parsed.delimiter)
  }, [normalizedRows.length, options, outputFormat, parsed])

  const headers = useMemo(() => getHeaders(normalizedRows, headerRow), [headerRow, normalizedRows])
  const dataRows = useMemo(
    () => getDataRows(normalizedRows, headerRow),
    [headerRow, normalizedRows]
  )
  const hasOutput = Boolean(output)
  const delimiterKey = delimiterLabelKey(parsed.delimiter)

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
                onClick={() => setInput('')}
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
                <CsvMetric label={t('app.format.csv.rows')} value={String(dataRows.length)} />
                <CsvMetric label={t('app.format.csv.columns')} value={String(headers.length)} />
                <CsvMetric
                  label={t('app.format.csv.detected')}
                  value={t(`app.format.csv.delimiter.${delimiterKey}`)}
                />
                <CsvMetric
                  label={t('app.format.csv.cells')}
                  value={String(dataRows.length * headers.length)}
                />
              </div>

              {parsed.error && (
                <p className="text-sm text-[var(--error)]">
                  {t(`app.format.csv.error.${parsed.error}`)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardTitle className="text-base">{t('app.format.csv.preview')}</CardTitle>
            <CardDescription>{t('app.format.csv.preview_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            {headers.length ? (
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
                    {dataRows.slice(0, 8).map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-t border-[var(--border-base)]">
                        {headers.map((header, columnIndex) => (
                          <td
                            key={`${header}-${columnIndex}`}
                            className="px-3 py-2 font-mono text-xs"
                          >
                            {row[columnIndex]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
