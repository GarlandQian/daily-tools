'use client'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { CalendarClock, Clock, Copy, Pause, Play, RotateCcw, TimerReset } from 'lucide-react'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCopy } from '@/hooks/useCopy'

type TimestampUnit = 'seconds' | 'milliseconds'
type TimestampInputUnit = 'auto' | TimestampUnit

dayjs.extend(utc)

const formatDateTimeLocal = (date: dayjs.ConfigType) => dayjs(date).format('YYYY-MM-DDTHH:mm:ss')
const getCurrentDateTimeLocal = () => formatDateTimeLocal(Date.now())

let currentTimeSnapshot = 0

const updateCurrentTimeSnapshot = () => {
  currentTimeSnapshot = Date.now()
}

const subscribeCurrentTime = (onStoreChange: () => void) => {
  const update = () => {
    updateCurrentTimeSnapshot()
    onStoreChange()
  }
  const immediate = window.setTimeout(update, 0)
  const interval = window.setInterval(update, 1000)

  return () => {
    window.clearTimeout(immediate)
    window.clearInterval(interval)
  }
}

const getCurrentTimeSnapshot = () => currentTimeSnapshot
const getServerTimeSnapshot = () => 0

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

const TimestampClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const liveTimestamp = useSyncExternalStore(
    subscribeCurrentTime,
    getCurrentTimeSnapshot,
    getServerTimeSnapshot
  )
  const [pausedTimestamp, setPausedTimestamp] = useState<number | null>(null)
  const [unit, setUnit] = useState<TimestampUnit>('seconds')
  const [timestampUnit, setTimestampUnit] = useState<TimestampInputUnit>('auto')

  const [inputTimestamp, setInputTimestamp] = useState('')
  const [inputDatetime, setInputDatetime] = useState('')

  const isPaused = pausedTimestamp !== null
  const currentTimestamp = pausedTimestamp ?? liveTimestamp
  const hasCurrentTime = currentTimestamp > 0

  const currentSeconds = useMemo(
    () => (hasCurrentTime ? Math.floor(currentTimestamp / 1000) : 0),
    [currentTimestamp, hasCurrentTime]
  )
  const currentMilliseconds = currentTimestamp
  const displayTimestamp = useMemo(() => {
    if (!hasCurrentTime) return '--'
    return unit === 'seconds' ? currentSeconds : currentMilliseconds
  }, [currentMilliseconds, currentSeconds, hasCurrentTime, unit])

  const currentDateStr = useMemo(() => {
    if (!hasCurrentTime) return '--'
    return dayjs(currentTimestamp).format('YYYY-MM-DD HH:mm:ss')
  }, [currentTimestamp, hasCurrentTime])

  const convertedDate = useMemo(() => {
    return parseTimestamp(inputTimestamp, timestampUnit)
  }, [inputTimestamp, timestampUnit])

  const convertedTimestamp = useMemo(() => {
    if (!inputDatetime) return null
    const d = dayjs(inputDatetime)
    if (!d.isValid()) return null
    return {
      seconds: Math.floor(d.valueOf() / 1000),
      milliseconds: d.valueOf()
    }
  }, [inputDatetime])

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
    setPausedTimestamp(value => (value === null ? liveTimestamp : null))
  }, [liveTimestamp])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--primary)]" />
            <CardTitle>{t('app.converter.timestamp.current')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Big timestamp display */}
            <div className="flex items-baseline gap-4 flex-wrap">
              <span
                className={`text-4xl md:text-5xl font-mono tabular-nums font-semibold text-[var(--text-primary)] ${
                  !isPaused
                    ? 'animate-pulse ring-2 ring-[var(--primary)]/20 rounded-lg px-3 py-1'
                    : 'px-3 py-1'
                }`}
              >
                {displayTimestamp}
              </span>
              <span className="text-base text-[var(--text-secondary)]">{currentDateStr}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RadioGroup
                value={unit}
                onValueChange={v => setUnit(v as TimestampUnit)}
                className="flex gap-3"
              >
                <label className="flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5">
                  <RadioGroupItem value="seconds" />
                  <span className="text-sm">{t('app.converter.timestamp.seconds')}</span>
                </label>
                <label className="flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5">
                  <RadioGroupItem value="milliseconds" />
                  <span className="text-sm">{t('app.converter.timestamp.milliseconds')}</span>
                </label>
              </RadioGroup>

              <div className="flex flex-wrap gap-3 sm:ml-auto">
                <Button
                  icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  disabled={!hasCurrentTime}
                  onClick={togglePaused}
                >
                  {isPaused
                    ? t('app.converter.timestamp.resume')
                    : t('app.converter.timestamp.pause')}
                </Button>
                <Button
                  icon={<Copy className="w-4 h-4" />}
                  disabled={!hasCurrentTime}
                  onClick={() => copy(displayTimestamp)}
                >
                  {t('public.copy')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
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
                onChange={e => setInputTimestamp(e.target.value)}
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
                icon={<Clock className="w-4 h-4" />}
                onClick={fillCurrentTimestamp}
              >
                {t('app.converter.timestamp.use_now')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => setInputTimestamp('')}
              >
                {t('public.clear')}
              </Button>
            </div>

            {timestampError && (
              <p className="text-sm text-[var(--error)]">{t('app.converter.timestamp.invalid')}</p>
            )}

            {convertedDate && (
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-base)] p-4 glass-panel">
                <TimestampResultRow
                  label={t('app.converter.timestamp.local')}
                  value={convertedDate.date.format('YYYY-MM-DD HH:mm:ss')}
                  onCopy={() => copy(convertedDate.date.format('YYYY-MM-DD HH:mm:ss'))}
                />
                <TimestampResultRow
                  label="UTC"
                  value={convertedDate.date.utc().format('YYYY-MM-DD HH:mm:ss')}
                  onCopy={() => copy(convertedDate.date.utc().format('YYYY-MM-DD HH:mm:ss'))}
                />
                <TimestampResultRow
                  label="ISO 8601"
                  value={convertedDate.date.toISOString()}
                  onCopy={() => copy(convertedDate.date.toISOString())}
                />
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
                onChange={e => setInputDatetime(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                icon={<Clock className="w-4 h-4" />}
                onClick={fillCurrentDateTime}
              >
                {t('app.converter.timestamp.use_now')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => setInputDatetime('')}
              >
                {t('public.clear')}
              </Button>
            </div>

            {convertedTimestamp && (
              <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-base)] p-4 glass-panel">
                <TimestampResultRow
                  label={t('app.converter.timestamp.seconds')}
                  value={convertedTimestamp.seconds}
                  onCopy={() => copy(convertedTimestamp.seconds)}
                />
                <TimestampResultRow
                  label={t('app.converter.timestamp.milliseconds')}
                  value={convertedTimestamp.milliseconds}
                  onCopy={() => copy(convertedTimestamp.milliseconds)}
                />
                <TimestampResultRow
                  label="ISO 8601"
                  value={dayjs(convertedTimestamp.milliseconds).toISOString()}
                  onCopy={() => copy(dayjs(convertedTimestamp.milliseconds).toISOString())}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
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
