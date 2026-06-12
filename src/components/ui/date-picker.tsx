'use client'

import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EN_MONTH_LABELS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2026, month, 1))
)
const padDatePart = (value: number) => String(value).padStart(2, '0')
const formatDateValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  fromYear?: number
  toYear?: number
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  fromYear,
  toYear
}: DatePickerProps) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()
  const currentYear = React.useMemo(() => new Date().getFullYear(), [])
  const minYear = fromYear ?? currentYear - 120
  const maxYear = toYear ?? currentYear + 10
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => value ?? new Date())
  const isChinese = i18n.language === 'cn'

  const years = React.useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [maxYear, minYear]
  )

  const monthOptions = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        label: isChinese ? `${month + 1}月` : EN_MONTH_LABELS[month],
        value: String(month)
      })),
    [isChinese]
  )

  const calendarBounds = React.useMemo(
    () => ({
      endMonth: new Date(maxYear, 11, 31),
      startMonth: new Date(minYear, 0, 1)
    }),
    [maxYear, minYear]
  )

  const updatePopoverPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const margin = 16
    const calendarWidth = Math.min(360, window.innerWidth - margin * 2)
    const calendarHeight = 468
    const left = Math.min(Math.max(rect.left, margin), window.innerWidth - calendarWidth - margin)
    const belowTop = rect.bottom + 8
    const aboveTop = rect.top - calendarHeight - 8
    const top =
      belowTop + calendarHeight > window.innerHeight - margin && aboveTop > margin
        ? aboveTop
        : belowTop

    setPopoverStyle({
      left,
      top: Math.max(margin, Math.min(top, window.innerHeight - margin - calendarHeight)),
      width: calendarWidth
    })
  }, [])

  React.useEffect(() => {
    if (open) {
      setDisplayMonth(value ?? new Date())
    }
  }, [open, value])

  const updateDisplayYear = (year: number) => {
    setDisplayMonth(current => new Date(year, current.getMonth(), 1))
  }

  const updateDisplayMonth = (month: number) => {
    setDisplayMonth(current => new Date(current.getFullYear(), month, 1))
  }

  const selectDate = (date: Date | undefined) => {
    onChange?.(date)
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return

    let animationFrame: number | null = null
    const schedulePopoverPosition = () => {
      if (animationFrame !== null) return
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null
        updatePopoverPosition()
      })
    }

    updatePopoverPosition()
    window.addEventListener('resize', schedulePopoverPosition, { passive: true })
    window.addEventListener('scroll', schedulePopoverPosition, { capture: true, passive: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      window.removeEventListener('resize', schedulePopoverPosition)
      window.removeEventListener('scroll', schedulePopoverPosition, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, updatePopoverPosition])

  const calendarPopover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
            <div className="fixed z-[1000] rounded-2xl bg-transparent" style={popoverStyle}>
              <div className="glass-panel glass-panel-strong glass-popover glass-clip max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl">
                <div className="grid gap-3 border-b border-[var(--border-subtle)] p-3.5 pb-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                    <Select
                      aria-label={isChinese ? '年份' : 'Year'}
                      value={String(displayMonth.getFullYear())}
                      onChange={event => updateDisplayYear(Number(event.target.value))}
                    >
                      {years.map(year => (
                        <option key={year} value={year}>
                          {isChinese ? `${year}年` : year}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label={isChinese ? '月份' : 'Month'}
                      value={String(displayMonth.getMonth())}
                      onChange={event => updateDisplayMonth(Number(event.target.value))}
                    >
                      {monthOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <Calendar
                  mode="single"
                  month={displayMonth}
                  onMonthChange={setDisplayMonth}
                  selected={value}
                  onSelect={selectDate}
                  startMonth={calendarBounds.startMonth}
                  endMonth={calendarBounds.endMonth}
                  initialFocus
                  classNames={{
                    month_caption: 'sr-only',
                    nav: 'hidden'
                  }}
                  className="w-full rounded-none bg-transparent"
                />
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] p-3.5 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onChange?.(undefined)
                      setOpen(false)
                    }}
                  >
                    {t('public.clear')}
                  </Button>
                  <Button type="button" size="sm" onClick={() => selectDate(new Date())}>
                    {t('public.today')}
                  </Button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )
      : null

  return (
    <div ref={triggerRef} className="relative">
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start text-left font-normal glass-input',
          !value && 'text-[var(--text-tertiary)]',
          className
        )}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? formatDateValue(value) : <span>{placeholder ?? t('public.pick_date')}</span>}
      </Button>
      {calendarPopover}
    </div>
  )
}
