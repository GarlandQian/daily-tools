'use client'

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  CalendarClock,
  Clock,
  Copy,
  FileText,
  Pause,
  Play,
  RotateCcw,
  TimerReset
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import { useVisibleNow } from '@/hooks/useVisibleNow'

type TimestampUnit = 'seconds' | 'milliseconds'
type TimestampInputUnit = 'auto' | TimestampUnit

interface BatchRow {
  input: string
  iso: string
  local: string
  milliseconds: number
  relative: string
  seconds: number
  unit: TimestampUnit
}

dayjs.extend(utc)
dayjs.extend(timezone)

const MAX_BATCH_ROWS = 80

const TIMEZONE_OPTIONS = [
  'Asia/Shanghai',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney'
]

const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const formatDateTimeLocal = (date: dayjs.ConfigType) => dayjs(date).format('YYYY-MM-DDTHH:mm:ss')
const getCurrentDateTimeLocal = () => formatDateTimeLocal(Date.now())

const parseTimestamp = (value: string, unit: TimestampInputUnit) => {
  const trimmed = value.trim()
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return null

  const timestamp = Number(trimmed)
  if (!Number.isSafeInteger(timestamp)) return null

  const resolvedUnit =
    unit === 'auto' ? (Math.abs(timestamp) >= 100000000000 ? 'milliseconds' : 'seconds') : unit
  const milliseconds = resolvedUnit === 'seconds' ? timestamp * 1000 : timestamp
  const date = dayjs(milliseconds)

  if (!date.isValid()) return null
  return { date, milliseconds, unit: resolvedUnit }
}

const parseDateInput = (value: string, zone: string) => {
  if (!value) return null
  const parsed = dayjs.tz(value, zone)
  if (!parsed.isValid()) return null
  return {
    date: parsed,
    milliseconds: parsed.valueOf(),
    seconds: Math.floor(parsed.valueOf() / 1000)
  }
}

const formatRelative = (targetMilliseconds: number, nowMilliseconds: number) => {
  const diffSeconds = Math.round((targetMilliseconds - nowMilliseconds) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const units = [
    { seconds: 86400, suffix: 'd' },
    { seconds: 3600, suffix: 'h' },
    { seconds: 60, suffix: 'm' },
    { seconds: 1, suffix: 's' }
  ]
  const unit = units.find(item => absSeconds >= item.seconds) ?? units[units.length - 1]
  const value = Math.max(0, Math.round(absSeconds / unit.seconds))
  return diffSeconds >= 0 ? `+${value}${unit.suffix}` : `-${value}${unit.suffix}`
}

const formatZoneDate = (milliseconds: number, zone: string) =>
  dayjs(milliseconds).tz(zone).format('YYYY-MM-DD HH:mm:ss')

const parseBatch = (
  value: string,
  unit: TimestampInputUnit,
  zone: string,
  nowMilliseconds: number
): BatchRow[] =>
  value
    .split(/\r?\n/u)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH_ROWS)
    .map(input => {
      const parsed = parseTimestamp(input, unit)
      if (!parsed) return null
      return {
        input,
        iso: parsed.date.toISOString(),
        local: formatZoneDate(parsed.milliseconds, zone),
        milliseconds: parsed.milliseconds,
        relative: formatRelative(parsed.milliseconds, nowMilliseconds),
        seconds: Math.floor(parsed.milliseconds / 1000),
        unit: parsed.unit
      }
    })
    .filter((row): row is BatchRow => Boolean(row))

const TimestampClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [pausedTimestamp, setPausedTimestamp] = useState<number | null>(null)
  const [unit, setUnit] = useState<TimestampUnit>('seconds')
  const [timestampUnit, setTimestampUnit] = useState<TimestampInputUnit>('auto')
  const [displayZone, setDisplayZone] = useState(getBrowserTimezone)

  const [inputTimestamp, setInputTimestamp] = useState('')
  const [inputDatetime, setInputDatetime] = useState('')
  const [batchInput, setBatchInput] = useState('1704067200\n1704067200000\n4102444800')
  const deferredBatchInput = useDeferredValue(batchInput)

  const isPaused = pausedTimestamp !== null
  const liveTimestamp = useVisibleNow(!isPaused)
  const currentTimestamp = pausedTimestamp ?? liveTimestamp
  const hasCurrentTime = currentTimestamp > 0
  const nowForDerived = hasCurrentTime ? currentTimestamp : 0

  const currentSeconds = useMemo(
    () => (hasCurrentTime ? Math.floor(currentTimestamp / 1000) : 0),
    [currentTimestamp, hasCurrentTime]
  )
  const currentMilliseconds = currentTimestamp
  const displayTimestamp = useMemo(() => {
    if (!hasCurrentTime) return '--'
    return unit === 'seconds' ? currentSeconds : currentMilliseconds
  }, [currentMilliseconds, currentSeconds, hasCurrentTime, unit])

  const currentFormats = useMemo(() => {
    if (!hasCurrentTime) return null
    const local = dayjs(currentTimestamp)
    const zoned = dayjs(currentTimestamp).tz(displayZone)
    return {
      iso: local.toISOString(),
      local: local.format('YYYY-MM-DD HH:mm:ss'),
      offset: zoned.format('Z'),
      rfc: local.toDate().toUTCString(),
      unix: String(currentSeconds),
      utc: local.utc().format('YYYY-MM-DD HH:mm:ss'),
      zone: zoned.format('YYYY-MM-DD HH:mm:ss')
    }
  }, [currentSeconds, currentTimestamp, displayZone, hasCurrentTime])

  const convertedDate = useMemo(() => {
    return parseTimestamp(inputTimestamp, timestampUnit)
  }, [inputTimestamp, timestampUnit])

  const convertedDateRows = useMemo(() => {
    if (!convertedDate) return []
    return [
      {
        label: t('app.converter.timestamp.local'),
        value: convertedDate.date.format('YYYY-MM-DD HH:mm:ss')
      },
      { label: 'UTC', value: convertedDate.date.utc().format('YYYY-MM-DD HH:mm:ss') },
      {
        label: t('app.converter.timestamp.zone_time'),
        value: formatZoneDate(convertedDate.milliseconds, displayZone)
      },
      { label: 'ISO 8601', value: convertedDate.date.toISOString() },
      { label: 'RFC 1123', value: convertedDate.date.toDate().toUTCString() },
      {
        label: t('app.converter.timestamp.relative'),
        value: formatRelative(convertedDate.milliseconds, nowForDerived)
      }
    ]
  }, [convertedDate, displayZone, nowForDerived, t])

  const convertedTimestamp = useMemo(() => {
    return parseDateInput(inputDatetime, displayZone)
  }, [displayZone, inputDatetime])

  const convertedTimestampRows = useMemo(() => {
    if (!convertedTimestamp) return []
    return [
      { label: t('app.converter.timestamp.seconds'), value: convertedTimestamp.seconds },
      { label: t('app.converter.timestamp.milliseconds'), value: convertedTimestamp.milliseconds },
      { label: 'ISO 8601', value: convertedTimestamp.date.toISOString() },
      { label: 'UTC', value: convertedTimestamp.date.utc().format('YYYY-MM-DD HH:mm:ss') },
      {
        label: t('app.converter.timestamp.zone_time'),
        value: convertedTimestamp.date.tz(displayZone).format('YYYY-MM-DD HH:mm:ss')
      }
    ]
  }, [convertedTimestamp, displayZone, t])

  const batchRows = useMemo(
    () => parseBatch(deferredBatchInput, timestampUnit, displayZone, nowForDerived),
    [deferredBatchInput, displayZone, nowForDerived, timestampUnit]
  )
  const batchTruncated =
    deferredBatchInput.split(/\r?\n/u).filter(item => item.trim()).length > MAX_BATCH_ROWS
  const batchCsv = useMemo(
    () =>
      [
        'input,unit,seconds,milliseconds,local,iso,relative',
        ...batchRows.map(row =>
          [row.input, row.unit, row.seconds, row.milliseconds, row.local, row.iso, row.relative]
            .map(value => `"${String(value).replaceAll('"', '""')}"`)
            .join(',')
        )
      ].join('\n'),
    [batchRows]
  )

  const currentSummary = useMemo(() => {
    if (!currentFormats) return ''
    return [
      `${t('app.converter.timestamp.seconds')}: ${currentSeconds}`,
      `${t('app.converter.timestamp.milliseconds')}: ${currentMilliseconds}`,
      `${t('app.converter.timestamp.local')}: ${currentFormats.local}`,
      `UTC: ${currentFormats.utc}`,
      `${displayZone}: ${currentFormats.zone}`,
      `ISO 8601: ${currentFormats.iso}`,
      `RFC 1123: ${currentFormats.rfc}`
    ].join('\n')
  }, [currentFormats, currentMilliseconds, currentSeconds, displayZone, t])

  const timestampError = Boolean(inputTimestamp.trim() && !convertedDate)
  const fillCurrentTimestamp = useCallback(() => {
    const sourceTimestamp = hasCurrentTime ? currentTimestamp : Date.now()
    const sourceSeconds = Math.floor(sourceTimestamp / 1000)
    setInputTimestamp(String(unit === 'seconds' ? sourceSeconds : sourceTimestamp))
    setTimestampUnit(unit)
  }, [currentTimestamp, hasCurrentTime, unit])

  const fillCurrentDateTime = useCallback(() => {
    setInputDatetime(getCurrentDateTimeLocal())
  }, [])

  const togglePaused = useCallback(() => {
    setPausedTimestamp(value =>
      value === null ? (liveTimestamp > 0 ? liveTimestamp : Date.now()) : null
    )
  }, [liveTimestamp])

  const resetZone = useCallback(() => {
    setDisplayZone(getBrowserTimezone())
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[var(--primary)]" />
                {t('app.converter.timestamp.current')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.converter.timestamp.description')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                disabled={!hasCurrentTime}
                onClick={togglePaused}
              >
                {isPaused
                  ? t('app.converter.timestamp.resume')
                  : t('app.converter.timestamp.pause')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                disabled={!currentSummary}
                onClick={() => copy(currentSummary)}
              >
                {t('app.converter.timestamp.copy_summary')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <span
              className={`rounded-xl px-3 py-2 font-mono text-4xl font-semibold tabular-nums text-[var(--text-primary)] md:text-5xl ${
                !isPaused && hasCurrentTime ? 'ring-2 ring-[var(--primary)]/20' : ''
              }`}
            >
              {displayTimestamp}
            </span>
            <div className="min-w-0 pb-2">
              <div className="text-sm text-[var(--text-secondary)]">
                {currentFormats?.local ?? '--'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                {displayZone} {currentFormats ? `UTC${currentFormats.offset}` : ''}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label>{t('app.converter.timestamp.unit')}</Label>
              <RadioGroup
                value={unit}
                onValueChange={v => setUnit(v as TimestampUnit)}
                className="grid grid-cols-2 gap-2"
              >
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="seconds" />
                  <span className="text-sm">{t('app.converter.timestamp.seconds')}</span>
                </label>
                <label className="glass-input flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3">
                  <RadioGroupItem value="milliseconds" />
                  <span className="text-sm">{t('app.converter.timestamp.milliseconds')}</span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label htmlFor="timestamp-zone">{t('app.converter.timestamp.timezone')}</Label>
              <div className="flex gap-2">
                <Select
                  id="timestamp-zone"
                  value={displayZone}
                  onChange={event => setDisplayZone(event.target.value)}
                >
                  {Array.from(new Set([displayZone, ...TIMEZONE_OPTIONS])).map(zone => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('app.converter.timestamp.reset_timezone')}
                  onClick={resetZone}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TimestampValue
              label={t('app.converter.timestamp.seconds')}
              value={hasCurrentTime ? currentSeconds : '--'}
              disabled={!hasCurrentTime}
              onCopy={() => copy(currentSeconds)}
            />
            <TimestampValue
              label={t('app.converter.timestamp.milliseconds')}
              value={hasCurrentTime ? currentMilliseconds : '--'}
              disabled={!hasCurrentTime}
              onCopy={() => copy(currentMilliseconds)}
            />
            <TimestampValue
              label="UTC"
              value={currentFormats?.utc ?? '--'}
              disabled={!currentFormats}
              onCopy={() => copy(currentFormats?.utc ?? '')}
            />
            <TimestampValue
              label="ISO 8601"
              value={currentFormats?.iso ?? '--'}
              disabled={!currentFormats}
              onCopy={() => copy(currentFormats?.iso ?? '')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TimerReset className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.timestamp.to_date')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="space-y-3">
              <Label htmlFor="timestamp-input">{t('app.converter.timestamp.timestamp')}</Label>
              <Input
                id="timestamp-input"
                inputMode="numeric"
                value={inputTimestamp}
                onChange={event => setInputTimestamp(event.target.value)}
                placeholder={t('app.converter.timestamp.input_ts')}
                className="h-12 font-mono text-base"
              />
            </div>

            <div className="space-y-3">
              <Label>{t('app.converter.timestamp.unit')}</Label>
              <RadioGroup
                value={timestampUnit}
                onValueChange={value => setTimestampUnit(value as TimestampInputUnit)}
                className="flex flex-wrap gap-3"
              >
                {(['auto', 'seconds', 'milliseconds'] as const).map(item => (
                  <label
                    key={item}
                    className="flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5"
                  >
                    <RadioGroupItem value={item} />
                    <span className="text-sm">{t(`app.converter.timestamp.unit.${item}`)}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                icon={<Clock className="h-4 w-4" />}
                onClick={fillCurrentTimestamp}
              >
                {t('app.converter.timestamp.use_now')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setInputTimestamp('')}
              >
                {t('public.clear')}
              </Button>
            </div>

            {timestampError && (
              <p className="text-sm text-[var(--error)]">{t('app.converter.timestamp.invalid')}</p>
            )}

            {convertedDate && (
              <div className="glass-panel flex flex-col gap-3 rounded-xl border border-[var(--border-base)] p-4">
                {convertedDateRows.map(row => (
                  <TimestampResultRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    onCopy={() => copy(row.value)}
                  />
                ))}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {t('app.converter.timestamp.detected_unit', {
                    unit: t(`app.converter.timestamp.unit.${convertedDate.unit}`)
                  })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-[var(--primary)]" />
              {t('app.converter.timestamp.to_ts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="space-y-3">
              <Label htmlFor="datetime-input">{t('app.converter.timestamp.datetime')}</Label>
              <Input
                id="datetime-input"
                type="datetime-local"
                step={1}
                value={inputDatetime}
                onChange={event => setInputDatetime(event.target.value)}
                className="h-12 text-base"
              />
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('app.converter.timestamp.datetime_zone_hint', { zone: displayZone })}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                icon={<Clock className="h-4 w-4" />}
                onClick={fillCurrentDateTime}
              >
                {t('app.converter.timestamp.use_now')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setInputDatetime('')}
              >
                {t('public.clear')}
              </Button>
            </div>

            {convertedTimestamp && (
              <div className="glass-panel flex flex-col gap-3 rounded-xl border border-[var(--border-base)] p-4">
                {convertedTimestampRows.map(row => (
                  <TimestampResultRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    onCopy={() => copy(row.value)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-[var(--primary)]" />
                {t('app.converter.timestamp.batch')}
              </CardTitle>
              <CardDescription className="mt-2">
                {t('app.converter.timestamp.batch_hint', { limit: MAX_BATCH_ROWS })}
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<Copy className="h-4 w-4" />}
              disabled={!batchRows.length}
              onClick={() => copy(batchCsv)}
            >
              {t('app.converter.timestamp.copy_csv')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={batchInput}
            onChange={event => setBatchInput(event.target.value)}
            rows={4}
            className="resize-none font-mono"
            placeholder={t('app.converter.timestamp.batch_placeholder')}
          />

          {batchTruncated && (
            <p className="rounded-xl border border-[var(--warning)] bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning)]">
              {t('app.converter.timestamp.batch_truncated', { limit: MAX_BATCH_ROWS })}
            </p>
          )}

          <div className="glass-clip overflow-auto rounded-xl border border-[var(--border-base)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--glass-panel-bg)]">
                <tr>
                  <th className="px-3 py-2">{t('app.converter.timestamp.timestamp')}</th>
                  <th className="px-3 py-2">{t('app.converter.timestamp.unit')}</th>
                  <th className="px-3 py-2">{t('app.converter.timestamp.zone_time')}</th>
                  <th className="px-3 py-2">ISO</th>
                  <th className="px-3 py-2">{t('app.converter.timestamp.relative')}</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.length ? (
                  batchRows.map(row => (
                    <tr
                      key={`${row.input}-${row.milliseconds}`}
                      className="border-t border-[var(--border-base)]"
                    >
                      <td className="px-3 py-2 font-mono">{row.input}</td>
                      <td className="px-3 py-2">{t(`app.converter.timestamp.unit.${row.unit}`)}</td>
                      <td className="px-3 py-2 font-mono">{row.local}</td>
                      <td className="break-all px-3 py-2 font-mono">{row.iso}</td>
                      <td className="px-3 py-2 font-mono">{row.relative}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                      {t('app.converter.timestamp.batch_empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const TimestampValue = ({
  disabled,
  label,
  onCopy,
  value
}: {
  disabled?: boolean
  label: string
  onCopy: () => void
  value: number | string
}) => (
  <div className="glass-input flex items-center justify-between gap-3 rounded-xl p-3">
    <div className="min-w-0">
      <div className="text-xs font-medium text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 truncate font-mono text-base font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
    </div>
    <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onCopy}>
      <Copy className="h-4 w-4" />
    </Button>
  </div>
)

const TimestampResultRow = ({
  label,
  onCopy,
  value
}: {
  label: string
  onCopy: () => void
  value: number | string
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="text-xs font-medium text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 break-all font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
    </div>
    <Button type="button" variant="ghost" size="icon" onClick={onCopy}>
      <Copy className="h-4 w-4" />
    </Button>
  </div>
)

export default TimestampClient
