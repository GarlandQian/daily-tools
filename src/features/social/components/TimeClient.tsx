'use client'

import { useRafInterval } from 'ahooks'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { Clock, Globe } from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { tzListMap, type tzMap } from '@/const/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const TimeClient = () => {
  const { t } = useTranslation()
  const [timeZonelist, setTimeZonelist] = useState<string[]>([])
  const clockRef = useRef<HTMLSpanElement>(null)
  const dateRef = useRef<HTMLSpanElement>(null)
  const chipRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
  const [colonVisible, setColonVisible] = useState(true)

  // Update clock every second
  useRafInterval(() => {
    const now = dayjs()

    if (clockRef.current) {
      const h = now.format('HH')
      const m = now.format('mm')
      const s = now.format('ss')
      clockRef.current.innerHTML = `${h}<span class="colon-pulse">${colonVisible ? ':' : ' '}</span>${m}<span class="colon-pulse">${colonVisible ? ':' : ' '}</span>${s}`
    }

    if (dateRef.current) {
      dateRef.current.textContent = now.format('dddd, MMMM D, YYYY')
    }

    setColonVisible(prev => !prev)

    // Update timezone chips
    chipRefs.current.forEach((el, tz) => {
      const tzData = tzListMap[tz as tzMap]
      if (tzData && el) {
        el.textContent = dayjs().tz(tzData.value).format('HH:mm:ss')
      }
    })
  }, 1000)

  const tzKeys = useMemo(() => {
    if (timeZonelist.length === 0) {
      return Object.keys(tzListMap)
    }
    return timeZonelist
  }, [timeZonelist])

  const onTimeZonelistChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = e.target.selectedOptions
    const values = Array.from(options).map(o => o.value)
    setTimeZonelist(values)
  }

  // Featured timezones for the top row
  const featuredZones: { key: tzMap; short: string }[] = [
    { key: 'chinaStandardTime', short: 'Beijing' },
    { key: 'easternTime', short: 'New York' },
    { key: 'greenwichMeanTime', short: 'London' },
    { key: 'japanStandardTime', short: 'Tokyo' },
    { key: 'centralEuropeanTime', short: 'Berlin' },
    { key: 'australianEasternTime', short: 'Sydney' }
  ]

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Hero clock */}
      <Card className="glass-glow-primary">
        <CardContent className="py-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Local Time</span>
          </div>
          <span
            ref={clockRef}
            className="text-5xl md:text-6xl font-mono font-semibold tabular-nums text-[var(--text-primary)] tracking-tight"
          >
            {dayjs().format('HH:mm:ss')}
          </span>
          <span ref={dateRef} className="text-base text-[var(--text-secondary)] mt-1">
            {dayjs().format('dddd, MMMM D, YYYY')}
          </span>
        </CardContent>
      </Card>

      {/* Featured timezone chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {featuredZones.map(zone => (
          <div
            key={zone.key}
            className="glass-float rounded-xl p-3 flex flex-col items-center gap-1 relative overflow-hidden"
          >
            <div className="glass-specular" />
            <span className="text-xs font-medium text-[var(--text-tertiary)] z-10">
              {zone.short}
            </span>
            <span
              ref={el => {
                if (el) chipRefs.current.set(zone.key, el)
              }}
              className="text-lg font-mono font-semibold tabular-nums text-[var(--text-primary)] z-10"
            >
              {dayjs().tz(tzListMap[zone.key].value).format('HH:mm:ss')}
            </span>
          </div>
        ))}
      </div>

      {/* Timezone filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--text-secondary)]" />
            <CardTitle>{t('app.social.time.timezone')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Filter timezones (hold Ctrl/Cmd to multi-select, or leave empty for all)</Label>
            <Select
              multiple
              size={5}
              value={timeZonelist}
              onChange={onTimeZonelistChange}
              className="h-auto min-h-[120px]"
            >
              {Object.keys(tzListMap).map(key => (
                <option key={key} value={key}>
                  {tzListMap[key as tzMap].label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* All timezone grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tzKeys.map(tz => {
            const tzData = tzListMap[tz as tzMap]
            if (!tzData) return null
            return (
              <div
                key={tz}
                className="glass-panel rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden"
              >
                <div className="glass-specular" />
                <span className="text-xs text-[var(--text-tertiary)] truncate z-10">
                  {tzData.label}
                </span>
                <span
                  ref={el => {
                    if (el) chipRefs.current.set(tz, el)
                  }}
                  className="text-xl font-mono font-semibold tabular-nums text-[var(--text-primary)] z-10"
                >
                  {dayjs().tz(tzData.value).format('HH:mm:ss')}
                </span>
                <span className="text-xs text-[var(--text-secondary)] z-10">
                  {dayjs().tz(tzData.value).format('YYYY-MM-DD')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default TimeClient
