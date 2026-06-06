'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ColorPickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  value: string
  onChange: (value: string) => void
  showValue?: boolean
}

const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ className, value, onChange, showValue = true, disabled, ...props }, ref) => {
    return (
      <div
        className={cn(
          'glass-color-picker glass-panel glass-panel-static glass-shimmer glass-clip relative flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl px-3',
          'focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <input
          {...props}
          ref={ref}
          type="color"
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          className="h-7 w-7 shrink-0 rounded-xl border border-[var(--glass-border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_rgba(0,0,0,0.16)]"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        {showValue && (
          <span className="min-w-[7ch] shrink-0 text-right font-mono text-sm font-semibold uppercase tracking-normal text-[var(--text-primary)] tabular-nums">
            {value}
          </span>
        )}
      </div>
    )
  }
)
ColorPicker.displayName = 'ColorPicker'

export { ColorPicker }
