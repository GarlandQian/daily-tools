'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'glass-panel glass-panel-strong glass-popover w-[min(20rem,calc(100vw-2rem))] rounded-xl p-3 text-[var(--text-primary)]',
        className
      )}
      classNames={{
        root: 'relative',
        months: 'flex flex-col gap-4',
        month: 'space-y-3',
        month_caption: 'flex h-8 items-center justify-center px-10',
        caption_label: 'text-sm font-medium text-[var(--text-primary)]',
        nav: 'absolute inset-x-3 top-3 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100'
        ),
        chevron: 'h-4 w-4',
        month_grid: 'w-full table-fixed border-collapse',
        weekdays: 'border-0',
        weekday: 'h-9 w-9 pb-1 text-center text-xs font-medium text-[var(--text-tertiary)]',
        weeks: 'border-0',
        week: 'border-0',
        day: 'h-9 w-9 p-0 text-center align-middle text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 rounded-lg p-0 font-normal aria-selected:opacity-100'
        ),
        selected:
          '[&>button]:bg-[var(--primary)] [&>button]:text-white [&>button]:hover:bg-[var(--primary-hover)] [&>button]:hover:text-white [&>button]:focus:bg-[var(--primary)] [&>button]:focus:text-white',
        today: '[&>button]:bg-[var(--bg-muted)] [&>button]:text-[var(--text-primary)]',
        outside: '[&>button]:text-[var(--text-tertiary)] [&>button]:opacity-50',
        disabled: '[&>button]:text-[var(--text-tertiary)] [&>button]:opacity-40',
        hidden: 'invisible',
        range_end: 'day-range-end',
        range_middle: '[&>button]:bg-[var(--primary-subtle)] [&>button]:text-[var(--text-primary)]',
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', className)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', className)} />
          )
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
