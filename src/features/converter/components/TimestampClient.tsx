'use client'

import dayjs from 'dayjs'
import { Clock, Copy, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCopy } from '@/hooks/useCopy'

type TimestampUnit = 'seconds' | 'milliseconds'

const TimestampClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())
  const [isPaused, setIsPaused] = useState(false)
  const [unit, setUnit] = useState<TimestampUnit>('seconds')

  // Input fields
  const [inputTimestamp, setInputTimestamp] = useState('')
  const [inputDatetime, setInputDatetime] = useState('')

  // Update current timestamp every second when not paused
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [isPaused])

  const displayTimestamp = useMemo(() => {
    return unit === 'seconds' ? Math.floor(currentTimestamp / 1000) : currentTimestamp
  }, [currentTimestamp, unit])

  const currentDateStr = useMemo(() => {
    return dayjs(currentTimestamp).format('YYYY-MM-DD HH:mm:ss')
  }, [currentTimestamp])

  // Convert timestamp to date
  const convertedDate = useMemo(() => {
    if (!inputTimestamp) return null
    const ts = parseInt(inputTimestamp)
    if (isNaN(ts)) return null
    const ms = inputTimestamp.length > 10 ? ts : ts * 1000
    return dayjs(ms)
  }, [inputTimestamp])

  // Convert date to timestamp
  const convertedTimestamp = useMemo(() => {
    if (!inputDatetime) return null
    const d = dayjs(inputDatetime)
    if (!d.isValid()) return null
    return {
      seconds: Math.floor(d.valueOf() / 1000),
      milliseconds: d.valueOf()
    }
  }, [inputDatetime])

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Current Timestamp - hero display */}
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

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <RadioGroup
                value={unit}
                onValueChange={v => setUnit(v as TimestampUnit)}
                className="flex gap-3"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <RadioGroupItem value="seconds" />
                  <span className="text-sm">{t('app.converter.timestamp.seconds')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <RadioGroupItem value="milliseconds" />
                  <span className="text-sm">{t('app.converter.timestamp.milliseconds')}</span>
                </label>
              </RadioGroup>

              <div className="flex gap-2 ml-auto">
                <Button
                  icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused
                    ? t('app.converter.timestamp.resume')
                    : t('app.converter.timestamp.pause')}
                </Button>
                <Button icon={<Copy className="w-4 h-4" />} onClick={() => copy(displayTimestamp)}>
                  {t('app.generation.uuid.copy')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Timestamp to Date */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.timestamp.to_date')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              value={inputTimestamp}
              onChange={e => setInputTimestamp(e.target.value)}
              placeholder={t('app.converter.timestamp.input_ts')}
              className="font-mono h-12 text-base"
            />
            {convertedDate && convertedDate.isValid() && (
              <div className="rounded-lg glass-panel border border-[var(--border-base)] p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold font-mono text-[var(--text-primary)]">
                    {convertedDate.format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={<Copy className="w-4 h-4" />}
                    onClick={() => copy(convertedDate.format('YYYY-MM-DD HH:mm:ss'))}
                  />
                </div>
                <span className="text-sm text-[var(--text-secondary)]">
                  {convertedDate.format('dddd, MMMM D, YYYY')}
                </span>
                <span className="text-sm text-[var(--text-tertiary)] font-mono">
                  ISO: {convertedDate.toISOString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date to Timestamp */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.timestamp.to_ts')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              type="datetime-local"
              value={inputDatetime}
              onChange={e => setInputDatetime(e.target.value)}
              className="h-12 text-base"
            />
            {convertedTimestamp && (
              <div className="rounded-lg glass-panel border border-[var(--border-base)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {t('app.converter.timestamp.seconds')}
                    </span>
                    <span className="text-lg font-mono font-semibold text-[var(--text-primary)]">
                      {convertedTimestamp.seconds}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={<Copy className="w-4 h-4" />}
                    onClick={() => copy(convertedTimestamp.seconds)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {t('app.converter.timestamp.milliseconds')}
                    </span>
                    <span className="text-lg font-mono font-semibold text-[var(--text-primary)]">
                      {convertedTimestamp.milliseconds}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={<Copy className="w-4 h-4" />}
                    onClick={() => copy(convertedTimestamp.milliseconds)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TimestampClient
