'use client'

import { useRafInterval } from 'ahooks'
import dayjs, { type Dayjs } from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { Clock3, Globe2, RotateCcw, Search, TimerReset } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tzListMap, type tzMap } from '@/const/timezone'
import { cn } from '@/lib/utils'

dayjs.extend(utc)
dayjs.extend(timezone)

type ZoneGroup =
  | 'africa'
  | 'all'
  | 'america'
  | 'antarctica'
  | 'asia'
  | 'atlantic'
  | 'australia'
  | 'europe'
  | 'indian'
  | 'other'
  | 'pacific'

interface FeaturedZone {
  key: tzMap
  group: Exclude<ZoneGroup, 'all'>
}

interface WorldZone {
  group: Exclude<ZoneGroup, 'all'>
  key: string
  label: string
  searchable: string
  value: string
}

const featuredZones: FeaturedZone[] = [
  { key: 'chinaStandardTime', group: 'asia' },
  { key: 'japanStandardTime', group: 'asia' },
  { key: 'greenwichMeanTime', group: 'europe' },
  { key: 'centralEuropeanTime', group: 'europe' },
  { key: 'easternTime', group: 'america' },
  { key: 'pacificTime', group: 'america' },
  { key: 'australianEasternTime', group: 'pacific' },
  { key: 'newZealandTime', group: 'pacific' }
]

const groupOptionValues: ZoneGroup[] = [
  'all',
  'asia',
  'europe',
  'america',
  'africa',
  'australia',
  'pacific',
  'atlantic',
  'indian',
  'antarctica',
  'other'
]

const fallbackTimezoneIds = Array.from(
  new Set(Object.values(tzListMap).map(timezone => timezone.value))
).sort((a, b) => a.localeCompare(b))

const getZoneGroup = (zoneId: string): Exclude<ZoneGroup, 'all'> => {
  const region = zoneId.split('/')[0]?.toLowerCase()

  switch (region) {
    case 'africa':
    case 'america':
    case 'antarctica':
    case 'asia':
    case 'atlantic':
    case 'australia':
    case 'europe':
    case 'indian':
    case 'pacific':
      return region
    default:
      return 'other'
  }
}

const getSupportedTimezoneIds = () => {
  if (typeof Intl.supportedValuesOf !== 'function') {
    return fallbackTimezoneIds
  }

  try {
    return Array.from(
      new Set([...Intl.supportedValuesOf('timeZone'), ...fallbackTimezoneIds])
    ).sort((a, b) => a.localeCompare(b))
  } catch {
    return fallbackTimezoneIds
  }
}

const getRegionLabel = (group: Exclude<ZoneGroup, 'all'>, language: string) => {
  const labels: Record<Exclude<ZoneGroup, 'all'>, { cn: string; en: string }> = {
    africa: { cn: '非洲', en: 'Africa' },
    america: { cn: '美洲', en: 'Americas' },
    antarctica: { cn: '南极洲', en: 'Antarctica' },
    asia: { cn: '亚洲', en: 'Asia' },
    atlantic: { cn: '大西洋', en: 'Atlantic' },
    australia: { cn: '澳大利亚', en: 'Australia' },
    europe: { cn: '欧洲', en: 'Europe' },
    indian: { cn: '印度洋', en: 'Indian Ocean' },
    other: { cn: '其他', en: 'Other' },
    pacific: { cn: '太平洋', en: 'Pacific' }
  }

  return language === 'cn' ? labels[group].cn : labels[group].en
}

const formatWorldTimezoneLabel = (zoneId: string, language: string) => {
  const group = getZoneGroup(zoneId)
  const region = getRegionLabel(group, language)
  const city = zoneId.split('/').slice(1).join(' / ').replaceAll('_', ' ')

  if (!city) return region
  return language === 'cn' ? `${region} / ${city}` : `${city} (${region})`
}

const formatOffset = (date: Dayjs, zoneId: string) => {
  const offset = date.tz(zoneId).format('Z')
  return `UTC${offset}`
}

const formatDiff = (localNow: Dayjs, zoneId: string, t: ReturnType<typeof useTranslation>['t']) => {
  const diffHours = localNow.tz(zoneId).utcOffset() / 60 - localNow.utcOffset() / 60
  if (diffHours === 0) return t('app.social.time.same_as_local')
  const direction = diffHours > 0 ? '+' : ''
  return t('app.social.time.from_local', { hours: `${direction}${diffHours}` })
}

const formatLongDate = (date: Dayjs, language: string) =>
  new Intl.DateTimeFormat(language === 'cn' ? 'zh-CN' : 'en-US', {
    dateStyle: 'full'
  }).format(date.toDate())

const formatShortMonthDay = (date: Dayjs, language: string) =>
  new Intl.DateTimeFormat(language === 'cn' ? 'zh-CN' : 'en-US', {
    month: language === 'cn' ? 'numeric' : 'short',
    day: 'numeric'
  }).format(date.toDate())

const TimeClient = () => {
  const { i18n, t } = useTranslation()
  const [now, setNow] = useState<Dayjs | null>(null)
  const [localZone, setLocalZone] = useState('')
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<ZoneGroup>('all')

  React.useEffect(() => {
    setNow(dayjs())
    setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  useRafInterval(() => {
    setNow(dayjs())
  }, 1000)

  const localNow = now ?? dayjs('2000-01-01T00:00:00')
  const isReady = now !== null
  const secondsToday = localNow.hour() * 3600 + localNow.minute() * 60 + localNow.second()
  const dayProgress = (secondsToday / 86400) * 100
  const timezoneIds = useMemo(() => getSupportedTimezoneIds(), [])

  const zoneEntries = useMemo(() => {
    const entries: WorldZone[] = timezoneIds.map(zoneId => {
      const label = formatWorldTimezoneLabel(zoneId, i18n.language)

      return {
        group: getZoneGroup(zoneId),
        key: zoneId,
        label,
        searchable: `${label} ${zoneId}`.toLowerCase(),
        value: zoneId
      }
    })

    return entries.sort((a, b) => a.label.localeCompare(b.label))
  }, [i18n.language, timezoneIds])

  const groupOptions = useMemo(
    () =>
      groupOptionValues.map(value => ({
        value,
        label: t(`app.social.time.group.${value}`)
      })),
    [t]
  )

  const visibleZones = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return zoneEntries.filter(zone => {
      const matchesGroup = activeGroup === 'all' || zone.group === activeGroup
      if (!matchesGroup) return false
      if (!normalizedQuery) return true

      return zone.searchable.includes(normalizedQuery)
    })
  }, [activeGroup, query, zoneEntries])

  const localTime = isReady ? localNow.format('HH:mm:ss') : '--:--:--'
  const localDate = isReady
    ? formatLongDate(localNow, i18n.language)
    : t('app.social.time.loading_local')
  const utcTime = isReady ? localNow.utc().format('HH:mm:ss') : '--:--:--'
  const unixTime = isReady ? localNow.unix().toLocaleString() : '--'

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden pb-1">
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="glass-panel glass-accent-border glass-glow-primary glass-prism min-w-0 rounded-2xl p-5 sm:p-6">
          <div className="relative z-10 flex min-h-[290px] flex-col justify-between gap-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--primary-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t('app.social.time.local_time')}
                </div>
                <h2 className="text-base font-medium text-[var(--text-secondary)]">
                  {localZone || t('app.social.time.local_timezone')}
                </h2>
              </div>
              <div className="rounded-full border border-[var(--border-base)] bg-[var(--success-subtle)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                {t('app.social.time.live')}
              </div>
            </div>

            <div className="min-w-0">
              <div className="max-w-full overflow-hidden font-mono text-[clamp(2.65rem,8vw,6.75rem)] font-semibold leading-none tracking-normal text-[var(--text-primary)] tabular-nums">
                {localTime}
              </div>
              <div className="mt-4 text-sm text-[var(--text-secondary)] sm:text-base">
                {localDate}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricBlock label="UTC" value={utcTime} />
              <MetricBlock label="Unix" value={unixTime} />
              <MetricBlock
                label={t('app.social.time.offset')}
                value={isReady ? localNow.format('Z') : '--'}
              />
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5">
          <div className="glass-panel glass-prism min-w-0 rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {t('app.social.time.day_progress')}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {t('app.social.time.day_progress_hint')}
                </p>
              </div>
              <TimerReset className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            <div className="flex items-end gap-2">
              <span className="font-mono text-4xl font-semibold tabular-nums text-[var(--text-primary)]">
                {isReady ? dayProgress.toFixed(1) : '--'}
              </span>
              <span className="pb-1 text-sm text-[var(--text-secondary)]">%</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--glass-input-bg)]">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
                style={{ width: `${isReady ? dayProgress : 0}%` }}
              />
            </div>
          </div>

          <div className="glass-panel glass-prism min-w-0 rounded-2xl p-5">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('app.social.time.quick_groups')}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {groupOptions.map(group => (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => setActiveGroup(group.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    activeGroup === group.value
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                      : 'border-[var(--border-base)] bg-[var(--glass-input-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)]'
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {featuredZones.map(zone => {
          const zoneData = tzListMap[zone.key]
          const zoneNow = localNow.tz(zoneData.value)

          return (
            <div key={zone.key} className="glass-panel glass-prism min-w-0 rounded-2xl p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {t(`app.social.time.city.${zone.key}`)}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                    {formatOffset(localNow, zoneData.value)}
                  </div>
                </div>
                <Globe2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              </div>
              <div className="mt-5 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {isReady ? zoneNow.format('HH:mm') : '--:--'}
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {isReady
                  ? formatShortMonthDay(zoneNow, i18n.language)
                  : t('app.social.time.loading')}
              </div>
            </div>
          )
        })}
      </section>

      <section className="glass-panel glass-prism flex min-w-0 flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b border-[var(--glass-border)] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('app.social.time.timezone')}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t('app.social.time.zones_shown', { count: visibleZones.length })}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('app.social.time.search_placeholder')}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                setActiveGroup('all')
                setQuery('')
              }}
            >
              {t('app.social.time.reset')}
            </Button>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleZones.map(zone => {
              const zoneNow = localNow.tz(zone.value)

              return (
                <div
                  key={zone.key}
                  className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {zone.label}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                        {zone.value}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--primary-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                      {formatOffset(localNow, zone.value)}
                    </span>
                  </div>
                  <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0 overflow-hidden font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                      {isReady ? zoneNow.format('HH:mm:ss') : '--:--:--'}
                    </div>
                    <div className="min-w-0 shrink text-right text-xs text-[var(--text-secondary)]">
                      <div>{isReady ? zoneNow.format('YYYY-MM-DD') : '---- -- --'}</div>
                      <div className="mt-1">
                        {isReady ? formatDiff(localNow, zone.value, t) : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

const MetricBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
      {label}
    </div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
      {value}
    </div>
  </div>
)

export default TimeClient
