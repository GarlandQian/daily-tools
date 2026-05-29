'use client'

import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="relative">
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
        {value ? format(value, 'PPP') : <span>{placeholder}</span>}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-2 left-0">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange?.(date)
                setOpen(false)
              }}
              initialFocus
            />
          </div>
        </>
      )}
    </div>
  )
}
