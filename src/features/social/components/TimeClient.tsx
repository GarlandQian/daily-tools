'use client'

import { Clock3, Globe2, RotateCcw, Search, TimerReset } from 'lucide-react'
import React, { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tzListMap, type tzMap } from '@/const/timezone'
import { useVisibleNow } from '@/hooks/useVisibleNow'
import { cn } from '@/lib/utils'

import { formatInteger } from '../utils/formatters'

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

interface ZoneParts {
  day: number
  hour: number
  minute: number
  month: number
  second: number
  year: number
}

interface ZoneSnapshot {
  date: string
  offsetMinutes: number
  offsetText: string
  time: string
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
const MAX_VISIBLE_ZONES = 96
const TIME_SEARCH_LIMIT = 160

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

const regionLabels: Record<Exclude<ZoneGroup, 'all'>, { cn: string; en: string }> = {
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

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>()

const getLocale = (language: string) => (language === 'cn' ? 'zh-CN' : 'en-US')
const padTimePart = (value: number) => String(value).padStart(2, '0')

const getDateFormatter = (
  language: string,
  mode: 'fullDate' | 'zoneCalendarDate' | 'zhWeekday',
  zoneId?: string
) => {
  const locale = mode === 'zhWeekday' ? 'zh-CN' : getLocale(language)
  const key = `${locale}:${mode}:${zoneId ?? 'local'}`
  const cached = dateFormatterCache.get(key)

  if (cached) return cached

  const formatter = new Intl.DateTimeFormat(
    locale,
    mode === 'fullDate'
      ? { dateStyle: 'full' }
      : mode === 'zhWeekday'
        ? { timeZone: zoneId, weekday: 'short' }
        : {
            day: 'numeric',
            month: 'short',
            timeZone: zoneId,
            weekday: 'short'
          }
  )

  dateFormatterCache.set(key, formatter)
  return formatter
}

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
  return language === 'cn' ? regionLabels[group].cn : regionLabels[group].en
}

const formatWorldTimezoneLabel = (
  zoneId: string,
  group: Exclude<ZoneGroup, 'all'>,
  language: string
) => {
  const region = getRegionLabel(group, language)
  const city = zoneId.split('/').slice(1).join(' / ').replaceAll('_', ' ')

  if (!city) return region
  return language === 'cn' ? `${region} / ${city}` : `${city} (${region})`
}

const getZoneFormatter = (zoneId: string) => {
  const cached = timeZoneFormatterCache.get(zoneId)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: zoneId,
    year: 'numeric'
  })
  timeZoneFormatterCache.set(zoneId, formatter)
  return formatter
}

const getZoneParts = (milliseconds: number, zoneId: string): ZoneParts => {
  const values = Object.fromEntries(
    getZoneFormatter(zoneId)
      .formatToParts(new Date(milliseconds))
      .map(part => [part.type, part.value])
  )

  return {
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year)
  }
}

const getZoneOffsetMinutesFromParts = (milliseconds: number, parts: ZoneParts) => {
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return Math.round((zonedAsUtc - milliseconds) / 60000)
}

const getZoneOffsetMinutes = (milliseconds: number, zoneId: string) =>
  getZoneOffsetMinutesFromParts(milliseconds, getZoneParts(milliseconds, zoneId))

const formatOffsetMinutes = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60
  return `${sign}${padTimePart(hours)}:${padTimePart(minutes)}`
}

const formatZonePartsTime = (parts: ZoneParts, withSeconds = true) => {
  const time = `${padTimePart(parts.hour)}:${padTimePart(parts.minute)}`
  return withSeconds ? `${time}:${padTimePart(parts.second)}` : time
}

const formatZonePartsDate = (parts: ZoneParts) =>
  `${parts.year}-${padTimePart(parts.month)}-${padTimePart(parts.day)}`

const getZoneSnapshot = (milliseconds: number, zoneId: string): ZoneSnapshot => {
  const parts = getZoneParts(milliseconds, zoneId)
  const offsetMinutes = getZoneOffsetMinutesFromParts(milliseconds, parts)

  return {
    date: formatZonePartsDate(parts),
    offsetMinutes,
    offsetText: `UTC${formatOffsetMinutes(offsetMinutes)}`,
    time: formatZonePartsTime(parts)
  }
}

const formatOffset = (milliseconds: number, zoneId: string) => {
  const offset = formatOffsetMinutes(getZoneOffsetMinutes(milliseconds, zoneId))
  return `UTC${offset}`
}

const formatDiffFromOffsetMinutes = (
  milliseconds: number,
  offsetMinutes: number,
  labels: { fromLocal: (hours: string) => string; sameAsLocal: string }
) => {
  const localOffsetMinutes = -new Date(milliseconds).getTimezoneOffset()
  const diffHours = (offsetMinutes - localOffsetMinutes) / 60
  if (diffHours === 0) return labels.sameAsLocal
  const direction = diffHours > 0 ? '+' : ''
  return labels.fromLocal(`${direction}${diffHours}`)
}

const formatLongDate = (milliseconds: number, language: string) =>
  getDateFormatter(language, 'fullDate').format(new Date(milliseconds))

const formatZoneCalendarDate = (milliseconds: number, zoneId: string, language: string) => {
  if (language === 'cn') {
    const parts = getZoneParts(milliseconds, zoneId)
    const weekday = getDateFormatter(language, 'zhWeekday', zoneId).format(new Date(milliseconds))
    return `${parts.month}月${parts.day}日 ${weekday}`
  }

  return getDateFormatter(language, 'zoneCalendarDate', zoneId).format(new Date(milliseconds))
}

const formatRelativeDay = (
  milliseconds: number,
  zoneId: string,
  labels: { today: string; tomorrow: string; yesterday: string }
) => {
  const zoneParts = getZoneParts(milliseconds, zoneId)
  const localDate = new Date(milliseconds)
  const zoneDay = Date.UTC(zoneParts.year, zoneParts.month - 1, zoneParts.day)
  const localDay = Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate())
  const dayDiff = Math.round((zoneDay - localDay) / 86400000)
  if (dayDiff === -1) return labels.yesterday
  if (dayDiff === 1) return labels.tomorrow
  return labels.today
}

const formatLocalTime = (milliseconds: number) => {
  const date = new Date(milliseconds)
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`
}

const formatUtcTime = (milliseconds: number) => {
  const date = new Date(milliseconds)
  return `${padTimePart(date.getUTCHours())}:${padTimePart(date.getUTCMinutes())}:${padTimePart(date.getUTCSeconds())}`
}

const formatZoneTime = (milliseconds: number, zoneId: string, withSeconds = true) => {
  const parts = getZoneParts(milliseconds, zoneId)
  return formatZonePartsTime(parts, withSeconds)
}

const TimeClient = () => {
  const { i18n, t } = useTranslation()
  const now = useVisibleNow()
  const [localZone, setLocalZone] = useState('')
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<ZoneGroup>('all')
  const language = i18n.language

  React.useEffect(() => {
    setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  const deferredQuery = useDeferredValue(query)
  const sameAsLocalLabel = t('app.social.time.same_as_local')
  const relativeDayLabels = useMemo(
    () => ({
      today: t('app.social.time.date.today'),
      tomorrow: t('app.social.time.date.tomorrow'),
      yesterday: t('app.social.time.date.yesterday')
    }),
    [t]
  )
  const fromLocalLabel = React.useCallback(
    (hours: string) => t('app.social.time.from_local', { hours }),
    [t]
  )
  const isReady = now > 0
  const localDate = useMemo(() => (isReady ? new Date(now) : null), [isReady, now])
  const secondsToday = localDate
    ? localDate.getHours() * 3600 + localDate.getMinutes() * 60 + localDate.getSeconds()
    : 0
  const dayProgress = (secondsToday / 86400) * 100
  const timezoneIds = useMemo(() => getSupportedTimezoneIds(), [])

  const zoneEntries = useMemo(() => {
    const entries: WorldZone[] = timezoneIds.map(zoneId => {
      const group = getZoneGroup(zoneId)
      const label = formatWorldTimezoneLabel(zoneId, group, language)

      return {
        group,
        key: zoneId,
        label,
        searchable: `${label} ${zoneId}`.toLowerCase(),
        value: zoneId
      }
    })

    return entries.sort((a, b) => a.label.localeCompare(b.label))
  }, [language, timezoneIds])

  const groupOptions = useMemo(
    () =>
      groupOptionValues.map(value => ({
        value,
        label: t(`app.social.time.group.${value}`)
      })),
    [t]
  )

  const filteredZones = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return zoneEntries.filter(zone => {
      const matchesGroup = activeGroup === 'all' || zone.group === activeGroup
      if (!matchesGroup) return false
      if (!normalizedQuery) return true

      return zone.searchable.includes(normalizedQuery)
    })
  }, [activeGroup, deferredQuery, zoneEntries])

  const visibleZones = useMemo(() => filteredZones.slice(0, MAX_VISIBLE_ZONES), [filteredZones])
  const zoneCountLabel =
    filteredZones.length > visibleZones.length
      ? t('app.social.time.zones_shown_limited', {
          count: visibleZones.length,
          total: filteredZones.length
        })
      : t('app.social.time.zones_shown', { count: visibleZones.length })

  const localTime = isReady ? formatLocalTime(now) : '--:--:--'
  const localDateLabel = isReady
    ? formatLongDate(now, language)
    : t('app.social.time.loading_local')
  const utcTime = isReady ? formatUtcTime(now) : '--:--:--'
  const unixTime = isReady ? formatInteger(Math.floor(now / 1000), language) : '--'

  const visibleZoneCards = useMemo(
    () =>
      visibleZones.map(zone => (
        <WorldZoneCard
          key={zone.key}
          fromLocalLabel={fromLocalLabel}
          sameAsLocalLabel={sameAsLocalLabel}
          zone={zone}
        />
      )),
    [fromLocalLabel, sameAsLocalLabel, visibleZones]
  )

  return (
    <div className="time-dashboard flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden pb-5 sm:gap-7 sm:pb-6">
      <section className="time-overview-grid grid min-w-0 grid-cols-1 gap-6 sm:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:gap-7">
        <div className="time-glass-surface time-glass-hero glass-panel glass-accent-border glass-glow-primary glass-prism min-w-0 rounded-2xl p-5 sm:p-6">
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
                {localDateLabel}
              </div>
            </div>

            <div className="time-metrics-grid grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricBlock label="UTC" value={utcTime} />
              <MetricBlock label="Unix" value={unixTime} />
              <MetricBlock
                label={t('app.social.time.offset')}
                value={isReady ? formatOffsetMinutes(-new Date(now).getTimezoneOffset()) : '--'}
              />
            </div>
          </div>
        </div>

        <div className="time-side-stack grid min-w-0 grid-cols-1 gap-6 sm:gap-6">
          <div className="time-glass-surface time-glass-control time-glass-progress glass-panel glass-prism min-w-0 rounded-2xl p-5">
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
            <div className="time-progress-track mt-5 h-2 overflow-hidden rounded-full">
              <div
                className="time-progress-fill h-full rounded-full transition-[width] duration-300"
                style={{ width: `${isReady ? dayProgress : 0}%` }}
              />
            </div>
          </div>

          <div className="time-glass-surface time-glass-control time-glass-groups glass-panel glass-prism min-w-0 rounded-2xl p-5">
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
                    'time-group-chip rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    activeGroup === group.value
                      ? 'time-group-chip-active border-[var(--primary)] bg-[var(--primary)] text-white'
                      : 'border-[var(--border-base)] text-[var(--text-secondary)]'
                  )}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="time-featured-grid grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
        {featuredZones.map(zone => {
          const zoneData = tzListMap[zone.key]
          const relativeDay = isReady
            ? formatRelativeDay(now, zoneData.value, relativeDayLabels)
            : relativeDayLabels.today

          return (
            <div
              key={zone.key}
              className="time-glass-surface time-glass-card glass-panel glass-panel-static glass-prism min-w-0 rounded-2xl p-4"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">
                    {t(`app.social.time.city.${zone.key}`)}
                  </div>
                  <div className="mt-1 truncate text-xs font-medium text-[var(--text-secondary)]">
                    {isReady ? formatOffset(now, zoneData.value) : 'UTC--:--'}
                  </div>
                </div>
                <Globe2 className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              </div>
              <div className="mt-5 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {isReady ? formatZoneTime(now, zoneData.value, false) : '--:--'}
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                {isReady ? (
                  <>
                    <span className="rounded-full border border-[var(--border-base)] bg-[var(--surface-subtle)] px-2 py-0.5 font-medium text-[var(--text-primary)]">
                      {relativeDay}
                    </span>
                    <span className="truncate">
                      {formatZoneCalendarDate(now, zoneData.value, language)}
                    </span>
                  </>
                ) : (
                  t('app.social.time.loading')
                )}
              </div>
            </div>
          )
        })}
      </section>

      <section className="time-glass-surface time-zone-shell glass-panel glass-panel-static glass-prism flex min-w-0 flex-col overflow-hidden rounded-2xl">
        <div className="time-zone-shell-header flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('app.social.time.timezone')}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{zoneCountLabel}</p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value.slice(0, TIME_SEARCH_LIMIT))}
                placeholder={t('app.social.time.search_placeholder')}
                maxLength={TIME_SEARCH_LIMIT}
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
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleZoneCards}
          </div>
        </div>
      </section>
    </div>
  )
}

const MetricBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="time-glass-inset rounded-xl p-3">
    <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
      {label}
    </div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)] tabular-nums">
      {value}
    </div>
  </div>
)

const useNearViewport = <T extends HTMLElement>() => {
  const ref = React.useRef<T | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        setIsNearViewport(entries.some(entry => entry.isIntersecting))
      },
      { rootMargin: '320px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, isNearViewport] as const
}

const WorldZoneCard = React.memo(
  ({
    fromLocalLabel,
    sameAsLocalLabel,
    zone
  }: {
    fromLocalLabel: (hours: string) => string
    sameAsLocalLabel: string
    zone: WorldZone
  }) => {
    const [cardRef, isNearViewport] = useNearViewport<HTMLDivElement>()
    const now = useVisibleNow(isNearViewport)
    const zoneSnapshot = useMemo(
      () => (now > 0 ? getZoneSnapshot(now, zone.value) : null),
      [now, zone.value]
    )

    return (
      <div
        ref={cardRef}
        className="time-zone-card min-w-0 rounded-xl p-4 [contain-intrinsic-size:112px] [content-visibility:auto]"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-6 text-[var(--text-primary)]">
              {zone.label}
            </div>
            <div className="mt-1 truncate text-[13px] font-medium text-[var(--text-secondary)]">
              {zone.value}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border-base)] bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
            {zoneSnapshot ? zoneSnapshot.offsetText : 'UTC--:--'}
          </span>
        </div>
        <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0 overflow-hidden font-mono text-3xl font-semibold leading-none tabular-nums text-[var(--text-primary)]">
            {zoneSnapshot ? zoneSnapshot.time : '--:--:--'}
          </div>
          <div className="min-w-0 shrink text-right text-[13px] font-medium leading-5">
            <div className="text-[var(--text-primary)]">
              {zoneSnapshot ? zoneSnapshot.date : '---- -- --'}
            </div>
            <div className="mt-0.5 text-[var(--text-secondary)]">
              {zoneSnapshot
                ? formatDiffFromOffsetMinutes(now, zoneSnapshot.offsetMinutes, {
                    fromLocal: fromLocalLabel,
                    sameAsLocal: sameAsLocalLabel
                  })
                : '--'}
            </div>
          </div>
        </div>
      </div>
    )
  },
  (previous, next) =>
    previous.fromLocalLabel === next.fromLocalLabel &&
    previous.sameAsLocalLabel === next.sameAsLocalLabel &&
    previous.zone === next.zone
)

WorldZoneCard.displayName = 'WorldZoneCard'

export default TimeClient
