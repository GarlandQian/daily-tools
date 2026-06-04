'use client'

import dayjs from 'dayjs'
import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({ value, onChange, placeholder, disabled, className }: DatePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>()

  const updatePopoverPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const margin = 16
    const calendarWidth = Math.min(320, window.innerWidth - margin * 2)
    const calendarHeight = 344
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
    if (!open) return

    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, updatePopoverPosition])

  const calendarPopover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
            <div className="fixed z-[1000] rounded-2xl bg-transparent" style={popoverStyle}>
              <div className="glass-clip max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl">
                <Calendar
                  mode="single"
                  selected={value}
                  onSelect={date => {
                    onChange?.(date)
                    setOpen(false)
                  }}
                  initialFocus
                />
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
        {value ? (
          dayjs(value).format('YYYY-MM-DD')
        ) : (
          <span>{placeholder ?? t('public.pick_date')}</span>
        )}
      </Button>
      {calendarPopover}
    </div>
  )
}
