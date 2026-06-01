import * as React from 'react'

import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <label
        className={cn('flex min-h-10 items-center gap-2.5 cursor-pointer select-none', className)}
      >
        <input
          ref={ref}
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--border-base)] bg-[var(--glass-input-bg)] text-[var(--primary)] accent-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 cursor-pointer"
          {...props}
        />
        {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
        {children}
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
