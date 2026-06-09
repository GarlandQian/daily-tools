'use client'

import {
  Binary,
  ClipboardList,
  Copy,
  Download,
  Fingerprint,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type ExportFormat = 'json' | 'csv' | 'sql'

interface UuidInfo {
  bytes: string[]
  compact: string
  error: string | null
  groups: string[]
  isMax: boolean
  isNil: boolean
  normalized: string
  timestamp: string | null
  urn: string
  variant: string
  version: string
}

const SAMPLE_UUID = '018f6b7a-8b5f-7cc2-a2a3-79c5b6f8d901'
const SAMPLE_BATCH = [
  '018f6b7a-8b5f-7cc2-a2a3-79c5b6f8d901',
  '550e8400-e29b-41d4-a716-446655440000',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff'
].join('\n')
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_EPOCH_OFFSET = BigInt('122192928000000000')
const MAX_BATCH_LINES = 200

const normalizeUuid = (value: string) => {
  const compact = value
    .trim()
    .replace(/^urn:uuid:/i, '')
    .replace(/[{}]/g, '')
    .replaceAll('-', '')
    .toLowerCase()

  if (!/^[0-9a-f]{32}$/.test(compact)) return null
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

const getVariant = (hex: string) => {
  const value = Number.parseInt(hex[16], 16)
  if ((value & 0b1000) === 0) return 'ncs'
  if ((value & 0b1100) === 0b1000) return 'rfc4122'
  if ((value & 0b1110) === 0b1100) return 'microsoft'
  return 'future'
}

const getVersion = (normalized: string) => normalized[14]

const parseV1Timestamp = (normalized: string) => {
  const compact = normalized.replaceAll('-', '')
  const timeLow = compact.slice(0, 8)
  const timeMid = compact.slice(8, 12)
  const timeHigh = compact.slice(13, 16)
  const timestamp = BigInt(`0x${timeHigh}${timeMid}${timeLow}`)
  const unixMillis = Number((timestamp - UUID_EPOCH_OFFSET) / BigInt(10000))
  if (!Number.isFinite(unixMillis) || unixMillis < 0) return null
  return new Date(unixMillis).toISOString()
}

const parseV7Timestamp = (normalized: string) => {
  const compact = normalized.replaceAll('-', '')
  const unixMillis = Number(BigInt(`0x${compact.slice(0, 12)}`))
  if (!Number.isFinite(unixMillis) || unixMillis <= 0) return null
  return new Date(unixMillis).toISOString()
}

const inspectUuid = (value: string): UuidInfo => {
  const normalized = normalizeUuid(value)
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    return {
      bytes: [],
      compact: '',
      error: 'invalid',
      groups: [],
      isMax: false,
      isNil: false,
      normalized: '',
      timestamp: null,
      urn: '',
      variant: 'unknown',
      version: 'unknown'
    }
  }

  const compact = normalized.replaceAll('-', '')
  const version = getVersion(normalized)
  const variant = getVariant(compact)
  const isNil = compact === '0'.repeat(32)
  const isMax = compact === 'f'.repeat(32)
  const timestamp =
    version === '1'
      ? parseV1Timestamp(normalized)
      : version === '7'
        ? parseV7Timestamp(normalized)
        : null

  return {
    bytes: compact.match(/.{1,2}/g) ?? [],
    compact,
    error: null,
    groups: normalized.split('-'),
    isMax,
    isNil,
    normalized,
    timestamp,
    urn: `urn:uuid:${normalized}`,
    variant,
    version
  }
}

const versionKey = (version: string) => {
  if (['1', '3', '4', '5', '6', '7', '8'].includes(version)) return version
  return 'unknown'
}

const csvEscape = (value: string | number | null) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildBatchExport = (items: UuidInfo[], format: ExportFormat) => {
  const validItems = items.filter(item => !item.error)
  if (format === 'json') {
    return JSON.stringify(
      validItems.map(item => ({
        uuid: item.normalized,
        version: item.version,
        variant: item.variant,
        timestamp: item.timestamp,
        compact: item.compact,
        urn: item.urn
      })),
      null,
      2
    )
  }

  if (format === 'sql') {
    return validItems
      .map(item => `('${item.normalized}', ${item.version}, '${item.variant}')`)
      .join(',\n')
  }

  const rows = validItems.map(item =>
    [item.normalized, item.version, item.variant, item.timestamp, item.compact, item.urn]
      .map(csvEscape)
      .join(',')
  )
  return ['uuid,version,variant,timestamp,compact,urn', ...rows].join('\n')
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

const UuidInspectorClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_UUID)
  const [batchInput, setBatchInput] = useState(SAMPLE_BATCH)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [uppercase, setUppercase] = useState(false)
  const [showInvalidRows, setShowInvalidRows] = useState(true)

  const info = useMemo(() => inspectUuid(input), [input])
  const displayUuid = uppercase ? info.normalized.toUpperCase() : info.normalized
  const displayCompact = uppercase ? info.compact.toUpperCase() : info.compact
  const displayUrn = uppercase ? info.urn.toUpperCase() : info.urn
  const batchRows = useMemo(
    () =>
      batchInput
        .split(/\r?\n|,|\\s+/)
        .map(row => row.trim())
        .filter(Boolean)
        .slice(0, MAX_BATCH_LINES),
    [batchInput]
  )
  const batchInfos = useMemo(() => batchRows.map(inspectUuid), [batchRows])
  const visibleBatchInfos = showInvalidRows ? batchInfos : batchInfos.filter(item => !item.error)
  const versionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    batchInfos.forEach(item => {
      const key = item.error ? 'invalid' : `v${item.version}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([version, count]) => `${version}: ${count}`)
      .join(' · ')
  }, [batchInfos])
  const summary = useMemo(
    () =>
      info.error
        ? ''
        : JSON.stringify(
            {
              uuid: info.normalized,
              version: info.version,
              variant: info.variant,
              timestamp: info.timestamp,
              compact: info.compact,
              urn: info.urn,
              bytes: info.bytes
            },
            null,
            2
          ),
    [info]
  )
  const batchExport = useMemo(
    () => buildBatchExport(batchInfos, exportFormat),
    [batchInfos, exportFormat]
  )
  const validCount = batchInfos.filter(item => !item.error).length
  const invalidCount = batchInfos.length - validCount
  const duplicateCount =
    batchInfos.length - new Set(batchInfos.map(item => item.normalized || item.error)).size

  const reset = () => {
    setInput(SAMPLE_UUID)
    setBatchInput(SAMPLE_BATCH)
    setExportFormat('json')
    setUppercase(false)
    setShowInvalidRows(true)
  }

  const applyBatchFirst = () => {
    const firstValid = batchInfos.find(item => !item.error)
    if (firstValid) setInput(firstValid.normalized)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.uuid')}
              </CardTitle>
              <CardDescription>{t('app.converter.uuid.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                disabled={!summary}
                onClick={() => copy(summary)}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <UuidMetric label={t('app.converter.uuid.metric.valid')} value={String(validCount)} />
            <UuidMetric
              label={t('app.converter.uuid.metric.invalid')}
              value={String(invalidCount)}
            />
            <UuidMetric
              label={t('app.converter.uuid.metric.duplicates')}
              value={String(Math.max(0, duplicateCount))}
            />
            <UuidMetric
              label={t('app.converter.uuid.metric.batch')}
              value={String(batchInfos.length)}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="uuid-input">{t('app.converter.uuid.input')}</Label>
            <Input
              id="uuid-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono"
            />
          </div>

          {info.error ? (
            <p className="rounded-xl border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
              {t('app.converter.uuid.invalid')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <UuidMetric
                label={t('app.converter.uuid.version')}
                value={t(`app.converter.uuid.version.${versionKey(info.version)}`)}
              />
              <UuidMetric
                label={t('app.converter.uuid.variant')}
                value={t(`app.converter.uuid.variant.${info.variant}`)}
              />
              <UuidMetric
                label={t('app.converter.uuid.kind')}
                value={
                  info.isNil
                    ? t('app.converter.uuid.nil')
                    : info.isMax
                      ? t('app.converter.uuid.max')
                      : t('app.converter.uuid.standard')
                }
              />
              <UuidMetric label={t('app.converter.uuid.bytes')} value={String(info.bytes.length)} />
            </div>
          )}
        </CardContent>
      </Card>

      {!info.error && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Binary className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.uuid.layout')}
              </CardTitle>
              <CardDescription>{t('app.converter.uuid.layout_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {info.groups.map((group, index) => (
                  <div key={`${group}-${index}`} className="glass-input rounded-xl p-3">
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {t('app.converter.uuid.group')} {index + 1}
                    </p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {uppercase ? group.toUpperCase() : group}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <CopyBox
                  label={t('app.converter.uuid.copy_normalized')}
                  value={displayUuid}
                  onCopy={copy}
                />
                <CopyBox
                  label={t('app.converter.uuid.compact')}
                  value={displayCompact}
                  onCopy={copy}
                />
                <CopyBox label={t('app.converter.uuid.urn')} value={displayUrn} onCopy={copy} />
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {info.bytes.map((byte, index) => (
                  <div
                    key={`${byte}-${index}`}
                    className="glass-input rounded-lg p-2 text-center font-mono text-xs"
                  >
                    {uppercase ? byte.toUpperCase() : byte}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-[360px] flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{t('app.converter.uuid.summary')}</CardTitle>
                <div className="glass-input rounded-xl px-3 py-2">
                  <Checkbox
                    checked={uppercase}
                    onChange={event => setUppercase(event.target.checked)}
                    label={t('app.converter.uuid.uppercase')}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              {info.timestamp && (
                <div className="glass-input rounded-xl p-3">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t(
                      info.version === '7'
                        ? 'app.converter.uuid.timestamp_v7'
                        : 'app.converter.uuid.timestamp'
                    )}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {info.timestamp}
                  </p>
                </div>
              )}
              <Textarea
                value={summary}
                readOnly
                rows={14}
                className="min-h-[280px] flex-1 resize-none font-mono"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.uuid.batch')}
              </CardTitle>
              <CardDescription>{t('app.converter.uuid.batch_hint')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={applyBatchFirst}
                disabled={!validCount}
              >
                {t('app.converter.uuid.use_first')}
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                disabled={!validCount}
                onClick={() =>
                  downloadText(
                    batchExport,
                    `uuid-batch.${exportFormat === 'json' ? 'json' : exportFormat}`,
                    exportFormat === 'json'
                      ? 'application/json;charset=utf-8'
                      : 'text/plain;charset=utf-8'
                  )
                }
              >
                {t('app.converter.uuid.download')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-4">
            <Textarea
              value={batchInput}
              onChange={event => setBatchInput(event.target.value)}
              rows={9}
              className="font-mono"
              placeholder={t('app.converter.uuid.batch_placeholder')}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={exportFormat}
                onChange={event => setExportFormat(event.target.value as ExportFormat)}
              >
                <option value="json">{t('app.converter.uuid.export.json')}</option>
                <option value="csv">{t('app.converter.uuid.export.csv')}</option>
                <option value="sql">{t('app.converter.uuid.export.sql')}</option>
              </Select>
              <div className="glass-input rounded-xl px-3 py-2">
                <Checkbox
                  checked={showInvalidRows}
                  onChange={event => setShowInvalidRows(event.target.checked)}
                  label={t('app.converter.uuid.show_invalid')}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => copy(batchExport)}
                disabled={!validCount}
              >
                {t('public.copy')}
              </Button>
            </div>
            {versionCounts && (
              <p className="text-xs text-[var(--text-tertiary)]">{versionCounts}</p>
            )}
          </div>

          <div className="space-y-3">
            <CardDescription>{t('app.converter.uuid.batch_results')}</CardDescription>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {visibleBatchInfos.length ? (
                visibleBatchInfos.map((item, index) => (
                  <div
                    key={`${item.normalized || 'invalid'}-${index}`}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3"
                  >
                    {item.error ? (
                      <p className="text-sm text-[var(--error)]">
                        {t('app.converter.uuid.invalid')}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="break-all font-mono text-xs font-semibold text-[var(--text-primary)]">
                              {uppercase ? item.normalized.toUpperCase() : item.normalized}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                              v{item.version} · {item.variant}
                              {item.timestamp ? ` · ${item.timestamp}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => copy(item.normalized)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--text-secondary)]">
                  {t('app.converter.uuid.batch_empty')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const UuidMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

const CopyBox = ({
  label,
  onCopy,
  value
}: {
  label: string
  onCopy: (value: string) => void
  value: string
}) => (
  <div className="glass-input rounded-xl p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => onCopy(value)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
    <p className="break-all font-mono text-xs text-[var(--text-primary)]">{value}</p>
  </div>
)

export default UuidInspectorClient
