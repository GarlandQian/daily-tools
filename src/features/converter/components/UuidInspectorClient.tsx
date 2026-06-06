'use client'

import { Binary, Copy, Fingerprint, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface UuidInfo {
  bytes: string[]
  compact: string
  error: string | null
  groups: string[]
  isMax: boolean
  isNil: boolean
  normalized: string
  timestamp: string | null
  variant: string
  version: string
}

const SAMPLE_UUID = '018f6b7a-8b5f-7cc2-a2a3-79c5b6f8d901'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_EPOCH_OFFSET = BigInt('122192928000000000')

const normalizeUuid = (value: string) => {
  const compact = value.trim().replace(/[{}]/g, '').replaceAll('-', '').toLowerCase()
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
      variant: 'unknown',
      version: 'unknown'
    }
  }

  const compact = normalized.replaceAll('-', '')
  const version = getVersion(normalized)
  const variant = getVariant(compact)
  const isNil = compact === '0'.repeat(32)
  const isMax = compact === 'f'.repeat(32)

  return {
    bytes: compact.match(/.{1,2}/g) ?? [],
    compact,
    error: null,
    groups: normalized.split('-'),
    isMax,
    isNil,
    normalized,
    timestamp: version === '1' ? parseV1Timestamp(normalized) : null,
    variant,
    version
  }
}

const versionKey = (version: string) => {
  if (['1', '3', '4', '5', '6', '7', '8'].includes(version)) return version
  return 'unknown'
}

const UuidInspectorClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_UUID)

  const info = useMemo(() => inspectUuid(input), [input])
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
              bytes: info.bytes
            },
            null,
            2
          ),
    [info]
  )

  const reset = () => setInput(SAMPLE_UUID)

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
            <div className="flex flex-wrap gap-3">
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
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                      {group}
                    </p>
                  </div>
                ))}
              </div>

              <div className="glass-input rounded-xl p-4">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.uuid.compact')}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[var(--text-primary)]">
                  {info.compact}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {info.bytes.map((byte, index) => (
                  <div
                    key={`${byte}-${index}`}
                    className="glass-input rounded-lg p-2 text-center font-mono text-xs"
                  >
                    {byte}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-[360px] flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{t('app.converter.uuid.summary')}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => copy(info.normalized)}>
                  {t('app.converter.uuid.copy_normalized')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              {info.timestamp && (
                <div className="glass-input rounded-xl p-3">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t('app.converter.uuid.timestamp')}
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
    </div>
  )
}

const UuidMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default UuidInspectorClient
